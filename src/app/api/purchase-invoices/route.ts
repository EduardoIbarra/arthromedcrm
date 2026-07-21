import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const invoices = await prisma.facturas_compra.findMany({
      orderBy: { created_at: 'desc' },
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

    const data = invoices.map((inv: any) => ({
      id: inv.id,
      numero_factura: inv.numero_factura,
      nombre: inv.nombre || null,
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
        productos: item.productos ? {
          ...item.productos,
          description: item.productos.nombre
        } : (item.producto_nombre ? {
          id: item.producto_id,
          nombre: item.producto_nombre,
          description: item.producto_nombre
        } : null)
      }))
    }))

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error in GET /api/purchase-invoices:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nombre, observaciones, pre_order_ids, items: customItems } = body

    const currentYear = new Date().getFullYear().toString().slice(-2)
    const prefix = `FC${currentYear}-`

    const existingInvoices = await prisma.facturas_compra.findMany({
      where: { numero_factura: { startsWith: prefix } },
      select: { numero_factura: true }
    })

    let maxNum = 0
    for (const inv of existingInvoices) {
      const parts = inv.numero_factura.split('-')
      if (parts.length > 1) {
        const num = parseInt(parts[1], 10)
        if (!isNaN(num) && num > maxNum) {
          maxNum = num
        }
      }
    }
    const nextNum = maxNum + 1
    const numero_factura = `${prefix}${String(nextNum).padStart(3, '0')}`

    let consolidatedItemsMap = new Map<string, { product_id: string; quantity: number }>()

    if (customItems && Array.isArray(customItems) && customItems.length > 0) {
      for (const item of customItems) {
        const pid = item.product_id
        const qty = parseInt(item.quantity, 10) || 0
        if (!pid) continue
        const existing = consolidatedItemsMap.get(pid)
        if (existing) {
          existing.quantity += qty
        } else {
          consolidatedItemsMap.set(pid, { product_id: pid, quantity: qty })
        }
      }
    } else if (pre_order_ids && Array.isArray(pre_order_ids) && pre_order_ids.length > 0) {
      const orderItems = await prisma.orden_productos.findMany({
        where: { orden_id: { in: pre_order_ids } }
      })

      for (const item of orderItems) {
        const pid = item.producto_id
        const qty = item.cantidad_ordenada || 0
        if (!pid) continue
        const existing = consolidatedItemsMap.get(pid)
        if (existing) {
          existing.quantity += qty
        } else {
          consolidatedItemsMap.set(pid, { product_id: pid, quantity: qty })
        }
      }
    }

    const pids = Array.from(consolidatedItemsMap.keys())
    const primaryProducts = await prisma.productos.findMany({
      where: { id: { in: pids } }
    })
    const productMap = new Map<string, any>(primaryProducts.map((p: any) => [p.id, p]))

    const invoice = await prisma.facturas_compra.create({
      data: {
        numero_factura,
        nombre: nombre || null,
        observaciones: observaciones || null,
        factura_compra_items: {
          create: Array.from(consolidatedItemsMap.values()).map(item => {
            const prod = productMap.get(item.product_id)
            return {
              producto_id: item.product_id,
              producto_nombre: prod ? prod.nombre : 'Producto',
              cantidad: item.quantity
            }
          })
        }
      },
      include: {
        factura_compra_items: {
          include: {
            productos: true
          }
        }
      }
    })

    if (pre_order_ids && Array.isArray(pre_order_ids) && pre_order_ids.length > 0) {
      await prisma.ordenes_compra.updateMany({
        where: { id: { in: pre_order_ids } },
        data: { factura_compra_id: invoice.id }
      })
    }

    const data = {
      id: invoice.id,
      numero_factura: invoice.numero_factura,
      nombre: invoice.nombre || null,
      observaciones: invoice.observaciones || null,
      fecha_factura: invoice.fecha_factura ? invoice.fecha_factura.toISOString() : null,
      created_at: invoice.created_at ? invoice.created_at.toISOString() : new Date().toISOString(),
      items: (invoice.factura_compra_items || []).map((item: any) => ({
        id: item.id,
        factura_compra_id: item.factura_compra_id,
        product_id: item.producto_id,
        quantity: item.cantidad,
        productos: item.productos ? { ...item.productos, description: item.productos.nombre } : null
      }))
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/purchase-invoices:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
