import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await prisma.clients.findMany({
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    })
    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error fetching clients for select:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
