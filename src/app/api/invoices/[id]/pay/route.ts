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
    const { fecha_pago, metodo_pago } = body

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })
    }

    const factura = await prisma.facturas_cliente.findUnique({
      where: { id }
    })

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    const updated = await prisma.facturas_cliente.update({
      where: { id },
      data: {
        estado: 'pagada',
        fecha_pago: fecha_pago ? new Date(fecha_pago) : new Date(),
        metodo_pago: metodo_pago || null
      }
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error paying invoice:', error)
    return NextResponse.json({ error: error.message || 'Error al registrar el pago' }, { status: 500 })
  }
}
