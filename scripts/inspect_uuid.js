const { Client } = require('pg');
const prodDbUrl = "postgresql://postgres:B9124853d8.90@db.lmiymbdnqkvppaalgayr.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString: prodDbUrl });
  await client.connect();
  
  const sampleGuid = '5fb8abf3-39bf-41c7-a0e4-3de3c2b54362';
  console.log(`Searching for UUID ${sampleGuid} across all tables in production...`);
  
  // Get all tables
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  
  for (const row of tablesRes.rows) {
    const tableName = row.table_name;
    // Get columns of type uuid
    const colsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1 AND data_type = 'uuid'
    `, [tableName]);
    
    for (const colRow of colsRes.rows) {
      const colName = colRow.column_name;
      try {
        const checkRes = await client.query(`SELECT * FROM public."${tableName}" WHERE "${colName}" = $1`, [sampleGuid]);
        if (checkRes.rows.length > 0) {
          console.log(`FOUND in table: ${tableName}, column: ${colName}`);
          console.log(checkRes.rows[0]);
        }
      } catch (err) {
        // ignore errors like permission or missing columns
      }
    }
  }
  
  await client.end();
}

run().catch(console.error);
