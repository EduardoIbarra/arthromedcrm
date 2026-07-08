import { NextResponse } from 'next/server'
import { querySegundaDB } from '@/lib/segundaDB'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [items, localProducts] = await Promise.all([
      querySegundaDB<{
        producto_id: string
        nombre: string
        cantidad: string
      }>(`
        SELECT producto_id, nombre, cantidad
        FROM stock_por_producto
        ORDER BY nombre ASC
      `),
      prisma.productos.findMany({
        select: {
          id: true,
          precio_unitario: true,
          categoria: true,
          tipo: true,
        },
      }),
    ])

    const productMap = new Map<string, { precio_unitario: any; categoria: string | null; tipo: string | null }>(
      (localProducts as any[]).map((p: any) => [p.id, p])
    )

    const mapped = items.map((p) => {
      const cantidadNum = parseInt(p.cantidad || '0', 10)
      const localProd = productMap.get(p.producto_id)
      const price = localProd?.precio_unitario ? Number(localProd.precio_unitario) : 0
      const cat = localProd?.categoria || 'General'
      const t = localProd?.tipo || 'General'

      return {
        id: p.producto_id,
        nombre: p.nombre,
        categoria: cat,
        tipo: t,
        activo: true,
        stock_actual: cantidadNum,
        precio_unitario: price,
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

