import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { comentario } = body

    if (!comentario || typeof comentario !== 'string' || comentario.trim() === '') {
      return NextResponse.json({ error: 'El comentario no puede estar vacío' }, { status: 400 })
    }

    const newComment = await prisma.cotizacion_comentarios.create({
      data: {
        cotizacion_id: id,
        comentario: comentario.trim()
      }
    })

    return NextResponse.json({ data: newComment })
  } catch (err: any) {
    console.error('[POST /api/cotizaciones/[id]/comments] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
