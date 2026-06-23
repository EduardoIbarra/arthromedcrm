import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await prisma.congress_workshops.findMany({
      include: {
        congresos: true,
        congress_workshop_doctors: { include: { doctors: true } },
        congress_workshop_members: { include: { user_profiles: true, car_fleet: true } },
        workshop_temp_staff: { include: { car_fleet: true } },
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
    const { name, congress_id, date_time, end_date_time, max_people, cost, professor, doctorIds, memberIds, members, tempStaff, flyer, description } = body

    if (!name || !date_time || !max_people) {
      return NextResponse.json({ error: 'Faltan campos requeridos.' }, { status: 400 })
    }

    const docIds = Array.isArray(doctorIds) ? doctorIds : []
    
    let membersData: { user_id: string, car_id: string | null }[] = []
    if (members && Array.isArray(members)) {
      membersData = members.map((m: any) => ({
        user_id: m.userId,
        car_id: m.carId || null
      }))
    } else if (memberIds && Array.isArray(memberIds)) {
      membersData = memberIds.map((userId: string) => ({
        user_id: userId,
        car_id: null
      }))
    }

    const workshop = await prisma.congress_workshops.create({
      data: {
        name,
        date_time: new Date(date_time),
        end_date_time: end_date_time ? new Date(end_date_time) : null,
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
        },
        congress_workshop_members: {
          create: membersData
        },
        workshop_temp_staff: {
          create: (tempStaff || []).map((ts: any) => ({
            id: ts.id,
            name: ts.name,
            phone: ts.phone || null,
            car_id: ts.carId || null
          }))
        }
      },
      include: {
        congress_workshop_doctors: { include: { doctors: true } },
        congress_workshop_members: { include: { user_profiles: true, car_fleet: true } },
        workshop_temp_staff: { include: { car_fleet: true } },
        congresos: true
      }
    })

    return NextResponse.json({ data: workshop }, { status: 201 })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
