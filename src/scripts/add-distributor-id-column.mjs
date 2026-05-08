// Run this script to add the distributor_id column via Supabase REST API
// Usage: node src/scripts/migrate-distributor-id.mjs

const SUPABASE_URL = 'https://vogpviplsmupegohvbtl.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZ3B2aXBsc211cGVnb2h2YnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1Mzk0NTQsImV4cCI6MjA5MzExNTQ1NH0.Q0i5LfKFcKbBzqPuP6oXNq7R7c4sBkhwMCSB8WSwFoI'

async function main() {
  // We need to add the column. With anon key we can't run DDL.
  // Let's check if a service role key is available
  console.log('')
  console.log('=== Distributor ID Migration ===')
  console.log('')
  console.log('Please run this SQL in your Supabase dashboard SQL Editor:')
  console.log('(https://supabase.com/dashboard/project/vogpviplsmupegohvbtl/sql/new)')
  console.log('')
  console.log('--- SQL START ---')
  console.log(`
ALTER TABLE clients ADD COLUMN IF NOT EXISTS distributor_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_clients_distributor_id ON clients (distributor_id);
  `.trim())
  console.log('--- SQL END ---')
  console.log('')
  console.log('After running the SQL, call this endpoint to assign IDs to existing distributors:')
  console.log('POST http://localhost:3002/api/distributors/assign-ids')
  console.log('')
}

main()
