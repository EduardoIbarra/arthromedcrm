import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// POST /api/clients/[id]/activities
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  try {
    const data = await prisma.client_activities.create({
      data: {
        client_id: id,
        type: body.type,
        content: body.content,
        created_by: body.created_by || 'Usuario',
      }
    })

    // Update last_contact_at
    await prisma.clients.update({
      where: { id },
      data: { last_contact_at: new Date() }
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET /api/clients/[id]/activities
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const data = await prisma.client_activities.findMany({
      where: { client_id: id },
      orderBy: { created_at: 'desc' },
      take: 50
    })
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
