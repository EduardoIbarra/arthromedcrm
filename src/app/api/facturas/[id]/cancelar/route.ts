import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAlegraAuthHeader } from '@/lib/alegra'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { reason = '02' } = body

    const invoice = await prisma.facturas_cliente.findUnique({
      where: { id }
    })

    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 })
    }

    if (!invoice.alegra_id) {
      return NextResponse.json({ success: false, error: 'La factura no está sincronizada con Alegra (falta alegra_id)' }, { status: 400 })
    }

    const authHeader = getAlegraAuthHeader()
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Credenciales de Alegra no configuradas' }, { status: 500 })
    }

    // Call Alegra void endpoint
    const res = await fetch(`https://api.alegra.com/api/v1/invoices/${invoice.alegra_id}/void`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ cause: reason })
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Alegra API Cancel Error:', data)
      return NextResponse.json({ success: false, error: data.message || 'Error al cancelar la factura en Alegra' }, { status: 400 })
    }

    // Update local DB
    await prisma.facturas_cliente.update({
      where: { id },
      data: { estado: 'cancelada' }
    })

    return NextResponse.json({ success: true, factura: data })
  } catch (err: any) {
    console.error('[POST /api/facturas/[id]/cancelar] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
