const { Client } = require('pg');

const regions = [
  'aws-0-us-east-1.pooler.supabase.com',
  'aws-0-us-east-2.pooler.supabase.com',
  'aws-0-us-west-1.pooler.supabase.com',
  'aws-0-us-west-2.pooler.supabase.com',
  'aws-0-ca-central-1.pooler.supabase.com',
  'aws-0-sa-east-1.pooler.supabase.com',
];

async function testHost(host) {
  const url = `postgresql://postgres.ibcevxzxfzszrmejekqd:Rapido221196.@${host}:5432/postgres`;
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log(`SUCCESS ON HOST: ${host}`);
    const countRes = await client.query('SELECT COUNT(*) FROM public.productos');
    console.log(`Count: ${countRes.rows[0].count}`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`Failed for ${host}: ${err.message}`);
    return false;
  }
}

async function run() {
  for (const host of regions) {
    const ok = await testHost(host);
    if (ok) break;
  }
}

run();
