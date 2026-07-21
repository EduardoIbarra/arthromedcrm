import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAlegraAuthHeader, fetchAlegraInvoice, fetchAlegraPaymentsForInvoice } from '@/lib/alegra'
import { firstPaymentFieldsFromAlegraInvoice } from '@/lib/delivery-limit'
import { computeEstadoSurtido } from '@/lib/fulfillment-status'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { advanceInvoiceId, amount } = body

    if (!advanceInvoiceId || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { success: false, error: 'La factura de anticipo y el monto son requeridos.' },
        { status: 400 }
      )
    }

    const authHeader = getAlegraAuthHeader()
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Credenciales de Alegra no configuradas' },
        { status: 500 }
      )
    }

    // 1. Fetch final/target invoice from DB
    const finalInvoice = await prisma.facturas_cliente.findUnique({
      where: { id },
    })

    if (!finalInvoice) {
      return NextResponse.json({ success: false, error: 'Factura final no encontrada' }, { status: 404 })
    }

    if (!finalInvoice.alegra_id) {
      return NextResponse.json(
        { success: false, error: 'La factura final no está vinculada con Alegra.' },
        { status: 400 }
      )
    }

    // 2. Fetch advance invoice from DB
    const advanceInvoice = await prisma.facturas_cliente.findUnique({
      where: { id: advanceInvoiceId },
    })

    if (!advanceInvoice) {
      return NextResponse.json({ success: false, error: 'Factura de anticipo no encontrada' }, { status: 404 })
    }

    if (!advanceInvoice.alegra_id) {
      return NextResponse.json(
        { success: false, error: 'La factura de anticipo no está vinculada con Alegra.' },
        { status: 400 }
      )
    }

    // 3. Fetch detailed documents from Alegra API
    let finalAlegraInvoice: any
    let advanceAlegraInvoice: any
    try {
      finalAlegraInvoice = await fetchAlegraInvoice(finalInvoice.alegra_id)
      advanceAlegraInvoice = await fetchAlegraInvoice(advanceInvoice.alegra_id)
    } catch (err: any) {
      console.error('Error fetching invoices from Alegra:', err)
      return NextResponse.json(
        { success: false, error: `Error al consultar Alegra: ${err.message}` },
        { status: 400 }
      )
    }

    // Verify UUID exists on final invoice (must be stamped)
    const finalUuid = finalAlegraInvoice.stamp?.uuid
    if (!finalUuid) {
      return NextResponse.json(
        { success: false, error: 'La factura final no tiene folio fiscal (UUID/Timbre). No se puede asociar una nota de crédito.' },
        { status: 400 }
      )
    }

    // 4. Resolve product & taxes from the advance invoice
    const advanceItems = advanceAlegraInvoice.items || []
    if (advanceItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'La factura de anticipo en Alegra no contiene partidas (items).' },
        { status: 400 }
      )
    }

    const firstItem = advanceItems[0]
    const advanceProductId = firstItem.id
    if (!advanceProductId) {
      return NextResponse.json(
        { success: false, error: 'No se encontró el ID del producto en la factura de anticipo.' },
        { status: 400 }
      )
    }

    // Calculate taxes
    const taxes = Array.isArray(firstItem.tax) ? firstItem.tax : []
    const totalTaxPercentage = taxes.reduce((sum: number, t: any) => sum + (Number(t.percentage) || 0), 0)
    const priceBeforeTax = Number(amount) / (1 + totalTaxPercentage / 100)

    // Map tax IDs for the payload
    const taxIdsMapped = taxes
      .map((t: any) => (t?.id != null ? { id: t.id } : null))
      .filter(Boolean)

    // 5. Build Alegra payload for adjustment-note
    const todayStr = new Date().toISOString().split('T')[0]
    const alegraPayload = {
      client: finalAlegraInvoice.client?.id,
      date: todayStr,
      stamp: {
        generateStamp: true,
      },
      useCFDI: 'G02', // Devoluciones, descuentos o bonificaciones
      paymentMethod: '30', // Aplicación de anticipos (standard SAT for this case)
      relationType: '07', // CFDI por aplicación de anticipo
      relations: [
        {
          uuid: finalUuid,
        },
      ],
      associatedSources: [
        {
          id: finalAlegraInvoice.id,
          type: 'invoice',
          amount: Number(amount),
        },
      ],
      items: [
        {
          id: advanceProductId,
          price: Number(priceBeforeTax.toFixed(4)),
          quantity: 1,
          tax: taxIdsMapped,
        },
      ],
    }

    // 6. Submit POST to Alegra adjustment-notes
    const res = await fetch('https://api.alegra.com/api/v1/adjustment-notes', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(alegraPayload),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Alegra API Adjustment Note Error:', data)
      return NextResponse.json(
        { success: false, error: data.message || 'Error al generar la nota de crédito en Alegra' },
        { status: 400 }
      )
    }

    // 7. Update local DB invoice state (best-effort sync)
    try {
      const { invoice: updatedInvoice, payments } = await fetchAlegraPaymentsForInvoice(finalInvoice.alegra_id)
      const fp = firstPaymentFieldsFromAlegraInvoice(updatedInvoice)
      
      const updateData: any = {
        primer_pago_fecha: fp.primer_pago_fecha,
        primer_pago_monto: fp.primer_pago_monto,
        total_pagado: fp.total_pagado,
        updated_at: new Date(),
      }

      const localEstado = String(finalInvoice.estado || '').toLowerCase()
      if (fp.estadoHint === 'parcial' && !['pagada', 'pagado', 'cancelada', 'anulado'].includes(localEstado)) {
        updateData.estado = 'parcial'
      } else if (fp.estadoHint === 'pagada' && !['cancelada', 'anulado'].includes(localEstado)) {
        updateData.estado = 'pagada'
      }

      await prisma.facturas_cliente.update({
        where: { id },
        data: updateData,
      })
    } catch (syncErr) {
      console.error('Failed to sync invoice status after credit note creation:', syncErr)
    }

    return NextResponse.json({ success: true, adjustmentNote: data })
  } catch (err: any) {
    console.error('[POST /api/invoices/[id]/nota-credito] Error:', err)
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 })
  }
}
