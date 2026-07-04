import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import prisma from '@/lib/prisma'
import { ClientInsert } from '@/types/database'
import { generateDistributorId } from '@/lib/distributor-id'

type FacturaRow = {
  id: string
  numero_factura: string
  cliente_rfc: string | null
  cliente_nombre: string
  fecha_expedicion: Date
  fecha_pago: Date | null
}

type PurchaseEnrichment = {
  last_purchase_date: Date | null
  last_factura_id: string | null
  last_factura_numero: string | null
  latest_payment_date: Date | null
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase()
}

function buildFacturaIndexes(facturas: FacturaRow[]) {
  const byRfc = new Map<string, FacturaRow[]>()
  const byName = new Map<string, FacturaRow[]>()

  for (const factura of facturas) {
    if (factura.cliente_rfc) {
      const key = normalizeKey(factura.cliente_rfc)
      const list = byRfc.get(key) || []
      list.push(factura)
      byRfc.set(key, list)
    }

    const nameKey = normalizeKey(factura.cliente_nombre)
    const nameList = byName.get(nameKey) || []
    nameList.push(factura)
    byName.set(nameKey, nameList)
  }

  return { byRfc, byName }
}

function getMatchedFacturas(
  client: { rfc?: string | null; name: string },
  indexes: ReturnType<typeof buildFacturaIndexes>
) {
  const seen = new Set<string>()
  const matched: FacturaRow[] = []

  if (client.rfc) {
    for (const factura of indexes.byRfc.get(normalizeKey(client.rfc)) || []) {
      if (!seen.has(factura.id)) {
        seen.add(factura.id)
        matched.push(factura)
      }
    }
  }

  if (client.name) {
    for (const factura of indexes.byName.get(normalizeKey(client.name)) || []) {
      if (!seen.has(factura.id)) {
        seen.add(factura.id)
        matched.push(factura)
      }
    }
  }

  return matched
}

function enrichClientWithFacturas(
  client: { rfc?: string | null; name: string },
  indexes: ReturnType<typeof buildFacturaIndexes>
): PurchaseEnrichment {
  const matched = getMatchedFacturas(client, indexes)

  if (matched.length === 0) {
    return {
      last_purchase_date: null,
      last_factura_id: null,
      last_factura_numero: null,
      latest_payment_date: null,
    }
  }

  let latestPurchase = matched[0]
  let latestPayment: Date | null = null

  for (const factura of matched) {
    if (factura.fecha_expedicion > latestPurchase.fecha_expedicion) {
      latestPurchase = factura
    }
    if (factura.fecha_pago && (!latestPayment || factura.fecha_pago > latestPayment)) {
      latestPayment = factura.fecha_pago
    }
  }

  return {
    last_purchase_date: latestPurchase.fecha_expedicion,
    last_factura_id: latestPurchase.id,
    last_factura_numero: latestPurchase.numero_factura,
    latest_payment_date: latestPayment,
  }
}

async function loadActiveFacturas() {
  return prisma.facturas_cliente.findMany({
    where: { estado: { notIn: ['anulado', 'cancelada'] } },
    select: {
      id: true,
      numero_factura: true,
      cliente_rfc: true,
      cliente_nombre: true,
      fecha_expedicion: true,
      fecha_pago: true,
    },
  })
}

function applyClientFilters(
  query: ReturnType<typeof supabase.from>,
  params: {
    search: string
    status: string
    state: string
    specialty: string
    congreso: string
    isProspect: boolean
    source: string
    assigned_to: string
  }
) {
  let filteredQuery = query

  if (params.search) {
    filteredQuery = filteredQuery.or(
      `name.ilike.%${params.search}%,rfc.ilike.%${params.search}%,phone.ilike.%${params.search}%,email_contact.ilike.%${params.search}%`
    )
  }
  if (params.status) {
    filteredQuery = filteredQuery.eq('status', params.status)
  } else if (params.isProspect) {
    filteredQuery = filteredQuery.not('status', 'in', '("Activo","Inactivo")')
  }
  if (params.state) {
    filteredQuery = filteredQuery.contains('states', [params.state])
  }
  if (params.specialty) {
    filteredQuery = filteredQuery.contains('specialties', [params.specialty])
  }
  if (params.congreso) {
    filteredQuery = filteredQuery.contains('tags', [`congreso:${params.congreso}`])
  }
  if (params.source) {
    filteredQuery = filteredQuery.eq('source', params.source)
  } else {
    filteredQuery = filteredQuery.or('source.is.null,source.neq."Formulario Público"')
  }
  if (params.assigned_to) {
    filteredQuery = filteredQuery.eq('assigned_to', params.assigned_to)
  }

  return filteredQuery
}

async function enrichWithCartasCount(clients: any[]) {
  if (clients.length === 0) return clients

  const clientIds = clients.map((client) => client.id)
  const cartasCounts = await prisma.cartas_distribucion.groupBy({
    by: ['client_id'],
    where: { client_id: { in: clientIds } },
    _count: { id: true },
  })

  const cartasMap = Object.fromEntries(
    cartasCounts.map((entry: { client_id: string; _count: { id: number } }) => [entry.client_id, entry._count.id])
  )

  return clients.map((client) => ({
    ...client,
    cartas_count: cartasMap[client.id] || 0,
  }))
}

// GET /api/clients — list with filters
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const state = searchParams.get('state') || ''
  const specialty = searchParams.get('specialty') || ''
  const congreso = searchParams.get('congreso') || ''
  const isProspect = searchParams.get('is_prospect') === 'true'
  const source = searchParams.get('source') || ''
  const assigned_to = searchParams.get('assigned_to') || ''
  const withPurchases = searchParams.get('with_purchases') === 'true'
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')

  const filterParams = {
    search,
    status,
    state,
    specialty,
    congreso,
    isProspect,
    source,
    assigned_to,
  }

  if (withPurchases) {
    let query = supabase.from('clients').select('*')
    query = applyClientFilters(query, filterParams)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const facturas = await loadActiveFacturas()
    const facturaIndexes = buildFacturaIndexes(facturas)

    let enrichedData = (data || []).map((client: any) => {
      const purchase = enrichClientWithFacturas(client, facturaIndexes)
      return {
        ...client,
        ...purchase,
        last_purchase_date: purchase.last_purchase_date?.toISOString().slice(0, 10) || null,
        latest_payment_date: purchase.latest_payment_date?.toISOString().slice(0, 10) || null,
      }
    })

    enrichedData = enrichedData.filter((client: any) => client.last_purchase_date)
    enrichedData.sort((a: any, b: any) => {
      const dateA = new Date(a.last_purchase_date).getTime()
      const dateB = new Date(b.last_purchase_date).getTime()
      return dateA - dateB
    })

    const totalCount = enrichedData.length
    const start = (page - 1) * pageSize
    const paginatedData = enrichedData.slice(start, start + pageSize)
    const withCartas = await enrichWithCartasCount(paginatedData)

    return NextResponse.json({ data: withCartas, count: totalCount, page, pageSize })
  }

  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  query = applyClientFilters(query, filterParams)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let enrichedData = data || []
  if (enrichedData.length > 0) {
    const facturas = await loadActiveFacturas()
    const facturaIndexes = buildFacturaIndexes(facturas)

    enrichedData = enrichedData.map((client: any) => {
      const purchase = enrichClientWithFacturas(client, facturaIndexes)
      return {
        ...client,
        last_purchase_date: purchase.last_purchase_date?.toISOString().slice(0, 10) || null,
        last_factura_id: purchase.last_factura_id,
        last_factura_numero: purchase.last_factura_numero,
        latest_payment_date: purchase.latest_payment_date?.toISOString().slice(0, 10) || null,
      }
    })

    enrichedData = await enrichWithCartasCount(enrichedData)
  }

  return NextResponse.json({ data: enrichedData, count, page, pageSize })
}

// POST /api/clients — create client
export async function POST(request: NextRequest) {
  const body: ClientInsert = await request.json()

  // Auto-assign distributor ID for new active distributors
  if (body.status === 'Activo' && !body.distributor_id) {
    body.distributor_id = await generateDistributorId()
  }

  try {
    const data = await prisma.clients.create({
      data: {
        name: body.name,
        rfc: body.rfc,
        zip_code: body.zip_code,
        fiscal_address: body.fiscal_address,
        email_primary: body.email_primary,
        email_billing: body.email_billing,
        email_contact: body.email_contact,
        phone: body.phone,
        whatsapp_phone: body.whatsapp_phone,
        states: body.states || [],
        hospitals: body.hospitals || [],
        specialties: body.specialties || [],
        tax_regime: body.tax_regime,
        status: body.status || 'Nuevo Prospecto',
        notes: body.notes,
        tags: body.tags || [],
        assigned_to: body.assigned_to,
        source: body.source,
        legal_representative: body.legal_representative,
        distributor_id: body.distributor_id,
        letter_created_at: body.letter_created_at ? new Date(body.letter_created_at) : null,
        letter_expires_at: body.letter_expires_at ? new Date(body.letter_expires_at) : null,
        letter_url: body.letter_url,
        avatar_url: body.avatar_url,
        addresses: body.addresses || []
      }
    })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}