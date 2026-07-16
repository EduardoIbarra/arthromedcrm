process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const DEV_URL = "postgresql://postgres:B9124853d8.90@db.zdvkatyzqgbeewtbuyfu.supabase.co:5432/postgres?sslmode=require";

async function run() {
  const client = new Client({ connectionString: DEV_URL });
  await client.connect();
  
  const res = await client.query(`
    SELECT policyname, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename = 'clientes';
  `);
  console.log("Policies for 'clientes':", res.rows);
  
  const resRls = await client.query(`
    SELECT relrowsecurity 
    FROM pg_class 
    WHERE relname = 'clientes';
  `);
  console.log("RLS enabled for 'clientes':", resRls.rows[0]?.relrowsecurity);
  
  await client.end();
}

run().catch(console.error);
