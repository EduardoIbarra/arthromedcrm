import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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

    // Get the factura and its products
    const factura = await prisma.facturas_cliente.findUnique({
      where: { id },
      include: { factura_productos: true }
    })

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    await prisma.$transaction(async (tx: any) => {
      // Update each factura_producto
      for (const item of items) {
        const { id: prodId, cantidad_entregada } = item
        if (prodId && typeof cantidad_entregada === 'number') {
          await tx.factura_productos.update({
            where: { id: prodId },
            data: { cantidad_entregada: Math.max(0, cantidad_entregada) }
          })
        }
      }

      // Re-fetch updated products to recalculate estado_surtido
      const updated = await tx.factura_productos.findMany({ where: { factura_id: id } })
      const anyDelivered = updated.some((p: any) => (p.cantidad_entregada || 0) > 0)
      const allDelivered = updated.every((p: any) => (p.cantidad_entregada || 0) >= p.cantidad_facturada)
      const estado_surtido = allDelivered ? 'completa' : anyDelivered ? 'parcial' : 'no_surtida'

      await tx.facturas_cliente.update({
        where: { id },
        data: { estado_surtido }
      })
    })

    return NextResponse.json({ success: true, message: 'Surtido actualizado exitosamente' })
  } catch (error: any) {
    console.error('Error updating invoice fulfillment:', error)
    return NextResponse.json({ error: error.message || 'Error al actualizar surtido' }, { status: 500 })
  }
}
