import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST /api/kanban/columns/reorder — batch update column positions
export async function POST(request: NextRequest) {
  try {
    // expects: { order: [{ id: string, position: number }] }
    const body = await request.json()
    const { order } = body as { order: { id: string; position: number }[] }

    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: 'order array is required' }, { status: 400 })
    }

    // Batch update all positions
    await prisma.$transaction(
      order.map(({ id, position }) =>
        prisma.kanban_columns.update({
          where: { id },
          data: { position, updated_at: new Date() },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
