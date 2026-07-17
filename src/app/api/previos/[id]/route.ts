import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const previo = await prisma.previos.findUnique({
      where: { id },
      include: {
        detalle_previo: {
          orderBy: { orden: 'asc' }
        },
      }
    })

    if (!previo) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ data: previo })
  } catch (error) {
    console.error('Error in /api/previos/[id]:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { items } = body

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 })
    }

    await Promise.all(
      items.map((item: any) =>
        prisma.detalle_previo.update({
          where: { id: item.id },
          data: { orden: item.orden }
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in PUT /api/previos/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
