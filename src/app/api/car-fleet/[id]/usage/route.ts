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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const { usage_id, title, user_id, date_time, location, notes } = body

    if (!usage_id) {
      return NextResponse.json({ error: 'usage_id is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (user_id !== undefined) updateData.user_id = user_id || null
    if (date_time !== undefined) updateData.date_time = new Date(date_time)
    if (location !== undefined) updateData.location = location || null
    if (notes !== undefined) updateData.notes = notes || null
    updateData.updated_at = new Date()

    const updated = await prisma.car_fleet_usage.update({
      where: { id: usage_id },
      data: updateData
    })

    return NextResponse.json({ data: updated })
  } catch (error: any) {
    console.error('Error updating car usage log:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { searchParams } = new URL(request.url)
    const usage_id = searchParams.get('usage_id')

    if (!usage_id) {
      return NextResponse.json({ error: 'usage_id parameter is required' }, { status: 400 })
    }

    await prisma.car_fleet_usage.delete({
      where: { id: usage_id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting car usage log:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
