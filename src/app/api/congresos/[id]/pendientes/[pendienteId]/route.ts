import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PATCH /api/congresos/[id]/pendientes/[pendienteId] — update a pendiente
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pendienteId: string }> }
) {
  const { id, pendienteId } = await params
  try {
    const body = await req.json()
    const { name, description, amount, completed, comments, responsable_id } = body

    const updated = await prisma.congreso_pendientes.update({
      where: {
        id: pendienteId,
        congreso_id: id
      },
      data: {
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
        amount: amount !== undefined ? (amount === null ? null : Number(amount)) : undefined,
        completed: completed !== undefined ? completed : undefined,
        comments: comments !== undefined ? comments : undefined,
        responsable_id: responsable_id !== undefined ? (responsable_id === '' ? null : responsable_id) : undefined,
        updated_at: new Date()
      },
      include: {
        responsable: {
          select: { id: true, first_name: true, last_name: true, email: true, position: true }
        }
      }
    })

    return NextResponse.json({ data: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 550 })
  }
}

// DELETE /api/congresos/[id]/pendientes/[pendienteId] — delete a pendiente
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pendienteId: string }> }
) {
  const { id, pendienteId } = await params
  try {
    await prisma.congreso_pendientes.delete({
      where: {
        id: pendienteId,
        congreso_id: id
      }
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
