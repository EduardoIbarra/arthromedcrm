import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/cirugias/[id]/hotel-rooms — list all rooms with occupants
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const rooms = await prisma.cirugia_hotel_rooms.findMany({
      where: { cirugia_id: id },
      include: {
        cirugia_hotel_occupants: {
          include: {
            user_profiles: {
              select: { id: true, first_name: true, last_name: true, email: true, position: true }
            }
          },
          orderBy: { created_at: 'asc' }
        }
      },
      orderBy: { created_at: 'asc' }
    })
    return NextResponse.json({ data: rooms })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/cirugias/[id]/hotel-rooms — create a room
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json()
    const { room_number, room_type, capacity, notes } = body

    if (!room_number) {
      return NextResponse.json({ error: 'room_number es requerido' }, { status: 400 })
    }

    const room = await prisma.cirugia_hotel_rooms.create({
      data: {
        cirugia_id: id,
        room_number,
        room_type: room_type || null,
        capacity: capacity ? parseInt(capacity) : 2,
        notes: notes || null
      },
      include: {
        cirugia_hotel_occupants: true
      }
    })

    return NextResponse.json({ data: room }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
