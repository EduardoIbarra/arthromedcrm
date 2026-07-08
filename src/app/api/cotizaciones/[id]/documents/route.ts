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
    const { nombre, url } = body

    if (!nombre || !url) {
      return NextResponse.json({ error: 'Nombre y URL del documento son requeridos' }, { status: 400 })
    }

    const newDoc = await prisma.cotizacion_documentos.create({
      data: {
        cotizacion_id: id,
        nombre: nombre.trim(),
        url: url.trim()
      }
    })

    return NextResponse.json({ data: newDoc })
  } catch (err: any) {
    console.error('[POST /api/cotizaciones/[id]/documents] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
