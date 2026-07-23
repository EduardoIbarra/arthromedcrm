import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function mapEstadoToStatus(estado: string | null): 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'PARTIAL' {
  if (!estado) return 'PENDING'
  const norm = estado.toLowerCase().trim()
  if (norm === 'completa') return 'COMPLETED'
  if (norm === 'cancelada') return 'CANCELLED'
  if (norm === 'parcial') return 'PARTIAL'
  return 'PENDING'
}

function mapStatusToEstado(status: string | null): 'pendiente' | 'completa' | 'cancelada' | 'parcial' {
  if (!status) return 'pendiente'
  const norm = status.toUpperCase().trim()
  if (norm === 'COMPLETED') return 'completa'
  if (norm === 'CANCELLED') return 'cancelada'
  if (norm === 'PARTIAL') return 'parcial'
  return 'pendiente'
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const order = await prisma.ordenes_compra.findUnique({
      where: { id },
      include: {
        facturas_compra: true,
        orden_productos: {
          where: { deleted_at: null },
          include: {
            productos: true
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const data = {
      id: order.id,
      status: mapEstadoToStatus(order.estado),
      notes: order.observaciones || null,
      created_at: order.created_at ? order.created_at.toISOString() : new Date().toISOString(),
      numero_orden: order.numero_orden,
      proveedor: order.proveedor,
      es_pre_orden: !!order.es_pre_orden,
      factura_compra_id: order.factura_compra_id || null,
      factura_compra_numero: order.facturas_compra?.numero_factura || null,
      items: (order.orden_productos || []).map((item: any) => ({
        id: item.id,
        purchase_order_id: item.orden_id,
        product_id: item.producto_id,
        quantity: item.cantidad_ordenada || 0,
        productos: item.productos ? {
          ...item.productos,
          description: item.productos.nombre
        } : (item.producto_nombre ? {
          id: item.producto_id,
          nombre: item.producto_nombre,
          description: item.producto_nombre
        } : null)
      }))
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, notes, items } = body

    const estado = mapStatusToEstado(status)

    // 1. Update purchase order fields
    await prisma.ordenes_compra.update({
      where: { id },
      data: {
        estado,
        observaciones: notes || null
      }
    })

    // 2. Replace items if provided
    if (items && Array.isArray(items)) {
      await prisma.orden_productos.deleteMany({
        where: { orden_id: id }
      })

      const productIds = items.map((it: any) => it.product_id).filter(Boolean)
      const primaryProducts = await prisma.productos.findMany({
        where: { id: { in: productIds } }
      })
      const productMap = new Map<string, any>(primaryProducts.map((p: any) => [p.id, p]))

      await prisma.orden_productos.createMany({
        data: items.map((item: any) => {
          const prod = productMap.get(item.product_id)
          return {
            orden_id: id,
            producto_id: item.product_id || null,
            producto_nombre: prod ? prod.nombre : 'Producto',
            cantidad_ordenada: parseInt(item.quantity, 10) || 0,
            cantidad_recibida: 0
          }
        })
      })
    }

    return GET(request, { params: Promise.resolve({ id }) })
  } catch (error: any) {
    console.error('Error in PUT /api/purchase-orders/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.orden_productos.deleteMany({
      where: { orden_id: id }
    })

    await prisma.ordenes_compra.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error in DELETE /api/purchase-orders/[id]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
