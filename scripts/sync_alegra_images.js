const { Client } = require('pg');

const devDbUrl = "postgresql://postgres.ibcevxzxfzszrmejekqd:Rapido221196.@aws-0-us-west-2.pooler.supabase.com:5432/postgres";
const prodDbUrl = "postgresql://postgres:B9124853d8.90@db.lmiymbdnqkvppaalgayr.supabase.co:5432/postgres";

const email = "arthromedpruebas@gmail.com";
const token = "cc9dd0421b039a4867a5";
const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

async function fetchAllAlegraItems() {
  console.log("Fetching items from Alegra...");
  let offset = 0;
  const items = [];
  let page = 0;
  while (page < 100) { // Limit to 100 pages (3000 items) max for safety
    console.log(`Fetching items from Alegra offset: ${offset}...`);
    const res = await fetch(`https://api.alegra.com/api/v1/items?limit=30&offset=${offset}`, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json'
      }
    });
    if (!res.ok) {
      console.error(`Error fetching Alegra items at offset ${offset}:`, res.status, await res.text());
      break;
    }
    const data = await res.json();
    console.log(`Retrieved ${data.length} items.`);
    if (!data || data.length === 0) break;
    items.push(...data);
    offset += 30;
    page++;
    // Small delay to prevent hitting rate limits too hard
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.log(`Successfully fetched ${items.length} items from Alegra.`);
  return items;
}

async function updateDbImages(name, url, alegraItems) {
  console.log(`Connecting to ${name} database...`);
  const client = new Client({ 
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log(`Connected to ${name}. Processing updates...`);

    const columnsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'productos'
    `);
    const cols = new Set(columnsRes.rows.map(r => r.column_name));

    let updatedCount = 0;
    for (const item of alegraItems) {
      const images = item.images || [];
      if (images.length === 0) continue;

      const imageUrls = images.map(img => img.url).filter(Boolean);
      if (imageUrls.length === 0) continue;

      let res = null;

      // 1. Match by ID
      if (cols.has('alegra_id') || cols.has('id_alegra')) {
        const whereClauses = [];
        const params = [imageUrls, String(item.id)];
        if (cols.has('alegra_id')) whereClauses.push('alegra_id = $2');
        if (cols.has('id_alegra')) whereClauses.push('id_alegra = $2');
        
        let setClause = 'image_urls = $1';
        if (cols.has('alegra_id')) setClause += ', alegra_id = $2';
        if (cols.has('id_alegra')) setClause += ', id_alegra = $2';

        res = await client.query(`
          UPDATE public.productos 
          SET ${setClause}
          WHERE ${whereClauses.join(' OR ')}
          RETURNING id, nombre_lista
        `, params);
      }

      // 2. Fallback matching by SKU
      if ((!res || res.rowCount === 0) && item.reference) {
        const skuClauses = [];
        const params = [imageUrls, String(item.id), String(item.reference)];
        if (cols.has('consecutivo_alg')) skuClauses.push('consecutivo_alg = $3');
        if (cols.has('order_code')) skuClauses.push('order_code = $3');
        
        if (skuClauses.length > 0) {
          let setClause = 'image_urls = $1';
          if (cols.has('alegra_id')) setClause += ', alegra_id = $2';
          if (cols.has('id_alegra')) setClause += ', id_alegra = $2';

          res = await client.query(`
            UPDATE public.productos 
            SET ${setClause}
            WHERE ${skuClauses.join(' OR ')}
            RETURNING id, nombre_lista
          `, params);
        }
      }

      // 3. Fallback matching by Name
      if (!res || res.rowCount === 0) {
        const nameClauses = [];
        const params = [imageUrls, String(item.id), String(item.name)];
        if (cols.has('nombre_lista')) nameClauses.push('nombre_lista = $3');
        if (cols.has('nombre')) nameClauses.push('nombre = $3');

        if (nameClauses.length > 0) {
          let setClause = 'image_urls = $1';
          if (cols.has('alegra_id')) setClause += ', alegra_id = $2';
          if (cols.has('id_alegra')) setClause += ', id_alegra = $2';

          res = await client.query(`
            UPDATE public.productos 
            SET ${setClause}
            WHERE ${nameClauses.join(' OR ')}
            RETURNING id, nombre_lista
          `, params);
        }
      }

      if (res && res.rowCount > 0) {
        updatedCount += res.rowCount;
      }
    }
    console.log(`${name} update finished: ${updatedCount} products updated.`);
  } catch (error) {
    console.error(`Error updating ${name}:`, error);
  } finally {
    await client.end();
  }
}

async function run() {
  try {
    const items = await fetchAllAlegraItems();
    
    // Run update on dev
    await updateDbImages('Development', devDbUrl, items);
    
    // Run update on prod
    await updateDbImages('Production', prodDbUrl, items);
    
    console.log("Image synchronization completed.");
  } catch (error) {
    console.error("Synchronization failed:", error);
  }
}

run();
