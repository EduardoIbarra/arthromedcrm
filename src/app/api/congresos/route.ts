import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await prisma.congresos.findMany({
      include: {
        congress_workshops: true,
        congress_contacts: true
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
      terms_doctor,
      terms_distributor,
      enable_workshops,
      global_budget,
      video_urls,
      workshops,
      contacts,
      gastos_estimados
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
        terms_doctor: terms_doctor || '',
        terms_distributor: terms_distributor || '',
        enable_workshops: enable_workshops !== false,
        global_budget: global_budget ? Number(global_budget) : null,
        video_urls: video_urls || [],
        congress_workshops: {
          create: (workshops || []).map((w: any) => ({
            name: w.name,
            date_time: new Date(w.date_time),
            end_date_time: w.end_date_time ? new Date(w.end_date_time) : null,
            max_people: Number(w.max_people),
            cost: w.cost ? Number(w.cost) : null,
            professor: w.professor
          }))
        },
        congress_contacts: {
          create: (contacts || []).map((c: any) => ({
            name: c.name,
            number: c.number,
            email: c.email
          }))
        },
        congreso_gastos_estimados: {
          create: (gastos_estimados || []).map((ge: any) => ({
            category_id: ge.category_id,
            amount: Number(ge.amount)
          }))
        }
      },
      include: {
        congress_workshops: true,
        congress_contacts: true,
        congreso_gastos_estimados: true
      }
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    console.error('Error in POST /api/congresos:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
