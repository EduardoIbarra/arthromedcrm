import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
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

    const mapped = products.map((p: any) => {
      const cantidadNum = p.stock_actual || 0
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
