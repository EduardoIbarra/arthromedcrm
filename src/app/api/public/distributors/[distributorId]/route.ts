import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/public/distributors/[distributorId]
// Public endpoint — returns single scanned carta info + distributor info
// Param [distributorId] can be either a carta_distribucion.id OR a client.id
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ distributorId: string }> }
) {
  const { distributorId } = await params

  try {
    // 1. Try finding by carta_distribucion ID first
    const cartaByUuid = await prisma.cartas_distribucion.findUnique({
      where: { id: distributorId },
      include: {
        clients: {
          select: {
            id: true,
            name: true,
            rfc: true,
            states: true,
            status: true,
            distributor_id: true,
          }
        }
      }
    })

    if (cartaByUuid) {
      const client = cartaByUuid.clients || {
        id: cartaByUuid.client_id || '',
        name: cartaByUuid.empresa_nombre,
        rfc: cartaByUuid.rfc,
        states: cartaByUuid.estado_region ? [cartaByUuid.estado_region] : [],
        status: 'Activo',
        distributor_id: null
      }
      return NextResponse.json({
        data: {
          client,
          carta: cartaByUuid,
          otherCartas: []
        }
      })
    }

    // 2. Fallback: Try finding by client ID
    const client = await prisma.clients.findUnique({
      where: { id: distributorId },
      select: {
        id: true,
        name: true,
        rfc: true,
        states: true,
        status: true,
        distributor_id: true,
        cartas_distribucion: {
          orderBy: { vigencia: 'desc' }
        }
      }
    })

    if (!client) {
      return NextResponse.json({ error: 'Carta o distribuidor no encontrado' }, { status: 404 })
    }

    const primaryCarta = client.cartas_distribucion.length > 0 ? client.cartas_distribucion[0] : null
    const otherCartas = client.cartas_distribucion.slice(1)

    return NextResponse.json({
      data: {
        client: {
          id: client.id,
          name: client.name,
          rfc: client.rfc,
          states: client.states,
          status: client.status,
          distributor_id: client.distributor_id
        },
        carta: primaryCarta,
        otherCartas
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

