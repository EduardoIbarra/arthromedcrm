import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const data = await prisma.congress_workshops.findUnique({
      where: { id },
      include: {
        congress: {
          select: { id: true, name: true }
        },
        enrollments: {
          include: {
            client: {
              select: { id: true, name: true, email_primary: true, phone: true }
            }
          },
          orderBy: { created_at: 'desc' }
        }
      }
    })

    if (!data) {
      return NextResponse.json({ error: 'Taller no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
