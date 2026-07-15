import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function mapAlegraEstimateStatus(status: string): string {
  switch (status?.toLowerCase()) {
    case 'open':
    case 'draft':     return 'pendiente'
    case 'accepted':   return 'aceptada'
    case 'rejected':   return 'rechazada'
    case 'void':       return 'cancelada'
    default:           return status || 'pendiente'
  }
}

async function fetchAlegraEstimatesPage(authHeader: string, start: number, limit: number): Promise<any[]> {
  const res = await fetch(`https://api.alegra.com/api/v1/estimates?limit=${limit}&start=${start}`, {
    headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Alegra API error ${res.status}: ${txt}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

async function fetchAllAlegraEstimates(authHeader: string, limit = 30, onlyRecent = false): Promise<any[]> {
  if (onlyRecent) {
    return fetchAlegraEstimatesPage(authHeader, 0, limit)
  }

  const allEstimates: any[] = []
  const concurrentPages = 5
  let start = 0
  let done = false

  while (!done) {
    const offsets = Array.from({ length: concurrentPages }, (_, i) => start + i * limit)
    const pages = await Promise.all(offsets.map(o => fetchAlegraEstimatesPage(authHeader, o, limit)))

    for (const page of pages) {
      allEstimates.push(...page)
      if (page.length < limit) { done = true; break }
    }

    start += concurrentPages * limit
    if (allEstimates.length >= 600) break
  }

  return allEstimates
}

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

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const onlyRecent = searchParams.get('recent') === 'true'

    const email = process.env.ALEGRA_API_EMAIL
    const token = process.env.ALEGRA_API_TOKEN

    if (!email || !token) {
      return NextResponse.json({
        success: false,
        error: 'Alegra API credentials are not configured in environment variables.',
      }, { status: 400 })
    }

    const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`

    const allEstimates = await fetchAllAlegraEstimates(authHeader, 30, onlyRecent)

    if (allEstimates.length === 0) {
      return NextResponse.json({ success: true, summary: { totalSynced: 0, created: 0, updated: 0 } })
    }

    const [allClientes, allExistingCotizaciones, allProductos] = await Promise.all([
      prisma.clientes.findMany({ select: { id: true, rfc: true, nombre: true } }),
      prisma.cotizaciones.findMany({ select: { id: true, alegra_id: true, numero_cotizacion: true } }),
      prisma.productos.findMany({ select: { id: true, consecutivo_alg: true, nombre: true } })
    ])

    const clientByRfc  = new Map<string, string>()
    const clientByName = new Map<string, string>()
    for (const c of allClientes) {
      if (c.rfc)    clientByRfc.set(c.rfc.toLowerCase(), c.id)
      if (c.nombre) clientByName.set(c.nombre.toLowerCase(), c.id)
    }

    const existingByAlegraId = new Map<string, string>()
    const existingByNumero   = new Map<string, string>()
    for (const c of allExistingCotizaciones) {
      if (c.alegra_id)          existingByAlegraId.set(c.alegra_id, c.id)
      if (c.numero_cotizacion)  existingByNumero.set(c.numero_cotizacion, c.id)
    }

    const productByRef  = new Map<string, string>()
    const productByName = new Map<string, string>()
    for (const p of allProductos) {
      if (p.consecutivo_alg) productByRef.set(p.consecutivo_alg.toLowerCase(), p.id)
      if (p.nombre)          productByName.set(p.nombre.toLowerCase(), p.id)
    }

    let totalCreated = 0
    let totalUpdated = 0
    let totalErrors  = 0
    const now = new Date()

    const results = await processBatch(
      allEstimates,
      15,
      async (est: any): Promise<'created' | 'updated' | 'error'> => {
        try {
          let client_id: string | null = null
          const rfcKey  = est.client?.identification?.trim().toLowerCase()
          const nameKey = est.client?.name?.trim().toLowerCase()
          if (rfcKey)  client_id = clientByRfc.get(rfcKey)  ?? null
          if (!client_id && nameKey) client_id = clientByName.get(nameKey) ?? null

          const subtotal = est.subtotal || 0
          const total    = est.total    || 0
          const iva      = total - subtotal
          const estado   = mapAlegraEstimateStatus(est.status)

          const numeroCotizacion = est.numberTemplate?.formattedNumber
            || est.numberTemplate?.number
            || est.number
            || `COT-${est.id}`

          const quoteData = {
            numero_cotizacion: numeroCotizacion,
            cliente_nombre:    est.client?.name || 'Cliente sin nombre',
            cliente_rfc:       est.client?.identification || null,
            fecha_expedicion:  new Date(est.date),
            fecha_vencimiento: est.dueDate ? new Date(est.dueDate) : null,
            estado,
            subtotal,
            iva:               est.tax || iva,
            total,
            observaciones:     est.observations || null,
            updated_at:        now,
            ...(client_id ? { clientes: { connect: { id: client_id } } } : {})
          }

          const alegraIdStr = est.id.toString()
          let cotizacionUuid = existingByAlegraId.get(alegraIdStr)
          let action: 'created' | 'updated'

          if (cotizacionUuid) {
            // Do not override existing records to preserve local modifications (CFDI use, payment, comments, etc.)
            action = 'updated'
          } else {
            const newQuote = await prisma.cotizaciones.create({
              data: {
                alegra_id: alegraIdStr,
                created_at: now,
                ...quoteData
              }
            })
            cotizacionUuid = newQuote.id
            action = 'created'

            // Create line items only for newly created records
            if (est.items?.length > 0) {
              await prisma.cotizacion_productos.createMany({
                data: est.items.map((item: any) => {
                  const iName  = item.name || item.description || 'Producto'
                  const rKey   = item.reference?.trim().toLowerCase()
                  const nKey   = iName.trim().toLowerCase()
                  const pid    = (rKey && productByRef.get(rKey)) ?? (nKey && productByName.get(nKey)) ?? null
                  return {
                    cotizacion_id:      cotizacionUuid,
                    producto_id:        pid || null,
                    producto_nombre:    iName,
                    producto_codigo:    item.reference || null,
                    cantidad:           Math.round(item.quantity) || 1,
                    precio_unitario:    item.price || 0,
                    importe:            (item.price || 0) * (item.quantity || 0)
                  }
                })
              })
            }
          }

          return action
        } catch (err) {
          console.error(`Error syncing cotización ID ${est.id}:`, err)
          return 'error'
        }
      }
    )

    for (const res of results) {
      if (res === 'created') totalCreated++
      else if (res === 'updated') totalUpdated++
      else totalErrors++
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalSynced: allEstimates.length,
        created: totalCreated,
        updated: totalUpdated,
        errors: totalErrors
      }
    })
  } catch (error: any) {
    console.error('Error in Alegra cotizaciones sync:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
