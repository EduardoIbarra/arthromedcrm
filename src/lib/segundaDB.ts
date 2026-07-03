import { Pool } from 'pg'

/**
 * Executes a query against the second Supabase database (compras/productos).
 * Creates a fresh pool per call (safe for serverless environments).
 */
export async function querySegundaDB<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const connectionString = process.env.SEGUNDA_DB_URL ||
    'postgresql://postgres:Mapache221196.@db.xfvzqzaggagxwgpjlydr.supabase.co:5432/postgres'

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 30000,
  })

  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return result.rows as T[]
  } finally {
    client.release()
    await pool.end()
  }
}
