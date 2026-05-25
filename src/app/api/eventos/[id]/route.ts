import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await prisma.eventos.findUnique({
      where: { id }
    })

    if (!data) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      nombre,
      tipo,
      fecha_inicio,
      fecha_fin,
      ubicacion,
      responsable,
      presupuesto,
      estado,
      descripcion
    } = body

    const data = await prisma.eventos.update({
      where: { id },
      data: {
        nombre,
        tipo,
        fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : undefined,
        fecha_fin: fecha_fin !== undefined ? (fecha_fin ? new Date(fecha_fin) : null) : undefined,
        ubicacion,
        responsable,
        presupuesto: presupuesto !== undefined ? (presupuesto ? Number(presupuesto) : null) : undefined,
        estado,
        descripcion
      }
    })

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('Error in PATCH /api/eventos/[id]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    await prisma.eventos.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/eventos/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
