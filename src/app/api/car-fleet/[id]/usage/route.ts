import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const logs = await prisma.car_fleet_usage.findMany({
      where: { car_id: id },
      include: {
        user_profiles: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            position: true,
          }
        }
      },
      orderBy: { date_time: 'desc' }
    })
    return NextResponse.json({ data: logs })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const { title, user_id, date_time, location, notes } = body

    if (!title || !date_time) {
      return NextResponse.json({ error: 'Título y fecha/hora son obligatorios' }, { status: 400 })
    }

    const usageRecord = await prisma.car_fleet_usage.create({
      data: {
        car_id: id,
        user_id: user_id || null,
        title,
        date_time: new Date(date_time),
        location: location || null,
        notes: notes || null,
      },
      include: {
        user_profiles: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            position: true,
          }
        }
      }
    })

    return NextResponse.json({ data: usageRecord }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating car usage log:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
