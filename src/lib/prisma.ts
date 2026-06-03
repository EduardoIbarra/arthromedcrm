import { PrismaClient } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL
  
  if (!connectionString) {
    console.warn('Warning: DATABASE_URL is not defined. Prisma will fail at runtime.')
    return new Proxy({}, {
      get: (target, prop) => {
        if (prop === 'then') return undefined
        throw new Error(`Prisma was initialized without DATABASE_URL. Property "${String(prop)}" cannot be accessed. Check your Vercel Environment Variables.`)
      }
    }) as any
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  
  return new PrismaClient({
    adapter,
    log: ['error', 'warn']
  })
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const hasUpdates = globalThis.prisma && ('ticket_updates' in globalThis.prisma)
const prisma = hasUpdates ? globalThis.prisma! : prismaClientSingleton()

export default prisma

// Hot reload trigger: 3

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
