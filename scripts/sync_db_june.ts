import { Client } from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Configuration
const SOURCE_URL = process.env.SEGUNDA_DB_URL
const DEST_URL = process.env.TARGET_DB_URL || process.env.DATABASE_URL
const CUTOFF_DATE = '2026-07-01T00:00:00.000Z'
const END_DATE = '2026-07-10T00:00:00.000Z'
const DRY_RUN = process.argv.includes('--dry-run')

if (!SOURCE_URL) throw new Error('SEGUNDA_DB_URL is required')
if (!DEST_URL) throw new Error('Target DB URL is required')

async function main() {
  console.log(`Starting DB Sync...`)
  console.log(`Source DB: ${SOURCE_URL.split('@')[1]}`)
  console.log(`Dest DB:   ${DEST_URL.split('@')[1]}`)
  console.log(`Mode:      ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`)
  console.log(`Cutoff:    ${CUTOFF_DATE} to ${END_DATE}`)
  console.log('--------------------------------------------------')

  const sourceClient = new Client({ connectionString: SOURCE_URL, ssl: { rejectUnauthorized: false } })
  const destClient = new Client({ connectionString: DEST_URL, ssl: { rejectUnauthorized: false } })

  await sourceClient.connect()
  await destClient.connect()

  try {
    // 1. Get all public tables
    const resTables = await sourceClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    `)
    const tables = resTables.rows.map(r => r.table_name)
    console.log(`Found ${tables.length} tables in public schema.`)

    for (const table of tables) {
      console.log(`\nProcessing table: ${table}...`)

      // 2. Compare Schema and Add Missing Columns
      const sourceColsRes = await sourceClient.query(`
        SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [table])
      const sourceCols = sourceColsRes.rows

      const destColsRes = await destClient.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [table])
      const destColNames = new Set(destColsRes.rows.map(r => r.column_name))

      if (destColNames.size === 0) {
        console.log(`  Table ${table} does not exist in destination! Skipping (table creation not supported dynamically).`)
        continue
      }

      for (const col of sourceCols) {
        if (!destColNames.has(col.column_name)) {
          let typeStr = col.data_type
          if (col.character_maximum_length) typeStr += `(${col.character_maximum_length})`

          const alterCmd = `ALTER TABLE "${table}" ADD COLUMN "${col.column_name}" ${typeStr}`
          console.log(`  [SCHEMA] ${alterCmd}`)
          if (!DRY_RUN) {
            await destClient.query(alterCmd)
          }
        }
      }

      // 3. Check if table has updated_at or created_at or id
      const hasId = sourceCols.some(c => c.column_name === 'id')
      if (!hasId) {
        console.log(`  Skipping data sync for ${table} (No 'id' column found)`)
        continue
      }

      const hasCreatedAt = sourceCols.some(c => c.column_name === 'created_at')
      const hasUpdatedAt = sourceCols.some(c => c.column_name === 'updated_at')

      let dateFilter = ''
      if (hasUpdatedAt && hasCreatedAt) {
        dateFilter = `WHERE (updated_at >= '${CUTOFF_DATE}' AND updated_at <= '${END_DATE}') OR (created_at >= '${CUTOFF_DATE}' AND created_at <= '${END_DATE}')`
      } else if (hasUpdatedAt) {
        dateFilter = `WHERE updated_at >= '${CUTOFF_DATE}' AND updated_at <= '${END_DATE}'`
      } else if (hasCreatedAt) {
        dateFilter = `WHERE created_at >= '${CUTOFF_DATE}' AND created_at <= '${END_DATE}'`
      }

      // If there's no date column, we might skip or sync all. We'll skip for safety.
      if (!dateFilter) {
        console.log(`  Skipping data sync for ${table} (No created_at/updated_at columns)`)
        continue
      }

      // 4. Fetch modified rows
      const dataRes = await sourceClient.query(`SELECT * FROM "${table}" ${dateFilter}`)
      const rows = dataRes.rows

      if (rows.length === 0) {
        console.log(`  No new/modified rows since ${CUTOFF_DATE}.`)
        continue
      }
      console.log(`  Found ${rows.length} rows to sync.`)

      // 5. Upsert rows
      let inserted = 0
      for (const row of rows) {
        const keys = Object.keys(row)
        const values = Object.values(row)

        const colNames = keys.map(k => `"${k}"`).join(', ')
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')

        const updateSet = keys
          .filter(k => k !== 'id')
          .map(k => `"${k}" = EXCLUDED."${k}"`)
          .join(', ')

        let upsertQuery = `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders})`

        if (updateSet.length > 0) {
          upsertQuery += ` ON CONFLICT ("id") DO UPDATE SET ${updateSet}`
        } else {
          upsertQuery += ` ON CONFLICT ("id") DO NOTHING` // No columns to update
        }

        try {
          if (!DRY_RUN) {
            await destClient.query(upsertQuery, values)
          }
          inserted++
        } catch (err: any) {
          console.error(`  [ERROR] Failed to upsert row id=${row.id} in ${table}:`, err.message)
        }
      }
      console.log(`  Successfully synced ${inserted} rows.`)
    }

    console.log('\n✅ Sync completed successfully.')
  } catch (error) {
    console.error('❌ Migration failed:', error)
  } finally {
    await sourceClient.end()
    await destClient.end()
  }
}

main()
