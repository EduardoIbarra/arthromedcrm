import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendNotificationToUser } from '@/lib/respond'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const { 
      name, 
      role, 
      has_pin, 
      has_gafete, 
      notes,
      travel_by_plane,
      flight_airline,
      flight_number,
      flight_departure,
      flight_arrival,
      flight_locator,
      ticket_file_url,
      ticket_file_name
    } = body

    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido.' }, { status: 400 })
    }

    const data = await prisma.congreso_viajeros.create({
      data: {
        congreso_id: id,
        name,
        role: role || null,
        user_id: body.user_id || null,
        has_pin: !!has_pin,
        has_gafete: !!has_gafete,
        notes: notes || null,
        travel_by_plane: !!travel_by_plane,
        flight_airline: flight_airline || null,
        flight_number: flight_number || null,
        flight_departure: flight_departure ? new Date(flight_departure) : null,
        flight_arrival: flight_arrival ? new Date(flight_arrival) : null,
        flight_locator: flight_locator || null,
        ticket_file_url: ticket_file_url || null,
        ticket_file_name: ticket_file_name || null
      }
    })

    if (body.user_id) {
      const congreso = await prisma.congresos.findUnique({
        where: { id },
        select: { name: true }
      });
      if (congreso) {
        let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        if (baseUrl.includes('localhost')) {
          baseUrl = 'https://dev.erp.arthromed.com.mx';
        }
        const url = `${baseUrl}/congresos/${id}/view`;
        const message = `¡Hola! Has sido agregado al equipo viajero del congreso "${congreso.name}". Puedes ver los detalles del congreso aquí: ${url}`;
        await sendNotificationToUser(body.user_id, message);
      }
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
