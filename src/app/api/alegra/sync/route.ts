import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapAlegraStatus(status: string): string {
  switch (status?.toLowerCase()) {
    case 'open':    return 'pendiente'
    case 'paid':
    case 'closed':  return 'pagada'
    case 'draft':   return 'pendiente'
    case 'void':    return 'cancelada'
    default:        return 'pendiente'
  }
}

function mapAlegraPaymentMethod(method: string): string {
  switch (method?.toLowerCase()) {
    case 'cash':        return 'Efectivo'
    case 'transfer':    return 'Transferencia'
    case 'check':       return 'Cheque'
    case 'card':
    case 'credit-card': return 'Tarjeta de crédito'
    case 'debit-card':  return 'Tarjeta de débito'
    default:            return method || 'No especificado'
  }
}

// ─── Alegra API fetch helpers ─────────────────────────────────────────────────

async function fetchAlegraPage(authHeader: string, start: number, limit: number): Promise<any[]> {
  const res = await fetch(`https://api.alegra.com/api/v1/invoices?limit=${limit}&start=${start}`, {
    headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Alegra API error ${res.status}: ${txt}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

/** Fetches all invoices from Alegra using concurrent page batches. Stops as
 *  soon as a batch returns a partial page (meaning we've hit the last page). */
async function fetchAllAlegraInvoices(authHeader: string, limit = 30): Promise<any[]> {
  const allInvoices: any[] = []
  const concurrentPages = 5  // fetch 5 pages at a time
  let start = 0
  let done = false

  while (!done) {
    const offsets = Array.from({ length: concurrentPages }, (_, i) => start + i * limit)
    const pages = await Promise.all(offsets.map(o => fetchAlegraPage(authHeader, o, limit)))

    for (const page of pages) {
      allInvoices.push(...page)
      if (page.length < limit) { done = true; break }
    }

    start += concurrentPages * limit
    // Safety cap: stop after 600 invoices (20 pages) to avoid runaway loops
    if (allInvoices.length >= 600) break
  }

  return allInvoices
}

// ─── Parallel batch helper ────────────────────────────────────────────────────

async function processBatch<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    const chunkResults = await Promise.all(chunk.map(fn))
    results.push(...chunkResults)
  }
  return results
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  try {
    const email = process.env.ALEGRA_API_EMAIL
    const token = process.env.ALEGRA_API_TOKEN

    if (!email || !token) {
      return NextResponse.json({
        success: false,
        error: 'Alegra API credentials are not configured in environment variables.',
      }, { status: 400 })
    }

    const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`

    // ── Step 1: Fetch all invoices from Alegra (parallel page batches) ────────
    const allInvoices = await fetchAllAlegraInvoices(authHeader)

    if (allInvoices.length === 0) {
      return NextResponse.json({ success: true, summary: { totalSynced: 0, created: 0, updated: 0 } })
    }

    // ── Step 2: Pre-load all lookup tables in parallel (3 queries total) ──────
    const [allClientes, allProductos, allExistingInvoices] = await Promise.all([
      prisma.clientes.findMany({ select: { id: true, rfc: true, nombre: true } }),
      prisma.productos.findMany({ select: { id: true, consecutivo_alg: true, nombre: true, line: true } }),
      prisma.facturas_cliente.findMany({ select: { id: true, alegra_id: true, numero_factura: true } })
    ])

    // Build O(1) lookup Maps
    const clientByRfc  = new Map<string, string>()
    const clientByName = new Map<string, string>()
    for (const c of allClientes) {
      if (c.rfc)    clientByRfc.set(c.rfc.toLowerCase(), c.id)
      if (c.nombre) clientByName.set(c.nombre.toLowerCase(), c.id)
    }

    const productByRef  = new Map<string, string>()
    const productByName = new Map<string, string>()
    const productLineByRef  = new Map<string, string>()
    const productLineByName = new Map<string, string>()
    for (const p of allProductos) {
      if (p.consecutivo_alg) productByRef.set(p.consecutivo_alg.toLowerCase(), p.id)
      if (p.nombre)          productByName.set(p.nombre.toLowerCase(), p.id)
      if (p.line) {
        if (p.consecutivo_alg) productLineByRef.set(p.consecutivo_alg.toLowerCase(), p.line)
        if (p.nombre)          productLineByName.set(p.nombre.toLowerCase(), p.line)
      }
    }

    const existingByAlegraId = new Map<string, string>()
    const existingByNumero   = new Map<string, string>()
    for (const f of allExistingInvoices) {
      if (f.alegra_id)      existingByAlegraId.set(f.alegra_id, f.id)
      if (f.numero_factura) existingByNumero.set(f.numero_factura, f.id)
    }

    // ── Step 3: Process all invoices in parallel batches of 15 ───────────────
    let totalCreated = 0
    let totalUpdated = 0
    let totalErrors  = 0
    const now = new Date()

    // Thread-safe counters via returned values (no shared mutable state in concurrent fn)
    const results = await processBatch(
      allInvoices,
      15,  // 15 concurrent invoice writes
      async (invoice: any): Promise<'created' | 'updated' | 'error'> => {
        try {
          // Client lookup — O(1) from Map
          let client_id: string | null = null
          const rfcKey  = invoice.client?.identification?.trim().toLowerCase()
          const nameKey = invoice.client?.name?.trim().toLowerCase()
          if (rfcKey)  client_id = clientByRfc.get(rfcKey)  ?? null
          if (!client_id && nameKey) client_id = clientByName.get(nameKey) ?? null

          const subtotal = invoice.subtotal || 0
          const total    = invoice.total    || 0
          const iva      = total - subtotal
          const estado   = mapAlegraStatus(invoice.status)

          let fecha_pago: Date | null = null
          if (estado === 'pagada') {
            const fp = invoice.payments?.[0]
            fecha_pago = fp?.date ? new Date(fp.date) : new Date(invoice.date)
          }

          const metodo_pago   = invoice.paymentMethod ? mapAlegraPaymentMethod(invoice.paymentMethod) : null
          const numeroFactura = invoice.numberTemplate?.formattedNumber
            || invoice.numberTemplate?.number
            || invoice.number
            || `ALE-${invoice.id}`

          const invoiceData = {
            numero_factura:    numeroFactura,
            clientes:          client_id ? { connect: { id: client_id } } : undefined,
            cliente_nombre:    invoice.client?.name || 'Cliente sin nombre',
            cliente_rfc:       invoice.client?.identification || null,
            fecha_expedicion:  new Date(invoice.date),
            fecha_vencimiento: new Date(invoice.dueDate || invoice.date),
            estado,
            subtotal,
            iva:               invoice.tax || iva,
            total,
            observaciones:     invoice.observations || null,
            fecha_pago,
            metodo_pago,
            updated_at:        now
          }

          const alegraIdStr = invoice.id.toString()
          let facturaUuid   = existingByAlegraId.get(alegraIdStr)
          let action: 'created' | 'updated'

          if (facturaUuid) {
            await prisma.facturas_cliente.update({ where: { id: facturaUuid }, data: invoiceData })
            action = 'updated'
          } else {
            const byNumUuid = existingByNumero.get(numeroFactura)
            if (byNumUuid) {
              await prisma.facturas_cliente.update({
                where: { id: byNumUuid },
                data: { ...invoiceData, alegra_id: alegraIdStr }
              })
              facturaUuid = byNumUuid
              action = 'updated'
            } else {
              const created = await prisma.facturas_cliente.create({
                data: { alegra_id: alegraIdStr, ...invoiceData, created_at: now }
              })
              facturaUuid = created.id
              action = 'created'
            }
          }

          // Recreate line items (delete old + batch insert new)
          if (invoice.items?.length > 0) {
            await prisma.factura_productos.deleteMany({ where: { factura_id: facturaUuid } })
            await prisma.factura_productos.createMany({
              data: invoice.items.map((item: any) => {
                const iName  = item.name || item.description || 'Producto'
                const rKey   = item.reference?.trim().toLowerCase()
                const nKey   = iName.trim().toLowerCase()
                const pid    = (rKey && productByRef.get(rKey)) ?? (nKey && productByName.get(nKey)) ?? null
                const linea  = (rKey && productLineByRef.get(rKey)) ?? (nKey && productLineByName.get(nKey)) ?? null
                return {
                  factura_id:         facturaUuid,
                  producto_id:        pid || null,
                  producto_nombre:    iName,
                  producto_codigo:    item.reference || null,
                  cantidad_facturada: Math.round(item.quantity) || 1,
                  precio_unitario:    item.price || 0,
                  importe:            (item.price || 0) * (item.quantity || 0),
                  linea:              linea || null,
                  alegra_id:          item.id ? String(item.id) : null
                }
              })
            })
          }

          return action
        } catch (err: any) {
          console.error(`Sync error for invoice ${invoice.id}:`, err.message)
          return 'error'
        }
      }
    )

    for (const r of results) {
      if (r === 'created') totalCreated++
      else if (r === 'updated') totalUpdated++
      else totalErrors++
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalSynced: totalCreated + totalUpdated,
        created:     totalCreated,
        updated:     totalUpdated,
        errors:      totalErrors
      }
    })
  } catch (error: any) {
    console.error('Error in Alegra sync GET:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred during synchronization.'
    }, { status: 500 })
  }
}
