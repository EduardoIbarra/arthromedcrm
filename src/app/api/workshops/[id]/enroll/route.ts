import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { clientId } = await request.json()

    if (!clientId) {
      return NextResponse.json({ error: 'Falta el ID del cliente' }, { status: 400 })
    }

    // 1. Get workshop details to check max_people
    const workshop = await prisma.congress_workshops.findUnique({
      where: { id },
      include: {
        _count: {
          select: { congress_workshop_enrollments: true }
        }
      }
    })

    if (!workshop) {
      return NextResponse.json({ error: 'Taller no encontrado' }, { status: 404 })
    }

    // 2. Verify client exists
    const client = await prisma.clients.findUnique({
      where: { id: clientId }
    })

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // 3. Check if already enrolled
    const existing = await prisma.congress_workshop_enrollments.findUnique({
      where: {
        workshop_id_client_id: {
          workshop_id: id,
          client_id: clientId
        }
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'Ya estás inscrito a este taller' }, { status: 400 })
    }

    // 4. Check limit
    if (workshop._count.congress_workshop_enrollments >= workshop.max_people) {
      return NextResponse.json({ error: 'El cupo de este taller está lleno' }, { status: 400 })
    }

    // 5. Enroll
    const enrollment = await prisma.congress_workshop_enrollments.create({
      data: {
        workshop_id: id,
        client_id: clientId
      }
    })

    return NextResponse.json({ data: enrollment })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const clientId = url.searchParams.get('clientId')

    if (!clientId) {
      return NextResponse.json({ error: 'Falta el ID del cliente' }, { status: 400 })
    }

    await prisma.congress_workshop_enrollments.delete({
      where: {
        workshop_id_client_id: {
          workshop_id: id,
          client_id: clientId
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    // If Prisma throws a "Record to delete does not exist" error, it's fine, we treat it as success or 404
    if (error.code === 'P2025') {
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
