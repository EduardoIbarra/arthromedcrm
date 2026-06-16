import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/public/distributors/[distributorId]
// Public endpoint — returns distributor info + all their cartas_distribucion
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ distributorId: string }> }
) {
  const { distributorId } = await params

  try {
    // Find client by distributor_id code
    const client = await prisma.clients.findFirst({
      where: { distributor_id: distributorId },
      select: {
        id: true,
        name: true,
        rfc: true,
        states: true,
        status: true,
        distributor_id: true,
        letter_created_at: true,
        letter_expires_at: true,
        cartas_distribucion: {
          orderBy: { vigencia: 'desc' }
        }
      }
    })

    if (!client) {
      return NextResponse.json({ error: 'Distribuidor no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ data: client })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
