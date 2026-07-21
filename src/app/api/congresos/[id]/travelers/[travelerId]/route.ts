import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; travelerId: string }> }
) {
  const { travelerId } = await params
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

    const data = await prisma.congreso_viajeros.update({
      where: { id: travelerId },
      data: {
        name: name !== undefined ? name : undefined,
        role: role !== undefined ? role : undefined,
        has_pin: has_pin !== undefined ? !!has_pin : undefined,
        has_gafete: has_gafete !== undefined ? !!has_gafete : undefined,
        notes: notes !== undefined ? notes : undefined,
        travel_by_plane: travel_by_plane !== undefined ? !!travel_by_plane : undefined,
        flight_airline: flight_airline !== undefined ? flight_airline : undefined,
        flight_number: flight_number !== undefined ? flight_number : undefined,
        flight_departure: flight_departure !== undefined ? (flight_departure ? new Date(flight_departure) : null) : undefined,
        flight_arrival: flight_arrival !== undefined ? (flight_arrival ? new Date(flight_arrival) : null) : undefined,
        flight_locator: flight_locator !== undefined ? flight_locator : undefined,
        ticket_file_url: ticket_file_url !== undefined ? ticket_file_url : undefined,
        ticket_file_name: ticket_file_name !== undefined ? ticket_file_name : undefined
      }
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; travelerId: string }> }
) {
  const { travelerId } = await params
  try {
    await prisma.congreso_viajeros.delete({
      where: { id: travelerId }
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
