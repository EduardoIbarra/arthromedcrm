import { PrismaClient } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL
  
  if (!connectionString) {
    console.warn('Warning: DATABASE_URL is not defined. Prisma will fail at runtime.')
    return new Proxy({}, {
      get: (target, prop) => {
        if (prop === 'then') return undefined
        throw new Error(`Prisma was initialized without DATABASE_URL. Property "${String(prop)}" cannot be accessed. Check your Vercel Environment Variables.`)
      }
    }) as any
  }

  // Strip conflicting SSL query params from connection string so options.ssl is respected by node-postgres Pool
  let cleanUrl = connectionString
  try {
    const parsedUrl = new URL(connectionString)
    parsedUrl.searchParams.delete('sslmode')
    parsedUrl.searchParams.delete('sslaccept')
    parsedUrl.searchParams.delete('sslcert')
    parsedUrl.searchParams.delete('sslkey')
    parsedUrl.searchParams.delete('sslrootcert')
    cleanUrl = parsedUrl.toString()
  } catch (e) {
    console.warn('Warning: Failed to parse connectionString as URL, using raw string.', e)
  }

  const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } })
  const adapter = new PrismaPg(pool)
  
  return new PrismaClient({
    adapter,
    log: ['error', 'warn']
  })
}

const TRIGGER_VERSION = 11

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
  var prismaTriggerVersion: number | undefined
}

const hasUpdates = globalThis.prisma && 
  ('ticket_updates' in globalThis.prisma) && 
  ('landing_pages' in globalThis.prisma) &&
  ('car_fleet' in globalThis.prisma) &&
  ('directorio_categorias' in globalThis.prisma) &&
  ('purchase_orders' in globalThis.prisma) &&
  globalThis.prismaTriggerVersion === TRIGGER_VERSION

const prisma = hasUpdates ? globalThis.prisma! : prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
  globalThis.prismaTriggerVersion = TRIGGER_VERSION
}
