import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const requisicion = await prisma.requisiciones.findFirst({
      where: { id, deleted_at: null },
      include: {
        items: {
          where: { deleted_at: null },
          orderBy: { created_at: 'asc' }
        },
        logs: {
          orderBy: { fecha: 'desc' }
        }
      }
    })

    if (!requisicion) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 })
    }

    return NextResponse.json({ data: requisicion })
  } catch (error: any) {
    console.error('Error in GET /api/public/requisiciones/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
