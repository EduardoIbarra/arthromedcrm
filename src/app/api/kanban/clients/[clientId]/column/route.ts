import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PATCH /api/kanban/clients/[clientId]/column
// Body: { column_id, moved_by, moved_by_name, note? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params

  try {
    const body = await request.json()
    const { column_id, moved_by, moved_by_name, note } = body

    if (!column_id) {
      return NextResponse.json({ error: 'column_id is required' }, { status: 400 })
    }

    // Get destination column name
    const destColumn = await prisma.kanban_columns.findUnique({
      where: { id: column_id },
      select: { name: true, id: true },
    })

    if (!destColumn) {
      return NextResponse.json({ error: 'Column not found' }, { status: 404 })
    }

    // Get current assignment (if any)
    const existing = await prisma.kanban_client_columns.findUnique({
      where: { client_id: clientId },
      include: { column: { select: { name: true, id: true } } },
    })

    // Upsert the client's column assignment
    await prisma.kanban_client_columns.upsert({
      where: { client_id: clientId },
      create: {
        client_id: clientId,
        column_id,
      },
      update: {
        column_id,
        updated_at: new Date(),
      },
    })

    // Create history entry
    await prisma.kanban_history.create({
      data: {
        client_id: clientId,
        from_column_id: existing?.column_id || null,
        to_column_id: column_id,
        from_column_name: existing?.column?.name || null,
        to_column_name: destColumn.name,
        moved_by: moved_by || null,
        moved_by_name: moved_by_name || null,
        note: note || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET /api/kanban/clients/[clientId]/column — get history for a specific client
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params

  try {
    const history = await prisma.kanban_history.findMany({
      where: { client_id: clientId },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json({ data: history })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
