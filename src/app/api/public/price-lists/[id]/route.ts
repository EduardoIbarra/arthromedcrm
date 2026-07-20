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

// GET /api/public/price-lists/[id]
// Public — returns publication metadata + price list items for QR validation
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const publication = await prisma.price_list_publications.findUnique({
      where: { id },
    })

    if (!publication) {
      return NextResponse.json({ error: 'Lista de precios no encontrada' }, { status: 404 })
    }

    const effectiveStatus = computeStatus(publication)

    // Load products in official list order
    const productsData = await prisma.products.findMany({
      where: { sort_order: { not: null } },
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        model: true,
        order_code: true,
        description: true,
        line: true,
        sort_order: true,
        base_hospital_price: true,
      },
    })

    let priceMap = new Map<string, number>()
    if (publication.hospital_id) {
      const hospitalPrices = await prisma.hospital_prices.findMany({
        where: { hospital_id: publication.hospital_id },
      })
      hospitalPrices.forEach((hp: { product_id: string; price: unknown }) =>
        priceMap.set(hp.product_id, Number(hp.price))
      )
    }

    const items = productsData.map((p: (typeof productsData)[number]) => {
      const custom = priceMap.get(p.id)
      const price =
        custom !== undefined
          ? custom
          : p.base_hospital_price != null
            ? Number(p.base_hospital_price)
            : null
      return {
        model: p.model || '',
        order_code: p.order_code || '',
        description: p.description || '',
        line: p.line || 'General',
        sort_order: p.sort_order,
        price,
      }
    })

    return NextResponse.json({
      publication: {
        id: publication.id,
        hospital_id: publication.hospital_id,
        hospital_name: publication.hospital_name,
        document_date: publication.document_date,
        vigencia: publication.vigencia,
        status: publication.status,
        effective_status: effectiveStatus,
        revoked_at: publication.revoked_at,
        revoke_reason: publication.revoke_reason,
        include_iva: publication.include_iva,
        currency: publication.currency,
        min_purchase: Number(publication.min_purchase),
        delivery_time: publication.delivery_time,
        created_at: publication.created_at,
      },
      items,
    })
  } catch (error: any) {
    console.error('public price-list error', error)
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 })
  }
}
