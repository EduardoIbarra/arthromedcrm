import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, color } = body

    if (!name) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 })
    }

    const data = await prisma.catalog_lines.update({
      where: { id },
      data: {
        name,
        description: description || '',
        color: color || '#0763a9'
      }
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error in PATCH /api/catalogos/lineas/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    await prisma.catalog_lines.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/catalogos/lineas/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
