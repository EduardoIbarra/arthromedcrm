import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/kanban/comments?client_id=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  if (!clientId) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  try {
    const comments = await prisma.kanban_comments.findMany({
      where: { client_id: clientId },
      orderBy: { created_at: 'asc' },
    })

    return NextResponse.json({ data: comments })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/kanban/comments
// Body: { client_id, author_id, author_name, content }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { client_id, author_id, author_name, content } = body

    if (!client_id || !content?.trim()) {
      return NextResponse.json({ error: 'client_id and content are required' }, { status: 400 })
    }

    const comment = await prisma.kanban_comments.create({
      data: {
        client_id,
        author_id: author_id || null,
        author_name: author_name || 'Usuario',
        content: content.trim(),
      },
    })

    return NextResponse.json({ data: comment }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
