import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/imports/[id] — single repartition detail
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const repartition = await prisma.importaciones_recepcion.findUnique({
      where: { id },
      include: {
        importacion_items: {
          include: {
            importacion_asignaciones: {
              include: {
                factura_productos: {
                  select: {
                    id: true,
                    producto_nombre: true,
                    cantidad_facturada: true,
                    cantidad_pendiente: true,
                    facturas_cliente: {
                      select: {
                        id: true,
                        numero_factura: true,
                        cliente_nombre: true,
                        fecha_pago: true,
                        fecha_expedicion: true,
                      }
                    }
                  }
                }
              }
            }
          }
        },
        importacion_fuentes: true,
      }
    })

    if (!repartition) {
      return NextResponse.json({ error: 'Repartición no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ data: repartition })
  } catch (error: any) {
    console.error('[imports/detail] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
