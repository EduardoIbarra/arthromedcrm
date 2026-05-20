import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, pdf_url, description } = body

    if (!name || !pdf_url) {
      return NextResponse.json({ error: 'Missing required fields: name, pdf_url' }, { status: 400 })
    }

    const data = await prisma.catalogos.update({
      where: { id },
      data: {
        name,
        pdf_url,
        description: description || '',
        updated_at: new Date()
      }
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error in PATCH /api/catalogos/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    await prisma.catalogos.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/catalogos/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
