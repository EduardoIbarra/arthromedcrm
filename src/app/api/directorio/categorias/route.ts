import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DEFAULT_CATEGORIES = ['Doctores', 'cerdos', 'Rayos X']

export async function GET(request: NextRequest) {
  try {
    let categories = await prisma.directorio_categorias.findMany({
      orderBy: { name: 'asc' }
    })

    // Auto-seed default categories if database has none
    if (categories.length === 0) {
      await prisma.directorio_categorias.createMany({
        data: DEFAULT_CATEGORIES.map(name => ({ name })),
        skipDuplicates: true
      })

      categories = await prisma.directorio_categorias.findMany({
        orderBy: { name: 'asc' }
      })
    }

    return NextResponse.json({ data: categories })
  } catch (error: any) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()

    // Case-insensitive check
    const existing = await prisma.directorio_categorias.findFirst({
      where: { name: { equals: trimmedName, mode: 'insensitive' } }
    })

    if (existing) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 400 })
    }

    const category = await prisma.directorio_categorias.create({
      data: { name: trimmedName }
    })

    return NextResponse.json({ data: category }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating category:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
