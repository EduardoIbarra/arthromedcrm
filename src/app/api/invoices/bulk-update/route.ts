import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, estado_surtido } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Se requieren IDs válidos' }, { status: 400 })
    }

    if (!estado_surtido || !['no_surtida', 'parcial', 'completa'].includes(estado_surtido)) {
      return NextResponse.json({ error: 'Estado de surtido inválido' }, { status: 400 })
    }

    const result = await prisma.facturas_cliente.updateMany({
      where: {
        id: {
          in: ids
        }
      },
      data: {
        estado_surtido
      }
    })

    return NextResponse.json({
      success: true,
      message: `Se actualizaron ${result.count} facturas exitosamente`,
      count: result.count
    })
  } catch (error: any) {
    console.error('Error updating invoices fulfillment status:', error)
    return NextResponse.json({ error: error.message || 'Error al actualizar facturas' }, { status: 500 })
  }
}
