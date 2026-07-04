const { Client } = require('pg');
const devDbUrl = "postgresql://postgres:Rapido221196.@db.ibcevxzxfzszrmejekqd.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString: devDbUrl });
  await client.connect();
  const res = await client.query('SELECT * FROM public.factura_productos LIMIT 1');
  if (res.rows.length > 0) {
    console.log("Keys in Development: ", Object.keys(res.rows[0]));
    console.log("Sample Row in Development: ", res.rows[0]);
  } else {
    console.log("No rows found in Development factura_productos");
  }
  await client.end();
}

run().catch(console.error);
