import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SORTABLE = new Set([
  'codigo',
  'empresa_nombre',
  'rfc',
  'destinatario',
  'estado_region',
  'vigencia',
  'fecha_creacion',
  'created_at',
])

/**
 * GET /api/cartas-distribucion
 * List distribution letters with search, client/institution filters, and sorting.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim()
    const clientId = (searchParams.get('client_id') || '').trim()
    const destinatario = (searchParams.get('destinatario') || '').trim()
    const sortRaw = (searchParams.get('sort') || 'created_at').trim()
    const orderRaw = (searchParams.get('order') || 'desc').toLowerCase()
    const sort = SORTABLE.has(sortRaw) ? sortRaw : 'created_at'
    const order = orderRaw === 'asc' ? 'asc' : 'desc'
    const status = (searchParams.get('status') || 'active').trim().toLowerCase()

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const where: any = {}

    if (status === 'expired') {
      where.vigencia = { lt: today }
    } else {
      where.vigencia = { gte: today }
    }

    if (clientId) {
      where.client_id = clientId
    }

    if (destinatario) {
      where.destinatario = { equals: destinatario, mode: 'insensitive' }
    }

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { empresa_nombre: { contains: search, mode: 'insensitive' } },
        { rfc: { contains: search, mode: 'insensitive' } },
        { destinatario: { contains: search, mode: 'insensitive' } },
        { estado_region: { contains: search, mode: 'insensitive' } },
        { clients: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ]
    }

    const [rows, institutions, clientsWithCartas] = await Promise.all([
      prisma.cartas_distribucion.findMany({
        where,
        orderBy: { [sort]: order },
        include: {
          clients: {
            select: {
              id: true,
              name: true,
              rfc: true,
              distributor_id: true,
            },
          },
        },
      }),
      // Distinct institutions (destinatario) for filter dropdown
      prisma.cartas_distribucion.findMany({
        where: { destinatario: { not: null } },
        select: { destinatario: true },
        distinct: ['destinatario'],
        orderBy: { destinatario: 'asc' },
      }),
      prisma.cartas_distribucion.findMany({
        where: { client_id: { not: null } },
        select: {
          client_id: true,
          clients: { select: { id: true, name: true } },
        },
        distinct: ['client_id'],
      }),
    ])

    const data = rows.map((c: any) => ({
      id: c.id,
      codigo: c.codigo,
      empresa_nombre: c.empresa_nombre,
      rfc: c.rfc,
      estado_region: c.estado_region,
      destinatario: c.destinatario,
      lineas_producto: c.lineas_producto || [],
      vigencia: c.vigencia,
      fecha_creacion: c.fecha_creacion,
      created_at: c.created_at,
      letter_url: c.letter_url,
      client_id: c.client_id,
      client_name: c.clients?.name || c.empresa_nombre || null,
      distributor_id: c.clients?.distributor_id || null,
    }))

    const clientOptionsMap = new Map<string, { id: string; name: string }>()
    for (const row of clientsWithCartas as any[]) {
      if (row.client_id && row.clients?.name) {
        clientOptionsMap.set(row.client_id, { id: row.client_id, name: row.clients.name })
      }
    }
    // Also include empresa_nombre as fallback labels when client missing from join
    for (const c of data) {
      if (c.client_id && !clientOptionsMap.has(c.client_id) && c.client_name) {
        clientOptionsMap.set(c.client_id, { id: c.client_id, name: c.client_name })
      }
    }

    const institutionOptions = (institutions as any[])
      .map(r => r.destinatario)
      .filter((v: string | null): v is string => !!v && v.trim().length > 0)
      .sort((a: string, b: string) => a.localeCompare(b, 'es'))

    return NextResponse.json({
      data,
      filters: {
        clients: Array.from(clientOptionsMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name, 'es')
        ),
        institutions: institutionOptions,
      },
    })
  } catch (error: any) {
    console.error('[GET /api/cartas-distribucion]', error)
    return NextResponse.json({ error: error.message || 'Error al listar cartas' }, { status: 500 })
  }
}
