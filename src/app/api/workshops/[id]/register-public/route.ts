import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name, email, phone } = await request.json()

    if (!name || !email) {
      return NextResponse.json({ error: 'Faltan campos requeridos (Nombre y Correo).' }, { status: 400 })
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
      return NextResponse.json({ error: 'Taller no encontrado.' }, { status: 404 })
    }

    // 2. Check capacity limit
    if (workshop._count.congress_workshop_enrollments >= workshop.max_people) {
      return NextResponse.json({ error: 'El cupo de este taller está lleno.' }, { status: 400 })
    }

    // 3. Find or create client
    let client = await prisma.clients.findFirst({
      where: {
        email_primary: {
          equals: email.trim(),
          mode: 'insensitive'
        }
      }
    })

    if (!client) {
      // Create new client as "Nuevo Prospecto"
      client = await prisma.clients.create({
        data: {
          name: name.trim(),
          email_primary: email.trim(),
          phone: phone?.trim() || null,
          status: 'Nuevo Prospecto',
          source: 'Landing Page Taller',
          tags: ['taller-registro']
        }
      })
    }

    // 4. Check if already enrolled
    const existingEnrollment = await prisma.congress_workshop_enrollments.findUnique({
      where: {
        workshop_id_client_id: {
          workshop_id: id,
          client_id: client.id
        }
      }
    })

    if (existingEnrollment) {
      return NextResponse.json({ error: 'Ya estás inscrito a este taller.' }, { status: 400 })
    }

    // 5. Enroll
    const enrollment = await prisma.congress_workshop_enrollments.create({
      data: {
        workshop_id: id,
        client_id: client.id
      }
    })

    return NextResponse.json({ 
      data: enrollment, 
      clientName: client.name, 
      clientId: client.id 
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error public registering workshop:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
