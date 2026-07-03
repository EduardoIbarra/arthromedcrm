import { NextRequest, NextResponse } from 'next/server'
import { querySegundaDB } from '@/lib/segundaDB'

export const dynamic = 'force-dynamic'

export interface StockFisicoItem {
  producto_id: string
  nombre: string
  cantidad: number
}

/**
 * GET /api/stock-fisico
 * Returns all items from segunda DB's stock_por_producto with positive stock.
 */
export async function GET(_req: NextRequest) {
  try {
    const items = await querySegundaDB<{
      producto_id: string
      nombre: string
      cantidad: string
    }>(`
      SELECT producto_id, nombre, cantidad
      FROM stock_por_producto
      WHERE CAST(cantidad AS bigint) > 0
      ORDER BY nombre ASC
    `)

    const data: StockFisicoItem[] = items.map(p => ({
      producto_id: p.producto_id,
      nombre: p.nombre,
      cantidad: parseInt(p.cantidad || '0', 10),
    }))

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('[stock-fisico] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
