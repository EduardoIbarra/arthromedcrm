import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; travelerId: string }> }
) {
  const { travelerId } = await params
  try {
    const body = await request.json()
    const { name, role, has_pin, has_gafete, notes } = body

    const data = await prisma.congreso_viajeros.update({
      where: { id: travelerId },
      data: {
        name: name !== undefined ? name : undefined,
        role: role !== undefined ? role : undefined,
        has_pin: has_pin !== undefined ? !!has_pin : undefined,
        has_gafete: has_gafete !== undefined ? !!has_gafete : undefined,
        notes: notes !== undefined ? notes : undefined
      }
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; travelerId: string }> }
) {
  const { travelerId } = await params
  try {
    await prisma.congreso_viajeros.delete({
      where: { id: travelerId }
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
