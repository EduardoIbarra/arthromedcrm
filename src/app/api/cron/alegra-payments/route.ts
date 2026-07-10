import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAlegraAuthHeader } from '@/lib/alegra'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const authHeader = getAlegraAuthHeader()
    if (!authHeader) {
      return NextResponse.json({ error: 'Credenciales de Alegra no configuradas' }, { status: 500 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find all partial payments that are due and not yet paid
    const duePayments = await prisma.parcialidades.findMany({
      where: {
        pagado: false,
        fecha_vencimiento: { lte: new Date() }
      },
      include: {
        planes_pago: {
          include: {
            facturas_cliente: true
          }
        }
      }
    })

    const results = []

    for (const payment of duePayments) {
      if (!payment.planes_pago?.facturas_cliente?.alegra_id) {
        results.push({ id: payment.id, success: false, error: 'Factura no tiene alegra_id' })
        continue
      }

      const alegraInvoiceId = payment.planes_pago.facturas_cliente.alegra_id

      const paymentPayload = {
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'other', // default to "other" (Por definir) or pick from DB
        invoices: [
          {
            id: alegraInvoiceId,
            amount: Number(payment.monto)
          }
        ]
      }

      try {
        const res = await fetch('https://api.alegra.com/api/v1/payments', {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(paymentPayload)
        })
        const data = await res.json()

        if (res.ok) {
          // Update partial payment to paid
          await prisma.parcialidades.update({
            where: { id: payment.id },
            data: { pagado: true, fecha_pago: new Date() }
          })
          results.push({ id: payment.id, success: true, paymentId: data.id })
        } else {
          results.push({ id: payment.id, success: false, error: data.message })
        }
      } catch (err: any) {
        results.push({ id: payment.id, success: false, error: err.message })
      }
    }

    return NextResponse.json({ success: true, processed: results.length, details: results })
  } catch (err: any) {
    console.error('[Cron Alegra Payments] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
