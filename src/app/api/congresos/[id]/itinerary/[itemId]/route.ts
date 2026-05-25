import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { itemId } = await params
  try {
    const body = await request.json()
    const { activity, date, time, location, notes } = body

    const data = await prisma.congreso_itinerarios.update({
      where: { id: itemId },
      data: {
        activity,
        date: date ? new Date(date) : undefined,
        time: time !== undefined ? time : undefined,
        location: location !== undefined ? location : undefined,
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
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { itemId } = await params
  try {
    await prisma.congreso_itinerarios.delete({
      where: { id: itemId }
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
