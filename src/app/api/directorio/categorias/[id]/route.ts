import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()

    // Case-insensitive duplicate check excluding this specific category
    const existing = await prisma.directorio_categorias.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
        id: { not: id }
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 400 })
    }

    const category = await prisma.directorio_categorias.update({
      where: { id },
      data: { name: trimmedName }
    })

    return NextResponse.json({ data: category })
  } catch (error: any) {
    console.error('Error updating category:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
