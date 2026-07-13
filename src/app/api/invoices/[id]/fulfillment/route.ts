import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { recalcAndPersistEstadoSurtido } from '@/lib/fulfillment-status'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { items } = body

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Se requiere el array de items' }, { status: 400 })
    }

    const factura = await prisma.facturas_cliente.findUnique({
      where: { id },
      include: { factura_productos: true },
    })

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    let estado_surtido = 'no_surtida'

    await prisma.$transaction(async (tx: any) => {
      for (const item of items) {
        const { id: prodId, cantidad_entregada } = item
        if (prodId && typeof cantidad_entregada === 'number') {
          const fp = factura.factura_productos.find((p: any) => p.id === prodId)
          const fact = Number(fp?.cantidad_facturada) || 0
          const ent = Math.max(0, Math.min(cantidad_entregada, fact || cantidad_entregada))
          await tx.factura_productos.update({
            where: { id: prodId },
            data: { cantidad_entregada: ent },
          })
        }
      }

      estado_surtido = await recalcAndPersistEstadoSurtido(tx, id)
    })

    return NextResponse.json({
      success: true,
      message: 'Surtido actualizado exitosamente',
      estado_surtido,
    })
  } catch (error: any) {
    console.error('Error updating invoice fulfillment:', error)
    return NextResponse.json({ error: error.message || 'Error al actualizar surtido' }, { status: 500 })
  }
}
