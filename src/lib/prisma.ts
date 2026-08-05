import { PrismaClient, Prisma } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'

const prismaClientSingleton = () => {
  const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.DIRECT_URL
  
  if (!connectionString) {
    console.warn('Warning: DATABASE_URL is not defined. Prisma will fail at runtime.')
    return new Proxy({}, {
      get: (target, prop) => {
        if (prop === 'then') return undefined
        throw new Error(`Prisma was initialized without DATABASE_URL. Property "${String(prop)}" cannot be accessed. Check your Vercel Environment Variables.`)
      }
    }) as any
  }

  // Strip conflicting SSL query params from connection string without mutating URL/password encoding
  const cleanUrl = connectionString
    .replace(/([?&])(sslmode|sslaccept|sslcert|sslkey|sslrootcert)=[^&]*&?/gi, '$1')
    .replace(/[?&]$/, '')

  const pool = new Pool({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  })
  pool.on('error', (err) => {
    console.error('Unexpected error on idle pg client (main DB):', err)
  })

  const adapter = new PrismaPg(pool)
  
  return new PrismaClient({
    adapter,
    log: ['error', 'warn']
  })
}



const TRIGGER_VERSION = 28

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
  var prismaTriggerVersion: number | undefined
}

const hasUpdates = globalThis.prisma && 
  ('ticket_updates' in globalThis.prisma) && 
  ('landing_pages' in globalThis.prisma) &&
  ('car_fleet' in globalThis.prisma) &&
  ('car_fleet_maintenance' in globalThis.prisma) &&
  ('directorio_categorias' in globalThis.prisma) &&
  ('purchase_orders' in globalThis.prisma) &&
  ('vacaciones' in globalThis.prisma) &&
  ('workshop_gastos_estimados' in globalThis.prisma) &&
  globalThis.prismaTriggerVersion === TRIGGER_VERSION

const basePrisma = hasUpdates ? globalThis.prisma! : prismaClientSingleton()

function cloneQueryArgs(args: any): any {
  if (!args || typeof args !== 'object') return args;
  if (args instanceof Date) return new Date(args.getTime());
  if (Array.isArray(args)) return args.map(cloneQueryArgs);
  
  const copy: any = {};
  for (const key of Object.keys(args)) {
    copy[key] = cloneQueryArgs(args[key]);
  }
  return copy;
}

// Prisma's runtime DMMF in this project strips `isList` / `relationFromFields`.
// Parse schema.prisma once so soft-delete only injects `where` on list relations
// (to-one relations reject `where` with "Unknown argument `where`").
type RelationMeta = { isList: boolean; type: string }

const SCALAR_TYPES = new Set([
  'String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Decimal', 'Bytes', 'BigInt'
])

function loadRelationMeta(): Map<string, RelationMeta> {
  const map = new Map<string, RelationMeta>()
  const candidates = [
    path.join(process.cwd(), 'src/generated/prisma/schema.prisma'),
    path.join(process.cwd(), 'prisma/schema.prisma'),
  ]

  let schema = ''
  for (const candidate of candidates) {
    try {
      schema = fs.readFileSync(candidate, 'utf8')
      break
    } catch {
      // try next path
    }
  }
  if (!schema) {
    console.warn('[prisma soft-delete] Could not load schema.prisma; nested soft-delete filters may be skipped')
    return map
  }

  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = modelRegex.exec(schema))) {
    const modelName = match[1]
    for (const line of match[2].split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue
      const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/)
      if (!fieldMatch) continue
      const [, fieldName, fieldType, isArray] = fieldMatch
      if (SCALAR_TYPES.has(fieldType)) continue
      if (!isArray && !/@relation/.test(trimmed)) continue
      map.set(`${modelName}.${fieldName}`, { isList: Boolean(isArray), type: fieldType })
    }
  }
  return map
}

const relationMeta = loadRelationMeta()

const deletedAtModels = new Set(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === 'deleted_at'))
    .map((model) => model.name)
)

function getRelationMeta(modelName: string, relationKey: string): RelationMeta | null {
  return relationMeta.get(`${modelName}.${relationKey}`) || null
}

function isListRelation(modelName: string, relationKey: string): boolean {
  const meta = getRelationMeta(modelName, relationKey)
  // Safe default: do NOT inject `where` when metadata is missing (to-one rejects it)
  if (!meta) return false
  return meta.isList
}

function applySoftDeleteFilters(modelName: string, args: any, allowWhere = true) {
  if (!args) return;

  const hasDeletedAtField = deletedAtModels.has(modelName);

  // Only root queries and list relations support `where`
  if (hasDeletedAtField && !args.includeDeleted && allowWhere) {
    if (!args.where) {
      args.where = { deleted_at: null };
    } else if (args.where.deleted_at === undefined) {
      args.where.deleted_at = null;
    }
  }

  // Traverse select/include
  const relations = args.select || args.include;
  if (relations && typeof relations === 'object') {
    for (const key of Object.keys(relations)) {
      const relationConfig = relations[key];
      if (!relationConfig) continue;

      const meta = getRelationMeta(modelName, key);
      if (!meta) continue;

      const targetModel = meta.type;
      const targetHasDeletedAt = deletedAtModels.has(targetModel);
      const isList = meta.isList;

      if (relationConfig === true) {
        // Only list relations accept `{ where: ... }` as a relation filter
        if (targetHasDeletedAt && isList) {
          relations[key] = { where: { deleted_at: null } };
        }
      } else if (typeof relationConfig === 'object') {
        if (targetHasDeletedAt && isList) {
          if (!relationConfig.where) {
            relationConfig.where = { deleted_at: null };
          } else if (relationConfig.where.deleted_at === undefined) {
            relationConfig.where.deleted_at = null;
          }
        }
        // Recurse: nested `where` only allowed for list relations
        applySoftDeleteFilters(targetModel, relationConfig, isList);
      }
    }
  }
}

function cleanupIncludeDeleted(argsObj: any) {
  if (!argsObj) return;
  delete argsObj.includeDeleted;
  const relations = argsObj.select || argsObj.include;
  if (relations && typeof relations === 'object') {
    for (const key of Object.keys(relations)) {
      if (typeof relations[key] === 'object') {
        cleanupIncludeDeleted(relations[key]);
      }
    }
  }
}

const extendedPrisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: any) {
        // 1. Intercept delete operation -> convert into logical update setting deleted_at = now()
        if (operation === 'delete') {
          const updateFn = (this as any)[model]?.update
          if (updateFn && args?.where) {
            return updateFn({
              where: args.where,
              data: { deleted_at: new Date() }
            })
          }
        }

        // 2. Intercept deleteMany operation -> convert into logical updateMany setting deleted_at = now()
        if (operation === 'deleteMany') {
          const updateManyFn = (this as any)[model]?.updateMany
          if (updateManyFn) {
            return updateManyFn({
              where: args?.where || {},
              data: { deleted_at: new Date() }
            })
          }
        }

        // 3. Intercept read queries -> filter out soft-deleted records (deleted_at IS NULL)
        const isRead = ['findMany', 'findUnique', 'findFirst', 'findFirstOrThrow', 'findUniqueOrThrow', 'count', 'groupBy', 'aggregate'].includes(operation)
        if (isRead) {
          const nextArgs = cloneQueryArgs(args)
          applySoftDeleteFilters(model, nextArgs)
          cleanupIncludeDeleted(nextArgs)
          return query(nextArgs)
        }

        return query(args)
      }
    }
  }
})

const prisma = extendedPrisma as unknown as typeof basePrisma
export default prisma

globalThis.prisma = prisma
globalThis.prismaTriggerVersion = TRIGGER_VERSION
