import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendNotificationToUser } from '@/lib/respond'

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
        },
        itinerary_items: {
          orderBy: [
            { date: 'asc' },
            { time: 'asc' }
          ]
        },
        travelers: {
          orderBy: { name: 'asc' }
        },
        gastos_estimados: {
          include: {
            category: true
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
      global_budget,
      workshops,
      contacts,
      catalog_ids,
      gastos_estimados
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

      // Sync gastos estimados
      await tx.congreso_gastos_estimados.deleteMany({ where: { congreso_id: id } })
      if (gastos_estimados && gastos_estimados.length > 0) {
        await tx.congreso_gastos_estimados.createMany({
          data: gastos_estimados.map((ge: any) => ({
            congreso_id: id,
            category_id: ge.category_id,
            amount: Number(ge.amount)
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
          global_budget: global_budget ? Number(global_budget) : null,
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
          },
          gastos_estimados: {
            include: {
              category: true
            }
          }
        }
      })
    })

    const travelers = await prisma.congreso_viajeros.findMany({
      where: {
        congreso_id: id,
        user_id: { not: null }
      }
    })

    if (travelers.length > 0) {
      let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      if (baseUrl.includes('localhost')) {
        baseUrl = 'https://dev.erp.arthromed.com.mx';
      }
      const url = `${baseUrl}/congresos/${data.id}/view`;
      const fechaFormat = data.start_date ? new Date(data.start_date).toLocaleString('es-MX', {
        timeZone: 'America/Monterrey',
        dateStyle: 'full'
      }) : 'No definida';

      const messageUpdate = `¡Hola! Los detalles del congreso "${data.name}" han sido actualizados. \nFecha de inicio: ${fechaFormat}\nPuedes ver los detalles aquí: ${url}`;
      
      for (const t of travelers) {
        if (t.user_id) {
          await sendNotificationToUser(t.user_id, messageUpdate);
        }
      }
    }

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
