import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendNotificationToUser } from '@/lib/respond'

export const dynamic = 'force-dynamic'

// GET /api/cirugias — list all surgeries with summary data
export async function GET() {
  try {
    const data = await prisma.cirugias.findMany({
      include: {
        cirugia_equipo: {
          include: {
            car_fleet: true,
          },
        },
        cirugia_productos: {
          include: { productos: { select: { nombre: true, precio_unitario: true } } },
        },
        cirugia_conceptos: true,
        cirugia_itinerarios: {
          orderBy: { date: 'asc' }
        },
      },
      orderBy: { fecha: 'desc' },
    })
    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('[GET /api/cirugias]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/cirugias — create a new surgery
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      nombre,
      medico,
      descripcion,
      fecha,
      estado,
      notas,
      equipo,       // [{ user_id, rol }]
      productos,    // [{ producto_id, cantidad, es_consumible, tipo_uso, precio_unitario }]
      conceptos,    // [{ concepto, cantidad, precio_unitario, subtotal }]
      itinerarios,  // [{ activity, date, time, notes }]
      doctor_id,
      hotelRooms,   // [{ room_number, room_type, capacity, notes, occupants }]
    } = body

    if (!nombre || !medico || !fecha) {
      return NextResponse.json({ error: 'Nombre, médico y fecha son requeridos.' }, { status: 400 })
    }

    const cirugia = await prisma.cirugias.create({
      data: {
        nombre,
        medico,
        doctor_id: doctor_id || null,
        descripcion: descripcion || null,
        fecha: new Date(fecha),
        estado: estado || 'programada',
        notas: notas || null,
        cirugia_equipo: {
          create: (equipo || []).map((e: any) => ({
            user_id: e.user_id,
            rol: e.rol || null,
            car_id: e.car_id || null,
          })),
        },
        cirugia_productos: {
          create: (productos || []).map((p: any) => ({
            producto_id: p.producto_id,
            cantidad: Number(p.cantidad) || 1,
            es_consumible: Boolean(p.es_consumible),
            tipo_uso: p.tipo_uso || 'venta',
            precio_unitario: p.precio_unitario != null ? Number(p.precio_unitario) : null,
          })),
        },
        cirugia_conceptos: {
          create: (conceptos || []).map((c: any) => ({
            concepto: c.concepto,
            cantidad: Number(c.cantidad) || 1,
            precio_unitario: Number(c.precio_unitario) || 0,
            subtotal: Number(c.subtotal) || 0,
          })),
        },
        cirugia_itinerarios: {
          create: (itinerarios || []).map((i: any) => ({
            activity: i.activity,
            date: new Date(i.date),
            time: i.time || null,
            notes: i.notes || null,
          })),
        },
        cirugia_hotel_rooms: {
          create: (hotelRooms || []).map((r: any) => ({
            room_number: r.room_number,
            room_type: r.room_type || null,
            capacity: Number(r.capacity) || 2,
            notes: r.notes || null,
            cirugia_hotel_occupants: {
              create: (r.cirugia_hotel_occupants || []).map((occ: any) => ({
                user_id: occ.user_id || null,
                guest_name: occ.guest_name || null,
                guest_phone: occ.guest_phone || null,
              }))
            }
          }))
        }
      },
      include: {
        cirugia_equipo: true,
        cirugia_productos: true,
        cirugia_conceptos: true,
        cirugia_itinerarios: true,
        cirugia_hotel_rooms: {
          include: {
            cirugia_hotel_occupants: true
          }
        }
      }
    })

    if (equipo && equipo.length > 0) {
      let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      if (baseUrl.includes('localhost')) {
        baseUrl = 'https://dev.erp.arthromed.com.mx';
      }
      const url = `${baseUrl}/cirugias/${cirugia.id}`;
      const fechaFormat = new Date(cirugia.fecha).toLocaleString('es-MX', {
        timeZone: 'America/Monterrey',
        dateStyle: 'full',
        timeStyle: 'short',
      });
      const message = `¡Hola! Has sido asignado al equipo asistente de la cirugía "${cirugia.nombre}" con el ${cirugia.medico}. \nFecha y hora: ${fechaFormat}\nPuedes ver los detalles aquí: ${url}`;
      for (const e of equipo) {
        if (e.user_id) {
          await sendNotificationToUser(e.user_id, message);
        }
      }
    }

    return NextResponse.json({ data: cirugia }, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/cirugias]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
