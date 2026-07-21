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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const preOrderParam = searchParams.get('pre_order')

    let whereClause: any = {}

    if (preOrderParam === 'true') {
      whereClause.es_pre_orden = true
    } else if (preOrderParam === 'false') {
      whereClause.OR = [
        { es_pre_orden: false },
        { es_pre_orden: null }
      ]
    }

    const orders = await prisma.ordenes_compra.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      include: {
        facturas_compra: {
          select: {
            numero_factura: true,
            nombre: true
          }
        },
        orden_productos: {
          include: {
            productos: true
          }
        }
      }
    })

    const data = orders.map((o: any) => ({
      id: o.id,
      status: mapEstadoToStatus(o.estado),
      notes: o.observaciones || null,
      created_at: o.created_at ? o.created_at.toISOString() : new Date().toISOString(),
      numero_orden: o.numero_orden,
      proveedor: o.proveedor,
      es_pre_orden: !!o.es_pre_orden,
      factura_compra_id: o.factura_compra_id || null,
      factura_compra_numero: o.facturas_compra?.numero_factura || null,
      factura_compra_nombre: o.facturas_compra?.nombre || null,
      items: (o.orden_productos || []).map((item: any) => ({
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
    }))

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error in GET /api/purchase-orders:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { status, notes, items, numero_orden: requestedNumeroOrden, es_pre_orden } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'La orden debe contener al menos un producto' }, { status: 400 })
    }

    let numero_orden = typeof requestedNumeroOrden === 'string' ? requestedNumeroOrden.trim() : ''

    if (numero_orden) {
      const existing = await prisma.ordenes_compra.findFirst({
        where: { numero_orden }
      })
      if (existing) {
        return NextResponse.json(
          { error: `Ya existe una orden con el número ${numero_orden}` },
          { status: 409 }
        )
      }
    } else {
      const currentYear = new Date().getFullYear().toString().slice(-2)
      const prefix = es_pre_orden ? `POC${currentYear}-` : `BS${currentYear}-`

      const existingOrders = await prisma.ordenes_compra.findMany({
        where: { numero_orden: { startsWith: prefix } },
        select: { numero_orden: true }
      })

      let maxNum = 0
      for (const order of existingOrders) {
        const parts = order.numero_orden.split('-')
        if (parts.length > 1) {
          const num = parseInt(parts[1], 10)
          if (!isNaN(num) && num > maxNum) {
            maxNum = num
          }
        }
      }
      const nextNum = maxNum + 1
      numero_orden = `${prefix}${String(nextNum).padStart(3, '0')}`
    }

    const estado = mapStatusToEstado(status)

    const productIds = items.map((it: any) => it.product_id).filter(Boolean)
    const primaryProducts = await prisma.productos.findMany({
      where: { id: { in: productIds } }
    })
    const productMap = new Map<string, any>(primaryProducts.map((p: any) => [p.id, p]))

    const createdPO = await prisma.ordenes_compra.create({
      data: {
        numero_orden,
        proveedor: 'BONSS MEDICAL',
        estado,
        observaciones: notes || null,
        es_pre_orden: !!es_pre_orden,
        orden_productos: {
          create: items.map((it: any) => {
            const prod = productMap.get(it.product_id)
            return {
              producto_id: it.product_id || null,
              producto_nombre: prod ? prod.nombre : 'Producto',
              cantidad_ordenada: parseInt(it.quantity, 10) || 0,
              cantidad_recibida: 0
            }
          })
        }
      },
      include: {
        orden_productos: {
          include: {
            productos: true
          }
        }
      }
    })

    const data = {
      id: createdPO.id,
      status: mapEstadoToStatus(createdPO.estado),
      notes: createdPO.observaciones || null,
      created_at: createdPO.created_at ? createdPO.created_at.toISOString() : new Date().toISOString(),
      numero_orden: createdPO.numero_orden,
      proveedor: createdPO.proveedor,
      es_pre_orden: !!createdPO.es_pre_orden,
      items: (createdPO.orden_productos || []).map((item: any) => ({
        id: item.id,
        purchase_order_id: item.orden_id,
        product_id: item.producto_id,
        quantity: item.cantidad_ordenada || 0,
        productos: item.productos ? {
          ...item.productos,
          description: item.productos.nombre
        } : null
      }))
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/purchase-orders:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Se requiere una lista de IDs para eliminar' }, { status: 400 })
    }

    await prisma.orden_productos.deleteMany({
      where: { orden_id: { in: ids } }
    })

    await prisma.ordenes_compra.deleteMany({
      where: { id: { in: ids } }
    })

    return NextResponse.json({ success: true, count: ids.length })
  } catch (error: any) {
    console.error('Error in DELETE /api/purchase-orders:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
