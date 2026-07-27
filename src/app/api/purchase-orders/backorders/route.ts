import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const items = await prisma.piezas_pendientes_fabricante.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        facturas_compra: {
          select: {
            id: true,
            numero_factura: true,
            nombre: true,
            fecha_factura: true,
            created_at: true,
            ordenes_compra: {
              select: {
                id: true,
                numero_orden: true,
                created_at: true
              }
            }
          }
        },
        ordenes_compra: {
          select: {
            id: true,
            numero_orden: true,
            created_at: true
          }
        },
        productos: {
          select: {
            id: true,
            nombre: true,
            nombre_lista: true,
            model: true,
            order_code: true,
            line: true,
            categoria: true
          }
        },
        created_by_user: {
          select: {
            id: true,
            email: true,
            raw_user_meta_data: true
          }
        }
      }
    })

    const formatted = items.map((item: any) => {
      const userMeta = (item.created_by_user as any)?.raw_user_meta_data || {}
      const userName = userMeta.full_name || userMeta.name || item.created_by_user?.email || 'Usuario'

      // Primary purchase order info (from direct link or via invoice)
      const po = item.ordenes_compra || (item.facturas_compra?.ordenes_compra && item.facturas_compra.ordenes_compra[0]) || null

      return {
        id: item.id,
        factura_compra_id: item.factura_compra_id,
        factura_numero: item.facturas_compra?.numero_factura || 'Factura',
        factura_nombre: item.facturas_compra?.nombre || null,
        orden_compra_id: po?.id || null,
        orden_numero: po?.numero_orden || null,
        producto_id: item.producto_id,
        producto_nombre: item.productos?.nombre_lista || item.productos?.nombre || item.producto_nombre || 'Producto',
        model: item.productos?.model || null,
        order_code: item.productos?.order_code || null,
        line: item.productos?.line || item.productos?.categoria || 'OTRO',
        cantidad_ordenada: item.cantidad_ordenada,
        cantidad_recibida: item.cantidad_recibida,
        cantidad_pendiente: item.cantidad_pendiente,
        status: item.status || 'Pendiente',
        observaciones: item.observaciones || null,
        created_at: item.created_at ? item.created_at.toISOString() : new Date().toISOString(),
        created_by_id: item.created_by,
        created_by_name: userName,
        created_by_email: item.created_by_user?.email || null
      }
    })

    return NextResponse.json({ data: formatted })
  } catch (error: any) {
    console.error('Error in GET /api/purchase-orders/backorders:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, observaciones } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing item ID' }, { status: 400 })
    }

    const updated = await prisma.piezas_pendientes_fabricante.update({
      where: { id },
      data: {
        status: status !== undefined ? status : undefined,
        observaciones: observaciones !== undefined ? observaciones : undefined
      }
    })

    return NextResponse.json({ data: updated })
  } catch (error: any) {
    console.error('Error in PATCH /api/purchase-orders/backorders:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
