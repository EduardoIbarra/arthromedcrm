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

    const quote = await prisma.cotizaciones.findUnique({
      where: { id }
    })

    if (!quote) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    // Calculate totals
    const totalMonto = parcialidades.reduce((sum: number, p: any) => sum + Number(p.monto), 0)

    // Create planes_pago
    const plan = await prisma.planes_pago.create({
      data: {
        folio: `PPC-${quote.numero_cotizacion}`,
        cliente_id: quote.cliente_id,
        cliente_nombre: quote.cliente_nombre,
        cotizacion_id: quote.id,
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
    console.error('[POST /api/cotizaciones/[id]/plan_pago] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
