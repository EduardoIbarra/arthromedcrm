import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/inventario — returns all productos with stock info
export async function GET() {
  try {
    const productos = await prisma.productos.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        inventario_productos: {
          include: {
            tipos_inventario: true
          }
        }
      }
    })

    const mapped = productos.map((p: any) => {
      // Calculate total stock from all inventories
      const totalStock = p.inventario_productos.reduce((sum: number, ip: any) => sum + (ip.stock_actual || 0), 0)
      
      return {
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        tipo: p.tipo,
        activo: p.activo,
        stock_actual: totalStock, // total across all inventories
        precio_unitario: Number(p.precio_unitario),
        stock_updated_at: p.stock_updated_at,
        // Include breakdown
        inventarios: p.inventario_productos.map((ip: any) => ({
          id: ip.tipo_inventario_id,
          nombre: ip.tipos_inventario.nombre,
          stock: ip.stock_actual,
          updated_at: ip.stock_updated_at
        }))
      }
    })

    return NextResponse.json({ data: mapped })
  } catch (err: any) {
    console.error('[GET /api/inventario]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
