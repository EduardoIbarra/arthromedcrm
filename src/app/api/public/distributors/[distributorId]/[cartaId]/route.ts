import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/public/distributors/[distributorId]/[cartaId]
// Returns a specific carta + the distributor's basic info
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ distributorId: string; cartaId: string }> }
) {
  const { distributorId, cartaId } = await params

  try {
    const [client, carta] = await Promise.all([
      prisma.clients.findUnique({
        where: { id: distributorId },
        select: {
          id: true,
          name: true,
          rfc: true,
          states: true,
          status: true,
          distributor_id: true,
        }
      }),
      prisma.cartas_distribucion.findUnique({
        where: { id: cartaId }
      })
    ])

    if (!client) {
      return NextResponse.json({ error: 'Distribuidor no encontrado' }, { status: 404 })
    }
    if (!carta) {
      return NextResponse.json({ error: 'Carta no encontrada' }, { status: 404 })
    }

    // Safety check: carta must belong to this client
    if (carta.client_id && carta.client_id !== distributorId) {
      return NextResponse.json({ error: 'Carta no pertenece a este distribuidor' }, { status: 403 })
    }

    return NextResponse.json({ client, carta })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
