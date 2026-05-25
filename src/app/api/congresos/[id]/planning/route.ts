import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const congreso = await prisma.congresos.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        start_date: true,
        end_date: true,
        location: true
      }
    })

    if (!congreso) {
      return NextResponse.json({ error: 'Congreso no encontrado' }, { status: 404 })
    }

    const itineraryItems = await prisma.congreso_itinerarios.findMany({
      where: { congreso_id: id },
      orderBy: [
        { date: 'asc' },
        { time: 'asc' }
      ]
    })

    const travelers = await prisma.congreso_viajeros.findMany({
      where: { congreso_id: id },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({
      data: {
        congreso,
        itineraryItems,
        travelers
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const { itineraryItems, travelers, override } = body

    const result = await prisma.$transaction(async (tx: any) => {
      // If override is true, delete existing planning records
      if (override) {
        await tx.congreso_itinerarios.deleteMany({ where: { congreso_id: id } })
        await tx.congreso_viajeros.deleteMany({ where: { congreso_id: id } })
      }

      let createdItinerary = []
      let createdTravelers = []

      if (itineraryItems && itineraryItems.length > 0) {
        createdItinerary = await Promise.all(
          itineraryItems.map((item: any) =>
            tx.congreso_itinerarios.create({
              data: {
                congreso_id: id,
                activity: item.activity,
                date: new Date(item.date),
                time: item.time || null,
                location: item.location || null,
                notes: item.notes || null
              }
            })
          )
        )
      }

      if (travelers && travelers.length > 0) {
        createdTravelers = await Promise.all(
          travelers.map((t: any) =>
            tx.congreso_viajeros.create({
              data: {
                congreso_id: id,
                name: t.name,
                role: t.role || null,
                has_pin: !!t.has_pin,
                has_gafete: !!t.has_gafete,
                notes: t.notes || null
              }
            })
          )
        )
      }

      return {
        itineraryItems: createdItinerary,
        travelers: createdTravelers
      }
    })

    return NextResponse.json({ data: result })
  } catch (error: any) {
    console.error('Error in POST /api/congresos/[id]/planning:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
