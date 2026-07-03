import { NextResponse } from 'next/server'
import { querySegundaDB } from '@/lib/segundaDB'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const items = await querySegundaDB<{
      producto_id: string
      nombre: string
      cantidad: string
    }>(`
      SELECT producto_id, nombre, cantidad
      FROM stock_por_producto
      ORDER BY nombre ASC
    `)

    const mapped = items.map((p) => {
      const cantidadNum = parseInt(p.cantidad || '0', 10)
      return {
        id: p.producto_id,
        nombre: p.nombre,
        categoria: 'General',
        tipo: 'General',
        activo: true,
        stock_actual: cantidadNum,
        precio_unitario: 0,
        stock_updated_at: new Date().toISOString(),
        inventarios: [
          {
            id: 'segunda-db-stock',
            nombre: 'Almacén Segunda DB',
            stock: cantidadNum,
            updated_at: new Date().toISOString()
          }
        ]
      }
    })

    return NextResponse.json({ data: mapped })
  } catch (err: any) {
    console.error('[GET /api/inventario]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
