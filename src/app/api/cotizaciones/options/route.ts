import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const [cfdiList, metodoPagoList, formaPagoList] = await Promise.all([
      prisma.cfdi.findMany({ orderBy: { id: 'asc' } }),
      prisma.metodo_pago.findMany({ orderBy: { id: 'asc' } }),
      prisma.forma_pago.findMany({ orderBy: { id: 'asc' } }),
    ])

    return NextResponse.json({
      data: {
        cfdi: cfdiList,
        metodo_pago: metodoPagoList,
        forma_pago: formaPagoList,
      }
    })
  } catch (err: any) {
    console.error('[GET /api/cotizaciones/options] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
