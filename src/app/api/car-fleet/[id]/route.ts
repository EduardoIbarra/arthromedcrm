import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const car = await prisma.car_fleet.findUnique({
      where: { id },
      include: {
        assigned_to: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            position: true,
            whatsapp: true
          }
        },
        maintenance_logs: {
          orderBy: { date: 'desc' }
        },
        incident_logs: {
          include: {
            reported_by: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true
              }
            }
          },
          orderBy: { date: 'desc' }
        },
        cirugia_equipo: {
          include: {
            cirugias: {
              select: {
                id: true,
                nombre: true,
                fecha: true,
                paciente: true,
                hospital: true,
                estado: true,
                medico: true
              }
            }
          }
        },
        congreso_members: {
          include: {
            congresos: {
              select: {
                id: true,
                name: true,
                start_date: true,
                end_date: true,
                location: true
              }
            },
            user_profiles: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true
              }
            }
          }
        },
        congreso_temp_staff: {
          include: {
            congresos: {
              select: {
                id: true,
                name: true,
                start_date: true,
                end_date: true,
                location: true
              }
            }
          }
        },
        congress_workshop_members: {
          include: {
            congress_workshops: {
              select: {
                id: true,
                name: true,
                date_time: true,
                congress_id: true,
                congresos: {
                  select: {
                    name: true,
                    location: true
                  }
                }
              }
            },
            user_profiles: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true
              }
            }
          }
        },
        workshop_temp_staff: {
          include: {
            congress_workshops: {
              select: {
                id: true,
                name: true,
                date_time: true,
                congress_id: true,
                congresos: {
                  select: {
                    name: true,
                    location: true
                  }
                }
              }
            }
          }
        },
        usage_records: {
          include: {
            user_profiles: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true
              }
            }
          },
          orderBy: { date_time: 'desc' }
        }
      }
    })

    if (!car) {
      return NextResponse.json({ error: 'Car not found' }, { status: 404 })
    }

    // Build synthesized usage history
    const usageLogs: Array<{
      id: string
      manual_id?: string
      user_id?: string
      type: 'cirugia' | 'taller' | 'congreso' | 'manual'
      title: string
      subtitle?: string
      date: string
      location?: string
      driverName?: string
      status?: string
      linkUrl?: string
      notes?: string
    }> = []

    // 0. Manual Usage Records
    car.usage_records?.forEach((ur: any) => {
      const driverName = ur.user_profiles
        ? `${ur.user_profiles.first_name || ''} ${ur.user_profiles.last_name || ''}`.trim() || ur.user_profiles.email
        : undefined

      usageLogs.push({
        id: `manual-${ur.id}`,
        manual_id: ur.id,
        user_id: ur.user_id || undefined,
        type: 'manual',
        title: ur.title,
        date: ur.date_time ? new Date(ur.date_time).toISOString() : (ur.created_at ? new Date(ur.created_at).toISOString() : ''),
        location: ur.location || undefined,
        driverName,
        notes: ur.notes || undefined
      })
    })

    // 1. Cirugías
    car.cirugia_equipo.forEach((eq: any) => {
      if (eq.cirugias) {
        usageLogs.push({
          id: `cirugia-${eq.id}`,
          type: 'cirugia',
          title: `Cirugía: ${eq.cirugias.paciente || eq.cirugias.nombre}`,
          subtitle: eq.cirugias.medico ? `Médico: ${eq.cirugias.medico}` : undefined,
          date: eq.cirugias.fecha ? new Date(eq.cirugias.fecha).toISOString() : (eq.created_at ? new Date(eq.created_at).toISOString() : ''),
          location: eq.cirugias.hospital || undefined,
          driverName: eq.guest_name || undefined,
          status: eq.cirugias.estado || undefined,
          linkUrl: `/cirugias/${eq.cirugia_id}`
        })
      }
    })

    // 2. Congresos (members)
    car.congreso_members.forEach((cm: any) => {
      if (cm.congresos) {
        const staffName = cm.user_profiles ? `${cm.user_profiles.first_name || ''} ${cm.user_profiles.last_name || ''}`.trim() || cm.user_profiles.email : undefined
        usageLogs.push({
          id: `congreso-m-${cm.congress_id}-${cm.user_id}`,
          type: 'congreso',
          title: `Congreso: ${cm.congresos.name}`,
          date: cm.congresos.start_date ? new Date(cm.congresos.start_date).toISOString() : '',
          location: cm.congresos.location || undefined,
          driverName: staffName,
          linkUrl: `/congresos/${cm.congress_id}`
        })
      }
    })

    // 2b. Congresos (temp staff)
    car.congreso_temp_staff.forEach((cts: any) => {
      if (cts.congresos) {
        usageLogs.push({
          id: `congreso-t-${cts.id}`,
          type: 'congreso',
          title: `Congreso: ${cts.congresos.name}`,
          date: cts.congresos.start_date ? new Date(cts.congresos.start_date).toISOString() : (cts.created_at ? new Date(cts.created_at).toISOString() : ''),
          location: cts.congresos.location || undefined,
          driverName: cts.name,
          linkUrl: `/congresos/${cts.congress_id}`
        })
      }
    })

    // 3. Talleres (members)
    car.congress_workshop_members.forEach((wm: any) => {
      if (wm.congress_workshops) {
        const staffName = wm.user_profiles ? `${wm.user_profiles.first_name || ''} ${wm.user_profiles.last_name || ''}`.trim() || wm.user_profiles.email : undefined
        usageLogs.push({
          id: `taller-m-${wm.workshop_id}-${wm.user_id}`,
          type: 'taller',
          title: `Taller: ${wm.congress_workshops.name}`,
          subtitle: wm.congress_workshops.congresos ? `Congreso: ${wm.congress_workshops.congresos.name}` : undefined,
          date: wm.congress_workshops.date_time ? new Date(wm.congress_workshops.date_time).toISOString() : '',
          location: wm.congress_workshops.congresos?.location || undefined,
          driverName: staffName,
          linkUrl: `/talleres/${wm.workshop_id}`
        })
      }
    })

    // 3b. Talleres (temp staff)
    car.workshop_temp_staff.forEach((wts: any) => {
      if (wts.congress_workshops) {
        usageLogs.push({
          id: `taller-t-${wts.id}`,
          type: 'taller',
          title: `Taller: ${wts.congress_workshops.name}`,
          subtitle: wts.congress_workshops.congresos ? `Congreso: ${wts.congress_workshops.congresos.name}` : undefined,
          date: wts.congress_workshops.date_time ? new Date(wts.congress_workshops.date_time).toISOString() : (wts.created_at ? new Date(wts.created_at).toISOString() : ''),
          location: wts.congress_workshops.congresos?.location || undefined,
          driverName: wts.name,
          linkUrl: `/talleres/${wts.workshop_id}`
        })
      }
    })

    // Sort usage logs by date descending
    usageLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Remove heavy raw relation fields from final output
    const {
      cirugia_equipo,
      congreso_members,
      congreso_temp_staff,
      congress_workshop_members,
      workshop_temp_staff,
      ...carData
    } = car

    return NextResponse.json({
      data: {
        ...carData,
        usage_logs: usageLogs
      }
    })
  } catch (error: any) {
    console.error('Error getting car details:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const { alias, make, model, year, plate_number, color, status, notes, assigned_to_id } = body

    const updateData: any = {}
    if (alias !== undefined) updateData.alias = alias || null
    if (make !== undefined) updateData.make = make
    if (model !== undefined) updateData.model = model
    if (year !== undefined) updateData.year = parseInt(year)
    if (plate_number !== undefined) updateData.plate_number = plate_number
    if (color !== undefined) updateData.color = color || null
    if (status !== undefined) updateData.status = status
    if (notes !== undefined) updateData.notes = notes || null
    if (assigned_to_id !== undefined) updateData.assigned_to_id = assigned_to_id || null

    const car = await prisma.car_fleet.update({
      where: { id },
      data: updateData,
      include: {
        assigned_to: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            position: true,
          }
        }
      }
    })
    return NextResponse.json({ data: car })
  } catch (error: any) {
    console.error('Error updating car:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await prisma.car_fleet.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting car:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
