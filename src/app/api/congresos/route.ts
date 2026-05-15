import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const data = await prisma.congresos.findMany({
      include: {
        workshops: true,
        contacts: true
      },
      orderBy: {
        start_date: 'desc'
      }
    })
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      name, 
      start_date, 
      end_date, 
      location, 
      description, 
      flyer, 
      specialty_ids,
      workshops,
      contacts 
    } = body

    if (!name || !start_date || !end_date || !location) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const data = await prisma.congresos.create({
      data: {
        name,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        location,
        description: description || '',
        flyer,
        specialty_ids: specialty_ids || [],
        workshops: {
          create: (workshops || []).map((w: any) => ({
            name: w.name,
            date_time: new Date(w.date_time),
            max_people: Number(w.max_people),
            cost: w.cost ? Number(w.cost) : null,
            professor: w.professor
          }))
        },
        contacts: {
          create: (contacts || []).map((c: any) => ({
            name: c.name,
            number: c.number,
            email: c.email
          }))
        }
      },
      include: {
        workshops: true,
        contacts: true
      }
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    console.error('Error in POST /api/congresos:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
