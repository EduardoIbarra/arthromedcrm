import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { parcialidades } = body

    const invoice = await prisma.facturas_cliente.findUnique({
      where: { id }
    })

    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 })
    }

    // Calculate totals
    const totalMonto = parcialidades.reduce((sum: number, p: any) => sum + Number(p.monto), 0)

    // Create planes_pago
    const plan = await prisma.planes_pago.create({
      data: {
        folio: `PP-${invoice.numero_factura}`,
        cliente_id: invoice.cliente_id,
        cliente_nombre: invoice.cliente_nombre,
        factura_id: invoice.id,
        numero_parcialidades: parcialidades.length,
        total_sin_descuento: totalMonto,
        total_con_descuento: totalMonto,
        parcialidades: {
          create: parcialidades.map((p: any, i: number) => ({
            numero: i + 1,
            monto: Number(p.monto),
            fecha_vencimiento: new Date(p.fecha),
            pagado: false
          }))
        }
      }
    })

    return NextResponse.json({ success: true, plan })
  } catch (err: any) {
    console.error('[POST /api/facturas/[id]/plan_pago] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
