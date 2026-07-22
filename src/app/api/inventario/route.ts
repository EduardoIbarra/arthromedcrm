import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Fetch all products
    const products = await prisma.productos.findMany({
      select: {
        id: true,
        nombre: true,
        nombre_lista: true,
        precio_unitario: true,
        categoria: true,
        tipo: true,
        stock_actual: true,
        stock_updated_at: true,
        activo: true
      },
      orderBy: { nombre: 'asc' }
    })

    // 2. Fetch real physical stock from unidades_inventario (disponible)
    const stockItems = (await prisma.$queryRawUnsafe(`
      SELECT il.producto_id, CAST(COUNT(u.id) AS bigint) AS cantidad
      FROM unidades_inventario u
      JOIN inventario_lotes il ON il.id = u.lote_id
      WHERE u.deleted_at IS NULL AND u.estado = 'disponible' AND il.deleted_at IS NULL
      GROUP BY il.producto_id
    `)) as { producto_id: string; cantidad: bigint | number | string }[]

    const stockMap = new Map<string, number>()
    for (const item of stockItems) {
      if (item.producto_id) {
        stockMap.set(item.producto_id, parseInt(String(item.cantidad ?? '0'), 10))
      }
    }

    const mapped = products.map((p: any) => {
      const cantidadNum = stockMap.get(p.id) ?? (p.stock_actual || 0)
      const price = p.precio_unitario ? Number(p.precio_unitario) : 0
      const cat = p.categoria || 'General'
      const t = p.tipo || 'General'

      return {
        id: p.id,
        nombre: p.nombre_lista || p.nombre,
        categoria: cat,
        tipo: t,
        activo: p.activo ?? true,
        stock_actual: cantidadNum,
        precio_unitario: price,
        stock_updated_at: p.stock_updated_at ? p.stock_updated_at.toISOString() : new Date().toISOString(),
        inventarios: [
          {
            id: 'almacen-principal',
            nombre: 'Almacén Principal',
            stock: cantidadNum,
            updated_at: p.stock_updated_at ? p.stock_updated_at.toISOString() : new Date().toISOString()
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
