import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await prisma.cajas.findMany({
      orderBy: {
        name: 'asc'
      }
    })
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, largo, ancho, alto, unidad, peso_max, color, descripcion, notas } = body

    if (!name) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 })
    }

    const data = await prisma.cajas.create({
      data: {
        name,
        largo: largo !== undefined && largo !== null && largo !== '' ? parseFloat(largo) : null,
        ancho: ancho !== undefined && ancho !== null && ancho !== '' ? parseFloat(ancho) : null,
        alto: alto !== undefined && alto !== null && alto !== '' ? parseFloat(alto) : null,
        unidad: unidad || 'cm',
        peso_max: peso_max !== undefined && peso_max !== null && peso_max !== '' ? parseFloat(peso_max) : null,
        color: color || '#0763a9',
        descripcion: descripcion || '',
        notas: notas || ''
      }
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    console.error('Error in POST /api/cajas:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
