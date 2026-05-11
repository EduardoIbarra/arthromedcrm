const { Client } = require('pg');

async function testPassword(password) {
  const client = new Client({
    connectionString: `postgresql://postgres:${password}@db.ibcevxzxfzszrmejekqd.supabase.co:5432/postgres`,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    console.log(`Success with: ${password}`);
    const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    console.log(res.rows);
    await client.end();
    return true;
  } catch (err) {
    console.log(`Failed with: ${password} - ${err.message}`);
    return false;
  }
}

async function run() {
  const passwords = ["rapido13", "rapido221196", "rápido221196", "Rapido13"];
  for (const p of passwords) {
    const success = await testPassword(p);
    if (success) break;
  }
}

run();
