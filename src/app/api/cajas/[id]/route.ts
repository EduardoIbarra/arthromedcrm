import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, largo, ancho, alto, unidad, peso_max, color, descripcion, notas } = body

    if (!name) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 })
    }

    const data = await prisma.cajas.update({
      where: { id },
      data: {
        name,
        largo: largo !== undefined && largo !== null && largo !== '' ? parseFloat(largo) : null,
        ancho: ancho !== undefined && ancho !== null && ancho !== '' ? parseFloat(ancho) : null,
        alto: alto !== undefined && alto !== null && alto !== '' ? parseFloat(alto) : null,
        unidad: unidad || 'cm',
        peso_max: peso_max !== undefined && peso_max !== null && peso_max !== '' ? parseFloat(peso_max) : null,
        color: color || '#0763a9',
        descripcion: descripcion || '',
        notas: notas || '',
        updated_at: new Date()
      }
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error in PATCH /api/cajas/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    await prisma.cajas.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/cajas/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
