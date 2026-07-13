import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { querySegundaDB } from '@/lib/segundaDB'

export const dynamic = 'force-dynamic'

export interface StockFisicoItem {
  producto_id: string
  nombre: string
  cantidad: number
}

type ConteoRow = { producto_id: string; cantidad: bigint | number | string }

/** Latest count per product — never SUM historical daily rows. */
const LATEST_CONTEO_SQL = `
  SELECT producto_id, CAST(contado AS bigint) AS cantidad
  FROM (
    SELECT DISTINCT ON (producto_id)
      producto_id,
      contado
    FROM conteo_diario
    ORDER BY producto_id, fecha DESC, updated_at DESC NULLS LAST
  ) latest
  WHERE CAST(contado AS bigint) > 0
`

function isMissingRelationError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? '')
  return (
    msg.includes('42P01') ||
    msg.includes('conteo_diario') ||
    msg.toLowerCase().includes('does not exist')
  )
}

/**
 * conteo_diario lives on the inventory / segunda DB in most environments,
 * and on the main prod DB in others. Try both; prefer the non-empty result,
 * falling back if the relation is missing.
 */
async function fetchLatestConteo(): Promise<ConteoRow[]> {
  let mainRows: ConteoRow[] | null = null
  let segundaRows: ConteoRow[] | null = null
  let mainErr: unknown = null
  let segundaErr: unknown = null

  try {
    mainRows = (await prisma.$queryRawUnsafe(LATEST_CONTEO_SQL)) as ConteoRow[]
  } catch (err) {
    if (!isMissingRelationError(err)) throw err
    mainErr = err
  }

  try {
    segundaRows = await querySegundaDB<ConteoRow>(LATEST_CONTEO_SQL)
  } catch (err) {
    if (!isMissingRelationError(err)) throw err
    segundaErr = err
  }

  // Prefer whichever source has data; if both do, prefer main (fresher prod counts)
  if (mainRows && mainRows.length > 0) return mainRows
  if (segundaRows && segundaRows.length > 0) return segundaRows
  if (mainRows) return mainRows
  if (segundaRows) return segundaRows

  // Both missing the table
  const detail = [mainErr, segundaErr]
    .filter(Boolean)
    .map(e => String((e as any)?.message ?? e))
    .join(' | ')
  throw new Error(
    detail || 'conteo_diario no está disponible en la base principal ni en SEGUNDA_DB'
  )
}

/**
 * GET /api/stock-fisico
 * Physical stock from conteo_diario (one row per product = most recent count).
 */
export async function GET(_req: NextRequest) {
  try {
    const items = await fetchLatestConteo()

    const productIds = items.map(i => i.producto_id).filter(Boolean)

    const products =
      productIds.length > 0
        ? await prisma.productos.findMany({
            where: { id: { in: productIds } },
            select: { id: true, nombre_lista: true, nombre: true },
          })
        : []

    const nameMap = new Map<string, string>()
    for (const p of products) {
      nameMap.set(p.id, p.nombre_lista || p.nombre || 'Desconocido')
    }

    const data: StockFisicoItem[] = items
      .map(p => ({
        producto_id: p.producto_id,
        nombre: nameMap.get(p.producto_id) || 'Desconocido',
        cantidad: parseInt(String(p.cantidad ?? '0'), 10),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('[stock-fisico] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
