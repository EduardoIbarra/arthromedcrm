import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await prisma.eventos.findMany({
      orderBy: {
        fecha_inicio: 'asc'
      }
    })
    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error fetching events:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
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
      descripcion,
      created_by
    } = body

    if (!nombre || !fecha_inicio) {
      return NextResponse.json({ error: 'Nombre y fecha de inicio son requeridos' }, { status: 400 })
    }

    const data = await prisma.eventos.create({
      data: {
        nombre,
        tipo: tipo || 'actividad',
        fecha_inicio: new Date(fecha_inicio),
        fecha_fin: fecha_fin ? new Date(fecha_fin) : null,
        ubicacion: ubicacion || null,
        responsable: responsable || null,
        presupuesto: presupuesto ? Number(presupuesto) : null,
        estado: estado || 'planificado',
        descripcion: descripcion || null,
        created_by: created_by || null,
      }
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    console.error('Error in POST /api/eventos:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
