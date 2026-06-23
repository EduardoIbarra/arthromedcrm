import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendNotificationToUser, sendRespondMessage } from '@/lib/respond'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const body = await request.json()
    const { userId } = body

    // Fetch workshop details, including assigned members, temporary staff, and itineraries
    const workshop = await prisma.congress_workshops.findUnique({
      where: { id },
      include: {
        congress_workshop_members: {
          include: {
            user_profiles: true,
            car_fleet: true
          }
        },
        workshop_temp_staff: {
          include: {
            car_fleet: true
          }
        },
        workshop_itinerarios: {
          include: {
            involved_members: {
              include: {
                user_profiles: true,
                workshop_temp_staff: true
              }
            }
          },
          orderBy: [
            { date: 'asc' },
            { time: 'asc' }
          ]
        }
      }
    })

    if (!workshop) {
      return NextResponse.json({ error: 'Taller no encontrado' }, { status: 404 })
    }

    // Format both permanent and temporary staff
    const systemStaff = (workshop.congress_workshop_members || []).map((m: any) => ({
      id: m.user_profiles.id,
      name: `${m.user_profiles.first_name || ''} ${m.user_profiles.last_name || ''}`.trim() || m.user_profiles.email,
      phone: m.user_profiles.whatsapp,
      car: m.car_fleet,
      isTemp: false
    }))

    const tempStaff = (workshop.workshop_temp_staff || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      phone: m.phone,
      car: m.car_fleet,
      isTemp: true
    }))

    let allStaff = [...systemStaff, ...tempStaff]

    // Filter staff members to notify (specific user or all)
    if (userId) {
      allStaff = allStaff.filter((s: any) => s.id === userId)
    }

    if (allStaff.length === 0) {
      return NextResponse.json({ success: true, message: 'No hay miembros asignados para notificar.' })
    }

    const formatMexicanDate = (dateVal: Date | string) => {
      let d: Date
      if (typeof dateVal === 'string') {
        if (!dateVal.includes('T')) {
          const [year, month, day] = dateVal.split('-').map(Number)
          // Create in local timezone
          d = new Date(year, month - 1, day)
        } else {
          d = new Date(dateVal)
        }
      } else {
        d = dateVal
      }

      try {
        return new Intl.DateTimeFormat('es-MX', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(d)
      } catch (e) {
        // Fallback
        return String(dateVal).split('T')[0]
      }
    }

    let notificationsSent = 0
    const errors: string[] = []

    for (const member of allStaff) {
      if (!member.phone) {
        errors.push(`El miembro ${member.name} no tiene teléfono de WhatsApp configurado.`)
        continue
      }

      const car = member.car
      const carText = car
        ? `🚗 ${car.alias || `${car.make} ${car.model} (Placas: ${car.plate_number})`}`
        : '🚶 Sin vehículo asignado (traslado por cuenta propia)'

      // Find itinerary tasks where this member is involved
      const userTasks = workshop.workshop_itinerarios.filter((it: any) =>
        it.involved_members.some((im: any) =>
          member.isTemp ? im.temp_member_id === member.id : im.user_id === member.id
        )
      )

      let tasksText = ''
      if (userTasks.length > 0) {
        tasksText = userTasks.map((t: any) => {
          const timeStr = t.time ? ` a las ${t.time} hs` : ''
          const noteStr = t.notes ? ` (${t.notes})` : ''
          return `• *${formatMexicanDate(t.date)}${timeStr}:* ${t.description}${noteStr}`
        }).join('\n')
      } else {
        tasksText = 'No tienes actividades específicas asignadas en el itinerario de este taller.'
      }

      const message = `¡Hola, *${member.name}*! 👋

Te compartimos tu resumen de logística y actividades para el taller:
*${workshop.name}*

*Vehículo asignado:*
${carText}

*Tus actividades:*
${tasksText}

_Por favor confírmanos que recibiste esta información. ¡Éxito en el taller!_ 👍`

      try {
        if (member.isTemp) {
          await sendRespondMessage(member.phone, { type: 'text', text: message })
        } else {
          await sendNotificationToUser(member.id, message)
        }
        notificationsSent++
      } catch (err: any) {
        console.error(`Error notifying staff member ${member.id} via Respond.io:`, err)
        errors.push(`Error al notificar a ${member.name}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      notificationsSent,
      totalRequested: allStaff.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error: any) {
    console.error('Error in notify API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
