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
const SECONDARY_MODELS = ['factura_productos']

async function processQueryArgsAndResolve(model: string, operation: string, args: any, query: any): Promise<any> {
  if (!args) {
    if (SECONDARY_MODELS.includes(model)) {
      return (prismaSegunda as any)[model][operation](args)
    }
    return query(args)
  }

  const fetchInstructions: any[] = []

  function stripRelation(currentModel: string, currentArgs: any, dataPath: string[]) {
    if (!currentArgs) return

    const isCurrentSecondary = SECONDARY_MODELS.includes(currentModel)

    const relations = currentArgs.include || currentArgs.select
    if (relations && typeof relations === 'object') {
      for (const key of Object.keys(relations)) {
        if (!relations[key]) continue

        let targetModel = key
        if (key === 'facturas_cliente') targetModel = 'facturas_cliente'
        else if (key === 'factura_productos') targetModel = 'factura_productos'
        else if (key === 'clientes') targetModel = 'clientes'
        else if (key === 'remisiones') targetModel = 'remisiones'
        else if (key === 'planes_pago') targetModel = 'planes_pago'
        else if (key === 'productos') targetModel = 'productos'
        else if (key === 'importacion_asignaciones') targetModel = 'importacion_asignaciones'
        
        const isTargetSecondary = SECONDARY_MODELS.includes(targetModel)

        if (isCurrentSecondary !== isTargetSecondary) {
          const config = relations[key]
          delete relations[key]
          
          if (currentArgs.include && Object.keys(currentArgs.include).length === 0) delete currentArgs.include
          if (currentArgs.select && Object.keys(currentArgs.select).length === 0) delete currentArgs.select

          if (currentArgs.select) {
            if (currentModel === 'facturas_cliente') {
              if (key === 'clientes') currentArgs.select.cliente_id = true
              else currentArgs.select.id = true
            } else if (currentModel === 'factura_productos') {
              if (key === 'productos') currentArgs.select.producto_id = true
              else if (key === 'facturas_cliente') currentArgs.select.factura_id = true
              else currentArgs.select.id = true
            } else if (currentModel === 'importacion_asignaciones') {
              if (key === 'factura_productos') currentArgs.select.factura_producto_id = true
            } else if (currentModel === 'remisiones' || currentModel === 'planes_pago') {
              if (key === 'facturas_cliente') currentArgs.select.factura_id = true
            } else {
              currentArgs.select.id = true
            }
          }

          fetchInstructions.push({
            type: isTargetSecondary ? 'to_secondary' : 'to_main',
            parentModel: currentModel,
            relationKey: key,
            targetModel,
            config,
            path: [...dataPath]
          })
        } else {
          if (typeof relations[key] === 'object') {
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
  }

  const nextArgs = JSON.parse(JSON.stringify(args))
  stripRelation(model, nextArgs, [])

  let result: any
  if (SECONDARY_MODELS.includes(model)) {
    result = await (prismaSegunda as any)[model][operation](nextArgs)
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

    const targetQueryFn = async (queryArgs: any) => {
      if (SECONDARY_MODELS.includes(inst.targetModel)) {
        return processQueryArgsAndResolve(inst.targetModel, 'findMany', queryArgs, null)
      } else {
        return queryArgs ? (prisma as any)[inst.targetModel].findMany(queryArgs) : []
      }
    }

    if (inst.parentModel === 'facturas_cliente') {
      if (inst.relationKey === 'clientes') {
        const ids = parentObjects.map((p: any) => p.cliente_id).filter(Boolean)
        if (ids.length > 0) {
          const related = await targetQueryFn({
            where: { id: { in: ids } },
            ...(typeof inst.config === 'object' ? inst.config : {})
          })
          const map = new Map(related.map((r: any) => [r.id, r]))
          for (const p of parentObjects) {
            p.clientes = map.get(p.cliente_id) || null
          }
        }
      } else if (inst.relationKey === 'remisiones') {
        const ids = parentObjects.map((p: any) => p.id).filter(Boolean)
        if (ids.length > 0) {
          const related = await targetQueryFn({
            where: { factura_id: { in: ids } },
            ...(typeof inst.config === 'object' ? inst.config : {})
          })
          const grouped: Record<string, any[]> = {}
          for (const item of related) {
            if (item.factura_id) {
              if (!grouped[item.factura_id]) grouped[item.factura_id] = []
              grouped[item.factura_id].push(item)
            }
          }
          for (const p of parentObjects) {
            p.remisiones = grouped[p.id] || []
          }
        }
      } else if (inst.relationKey === 'planes_pago') {
        const ids = parentObjects.map((p: any) => p.id).filter(Boolean)
        if (ids.length > 0) {
          const related = await targetQueryFn({
            where: { factura_id: { in: ids } },
            ...(typeof inst.config === 'object' ? inst.config : {})
          })
          const grouped: Record<string, any[]> = {}
          for (const item of related || []) {
            if (item.factura_id) {
              if (!grouped[item.factura_id]) grouped[item.factura_id] = []
              grouped[item.factura_id].push(item)
            }
          }
          for (const p of parentObjects) {
            p.planes_pago = grouped[p.id] || []
          }
        }
      } else if (inst.relationKey === 'factura_productos') {
        const ids = parentObjects.map((p: any) => p.id).filter(Boolean)
        const grouped: Record<string, any[]> = {}
        if (ids.length > 0) {
          const related = await targetQueryFn({
            where: { factura_id: { in: ids } },
            ...(typeof inst.config === 'object' ? inst.config : {})
          })
          for (const item of related || []) {
            if (item.factura_id) {
              if (!grouped[item.factura_id]) grouped[item.factura_id] = []
              grouped[item.factura_id].push(item)
            }
          }
        }
        for (const p of parentObjects) {
          p.factura_productos = grouped[p.id] || []
        }
      }
    } else if (inst.parentModel === 'factura_productos') {
      if (inst.relationKey === 'productos') {
        const ids = parentObjects.map((p: any) => p.producto_id).filter(Boolean)
        if (ids.length > 0) {
          const related = await targetQueryFn({
            where: { id: { in: ids } },
            ...(typeof inst.config === 'object' ? inst.config : {})
          })
          const map = new Map(related.map((r: any) => [r.id, r]))
          for (const p of parentObjects) {
            p.productos = map.get(p.producto_id) || null
          }
        }
      }
    } else if (inst.targetModel === 'facturas_cliente') {
      if (inst.parentModel === 'clientes') {
        const ids = parentObjects.map((p: any) => p.id).filter(Boolean)
        if (ids.length > 0) {
          const related = await targetQueryFn({
            where: { cliente_id: { in: ids } },
            ...(typeof inst.config === 'object' ? inst.config : {})
          })
          const grouped: Record<string, any[]> = {}
          for (const item of related) {
            if (item.cliente_id) {
              if (!grouped[item.cliente_id]) grouped[item.cliente_id] = []
              grouped[item.cliente_id].push(item)
            }
          }
          for (const p of parentObjects) {
            p.facturas_cliente = grouped[p.id] || []
          }
        }
      } else {
        const ids = parentObjects.map((p: any) => p.factura_id).filter(Boolean)
        if (ids.length > 0) {
          const related = await targetQueryFn({
            where: { id: { in: ids } },
            ...(typeof inst.config === 'object' ? inst.config : {})
          })
          const map = new Map(related.map((r: any) => [r.id, r]))
          for (const p of parentObjects) {
            p.facturas_cliente = map.get(p.factura_id) || null
          }
        }
      }
    } else if (inst.targetModel === 'factura_productos') {
      if (inst.parentModel === 'facturas_cliente') {
        const ids = parentObjects.map((p: any) => p.id).filter(Boolean)
        if (ids.length > 0) {
          const related = await targetQueryFn({
            where: { factura_id: { in: ids } },
            ...(typeof inst.config === 'object' ? inst.config : {})
          })
          const grouped: Record<string, any[]> = {}
          for (const item of related) {
            if (item.factura_id) {
              if (!grouped[item.factura_id]) grouped[item.factura_id] = []
              grouped[item.factura_id].push(item)
            }
          }
          for (const p of parentObjects) {
            p.factura_productos = grouped[p.id] || []
          }
        }
      } else if (inst.parentModel === 'productos') {
        const ids = parentObjects.map((p: any) => p.id).filter(Boolean)
        if (ids.length > 0) {
          const related = await targetQueryFn({
            where: { producto_id: { in: ids } },
            ...(typeof inst.config === 'object' ? inst.config : {})
          })
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
      } else if (inst.parentModel === 'importacion_asignaciones') {
        const ids = parentObjects.map((p: any) => p.factura_producto_id).filter(Boolean)
        if (ids.length > 0) {
          const related = await targetQueryFn({
            where: { id: { in: ids } },
            ...(typeof inst.config === 'object' ? inst.config : {})
          })
          const map = new Map(related.map((r: any) => [r.id, r]))
          for (const p of parentObjects) {
            p.factura_productos = map.get(p.factura_producto_id) || null
          }
        }
      }
    }
  }

  return result
}

const TRIGGER_VERSION = 12

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
      async $allOperations({ model, operation, args, query }: any) {
        if (SECONDARY_MODELS.includes(model)) {
          const isRead = ['findMany', 'findUnique', 'findFirst', 'findFirstOrThrow', 'findUniqueOrThrow'].includes(operation)
          if (isRead) {
            return processQueryArgsAndResolve(model, operation, args, query)
          }
          return (prismaSegunda as any)[model][operation](args)
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
