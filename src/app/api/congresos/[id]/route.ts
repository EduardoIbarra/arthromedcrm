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
        congress_workshops: {
          include: {
            congress_workshop_doctors: {
              include: { doctors: true }
            },
            congress_workshop_enrollments: {
              select: { client_id: true }
            }
          }
        },
        congress_contacts: true,
        congress_catalogos: {
          include: {
            catalogos: true
          }
        },
        congreso_itinerarios: {
          include: {
            involved_members: {
              include: { user_profiles: true, congreso_temp_staff: true }
            }
          },
          orderBy: [
            { date: 'asc' },
            { time: 'asc' }
          ]
        },
        congreso_viajeros: {
          orderBy: { name: 'asc' }
        },
        congreso_gastos_estimados: {
          include: {
            catalog_spending_categories: true
          }
        },
        congreso_members: {
          include: { user_profiles: true, car_fleet: true }
        },
        congreso_temp_staff: {
          include: { car_fleet: true }
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
      line_ids,
      terms_doctor,
      terms_distributor,
      enable_workshops,
      global_budget,
      video_urls,
      workshops,
      contacts,
      catalog_ids,
      gastos_estimados,
      members,
      tempStaff,
      itinerary
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
        const uniqueCatalogIds = Array.from(new Set<string>(catalog_ids))
        await tx.congress_catalogos.createMany({
          data: uniqueCatalogIds.map((cid: string) => ({
            congress_id: id,
            catalog_id: cid
          })),
          skipDuplicates: true
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

      // Sync Workshops and doctors
      const incomingWorkshopsWithId = (workshops || []).filter((w: any) => w.id)
      const incomingWorkshopsWithoutId = (workshops || []).filter((w: any) => !w.id)

      for (const w of incomingWorkshopsWithId) {
        await tx.congress_workshops.update({
          where: { id: w.id },
          data: {
            congress_id: id,
            name: w.name,
            date_time: new Date(w.date_time),
            end_date_time: w.end_date_time ? new Date(w.end_date_time) : null,
            max_people: Number(w.max_people),
            cost: w.cost ? Number(w.cost) : null,
            professor: w.professor || 'N/A'
          }
        })
        await tx.congress_workshop_doctors.deleteMany({ where: { workshop_id: w.id } })
        if (w.doctorIds && w.doctorIds.length > 0) {
          await tx.congress_workshop_doctors.createMany({
            data: w.doctorIds.map((did: string) => ({ workshop_id: w.id, doctor_id: did }))
          })
        }
      }

      for (const w of incomingWorkshopsWithoutId) {
        const createdWorkshop = await tx.congress_workshops.create({
          data: {
            congress_id: id,
            name: w.name,
            date_time: new Date(w.date_time),
            end_date_time: w.end_date_time ? new Date(w.end_date_time) : null,
            max_people: Number(w.max_people),
            cost: w.cost ? Number(w.cost) : null,
            professor: w.professor || 'N/A'
          }
        })
        if (w.doctorIds && w.doctorIds.length > 0) {
          await tx.congress_workshop_doctors.createMany({
            data: w.doctorIds.map((did: string) => ({ workshop_id: createdWorkshop.id, doctor_id: did }))
          })
        }
      }

      // Sync congress members (staff)
      let shouldUpdateMembers = false
      let membersData: { user_id: string, car_id: string | null }[] = []
      
      if (members && Array.isArray(members)) {
        shouldUpdateMembers = true
        membersData = members.map((m: any) => ({
          user_id: m.userId,
          car_id: m.carId || null
        }))
      }
      
      if (shouldUpdateMembers) {
        await tx.congreso_members.deleteMany({ where: { congress_id: id } })
      }

      if (tempStaff && Array.isArray(tempStaff)) {
        await tx.congreso_temp_staff.deleteMany({ where: { congress_id: id } })
      }

      if (itinerary && Array.isArray(itinerary)) {
        await tx.congreso_itinerarios.deleteMany({ where: { congreso_id: id } })
      }

      // Update congress
      const updated = await tx.congresos.update({
        where: { id },
        data: {
          name,
          start_date: start_date ? new Date(start_date) : undefined,
          end_date: end_date ? new Date(end_date) : undefined,
          location,
          description,
          flyer,
          specialty_ids: specialty_ids || [],
          line_ids: line_ids || [],
          terms_doctor,
          terms_distributor,
          enable_workshops: enable_workshops !== false,
          global_budget: global_budget ? Number(global_budget) : null,
          video_urls: video_urls || [],
          congress_contacts: {
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
          },
          ...(shouldUpdateMembers && {
            congreso_members: {
              create: membersData
            }
          })
        },
        include: {
          congress_workshops: true,
          congress_contacts: true,
          congress_catalogos: {
            include: {
              catalogos: true
            }
          },
          congreso_gastos_estimados: {
            include: {
              catalog_spending_categories: true
            }
          },
          congreso_members: {
            include: { user_profiles: true, car_fleet: true }
          },
          congreso_temp_staff: {
            include: { car_fleet: true }
          }
        }
      })

      if (tempStaff && Array.isArray(tempStaff)) {
        await tx.congreso_temp_staff.createMany({
          data: tempStaff.map((ts: any) => ({
            id: ts.id,
            congress_id: id,
            name: ts.name,
            phone: ts.phone || null,
            car_id: ts.carId || null
          }))
        })
      }

      if (itinerary && Array.isArray(itinerary)) {
        for (const item of itinerary) {
          await tx.congreso_itinerarios.create({
            data: {
              congreso_id: id,
              date: new Date(item.date),
              time: item.time || null,
              activity: item.description,
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
