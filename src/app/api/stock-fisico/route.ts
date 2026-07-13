import { NextRequest, NextResponse } from 'next/server'
import { querySegundaDB } from '@/lib/segundaDB'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export interface StockFisicoItem {
  producto_id: string
  nombre: string
  cantidad: number
}

/**
 * GET /api/stock-fisico
 * Returns items from segunda DB's conteo_diario joined with primary DB's productos.
 */
export async function GET(_req: NextRequest) {
  try {
    // 1. Fetch counts from segunda DB
    const items = await querySegundaDB<{
      producto_id: string
      cantidad: string
    }>(`
      SELECT producto_id, SUM(CAST(contado AS bigint)) AS cantidad
      FROM conteo_diario
      WHERE CAST(contado AS bigint) > 0
      GROUP BY producto_id
    `)

    // 2. Extract product IDs
    const productIds = items.map(i => i.producto_id).filter(Boolean)

    // 3. Fetch product names from primary DB
    const products = productIds.length > 0 ? await prisma.productos.findMany({
      where: { id: { in: productIds } },
      select: { id: true, nombre_lista: true, nombre: true }
    }) : []

    const nameMap = new Map<string, string>()
    for (const p of products) {
      nameMap.set(p.id, p.nombre_lista || p.nombre || 'Desconocido')
    }

    // 4. Map names back to the items
    const data: StockFisicoItem[] = items.map(p => ({
      producto_id: p.producto_id,
      nombre: nameMap.get(p.producto_id) || 'Desconocido',
      cantidad: parseInt(p.cantidad || '0', 10),
    })).sort((a, b) => a.nombre.localeCompare(b.nombre))

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('[stock-fisico] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
