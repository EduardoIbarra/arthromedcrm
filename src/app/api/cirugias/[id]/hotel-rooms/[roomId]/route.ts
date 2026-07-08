import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PATCH /api/cirugias/[id]/hotel-rooms/[roomId] — update room + replace occupants
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  const { roomId } = await params
  try {
    const body = await req.json()
    const { room_number, room_type, capacity, notes, occupants } = body

    const result = await prisma.$transaction(async (tx: any) => {
      // Update room fields
      await tx.cirugia_hotel_rooms.update({
        where: { id: roomId },
        data: {
          ...(room_number !== undefined && { room_number }),
          ...(room_type !== undefined && { room_type: room_type || null }),
          ...(capacity !== undefined && { capacity: parseInt(capacity) }),
          ...(notes !== undefined && { notes: notes || null })
        }
      })

      // Replace occupants if provided
      if (Array.isArray(occupants)) {
        await tx.cirugia_hotel_occupants.deleteMany({ where: { room_id: roomId } })
        if (occupants.length > 0) {
          await tx.cirugia_hotel_occupants.createMany({
            data: occupants.map((o: any) => ({
              room_id: roomId,
              user_id: o.user_id || null,
              guest_name: o.guest_name || null,
              guest_phone: o.guest_phone || null
            }))
          })
        }
      }

      return tx.cirugia_hotel_rooms.findUnique({
        where: { id: roomId },
        include: {
          cirugia_hotel_occupants: {
            include: {
              user_profiles: {
                select: { id: true, first_name: true, last_name: true, email: true, position: true }
              }
            }
          }
        }
      })
    })

    return NextResponse.json({ data: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/cirugias/[id]/hotel-rooms/[roomId] — delete a room
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  const { roomId } = await params
  try {
    await prisma.cirugia_hotel_rooms.delete({ where: { id: roomId } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
