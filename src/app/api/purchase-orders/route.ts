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

export async function GET() {
  try {
    // 1. Fetch orders from the second DB
    const orders = await querySegundaDB(`
      SELECT id, numero_orden, proveedor, fecha_orden, fecha_esperada, estado, observaciones, created_at, created_by
      FROM ordenes_compra
      ORDER BY created_at DESC NULLS LAST, numero_orden DESC
    `)

    if (orders.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const orderIds = orders.map(o => o.id)
    const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(', ')
    
    // 2. Fetch order items from the second DB
    const items = await querySegundaDB(`
      SELECT id, orden_id, producto_id, producto_nombre, cantidad_ordenada, cantidad_recibida, created_at, id_alegra
      FROM orden_productos
      WHERE orden_id IN (${placeholders})
    `, orderIds)

    // 3. Resolve products from primary DB to match expected frontend structure
    // Find all distinct product IDs referenced (some could be null)
    // We should map them. Wait, since some producto_ids could be from the second DB,
    // let's fetch primary products by ID, but also by model/order_code if they don't match,
    // or just fetch by ID. Let's do a findMany on primary DB using all non-null product IDs.
    const productIds = Array.from(new Set(items.map(i => i.producto_id).filter(Boolean))) as string[]
    
    const primaryProducts = await prisma.productos.findMany({
      where: {
        id: { in: productIds }
      }
    })

    const productMap = new Map<string, any>()
    for (const p of primaryProducts) {
      productMap.set(p.id, {
        ...p,
        description: p.nombre
      })
    }

    // Group items by order
    const itemsByOrder = new Map<string, any[]>()
    for (const item of items) {
      if (!itemsByOrder.has(item.orden_id)) {
        itemsByOrder.set(item.orden_id, [])
      }

      // Find the corresponding primary DB product
      let matchedProduct = productMap.get(item.producto_id)
      
      // Fallback if not found by UUID
      if (!matchedProduct && item.producto_nombre) {
        matchedProduct = {
          id: item.producto_id || uuidv4(),
          nombre: item.producto_nombre,
          description: item.producto_nombre,
          model: '',
          order_code: ''
        }
      }

      itemsByOrder.get(item.orden_id)!.push({
        id: item.id,
        purchase_order_id: item.orden_id,
        product_id: item.producto_id,
        quantity: item.cantidad_ordenada || 0,
        productos: matchedProduct
      })
    }

    // Map to frontend expected structure
    const data = orders.map(o => ({
      id: o.id,
      status: mapEstadoToStatus(o.estado),
      notes: o.observaciones || null,
      created_at: o.created_at || new Date().toISOString(),
      numero_orden: o.numero_orden,
      proveedor: o.proveedor,
      items: itemsByOrder.get(o.id) || []
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
    const { status, notes, items, numero_orden: requestedNumeroOrden } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'La orden debe contener al menos un producto' }, { status: 400 })
    }

    // 1. Generate unique PO ID
    const purchaseOrderId = uuidv4()

    // 2. Resolve numero_orden:
    // - Excel import sends the exact INVOICE NO. extracted from the file — keep it as-is
    // - Manual creates (no numero_orden) auto-increment BS{YY}-{nnn}
    let numero_orden = typeof requestedNumeroOrden === 'string'
      ? requestedNumeroOrden.trim()
      : ''

    if (numero_orden) {
      const existing = await querySegundaDB(
        `SELECT id FROM ordenes_compra WHERE numero_orden = $1 LIMIT 1`,
        [numero_orden]
      )
      if (existing.length > 0) {
        return NextResponse.json(
          { error: `Ya existe una orden de compra con el número ${numero_orden}` },
          { status: 409 }
        )
      }
    } else {
      const currentYear = new Date().getFullYear().toString().slice(-2) // e.g. "26"
      const prefix = `BS${currentYear}-`

      const existingOrders = await querySegundaDB(`
        SELECT numero_orden
        FROM ordenes_compra
        WHERE numero_orden LIKE $1
      `, [`${prefix}%`])

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
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    // 3. Insert purchase order into second DB
    await querySegundaDB(`
      INSERT INTO ordenes_compra (id, numero_orden, proveedor, fecha_orden, fecha_esperada, estado, observaciones, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      purchaseOrderId,
      numero_orden,
      'BONSS MEDICAL',
      today,
      today,
      estado,
      notes || null,
      new Date().toISOString()
    ])

    // 4. Fetch all products from second DB for matching
    const secondDBProducts = await querySegundaDB(`
      SELECT id, nombre, model, order_code FROM productos
    `)

    // Fetch primary DB products referenced in the request
    const primaryProductIds = items.map((it: any) => it.product_id)
    const primaryProducts = await prisma.productos.findMany({
      where: { id: { in: primaryProductIds } }
    })

    const primaryProductMap = new Map<string, any>(primaryProducts.map((p: any) => [p.id, p]))

    const createdItems = []

    // 5. Insert items into second DB orden_productos
    for (const item of items) {
      const primaryProd = primaryProductMap.get(item.product_id)
      if (!primaryProd) continue

      // Match logic with second DB products
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

      const itemId = uuidv4()
      const quantity = parseInt(item.quantity, 10) || 0

      await querySegundaDB(`
        INSERT INTO orden_productos (id, orden_id, producto_id, producto_nombre, cantidad_ordenada, cantidad_recibida, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        itemId,
        purchaseOrderId,
        matchedId,
        matchedName,
        quantity,
        0, // cantidad_recibida default
        new Date().toISOString()
      ])

      createdItems.push({
        id: itemId,
        purchase_order_id: purchaseOrderId,
        product_id: matchedId || primaryProd.id,
        quantity,
        productos: {
          ...primaryProd,
          description: primaryProd.nombre
        }
      })
    }

    const createdPO = {
      id: purchaseOrderId,
      status: mapEstadoToStatus(estado),
      notes: notes || null,
      created_at: new Date().toISOString(),
      numero_orden,
      proveedor: 'BONSS MEDICAL',
      items: createdItems
    }

    return NextResponse.json({ data: createdPO }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/purchase-orders:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
