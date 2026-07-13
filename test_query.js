const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:Mapache221196.@db.xfvzqzaggagxwgpjlydr.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'conteo_diario';")
  .then(res => { console.log(res.rows); pool.end(); })
  .catch(e => { console.error(e); pool.end(); });
