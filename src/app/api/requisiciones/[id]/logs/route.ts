import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Access denied' }, { status: 401 })
    }

    const body = await request.json()
    const { usuario, accion, archivo_url, archivo_nombre } = body

    if (!usuario || !accion) {
      return NextResponse.json({ error: 'Missing usuario or accion' }, { status: 400 })
    }

    const log = await prisma.requisicion_logs.create({
      data: {
        requisicion_id: id,
        usuario,
        accion,
        archivo_url: archivo_url || null,
        archivo_nombre: archivo_nombre || null
      }
    })

    return NextResponse.json({ data: log })
  } catch (error: any) {
    console.error('Error in POST /api/requisiciones/[id]/logs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
