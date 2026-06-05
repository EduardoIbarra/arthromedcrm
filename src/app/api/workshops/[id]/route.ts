import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const data = await prisma.congress_workshops.findUnique({
      where: { id },
      include: {
        congress: {
          select: { id: true, name: true }
        },
        doctors: {
          include: { doctor: true }
        },
        enrollments: {
          include: {
            client: {
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
    const { name, congress_id, date_time, max_people, cost, professor, doctorIds } = body

    if (doctorIds && Array.isArray(doctorIds)) {
      await prisma.congress_workshop_doctors.deleteMany({ where: { workshop_id: id } })
    }

    const data = await prisma.congress_workshops.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(congress_id !== undefined && { congress_id: congress_id || null }),
        ...(date_time && { date_time: new Date(date_time) }),
        ...(max_people && { max_people: parseInt(max_people) }),
        ...(cost !== undefined && { cost: cost ? parseFloat(cost) : null }),
        ...(professor && { professor }),
        ...(doctorIds && Array.isArray(doctorIds) && {
          doctors: {
            create: doctorIds.map((docId: string) => ({
              doctor_id: docId
            }))
          }
        })
      },
      include: {
        doctors: { include: { doctor: true } }
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
