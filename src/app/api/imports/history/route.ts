import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/imports/history
 * Returns a list of past repartitions with their items and allocations.
 */
export async function GET() {
  try {
    const repartitions = await prisma.importaciones_recepcion.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
      include: {
        importacion_items: {
          include: {
            importacion_asignaciones: {
              include: {
                factura_productos: {
                  select: {
                    producto_nombre: true,
                    cantidad_pendiente: true,
                    facturas_cliente: {
                      select: {
                        numero_factura: true,
                        cliente_nombre: true,
                        fecha_pago: true,
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

    return NextResponse.json({ data: repartitions })
  } catch (error: any) {
    console.error('[imports/history] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
