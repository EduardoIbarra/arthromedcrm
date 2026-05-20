import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await prisma.catalogos.findMany({
      orderBy: {
        created_at: 'desc'
      }
    })
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, pdf_url, description } = body

    if (!name || !pdf_url) {
      return NextResponse.json({ error: 'Missing required fields: name, pdf_url' }, { status: 400 })
    }

    const data = await prisma.catalogos.create({
      data: {
        name,
        pdf_url,
        description: description || ''
      }
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    console.error('Error in POST /api/catalogos:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
