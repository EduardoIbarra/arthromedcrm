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

// ── Second Database Client ─────────────────────────────────
const prismaClientSingletonSegunda = () => {
  const connectionString = process.env.SEGUNDA_DB_URL ||
    'postgresql://postgres:Mapache221196.@db.xfvzqzaggagxwgpjlydr.supabase.co:5432/postgres'
  
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

declare global {
  var prismaSegunda: undefined | ReturnType<typeof prismaClientSingletonSegunda>
}

const prismaSegunda = globalThis.prismaSegunda || prismaClientSingletonSegunda()
if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaSegunda = prismaSegunda
}

// ── Query Routing Helper ────────────────────────────────────
async function processQueryArgsAndResolve(model: string, operation: string, args: any, query: any): Promise<any> {
  if (!args) {
    if (model === 'factura_productos') {
      return (prismaSegunda.factura_productos as any)[operation](args)
    }
    return query(args)
  }

  const fetchInstructions: any[] = []

  function stripRelation(currentModel: string, currentArgs: any, dataPath: string[]) {
    if (!currentArgs) return

    // 1. Handle relations pointing TO factura_productos (queried on main DB)
    if (currentModel !== 'factura_productos') {
      if (currentArgs.include && 'factura_productos' in currentArgs.include) {
        const config = currentArgs.include.factura_productos
        delete currentArgs.include.factura_productos
        if (Object.keys(currentArgs.include).length === 0) delete currentArgs.include
        fetchInstructions.push({ type: 'to_factura_productos', model: currentModel, config, path: [...dataPath] })
      } else if (currentArgs.select && 'factura_productos' in currentArgs.select) {
        const config = currentArgs.select.factura_productos
        delete currentArgs.select.factura_productos
        if (currentModel === 'facturas_cliente' || currentModel === 'productos') {
          currentArgs.select.id = true
        } else if (currentModel === 'importacion_asignaciones') {
          currentArgs.select.factura_producto_id = true
        }
        fetchInstructions.push({ type: 'to_factura_productos', model: currentModel, config, path: [...dataPath] })
      }
    } else {
      // 2. Handle relations pointing FROM factura_productos (queried on segunda DB)
      for (const rel of ['facturas_cliente', 'productos']) {
        if (currentArgs.include && rel in currentArgs.include) {
          const config = currentArgs.include[rel]
          delete currentArgs.include[rel]
          if (Object.keys(currentArgs.include).length === 0) delete currentArgs.include
          fetchInstructions.push({ type: 'from_factura_productos', relation: rel, config, path: [...dataPath] })
        } else if (currentArgs.select && rel in currentArgs.select) {
          const config = currentArgs.select[rel]
          delete currentArgs.select[rel]
          if (rel === 'facturas_cliente') {
            currentArgs.select.factura_id = true
          } else if (rel === 'productos') {
            currentArgs.select.producto_id = true
          }
          fetchInstructions.push({ type: 'from_factura_productos', relation: rel, config, path: [...dataPath] })
        }
      }
    }

    // Recurse into other relations
    const relations = currentArgs.include || currentArgs.select
    if (relations && typeof relations === 'object') {
      for (const key of Object.keys(relations)) {
        if (relations[key] && typeof relations[key] === 'object') {
          let nextModel = key
          if (currentModel === 'importaciones_recepcion' && key === 'importacion_items') {
            nextModel = 'importacion_items'
          } else if (currentModel === 'importacion_items' && key === 'importacion_asignaciones') {
            nextModel = 'importacion_asignaciones'
          } else if (currentModel === 'facturas_cliente' && key === 'remisiones') {
            nextModel = 'remisiones'
          } else if (currentModel === 'remisiones' && key === 'remision_items') {
            nextModel = 'remision_items'
          }
          stripRelation(nextModel, relations[key], [...dataPath, key])
        }
      }
    }
  }

  const nextArgs = JSON.parse(JSON.stringify(args))
  stripRelation(model, nextArgs, [])

  let result: any
  if (model === 'factura_productos') {
    result = await (prismaSegunda.factura_productos as any)[operation](nextArgs)
  } else {
    result = await query(nextArgs)
  }

  if (!result || fetchInstructions.length === 0) {
    return result
  }

  for (const inst of fetchInstructions) {
    function collectObjects(obj: any, pathIdx: number): any[] {
      if (!obj) return []
      if (pathIdx === inst.path.length) {
        return Array.isArray(obj) ? obj : [obj]
      }
      const key = inst.path[pathIdx]
      if (Array.isArray(obj)) {
        return obj.flatMap((item: any) => collectObjects(item[key], pathIdx + 1))
      }
      return collectObjects(obj[key], pathIdx + 1)
    }

    const parentObjects = collectObjects(result, 0)
    if (parentObjects.length === 0) continue

    if (inst.type === 'to_factura_productos') {
      if (inst.model === 'facturas_cliente') {
        const ids = parentObjects.map((p: any) => p.id).filter(Boolean)
        if (ids.length > 0) {
          const related = await processQueryArgsAndResolve('factura_productos', 'findMany', {
            where: { factura_id: { in: ids } },
            ...(typeof inst.config === 'object' ? inst.config : {})
          }, null)
          const grouped: Record<string, any[]> = {}
          for (const item of related) {
            if (!grouped[item.factura_id]) grouped[item.factura_id] = []
            grouped[item.factura_id].push(item)
          }
          for (const p of parentObjects) {
            p.factura_productos = grouped[p.id] || []
          }
        }
      } else if (inst.model === 'productos') {
        const ids = parentObjects.map((p: any) => p.id).filter(Boolean)
        if (ids.length > 0) {
          const related = await processQueryArgsAndResolve('factura_productos', 'findMany', {
            where: { producto_id: { in: ids } },
            ...(typeof inst.config === 'object' ? inst.config : {})
          }, null)
          const grouped: Record<string, any[]> = {}
          for (const item of related) {
            if (item.producto_id) {
              if (!grouped[item.producto_id]) grouped[item.producto_id] = []
              grouped[item.producto_id].push(item)
            }
          }
          for (const p of parentObjects) {
            p.factura_productos = grouped[p.id] || []
          }
        }
      } else if (inst.model === 'importacion_asignaciones') {
        const ids = parentObjects.map((p: any) => p.factura_producto_id).filter(Boolean)
        if (ids.length > 0) {
          const related = await processQueryArgsAndResolve('factura_productos', 'findMany', {
            where: { id: { in: ids } },
            ...(typeof inst.config === 'object' ? inst.config : {})
          }, null)
          const map = new Map(related.map((r: any) => [r.id, r]))
          for (const p of parentObjects) {
            p.factura_productos = map.get(p.factura_producto_id) || null
          }
        }
      }
    } else if (inst.type === 'from_factura_productos') {
      if (inst.relation === 'facturas_cliente') {
        const ids = parentObjects.map((p: any) => p.factura_id).filter(Boolean)
        if (ids.length > 0) {
          const related = await query({
            where: { id: { in: ids } },
            ...(typeof inst.config === 'object' ? inst.config : {})
          })
          const map = new Map(related.map((r: any) => [r.id, r]))
          for (const p of parentObjects) {
            p.facturas_cliente = map.get(p.factura_id) || null
          }
        }
      } else if (inst.relation === 'productos') {
        const ids = parentObjects.map((p: any) => p.producto_id).filter(Boolean)
        if (ids.length > 0) {
          const related = await query({
            where: { id: { in: ids } },
            ...(typeof inst.config === 'object' ? inst.config : {})
          })
          const map = new Map(related.map((r: any) => [r.id, r]))
          for (const p of parentObjects) {
            p.productos = map.get(p.producto_id) || null
          }
        }
      }
    }
  }

  return result
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

const basePrisma = hasUpdates ? globalThis.prisma! : prismaClientSingleton()

const extendedPrisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (model === 'factura_productos') {
          const isRead = ['findMany', 'findUnique', 'findFirst', 'findFirstOrThrow', 'findUniqueOrThrow'].includes(operation)
          if (isRead) {
            return processQueryArgsAndResolve(model, operation, args, query)
          }
          return (prismaSegunda.factura_productos as any)[operation](args)
        }

        const isRead = ['findMany', 'findUnique', 'findFirst', 'findFirstOrThrow', 'findUniqueOrThrow'].includes(operation)
        if (isRead) {
          return processQueryArgsAndResolve(model, operation, args, query)
        }

        return query(args)
      }
    }
  }
})

const prisma = extendedPrisma as unknown as typeof basePrisma
export { prismaSegunda }
export default prisma

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
  globalThis.prismaTriggerVersion = TRIGGER_VERSION
}
