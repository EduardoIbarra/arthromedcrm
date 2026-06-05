import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const doctors = await prisma.doctors.findMany({
      orderBy: { name: 'asc' }
    })
    return NextResponse.json({ data: doctors })
  } catch (error: any) {
    console.error('Error fetching doctors:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, specialty_ids, country, avatar_url, phone, email, notes } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const doctor = await prisma.doctors.create({
      data: {
        name,
        specialty_ids: specialty_ids || [],
        country: country || 'Mexico',
        avatar_url,
        phone,
        email,
        notes
      }
    })

    return NextResponse.json({ data: doctor })
  } catch (error: any) {
    console.error('Error creating doctor:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
