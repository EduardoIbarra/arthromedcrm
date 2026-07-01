import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const contacts = await prisma.directorio_contactos.findMany({
      include: {
        category: true
      },
      orderBy: {
        name: 'asc'
      }
    })
    return NextResponse.json({ data: contacts })
  } catch (error: any) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { category_id, name, phone, email, notes } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!category_id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    const contact = await prisma.directorio_contactos.create({
      data: {
        category_id,
        name: name.trim(),
        phone: phone || null,
        email: email || null,
        notes: notes || null
      },
      include: {
        category: true
      }
    })

    return NextResponse.json({ data: contact }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating contact:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
