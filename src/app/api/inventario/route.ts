import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/inventario — returns all almacen_propio items
export async function GET() {
  try {
    const items = await prisma.almacen_propio.findMany({
      orderBy: { nombre: 'asc' }
    })

    const mapped = items.map((p: any) => {
      return {
        id: p.id,
        nombre: p.nombre,
        categoria: p.lote || 'Sin Lote',
        tipo: p.ubicacion || 'General',
        activo: true,
        stock_actual: p.cantidad,
        precio_unitario: 0,
        stock_updated_at: p.updated_at,
        inventarios: [
          {
            id: 'almacen-propio',
            nombre: 'Almacén Propio',
            stock: p.cantidad,
            updated_at: p.updated_at
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
