const { Client } = require('pg');
const devDbUrl = "postgresql://postgres:Rapido221196.@db.ibcevxzxfzszrmejekqd.supabase.co:5432/postgres";
const prodDbUrl = "postgresql://postgres:B9124853d8.90@db.lmiymbdnqkvppaalgayr.supabase.co:5432/postgres";

async function findGuid(dbName, url, guid) {
  const client = new Client({ connectionString: url });
  await client.connect();
  const res = await client.query('SELECT * FROM public.factura_productos WHERE id = $1', [guid]);
  console.log(`${dbName} has GUID ${guid}:`, res.rows.length > 0 ? "YES" : "NO");
  if (res.rows.length > 0) {
    console.log(res.rows[0]);
  }
  await client.end();
}

async function run() {
  const sampleGuid = '5fb8abf3-39bf-41c7-a0e4-3de3c2b54362';
  await findGuid('Development', devDbUrl, sampleGuid);
  await findGuid('Production', prodDbUrl, sampleGuid);
}

run().catch(console.error);
