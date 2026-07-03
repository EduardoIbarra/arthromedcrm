import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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

    // 2. Aggregate missing quantity per product ID
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

    const data = Array.from(missingMap.values())

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error fetching missing products:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
