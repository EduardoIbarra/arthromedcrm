import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const { activity, date, time, location, notes } = body

    if (!activity || !date) {
      return NextResponse.json({ error: 'La actividad y la fecha son campos requeridos.' }, { status: 400 })
    }

    const data = await prisma.congreso_itinerarios.create({
      data: {
        congreso_id: id,
        activity,
        date: new Date(date),
        time: time || null,
        location: location || null,
        notes: notes || null
      }
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
