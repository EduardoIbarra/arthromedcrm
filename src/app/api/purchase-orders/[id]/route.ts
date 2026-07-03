import { NextRequest, NextResponse } from 'next/server'
import { querySegundaDB } from '@/lib/segundaDB'
import prisma from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'

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

    // 1. Fetch order details from second DB
    const orderRows = await querySegundaDB(`
      SELECT id, numero_orden, proveedor, fecha_orden, fecha_esperada, estado, observaciones, created_at, created_by
      FROM ordenes_compra
      WHERE id = $1
    `, [id])

    if (orderRows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const order = orderRows[0]

    // 2. Fetch items
    const items = await querySegundaDB(`
      SELECT id, orden_id, producto_id, producto_nombre, cantidad_ordenada, cantidad_recibida, created_at, id_alegra
      FROM orden_productos
      WHERE orden_id = $1
    `, [id])

    // Resolve products from primary DB
    const productIds = Array.from(new Set(items.map(i => i.producto_id).filter(Boolean))) as string[]
    
    const primaryProducts = await prisma.productos.findMany({
      where: {
        id: { in: productIds }
      }
    })

    const productMap = new Map<string, any>(primaryProducts.map((p: any) => [p.id, p]))

    const mappedItems = items.map(item => {
      let matchedProduct = productMap.get(item.producto_id)
      if (!matchedProduct && item.producto_nombre) {
        matchedProduct = {
          id: item.producto_id || uuidv4(),
          nombre: item.producto_nombre,
          description: item.producto_nombre,
          model: '',
          order_code: ''
        }
      }
      return {
        id: item.id,
        purchase_order_id: item.orden_id,
        product_id: item.producto_id,
        quantity: item.cantidad_ordenada || 0,
        productos: matchedProduct ? {
          ...matchedProduct,
          description: matchedProduct.nombre
        } : null
      }
    })

    const data = {
      id: order.id,
      status: mapEstadoToStatus(order.estado),
      notes: order.observaciones || null,
      created_at: order.created_at || new Date().toISOString(),
      numero_orden: order.numero_orden,
      proveedor: order.proveedor,
      items: mappedItems
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

    // 1. Update purchase order fields in second DB
    await querySegundaDB(`
      UPDATE ordenes_compra
      SET estado = $1, observaciones = $2
      WHERE id = $3
    `, [estado, notes || null, id])

    // 2. If items were passed, update them
    if (items && Array.isArray(items)) {
      // Delete existing items
      await querySegundaDB(`
        DELETE FROM orden_productos
        WHERE orden_id = $1
      `, [id])

      // Fetch all products from second DB for matching
      const secondDBProducts = await querySegundaDB(`
        SELECT id, nombre, model, order_code FROM productos
      `)

      // Fetch primary DB products referenced in the request
      const primaryProductIds = items.map((it: any) => it.product_id)
      const primaryProducts = await prisma.productos.findMany({
        where: { id: { in: primaryProductIds } }
      })

      const primaryProductMap = new Map<string, any>(primaryProducts.map((p: any) => [p.id, p]))

      // Create new items in second DB
      for (const item of items) {
        const primaryProd = primaryProductMap.get(item.product_id)
        if (!primaryProd) continue

        let matchedSecondDBProduct = null

        const pModel = (primaryProd.model || '').trim().toLowerCase()
        const pCode = (primaryProd.order_code || '').trim().toLowerCase()
        const pName = (primaryProd.nombre || '').trim().toLowerCase()

        // Match by exact ID first
        matchedSecondDBProduct = secondDBProducts.find(sp => sp.id === primaryProd.id)

        if (!matchedSecondDBProduct && pModel && pCode) {
          // Match by model + code
          matchedSecondDBProduct = secondDBProducts.find(sp => 
            (sp.model && sp.model.trim().toLowerCase() === pModel) &&
            (sp.order_code && sp.order_code.trim().toLowerCase() === pCode)
          )
        }
        if (!matchedSecondDBProduct && pModel) {
          // Match by model only
          matchedSecondDBProduct = secondDBProducts.find(sp => 
            sp.model && sp.model.trim().toLowerCase() === pModel
          )
        }
        if (!matchedSecondDBProduct && pCode) {
          // Match by code only
          matchedSecondDBProduct = secondDBProducts.find(sp => 
            sp.order_code && sp.order_code.trim().toLowerCase() === pCode
          )
        }
        if (!matchedSecondDBProduct && pName) {
          // Match by name
          matchedSecondDBProduct = secondDBProducts.find(sp => 
            sp.nombre && sp.nombre.trim().toLowerCase() === pName
          )
        }

        const matchedId = matchedSecondDBProduct ? matchedSecondDBProduct.id : null
        const matchedName = matchedSecondDBProduct ? matchedSecondDBProduct.nombre : primaryProd.nombre
        const quantity = parseInt(item.quantity, 10) || 0

        await querySegundaDB(`
          INSERT INTO orden_productos (id, orden_id, producto_id, producto_nombre, cantidad_ordenada, cantidad_recibida, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          uuidv4(),
          id,
          matchedId,
          matchedName,
          quantity,
          0,
          new Date().toISOString()
        ])
      }
    }

    // 3. Fetch and return updated order
    const updatedRes = await GET(request, { params: Promise.resolve({ id }) })
    return updatedRes
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

    // 1. Delete items from second DB
    await querySegundaDB(`
      DELETE FROM orden_productos
      WHERE orden_id = $1
    `, [id])

    // 2. Delete purchase order from second DB
    await querySegundaDB(`
      DELETE FROM ordenes_compra
      WHERE id = $1
    `, [id])

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error in DELETE /api/purchase-orders/[id]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
