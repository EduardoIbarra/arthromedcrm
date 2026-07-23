import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { recomputeEntregadaFromRemisiones } from '@/lib/fulfillment-status'

export const dynamic = 'force-dynamic'

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapAlegraStatus(status: string, totalPaid = 0, balance?: number): string {
  const s = status?.toLowerCase()
  if (s === 'void') return 'cancelada'
  if (s === 'paid' || s === 'closed') return 'pagada'
  if (s === 'draft') return 'pendiente'
  // open (or unknown): use paid amounts for partial
  if (totalPaid > 0) {
    if (balance != null && balance <= 0.005) return 'pagada'
    return 'parcial'
  }
  if (s === 'open') return 'pendiente'
  return 'pendiente'
}

function extractFirstPayment(invoice: any): { date: Date | null; amount: number | null; totalPaid: number } {
  const payments = Array.isArray(invoice.payments) ? [...invoice.payments] : []
  payments.sort((a: any, b: any) => String(a.date || '').localeCompare(String(b.date || '')))
  const first = payments.find((p: any) => p.date && Number(p.amount) > 0)
  const totalPaid = Number(invoice.totalPaid) || 0
  return {
    date: first?.date ? new Date(first.date) : null,
    amount: first ? Number(first.amount) || null : totalPaid > 0 ? totalPaid : null,
    totalPaid: totalPaid > 0 ? totalPaid : 0,
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
          const totalPaidNum = Number(invoice.totalPaid) || 0
          const balanceNum =
            invoice.balance != null ? Number(invoice.balance) : total - totalPaidNum
          const estado = mapAlegraStatus(invoice.status, totalPaidNum, balanceNum)
          const firstPay = extractFirstPayment(invoice)

          let fecha_pago: Date | null = null
          if (estado === 'pagada') {
            // Latest payment date when fully paid
            const pays = Array.isArray(invoice.payments) ? [...invoice.payments] : []
            pays.sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')))
            const latest = pays.find((p: any) => p.date)
            fecha_pago = latest?.date
              ? new Date(latest.date)
              : firstPay.date || new Date(invoice.date)
          } else if (estado === 'parcial' && firstPay.date) {
            // Keep fecha_pago as first payment for partials so UIs that only look at fecha_pago still work
            fecha_pago = firstPay.date
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
            primer_pago_fecha: firstPay.date,
            primer_pago_monto: firstPay.amount,
            total_pagado:      firstPay.totalPaid > 0 ? firstPay.totalPaid : null,
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

          if (!facturaUuid) return 'error'
          // Narrow for TS — always set after create/update paths above
          const facturaId: string = facturaUuid

          // Transfer payment plans from estimate (cotización)
          const estimateObj = invoice.estimate;
          const estimateId = estimateObj?.id || estimateObj;
          if (estimateId) {
            const estimateIdStr = estimateId.toString()
            const cot = await prisma.cotizaciones.findUnique({ where: { alegra_id: estimateIdStr } })
            if (cot) {
              await prisma.planes_pago.updateMany({
                where: { cotizacion_id: cot.id, factura_id: null },
                data: { factura_id: facturaId }
              })
            }
          }

          // Recreate catalog lines from Alegra — NEVER wipe entregada.
          // Snapshot prior deliveries, map onto new rows, then restore from remisiones.
          if (invoice.items?.length > 0) {
            const existingLines = await prisma.factura_productos.findMany({
              where: { factura_id: facturaId },
              select: {
                alegra_id: true,
                producto_codigo: true,
                producto_nombre: true,
                cantidad_entregada: true,
              },
            })
            const deliveredByKey = new Map<string, number>()
            for (const row of existingLines) {
              const ent = row.cantidad_entregada || 0
              if (row.alegra_id) deliveredByKey.set(`a:${row.alegra_id}`, ent)
              if (row.producto_codigo) {
                deliveredByKey.set(`c:${row.producto_codigo.toLowerCase()}`, ent)
              }
              deliveredByKey.set(`n:${row.producto_nombre.toLowerCase()}`, ent)
            }

            await prisma.factura_productos.deleteMany({
              where: {
                factura_id: facturaId,
                OR: [
                  { manual: false },
                  { manual: null }
                ]
              }
            })
            await prisma.factura_productos.createMany({
              data: invoice.items.map((item: any) => {
                const iName  = item.name || item.description || 'Producto'
                const rKey   = item.reference?.trim().toLowerCase()
                const nKey   = iName.trim().toLowerCase()
                const pid    = (rKey && productByRef.get(rKey)) ?? (nKey && productByName.get(nKey)) ?? null
                const linea  = (rKey && productLineByRef.get(rKey)) ?? (nKey && productLineByName.get(nKey)) ?? null
                const qty    = Math.round(item.quantity) || 1
                const alegraLineId = item.id != null ? String(item.id) : null
                const prevDelivered =
                  (alegraLineId && deliveredByKey.get(`a:${alegraLineId}`)) ??
                  (rKey ? deliveredByKey.get(`c:${rKey}`) : undefined) ??
                  deliveredByKey.get(`n:${nKey}`) ??
                  0
                return {
                  factura_id:         facturaId,
                  producto_id:        pid || null,
                  producto_nombre:    iName,
                  producto_codigo:    item.reference || null,
                  cantidad_facturada: qty,
                  // Preserve prior entregada across wipe; remisiones overwrite matches next
                  cantidad_entregada: Math.min(Number(prevDelivered) || 0, qty),
                  precio_unitario:    item.price || 0,
                  importe:            (item.price || 0) * (item.quantity || 0),
                  linea:              linea || null,
                  alegra_id:          alegraLineId,
                }
              })
            })

            // Source of truth for deliveries: remisiones linked to this invoice
            await recomputeEntregadaFromRemisiones(prisma as any, facturaId)
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
