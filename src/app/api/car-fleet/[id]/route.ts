import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const car = await prisma.car_fleet.findUnique({
      where: { id },
      include: {
        assigned_to: {
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
    if (!car) {
      return NextResponse.json({ error: 'Car not found' }, { status: 404 })
    }
    return NextResponse.json({ data: car })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const { make, model, year, plate_number, color, status, notes, assigned_to_id } = body

    const updateData: any = {}
    if (make !== undefined) updateData.make = make
    if (model !== undefined) updateData.model = model
    if (year !== undefined) updateData.year = parseInt(year)
    if (plate_number !== undefined) updateData.plate_number = plate_number
    if (color !== undefined) updateData.color = color || null
    if (status !== undefined) updateData.status = status
    if (notes !== undefined) updateData.notes = notes || null
    if (assigned_to_id !== undefined) updateData.assigned_to_id = assigned_to_id || null

    const car = await prisma.car_fleet.update({
      where: { id },
      data: updateData,
      include: {
        assigned_to: {
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
    return NextResponse.json({ data: car })
  } catch (error: any) {
    console.error('Error updating car:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await prisma.car_fleet.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting car:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
