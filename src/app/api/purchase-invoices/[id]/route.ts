import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const inv = await prisma.facturas_compra.findUnique({
      where: { id },
      include: {
        ordenes_compra: {
          select: {
            id: true,
            numero_orden: true,
            observaciones: true,
            created_at: true
          }
        },
        factura_compra_items: {
          include: {
            productos: true
          }
        }
      }
    })

    if (!inv) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const data = {
      id: inv.id,
      numero_factura: inv.numero_factura,
      nombre: inv.nombre || null,
      status: (inv as any).status || 'Creado',
      observaciones: inv.observaciones || null,
      fecha_factura: inv.fecha_factura ? inv.fecha_factura.toISOString() : null,
      created_at: inv.created_at ? inv.created_at.toISOString() : new Date().toISOString(),
      pre_orders: (inv.ordenes_compra || []).map((po: any) => ({
        id: po.id,
        numero_orden: po.numero_orden,
        observaciones: po.observaciones,
        created_at: po.created_at ? po.created_at.toISOString() : null
      })),
      items: (inv.factura_compra_items || []).map((item: any) => ({
        id: item.id,
        factura_compra_id: item.factura_compra_id,
        product_id: item.producto_id,
        quantity: item.cantidad,
        cantidad_real: item.cantidad_real ?? 0,
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
    const { nombre, observaciones, status, items } = body

    // 1. Update purchase invoice main fields
    await prisma.facturas_compra.update({
      where: { id },
      data: {
        nombre: nombre || null,
        observaciones: observaciones || null,
        status: status || undefined
      }
    })

    // 2. Replace items if provided
    if (items && Array.isArray(items)) {
      await prisma.factura_compra_items.deleteMany({
        where: { factura_compra_id: id }
      })

      const productIds = items.map((it: any) => it.product_id).filter(Boolean)
      const primaryProducts = await prisma.productos.findMany({
        where: { id: { in: productIds } }
      })
      const productMap = new Map<string, any>(primaryProducts.map((p: any) => [p.id, p]))

      await prisma.factura_compra_items.createMany({
        data: items.map((item: any) => {
          const prod = productMap.get(item.product_id)
          return {
            factura_compra_id: id,
            producto_id: item.product_id || null,
            producto_nombre: prod ? prod.nombre : 'Producto',
            cantidad: parseInt(item.quantity, 10) || 0,
            cantidad_real: item.cantidad_real !== undefined ? parseInt(item.cantidad_real, 10) || 0 : 0
          }
        })
      })
    }

    return GET(request, { params: Promise.resolve({ id }) })
  } catch (error: any) {
    console.error('Error in PUT /api/purchase-invoices/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Unlink pre-orders
    await prisma.ordenes_compra.updateMany({
      where: { factura_compra_id: id },
      data: { factura_compra_id: null }
    })

    // 2. Delete invoice items
    await prisma.factura_compra_items.deleteMany({
      where: { factura_compra_id: id }
    })

    // 3. Delete invoice
    await prisma.facturas_compra.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error in DELETE /api/purchase-invoices/[id]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
