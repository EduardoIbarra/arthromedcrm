import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Find all client invoices with state PARCIAL or NO SURTIDA
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

    // 2. Query physical stock from productos table
    const productsStock = await prisma.productos.findMany({
      select: {
        id: true,
        nombre: true,
        stock_actual: true
      }
    })

    const stockMap = new Map<string, number>()
    const productNameMap = new Map<string, string>()
    for (const p of productsStock) {
      if (p.id) {
        stockMap.set(p.id, p.stock_actual || 0)
        productNameMap.set(p.id, p.nombre)
      }
    }

    // 3. Query incoming stock from facturas_compra (purchase invoices)
    //    Only count invoices that are NOT yet fully "Revisado" — i.e., items on the way
    const purchaseInvoices = await prisma.facturas_compra.findMany({
      where: {
        deleted_at: null,
        // Count all active purchase invoices as incoming stock
      },
      include: {
        factura_compra_items: {
          where: { producto_id: { not: null } }
        }
      }
    })

    const purchaseInvoiceStockMap = new Map<string, number>()
    const purchaseInvoiceSources: Array<{
      id: string
      numero_factura: string
      nombre: string | null
      status: string | null
      items: Array<{ product_id: string; quantity: number; nombre: string }>
    }> = []

    for (const inv of purchaseInvoices) {
      const invItems: Array<{ product_id: string; quantity: number; nombre: string }> = []
      for (const item of inv.factura_compra_items) {
        if (!item.producto_id) continue
        const qty = item.cantidad || 0
        if (qty <= 0) continue
        purchaseInvoiceStockMap.set(
          item.producto_id,
          (purchaseInvoiceStockMap.get(item.producto_id) || 0) + qty
        )
        invItems.push({
          product_id: item.producto_id,
          quantity: qty,
          nombre: productNameMap.get(item.producto_id) || (item.producto_nombre ?? 'Producto')
        })
      }
      if (invItems.length > 0) {
        purchaseInvoiceSources.push({
          id: inv.id,
          numero_factura: inv.numero_factura ?? '',
          nombre: inv.nombre ?? null,
          status: (inv as any).status ?? null,
          items: invItems
        })
      }
    }

    // 4. Aggregate missing quantity per product across all pending client invoices
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

    // 5. Subtract physical stock AND purchase invoice stock from missing quantities
    const data: Array<{ product_id: string; name: string; code: string; missing: number; covered_by_stock: number; covered_by_invoices: number }> = []
    for (const item of missingMap.values()) {
      const physicalStock = stockMap.get(item.product_id) || 0
      const invoiceStock = purchaseInvoiceStockMap.get(item.product_id) || 0
      const totalAvailable = physicalStock + invoiceStock
      const actualMissing = item.missing - totalAvailable
      if (actualMissing > 0) {
        data.push({
          ...item,
          missing: actualMissing,
          covered_by_stock: Math.min(physicalStock, item.missing),
          covered_by_invoices: Math.max(0, Math.min(invoiceStock, item.missing - physicalStock))
        })
      }
    }

    // 6. Build "by invoice" view: for each pending client invoice, show what remains missing
    const byInvoice: Array<{
      invoice_id: string
      numero_factura: string
      cliente_nombre: string
      items: Array<{ product_id: string; name: string; code: string; missing: number }>
    }> = []

    for (const invoice of pendingInvoices) {
      const invoiceItems: Array<{ product_id: string; name: string; code: string; missing: number }> = []

      for (const prod of invoice.factura_productos) {
        if (!prod.producto_id) continue
        const qtyFacturada = prod.cantidad_facturada || 0
        const qtyEntregada = prod.cantidad_entregada || 0
        const missingQty = qtyFacturada - qtyEntregada
        if (missingQty <= 0) continue

        // Check if this product is already in the global "still missing" data
        const stillMissingItem = data.find(d => d.product_id === prod.producto_id)
        if (!stillMissingItem) continue // fully covered by stock or purchase invoices

        const physicalStock = stockMap.get(prod.producto_id) || 0
        const invoiceStock = purchaseInvoiceStockMap.get(prod.producto_id) || 0
        const totalAvailable = physicalStock + invoiceStock
        const netMissing = missingQty - Math.max(0, totalAvailable)
        if (netMissing > 0) {
          invoiceItems.push({
            product_id: prod.producto_id,
            name: prod.producto_nombre,
            code: prod.producto_codigo || '',
            missing: netMissing
          })
        }
      }

      if (invoiceItems.length > 0) {
        byInvoice.push({
          invoice_id: invoice.id,
          numero_factura: invoice.numero_factura,
          cliente_nombre: invoice.cliente_nombre || 'Cliente desconocido',
          items: invoiceItems
        })
      }
    }

    // 7. Compute total missing pieces
    const totalMissing = data.reduce((sum, item) => sum + item.missing, 0)

    return NextResponse.json({
      data,
      byInvoice,
      totalMissing,
      purchaseInvoiceSources
    })
  } catch (error: any) {
    console.error('Error fetching missing products:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
