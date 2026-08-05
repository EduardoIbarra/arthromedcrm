import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const logs = await prisma.car_fleet_incidents.findMany({
      where: { car_id: id },
      include: {
        reported_by: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          }
        }
      },
      orderBy: { date: 'desc' }
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
    const { title, severity, description, date, cost, status, reported_by_id, notes } = body

    if (!title || !description || !date) {
      return NextResponse.json({ error: 'Title, description and date are required' }, { status: 400 })
    }

    const log = await prisma.car_fleet_incidents.create({
      data: {
        car_id: id,
        title,
        severity: severity || 'minor',
        description,
        date: new Date(date),
        cost: cost ? parseFloat(cost) : null,
        status: status || 'open',
        reported_by_id: reported_by_id || null,
        notes: notes || null,
      },
      include: {
        reported_by: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          }
        }
      }
    })

    return NextResponse.json({ data: log }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating incident log:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const { incident_id, title, severity, description, date, cost, status, reported_by_id, notes } = body

    if (!incident_id) {
      return NextResponse.json({ error: 'incident_id is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (severity !== undefined) updateData.severity = severity
    if (description !== undefined) updateData.description = description
    if (date !== undefined) updateData.date = new Date(date)
    if (cost !== undefined) updateData.cost = cost ? parseFloat(cost) : null
    if (status !== undefined) updateData.status = status
    if (reported_by_id !== undefined) updateData.reported_by_id = reported_by_id || null
    if (notes !== undefined) updateData.notes = notes || null

    const updated = await prisma.car_fleet_incidents.update({
      where: { id: incident_id },
      data: updateData,
      include: {
        reported_by: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          }
        }
      }
    })

    return NextResponse.json({ data: updated })
  } catch (error: any) {
    console.error('Error updating incident log:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { searchParams } = new URL(request.url)
    const incident_id = searchParams.get('incident_id')

    if (!incident_id) {
      return NextResponse.json({ error: 'incident_id parameter is required' }, { status: 400 })
    }

    await prisma.car_fleet_incidents.delete({
      where: { id: incident_id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting incident log:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

