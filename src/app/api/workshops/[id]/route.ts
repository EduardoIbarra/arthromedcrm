import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const data = await prisma.congress_workshops.findUnique({
      where: { id },
      include: {
        congresos: {
          select: { id: true, name: true }
        },
        congress_workshop_doctors: {
          include: { doctors: true }
        },
        congress_workshop_members: {
          include: { user_profiles: true, car_fleet: true }
        },
        workshop_temp_staff: {
          include: { car_fleet: true }
        },
        workshop_itinerarios: {
          include: {
            involved_members: {
              include: { user_profiles: true, workshop_temp_staff: true }
            }
          },
          orderBy: [
            { date: 'asc' },
            { time: 'asc' }
          ]
        },
        congress_workshop_enrollments: {
          include: {
            clients: {
              select: { id: true, name: true, email_primary: true, phone: true }
            }
          },
          orderBy: { created_at: 'desc' }
        }
      }
    })

    if (!data) {
      return NextResponse.json({ error: 'Taller no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, congress_id, date_time, end_date_time, max_people, cost, professor, doctorIds, memberIds, members, tempStaff, itinerary, flyer, description, diploma_template } = body

    const result = await prisma.$transaction(async (tx: any) => {
      if (doctorIds && Array.isArray(doctorIds)) {
        await tx.congress_workshop_doctors.deleteMany({ where: { workshop_id: id } })
      }

      let shouldUpdateMembers = false
      let membersData: { user_id: string, car_id: string | null }[] = []
      
      if (members && Array.isArray(members)) {
        shouldUpdateMembers = true
        membersData = members.map((m: any) => ({
          user_id: m.userId,
          car_id: m.carId || null
        }))
      } else if (memberIds && Array.isArray(memberIds)) {
        shouldUpdateMembers = true
        membersData = memberIds.map((userId: string) => ({
          user_id: userId,
          car_id: null
        }))
      }
      
      if (shouldUpdateMembers) {
        await tx.congress_workshop_members.deleteMany({ where: { workshop_id: id } })
      }

      if (tempStaff && Array.isArray(tempStaff)) {
        await tx.workshop_temp_staff.deleteMany({ where: { workshop_id: id } })
      }

      if (itinerary && Array.isArray(itinerary)) {
        await tx.workshop_itinerarios.deleteMany({ where: { workshop_id: id } })
      }

      const updated = await tx.congress_workshops.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(congress_id !== undefined && {
            congresos: congress_id
              ? { connect: { id: congress_id } }
              : { disconnect: true }
          }),
          ...(date_time && { date_time: new Date(date_time) }),
          ...(end_date_time !== undefined && { end_date_time: end_date_time ? new Date(end_date_time) : null }),
          ...(max_people && { max_people: parseInt(max_people) }),
          ...(cost !== undefined && { cost: cost ? parseFloat(cost) : null }),
          ...(professor && { professor }),
          ...(flyer !== undefined && { flyer }),
          ...(description !== undefined && { description }),
          ...(diploma_template !== undefined && { diploma_template }),
          ...(doctorIds && Array.isArray(doctorIds) && {
            congress_workshop_doctors: {
              create: doctorIds.map((docId: string) => ({
                doctor_id: docId
              }))
            }
          }),
          ...(shouldUpdateMembers && {
            congress_workshop_members: {
              create: membersData
            }
          })
        },
        include: {
          congress_workshop_doctors: { include: { doctors: true } },
          congress_workshop_members: { include: { user_profiles: true, car_fleet: true } },
          workshop_temp_staff: { include: { car_fleet: true } }
        }
      })

      if (tempStaff && Array.isArray(tempStaff)) {
        await tx.workshop_temp_staff.createMany({
          data: tempStaff.map((ts: any) => ({
            id: ts.id,
            workshop_id: id,
            name: ts.name,
            phone: ts.phone || null,
            car_id: ts.carId || null
          }))
        })
      }

      if (itinerary && Array.isArray(itinerary)) {
        for (const item of itinerary) {
          await tx.workshop_itinerarios.create({
            data: {
              workshop_id: id,
              date: new Date(item.date),
              time: item.time || null,
              description: item.description,
              notes: item.notes || null,
              involved_members: {
                create: (item.involvedMemberIds || []).map((memberId: string) => {
                  const isTemp = tempStaff && tempStaff.some((ts: any) => ts.id === memberId)
                  return {
                    ...(isTemp ? { temp_member_id: memberId } : { user_id: memberId })
                  }
                })
              }
            }
          })
        }
      }

      return updated
    })

    return NextResponse.json({ data: result })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.congress_workshops.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
