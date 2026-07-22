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
 * Physical stock derived from QR units in `unidades_inventario` where estado = 'disponible'.
 */
export async function GET(_req: NextRequest) {
  try {
    const items = (await prisma.$queryRawUnsafe(`
      SELECT il.producto_id, CAST(COUNT(u.id) AS bigint) AS cantidad
      FROM unidades_inventario u
      JOIN inventario_lotes il ON il.id = u.lote_id
      WHERE u.deleted_at IS NULL AND u.estado = 'disponible' AND il.deleted_at IS NULL
      GROUP BY il.producto_id
      HAVING COUNT(u.id) > 0
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
