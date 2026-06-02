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
    const { estado_surtido, items } = body

    if (!estado_surtido || !['no_surtida', 'parcial', 'completa'].includes(estado_surtido)) {
      return NextResponse.json({ error: 'Estado de surtido inválido' }, { status: 400 })
    }

    // Get the factura and its products
    const factura = await prisma.facturas_cliente.findUnique({
      where: { id },
      include: { factura_productos: true }
    })

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    // Begin transaction to update products and factura
    await prisma.$transaction(async (tx: any) => {
      // Update factura status
      await tx.facturas_cliente.update({
        where: { id },
        data: { estado_surtido }
      })

      // Update products based on the new status
      if (estado_surtido === 'completa') {
        for (const prod of factura.factura_productos) {
          await tx.factura_productos.update({
            where: { id: prod.id },
            data: { cantidad_entregada: prod.cantidad_facturada }
          })
        }
      } else if (estado_surtido === 'no_surtida') {
        for (const prod of factura.factura_productos) {
          await tx.factura_productos.update({
            where: { id: prod.id },
            data: { cantidad_entregada: 0 }
          })
        }
      } else if (estado_surtido === 'parcial') {
        if (!Array.isArray(items)) {
          throw new Error('Se requiere el array de items para estado parcial')
        }
        
        for (const item of items) {
          const { id: prodId, cantidad_entregada } = item
          if (prodId && typeof cantidad_entregada === 'number') {
            await tx.factura_productos.update({
              where: { id: prodId },
              data: { cantidad_entregada }
            })
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Surtido actualizado exitosamente'
    })
  } catch (error: any) {
    console.error('Error updating invoice fulfillment:', error)
    return NextResponse.json({ error: error.message || 'Error al actualizar surtido' }, { status: 500 })
  }
}
