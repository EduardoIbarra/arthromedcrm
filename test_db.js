const { Client } = require('pg');
const dns = require('dns');

dns.lookup('db.xfvzqzaggagxwgpjlydr.supabase.co', 4, (err, address) => {
  if (err) { console.error(err); return; }
  const client = new Client({
    connectionString: `postgresql://postgres:Mapache221196.@${address}:5432/postgres`,
    ssl: { rejectUnauthorized: false }
  });
  client.connect().then(() => {
    return client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'conteo_diario';");
  }).then(res => {
    console.log(res.rows);
    client.end();
  }).catch(e => {
    console.error(e);
    client.end();
  });
});
