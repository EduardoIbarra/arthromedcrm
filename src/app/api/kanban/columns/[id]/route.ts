import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PATCH /api/kanban/columns/[id] — update a column
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const { name, color, position } = body

    const column = await prisma.kanban_columns.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(color !== undefined && { color }),
        ...(position !== undefined && { position }),
        updated_at: new Date(),
      },
    })

    return NextResponse.json({ data: column })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/kanban/columns/[id] — delete a column (only if no clients assigned)
export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    // Check if any clients are in this column
    const clientCount = await prisma.kanban_client_columns.count({
      where: { column_id: id },
    })

    if (clientCount > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: hay ${clientCount} cliente(s) en esta columna.` },
        { status: 400 }
      )
    }

    await prisma.kanban_columns.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
