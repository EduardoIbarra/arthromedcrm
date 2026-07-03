import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { querySegundaDB } from '@/lib/segundaDB'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Find all client invoices with state PARCIAL or NO SURTIDA ('parcial' or 'no_surtida')
    const pendingInvoices = await prisma.facturas_cliente.findMany({
      where: {
        estado_surtido: {
          in: ['no_surtida', 'parcial']
        }
      },
      include: {
        factura_productos: {
          where: {
            producto_id: { not: null }
          }
        }
      }
    })

    // 2. Query stock from the second DB (http://localhost:3000/inventario uses stock_por_producto)
    const stockRows = await querySegundaDB(`
      SELECT producto_id, cantidad 
      FROM stock_por_producto
    `)

    const stockMap = new Map<string, number>()
    for (const row of stockRows) {
      if (row.producto_id) {
        const stockQty = parseInt(row.cantidad || '0', 10)
        stockMap.set(row.producto_id, stockQty)
      }
    }

    // 3. Aggregate missing quantity per product ID
    const missingMap = new Map<string, { product_id: string; name: string; code: string; missing: number }>()

    for (const invoice of pendingInvoices) {
      for (const prod of invoice.factura_productos) {
        if (!prod.producto_id) continue
        
        const qtyFacturada = prod.cantidad_facturada || 0
        const qtyEntregada = prod.cantidad_entregada || 0
        const missingQty = qtyFacturada - qtyEntregada

        if (missingQty <= 0) continue

        const existing = missingMap.get(prod.producto_id)
        if (existing) {
          existing.missing += missingQty
        } else {
          missingMap.set(prod.producto_id, {
            product_id: prod.producto_id,
            name: prod.producto_nombre,
            code: prod.producto_codigo || '',
            missing: missingQty
          })
        }
      }
    }

    // 4. Subtract stock from missing quantities so we don't order more than needed
    const data = []
    for (const item of missingMap.values()) {
      const stock = stockMap.get(item.product_id) || 0
      const actualMissing = item.missing - stock
      if (actualMissing > 0) {
        data.push({
          ...item,
          missing: actualMissing
        })
      }
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error fetching missing products:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
