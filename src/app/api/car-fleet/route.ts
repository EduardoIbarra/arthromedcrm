import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const cars = await prisma.car_fleet.findMany({
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
      },
      orderBy: [
        { make: 'asc' },
        { model: 'asc' }
      ]
    })
    return NextResponse.json({ data: cars })
  } catch (error: any) {
    console.error('Error fetching car fleet:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { alias, make, model, year, plate_number, color, status, notes, assigned_to_id } = body

    if (!make || !model || !year || !plate_number) {
      return NextResponse.json({ error: 'Make, model, year, and plate number are required.' }, { status: 400 })
    }

    const car = await prisma.car_fleet.create({
      data: {
        alias: alias || null,
        make,
        model,
        year: parseInt(year),
        plate_number,
        color: color || null,
        status: status || 'available',
        notes: notes || null,
        assigned_to_id: assigned_to_id || null,
      },
      include: {
        assigned_to: true
      }
    })

    return NextResponse.json({ data: car }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating car:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
