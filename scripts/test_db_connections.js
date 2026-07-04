const { Client } = require('pg');

const devDbUrl = "postgresql://postgres:Rapido221196.@db.ibcevxzxfzszrmejekqd.supabase.co:5432/postgres";
const prodDbUrl = "postgresql://postgres:B9124853d8.90@db.lmiymbdnqkvppaalgayr.supabase.co:5432/postgres";

async function checkDb(name, url) {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const countRes = await client.query('SELECT COUNT(*) FROM public.facturas_cliente');
    const prodCountRes = await client.query('SELECT COUNT(*) FROM public.factura_productos');
    console.log(`${name} database:`);
    console.log(`  - connection: OK`);
    console.log(`  - facturas_cliente count: ${countRes.rows[0].count}`);
    console.log(`  - factura_productos count: ${prodCountRes.rows[0].count}`);
    await client.end();
  } catch (error) {
    console.error(`Error connecting to ${name}:`, error.message);
  }
}

async function run() {
  await checkDb('Development (Supabase project ibcevxzxfzszrmejekqd)', devDbUrl);
  await checkDb('Production (Supabase project lmiymbdnqkvppaalgayr)', prodDbUrl);
}

run();
