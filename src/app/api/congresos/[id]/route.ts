import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const data = await prisma.congresos.findUnique({
      where: { id },
      include: {
        workshops: {
          include: {
            enrollments: {
              select: { client_id: true }
            }
          }
        },
        contacts: true,
        congress_catalogos: {
          include: {
            catalog: true
          }
        }
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
      terms_doctor,
      terms_distributor,
      enable_workshops,
      workshops,
      contacts,
      catalog_ids
    } = body
    
    // Update main record and nested relations
    const data = await prisma.$transaction(async (tx: any) => {
      // 1. Delete removed workshops and contacts
      const existingWorkshops = await tx.congress_workshops.findMany({ where: { congress_id: id }, select: { id: true } })
      const incomingWorkshopIds = (workshops || []).filter((w: any) => w.id).map((w: any) => w.id)
      const workshopsToDelete = existingWorkshops.filter((w: any) => !incomingWorkshopIds.includes(w.id)).map((w: any) => w.id)
      
      const existingContacts = await tx.congress_contacts.findMany({ where: { congress_id: id }, select: { id: true } })
      const incomingContactIds = (contacts || []).filter((c: any) => c.id).map((c: any) => c.id)
      const contactsToDelete = existingContacts.filter((c: any) => !incomingContactIds.includes(c.id)).map((c: any) => c.id)

      if (workshopsToDelete.length > 0) {
        await tx.congress_workshops.deleteMany({ where: { id: { in: workshopsToDelete } } })
      }
      if (contactsToDelete.length > 0) {
        await tx.congress_contacts.deleteMany({ where: { id: { in: contactsToDelete } } })
      }

      // Sync catalog associations
      await tx.congress_catalogos.deleteMany({ where: { congress_id: id } })
      if (catalog_ids && catalog_ids.length > 0) {
        await tx.congress_catalogos.createMany({
          data: catalog_ids.map((cid: string) => ({
            congress_id: id,
            catalog_id: cid
          }))
        })
      }

      // 2. Update congress and upsert related records
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
          terms_doctor,
          terms_distributor,
          enable_workshops: enable_workshops !== false,
          workshops: {
            upsert: (workshops || []).filter((w: any) => w.id).map((w: any) => ({
              where: { id: w.id },
              update: { name: w.name, date_time: new Date(w.date_time), max_people: Number(w.max_people), cost: w.cost ? Number(w.cost) : null, professor: w.professor },
              create: { name: w.name, date_time: new Date(w.date_time), max_people: Number(w.max_people), cost: w.cost ? Number(w.cost) : null, professor: w.professor }
            })),
            create: (workshops || []).filter((w: any) => !w.id).map((w: any) => ({
              name: w.name,
              date_time: new Date(w.date_time),
              max_people: Number(w.max_people),
              cost: w.cost ? Number(w.cost) : null,
              professor: w.professor
            }))
          },
          contacts: {
            upsert: (contacts || []).filter((c: any) => c.id).map((c: any) => ({
              where: { id: c.id },
              update: { name: c.name, number: c.number, email: c.email },
              create: { name: c.name, number: c.number, email: c.email }
            })),
            create: (contacts || []).filter((c: any) => !c.id).map((c: any) => ({
              name: c.name,
              number: c.number,
              email: c.email
            }))
          }
        },
        include: {
          workshops: true,
          contacts: true,
          congress_catalogos: {
            include: {
              catalog: true
            }
          }
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
