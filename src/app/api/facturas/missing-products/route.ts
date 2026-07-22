import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Extract a model code like "405Q3" or "302Q4" from a product name string
function extractModelCode(name: string | null): string | null {
  const m = (name || '').match(/\b(\d{3}Q\d+)\b/i)
  return m ? m[1].toUpperCase() : null
}

function normalizeName(name: string | null): string {
  return (name || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export async function GET() {
  try {
    // Folios starting with F or N are excluded (historical / non-delivery invoices)
    // — mirrors the same rule used in imports/repartition
    const isExcludedFolio = (numero_factura: string | null) =>
      /^[FN]/i.test(String(numero_factura || '').trim())

    // 1. Find pending client invoices — same filter as imports/repartition:
    //    • estado (payment) = pagada or parcial  (only invoices that have been paid)
    //    • estado_surtido = no_surtida or parcial (not yet fully delivered)
    //    • oculta ≠ true                          (not hidden)
    const pendingInvoices = await prisma.facturas_cliente.findMany({
      where: {
        estado: { in: ['pagada', 'parcial'] },
        oculta: { not: true },
        deleted_at: null
      },
      include: {
        factura_productos: true
      }
    })

    // Apply folio-prefix exclusion (F* / N* are non-delivery historical invoices)
    const filteredInvoices = pendingInvoices.filter(
      (inv: any) => !isExcludedFolio(inv.numero_factura)
    )

    // 2. Query physical stock from productos table + unidades_inventario (disponible)
    const productsStock = await prisma.productos.findMany({
      select: {
        id: true,
        nombre: true,
        order_code: true,
        stock_actual: true
      }
    })

    const realStockItems = (await prisma.$queryRawUnsafe(`
      SELECT il.producto_id, CAST(COUNT(u.id) AS bigint) AS cantidad
      FROM unidades_inventario u
      JOIN inventario_lotes il ON il.id = u.lote_id
      WHERE u.deleted_at IS NULL AND u.estado = 'disponible' AND il.deleted_at IS NULL
      GROUP BY il.producto_id
    `)) as { producto_id: string; cantidad: bigint | number | string }[]

    const realStockMap = new Map<string, number>()
    for (const item of realStockItems) {
      if (item.producto_id) {
        realStockMap.set(item.producto_id, parseInt(String(item.cantidad ?? '0'), 10))
      }
    }

    const stockMap = new Map<string, number>()
    const productNameMap = new Map<string, string>()
    // Fallback lookup maps: by product code and by normalized name
    const codeToProductId = new Map<string, string>()
    const normalizedNameToId = new Map<string, string>()
    for (const p of productsStock) {
      if (!p.id) continue
      stockMap.set(p.id, realStockMap.get(p.id) ?? (p.stock_actual || 0))
      productNameMap.set(p.id, p.nombre)
      // Index by explicit product code (order_code)
      if (p.order_code) codeToProductId.set(String(p.order_code).toUpperCase(), p.id)
      // Index by model code extracted from name (e.g. 405Q3)
      const mc = extractModelCode(p.nombre)
      if (mc) codeToProductId.set(mc, p.id)
      // Index by normalized name
      normalizedNameToId.set(normalizeName(p.nombre), p.id)
    }

    // Resolve a null producto_id line to a product ID using fallback matching
    function resolveProductId(nombre: string | null, codigo: string | null): string | null {
      // 1. Try explicit code match
      if (codigo) {
        const upper = codigo.toUpperCase()
        if (codeToProductId.has(upper)) return codeToProductId.get(upper)!
      }
      // 2. Try model code extracted from invoice line name
      const mc = extractModelCode(nombre)
      if (mc && codeToProductId.has(mc)) return codeToProductId.get(mc)!
      // 3. Try normalized name exact match
      const nn = normalizeName(nombre)
      if (nn && normalizedNameToId.has(nn)) return normalizedNameToId.get(nn)!
      return null
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

    // 4. Aggregate missing quantity per product across all filtered pending client invoices
    //    Lines with null producto_id are resolved via fallback (code / name matching)
    const missingMap = new Map<string, { product_id: string; name: string; code: string; missing: number }>()

    for (const invoice of filteredInvoices) {
      for (const prod of invoice.factura_productos) {
        // Resolve product ID — use direct ID or fallback matching for null
        const resolvedId = prod.producto_id ?? resolveProductId(prod.producto_nombre, prod.producto_codigo)
        if (!resolvedId) continue  // truly unresolvable (e.g. shipping/service lines)

        const qtyFacturada = prod.cantidad_facturada || 0
        const qtyEntregada = prod.cantidad_entregada || 0
        const missingQty = qtyFacturada - qtyEntregada

        if (missingQty <= 0) continue

        const existing = missingMap.get(resolvedId)
        if (existing) {
          existing.missing += missingQty
        } else {
          missingMap.set(resolvedId, {
            product_id: resolvedId,
            name: prod.producto_nombre ?? productNameMap.get(resolvedId) ?? 'Producto',
            code: prod.producto_codigo || '',
            missing: missingQty
          })
        }
      }
    }

    // 5. Subtract physical stock AND purchase invoice stock from missing quantities.
    //    IMPORTANT: include ALL products (even fully covered ones, missing=0) so the
    //    UI can look up covered_by_stock / covered_by_invoices for every product.
    //    Without this, the UI treats covered products as having 0 coverage and
    //    double-counts them in the shortage total.
    const data: Array<{ product_id: string; name: string; code: string; missing: number; covered_by_stock: number; covered_by_invoices: number }> = []
    for (const item of missingMap.values()) {
      const physicalStock = stockMap.get(item.product_id) || 0
      const invoiceStock = purchaseInvoiceStockMap.get(item.product_id) || 0
      const coveredByStock = Math.min(physicalStock, item.missing)
      const coveredByInvoices = Math.max(0, Math.min(invoiceStock, item.missing - physicalStock))
      data.push({
        ...item,
        missing: Math.max(0, item.missing - physicalStock - invoiceStock),
        covered_by_stock: coveredByStock,
        covered_by_invoices: coveredByInvoices
      })
    }

    // 6. Build "by invoice" view: for each pending client invoice, show what is pending delivery
    const byInvoice: Array<{
      invoice_id: string
      numero_factura: string
      cliente_nombre: string
      items: Array<{ product_id: string; name: string; code: string; missing: number }>
    }> = []

    for (const invoice of filteredInvoices) {
      const invoiceItems: Array<{ product_id: string; name: string; code: string; missing: number }> = []

      for (const prod of invoice.factura_productos) {
        const resolvedId = prod.producto_id ?? resolveProductId(prod.producto_nombre, prod.producto_codigo)
        if (!resolvedId) continue
        const qtyFacturada = prod.cantidad_facturada || 0
        const qtyEntregada = prod.cantidad_entregada || 0
        const missingQty = qtyFacturada - qtyEntregada
        if (missingQty <= 0) continue

        invoiceItems.push({
          product_id: resolvedId,
          name: prod.producto_nombre ?? productNameMap.get(resolvedId) ?? 'Producto',
          code: prod.producto_codigo || '',
          missing: missingQty
        })
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

    // Build physical stock sources list for UI
    const physicalStockSources = Array.from(stockMap.entries())
      .filter(([_, qty]) => qty > 0)
      .map(([prodId, qty]) => ({
        product_id: prodId,
        nombre: productNameMap.get(prodId) || 'Producto',
        quantity: qty
      }))

    return NextResponse.json({
      data,
      byInvoice,
      totalMissing,
      purchaseInvoiceSources,
      physicalStockSources
    })
  } catch (error: any) {
    console.error('Error fetching missing products:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
