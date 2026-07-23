import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export interface OrdenProducto {
  id: string
  orden_id: string
  producto_id: string | null
  producto_nombre: string | null
  cantidad_ordenada: number
  cantidad_recibida: number | null
}

export interface OrdenCompra {
  id: string
  numero_orden: string
  proveedor: string | null
  fecha_orden: string | null
  fecha_esperada: string | null
  estado: string | null
  observaciones: string | null
  created_at: string | null
  productos: OrdenProducto[]
  total_ordenado: number
  total_recibido: number
}

export async function GET(_request: NextRequest) {
  try {
    const orders = await prisma.ordenes_compra.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        orden_productos: {
          where: { deleted_at: null },
          include: {
            productos: {
              select: {
                id: true,
                nombre_lista: true,
                nombre: true
              }
            }
          }
        }
      }
    })

    const data: OrdenCompra[] = orders.map((o: any) => {
      const prods: OrdenProducto[] = (o.orden_productos || []).map((p: any) => ({
        id: p.id,
        orden_id: p.orden_id,
        producto_id: p.producto_id,
        producto_nombre: p.productos?.nombre_lista || p.productos?.nombre || p.producto_nombre,
        cantidad_ordenada: p.cantidad_ordenada || 0,
        cantidad_recibida: p.cantidad_recibida || 0
      }))

      const total_ordenado = prods.reduce((sum, p) => sum + (p.cantidad_ordenada || 0), 0)
      const total_recibido = prods.reduce((sum, p) => sum + (p.cantidad_recibida || 0), 0)

      return {
        id: o.id,
        numero_orden: o.numero_orden,
        proveedor: o.proveedor,
        fecha_orden: o.fecha_orden ? o.fecha_orden.toISOString() : null,
        fecha_esperada: o.fecha_esperada ? o.fecha_esperada.toISOString() : null,
        estado: o.estado,
        observaciones: o.observaciones,
        created_at: o.created_at ? o.created_at.toISOString() : null,
        productos: prods,
        total_ordenado,
        total_recibido
      }
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error in GET /api/ordenes-compra:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
