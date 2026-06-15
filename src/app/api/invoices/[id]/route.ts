import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const factura = await prisma.facturas_cliente.findUnique({
      where: { id },
      include: {
        factura_productos: {
          orderBy: {
            producto_nombre: 'asc'
          }
        },
        remisiones: {
          include: {
            remision_productos: true
          }
        },
        planes_pago: {
          include: {
            parcialidades: {
              orderBy: {
                numero: 'asc'
              }
            }
          },
          orderBy: {
            created_at: 'desc'
          },
          take: 1
        }
      }
    })

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    return NextResponse.json(factura)
  } catch (error: any) {
    console.error('Error fetching factura:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
