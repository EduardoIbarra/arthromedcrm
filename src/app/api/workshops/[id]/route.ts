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
    const { name, congress_id, date_time, max_people, cost, professor, doctorIds, flyer, description } = body

    if (doctorIds && Array.isArray(doctorIds)) {
      await prisma.congress_workshop_doctors.deleteMany({ where: { workshop_id: id } })
    }

    const data = await prisma.congress_workshops.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(congress_id !== undefined && {
          congresos: congress_id
            ? { connect: { id: congress_id } }
            : { disconnect: true }
        }),
        ...(date_time && { date_time: new Date(date_time) }),
        ...(max_people && { max_people: parseInt(max_people) }),
        ...(cost !== undefined && { cost: cost ? parseFloat(cost) : null }),
        ...(professor && { professor }),
        ...(flyer !== undefined && { flyer }),
        ...(description !== undefined && { description }),
        ...(doctorIds && Array.isArray(doctorIds) && {
          congress_workshop_doctors: {
            create: doctorIds.map((docId: string) => ({
              doctor_id: docId
            }))
          }
        })
      },
      include: {
        congress_workshop_doctors: { include: { doctors: true } }
      }
    })

    return NextResponse.json({ data })
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
