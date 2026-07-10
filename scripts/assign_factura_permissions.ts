import { Client } from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const DB_URL = process.env.DATABASE_URL

if (!DB_URL) throw new Error('DATABASE_URL is required')

async function main() {
  console.log(`Starting Permissions Assignment...`)
  console.log(`DB: ${DB_URL.split('@')[1]}`)
  console.log('--------------------------------------------------')

  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    const emails = ['eduardoi.delacruz@arthromed.com.mx', 'eduardo@arthromed.com.mx']
    
    // Find users by email
    for (const email of emails) {
      const res = await client.query(`SELECT id, permissions FROM user_profiles WHERE email = $1`, [email])
      if (res.rows.length === 0) {
        console.log(`User profile for ${email} not found. Skipping.`)
        continue
      }
      
      const profile = res.rows[0]
      const permissions = profile.permissions || {}
      
      const newPermissions = {
        ...permissions,
        facturas: ['view', 'create', 'edit', 'delete', 'timbrar', 'cancelar', 'manage_payments']
      }
      
      await client.query(`UPDATE user_profiles SET permissions = $1 WHERE id = $2`, [JSON.stringify(newPermissions), profile.id])
      console.log(`✅ Permissions updated successfully for ${email}.`)
    }
  } catch (err) {
    console.error('Error updating permissions:', err)
  } finally {
    await client.end()
    console.log('--------------------------------------------------')
    console.log('Done.')
  }
}

main()
