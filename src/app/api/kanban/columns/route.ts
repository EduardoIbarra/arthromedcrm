import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/kanban/columns — list all columns ordered by position
export async function GET() {
  try {
    const columns = await prisma.kanban_columns.findMany({
      orderBy: { position: 'asc' },
    })
    return NextResponse.json({ data: columns })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/kanban/columns — create a new column
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, color } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Determine next position
    const maxPositionResult = await prisma.kanban_columns.aggregate({
      _max: { position: true },
    })
    const nextPosition = (maxPositionResult._max.position ?? -1) + 1

    const column = await prisma.kanban_columns.create({
      data: {
        name: name.trim(),
        color: color || '#0763a9',
        position: nextPosition,
      },
    })

    return NextResponse.json({ data: column }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
