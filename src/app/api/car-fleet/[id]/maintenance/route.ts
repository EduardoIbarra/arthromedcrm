import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const logs = await prisma.car_fleet_maintenance.findMany({
      where: { car_id: id },
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
    const { title, type, description, cost, status, date, next_due_date, performed_by, notes } = body

    if (!title || !date) {
      return NextResponse.json({ error: 'Title and date are required' }, { status: 400 })
    }

    const log = await prisma.car_fleet_maintenance.create({
      data: {
        car_id: id,
        title,
        type: type || 'preventive',
        description: description || null,
        cost: cost ? parseFloat(cost) : null,
        status: status || 'scheduled',
        date: new Date(date),
        next_due_date: next_due_date ? new Date(next_due_date) : null,
        performed_by: performed_by || null,
        notes: notes || null,
      }
    })

    return NextResponse.json({ data: log }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating maintenance log:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
