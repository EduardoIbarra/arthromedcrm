import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const cotizacion = await prisma.cotizaciones.findUnique({
      where: { id },
      include: {
        clientes: true,
        cfdi: true,
        metodo_pago: true,
        forma_pago: true,
        productos: {
          orderBy: { created_at: 'asc' }
        },
        comentarios: {
          orderBy: { created_at: 'desc' }
        },
        documentos: {
          orderBy: { created_at: 'desc' }
        },
        planes_pago: {
          include: {
            parcialidades: {
              orderBy: { numero: 'asc' }
            }
          }
        }
      }
    })

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ data: cotizacion })
  } catch (err: any) {
    console.error('[GET /api/cotizaciones/[id]] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { cfdi_id, metodo_pago_id, forma_pago_id } = body

    const updated = await prisma.cotizaciones.update({
      where: { id },
      data: {
        cfdi_id: cfdi_id === '' ? null : cfdi_id,
        metodo_pago_id: metodo_pago_id === '' ? null : metodo_pago_id,
        forma_pago_id: forma_pago_id === '' ? null : forma_pago_id,
      },
      include: {
        cfdi: true,
        metodo_pago: true,
        forma_pago: true
      }
    })

    return NextResponse.json({ data: updated })
  } catch (err: any) {
    console.error('[PATCH /api/cotizaciones/[id]] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
