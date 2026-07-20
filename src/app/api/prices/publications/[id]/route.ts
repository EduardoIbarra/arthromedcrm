import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PATCH /api/prices/publications/[id] — revoke or update vigencia
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const existing = await prisma.price_list_publications.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 })
    }

    const data: any = { updated_at: new Date() }

    if (body.action === 'revoke') {
      data.status = 'revoked'
      data.revoked_at = new Date()
      data.revoke_reason = body.reason?.toString().trim() || 'Revocada por el emisor'
    } else if (body.action === 'reactivate') {
      data.status = 'active'
      data.revoked_at = null
      data.revoke_reason = null
    } else {
      if (body.vigencia) {
        data.vigencia = new Date(String(body.vigencia) + 'T12:00:00')
      }
      if (typeof body.revoke_reason === 'string') {
        data.revoke_reason = body.revoke_reason
      }
    }

    const pub = await prisma.price_list_publications.update({
      where: { id },
      data,
    })

    const vig = pub.vigencia instanceof Date
      ? pub.vigencia.toISOString().slice(0, 10)
      : String(pub.vigencia).slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)
    const effective_status =
      pub.status === 'revoked' ? 'revoked' : vig < today ? 'expired' : 'active'

    return NextResponse.json({
      publication: {
        ...pub,
        min_purchase: Number(pub.min_purchase),
        effective_status,
      },
    })
  } catch (error: any) {
    console.error('patch publication error', error)
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 })
  }
}
