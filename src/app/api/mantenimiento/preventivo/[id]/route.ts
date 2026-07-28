import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const record = await prisma.mantenimiento_preventivo.findFirst({
      where: { id, deleted_at: null },
    })

    if (!record) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
    }

    return NextResponse.json(record)
  } catch (error: any) {
    console.error('Error fetching preventivo record:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const record = await prisma.mantenimiento_preventivo.update({
      where: { id },
      data: {
        ...body,
        updated_at: new Date(),
      },
    })

    return NextResponse.json(record)
  } catch (error: any) {
    console.error('Error updating preventivo record:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.mantenimiento_preventivo.update({
      where: { id },
      data: { deleted_at: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting preventivo record:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
