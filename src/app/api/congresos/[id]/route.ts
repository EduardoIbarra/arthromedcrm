import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const data = await prisma.congresos.findUnique({
      where: { id },
      include: {
        workshops: true,
        contacts: true
      }
    })

    if (!data) {
      return NextResponse.json({ error: 'Congreso no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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
    
    // Update main record and nested relations
    const data = await prisma.$transaction(async (tx: any) => {
      // 1. Delete existing workshops and contacts to replace them
      await tx.congress_workshops.deleteMany({ where: { congress_id: id } })
      await tx.congress_contacts.deleteMany({ where: { congress_id: id } })

      // 2. Update congress and create new related records
      return await tx.congresos.update({
        where: { id },
        data: {
          name,
          start_date: start_date ? new Date(start_date) : undefined,
          end_date: end_date ? new Date(end_date) : undefined,
          location,
          description,
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
    })

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('Error in PATCH /api/congresos/[id]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    // Cascade delete is handled by database if configured, 
    // but Prisma will handle it if we do it in a transaction or if schema has onDelete: Cascade
    await prisma.congresos.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
