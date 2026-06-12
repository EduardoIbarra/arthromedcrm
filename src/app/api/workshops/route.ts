import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await prisma.congress_workshops.findMany({
      include: {
        congresos: true,
        congress_workshop_doctors: { include: { doctors: true } },
        _count: { select: { congress_workshop_enrollments: true } }
      },
      orderBy: { date_time: 'desc' },
    })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, congress_id, date_time, max_people, cost, professor, doctorIds, flyer, description } = body

    if (!name || !date_time || !max_people) {
      return NextResponse.json({ error: 'Faltan campos requeridos.' }, { status: 400 })
    }

    const docIds = Array.isArray(doctorIds) ? doctorIds : []

    const workshop = await prisma.congress_workshops.create({
      data: {
        name,
        date_time: new Date(date_time),
        max_people: parseInt(max_people),
        cost: cost ? parseFloat(cost) : null,
        professor: professor || 'N/A', // Legacy field
        flyer: flyer || null,
        description: description || null,
        ...(congress_id ? {
          congresos: {
            connect: { id: congress_id }
          }
        } : {}),
        congress_workshop_doctors: {
          create: docIds.map((docId: string) => ({
            doctor_id: docId
          }))
        }
      },
      include: {
        congress_workshop_doctors: { include: { doctors: true } },
        congresos: true
      }
    })

    return NextResponse.json({ data: workshop }, { status: 201 })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
