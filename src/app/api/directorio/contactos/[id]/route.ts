import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const contact = await prisma.directorio_contactos.findUnique({
      where: { id },
      include: {
        category: true
      }
    })
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }
    return NextResponse.json({ data: contact })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const { category_id, name, phone, email, notes } = body

    const updateData: any = {}
    if (category_id !== undefined) updateData.category_id = category_id
    if (name !== undefined) updateData.name = name.trim()
    if (phone !== undefined) updateData.phone = phone || null
    if (email !== undefined) updateData.email = email || null
    if (notes !== undefined) updateData.notes = notes || null

    const contact = await prisma.directorio_contactos.update({
      where: { id },
      data: updateData,
      include: {
        category: true
      }
    })
    return NextResponse.json({ data: contact })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await prisma.directorio_contactos.delete({
      where: { id }
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
