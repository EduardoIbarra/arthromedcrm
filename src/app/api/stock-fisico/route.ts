import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export interface StockFisicoItem {
  producto_id: string
  nombre: string
  cantidad: number
}

/**
 * GET /api/stock-fisico
 *
 * Primary DB only — public.conteo_diario.
 * One row per product: the most recent count (fecha, then updated_at).
 * Do not SUM historical daily rows.
 */
export async function GET(_req: NextRequest) {
  try {
    const items = (await prisma.$queryRawUnsafe(`
      SELECT producto_id, CAST(contado AS bigint) AS cantidad
      FROM (
        SELECT DISTINCT ON (producto_id)
          producto_id,
          contado
        FROM conteo_diario
        ORDER BY producto_id, fecha DESC, updated_at DESC NULLS LAST
      ) latest
      WHERE CAST(contado AS bigint) > 0
    `)) as { producto_id: string; cantidad: bigint | number | string }[]

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
