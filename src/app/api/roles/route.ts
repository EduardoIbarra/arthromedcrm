import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await prisma.roles.findMany({
      orderBy: {
        name: 'asc'
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
    const { name, description, permissions } = body

    if (!name) {
      return NextResponse.json({ error: 'Missing required name field' }, { status: 400 })
    }

    const data = await prisma.roles.create({
      data: {
        name,
        description: description || null,
        permissions: permissions || {}
      }
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
