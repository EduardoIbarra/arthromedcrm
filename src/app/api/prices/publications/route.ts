import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function computeStatus(pub: { status: string; vigencia: Date }): 'active' | 'revoked' | 'expired' {
  if (pub.status === 'revoked') return 'revoked'
  const vig = pub.vigencia instanceof Date
    ? pub.vigencia.toISOString().slice(0, 10)
    : String(pub.vigencia).slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  if (vig < today) return 'expired'
  return 'active'
}

// GET /api/prices/publications?hospitalId=...
export async function GET(request: NextRequest) {
  try {
    const hospitalId = request.nextUrl.searchParams.get('hospitalId')
    if (!hospitalId) {
      return NextResponse.json({ error: 'hospitalId requerido' }, { status: 400 })
    }

    const rows = await prisma.price_list_publications.findMany({
      where: { hospital_id: hospitalId },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json({
      publications: rows.map((p: (typeof rows)[number]) => ({
        ...p,
        min_purchase: Number(p.min_purchase),
        effective_status: computeStatus(p),
      })),
    })
  } catch (error: any) {
    console.error('list publications error', error)
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 })
  }
}

// POST /api/prices/publications — create a publication (used by export)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const hospitalId = body.hospitalId as string | null
    const documentDate = body.documentDate as string // YYYY-MM-DD
    const vigencia = body.vigencia as string // YYYY-MM-DD
    const includeIva = Boolean(body.includeIva)
    const currency = (body.currency || 'MXN').toString().toUpperCase().slice(0, 8)
    const minPurchase = Number(body.minPurchase ?? 72500)
    const deliveryTime = (body.deliveryTime || '15 días hábiles').toString()

    if (!documentDate || !vigencia) {
      return NextResponse.json({ error: 'documentDate y vigencia son requeridos' }, { status: 400 })
    }

    let hospitalName = 'Lista General de Distribuidor'
    if (hospitalId && hospitalId !== 'base') {
      const hospital = await prisma.hospitals.findUnique({ where: { id: hospitalId } })
      if (!hospital) {
        return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
      }
      hospitalName = hospital.name
    }

    const parseYmdUtc = (ymd: string) => {
      const [y, m, d] = ymd.split('-').map(Number)
      return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    }

    const pub = await prisma.price_list_publications.create({
      data: {
        hospital_id: hospitalId && hospitalId !== 'base' ? hospitalId : null,
        hospital_name: hospitalName,
        document_date: parseYmdUtc(documentDate),
        vigencia: parseYmdUtc(vigencia),
        status: 'active',
        include_iva: includeIva,
        currency,
        min_purchase: minPurchase,
        delivery_time: deliveryTime,
      },
    })

    return NextResponse.json({
      publication: {
        ...pub,
        min_purchase: Number(pub.min_purchase),
        effective_status: 'active',
      },
    })
  } catch (error: any) {
    console.error('create publication error', error)
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 })
  }
}
