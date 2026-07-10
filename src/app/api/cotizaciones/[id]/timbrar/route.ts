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
    const { metodo_pago = 'PUE', uso_cfdi = 'G03', forma_pago = '01', regimen_fiscal } = body

    const quote = await prisma.cotizaciones.findUnique({
      where: { id }
    })

    if (!quote) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    if (!quote.alegra_id) {
      return NextResponse.json({ success: false, error: 'La cotización no está sincronizada con Alegra (falta alegra_id)' }, { status: 400 })
    }

    const authHeader = getAlegraAuthHeader()
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Credenciales de Alegra no configuradas' }, { status: 500 })
    }

    // Fetch estimate from Alegra to get the clientId
    let clientId: string | undefined
    try {
      const estimateRes = await fetch(`https://api.alegra.com/api/v1/estimates/${quote.alegra_id}`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      })
      if (estimateRes.ok) {
        const estimateData = await estimateRes.json()
        clientId = estimateData.client?.id
      }
    } catch (err) {
      console.error('Error fetching estimate to get client:', err)
    }

    // Step 1: Optionally update client's taxRegime in Alegra if provided
    if (clientId && regimen_fiscal) {
      try {
        await fetch(`https://api.alegra.com/api/v1/clients/${clientId}`, {
          method: 'PUT',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ taxRegime: regimen_fiscal })
        })
      } catch (err) {
        console.error('Error updating Alegra client taxRegime:', err)
      }
    }

    // Step 2: Create Invoice from Estimate in Alegra
    const alegraPayload: any = {
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      estimate: quote.alegra_id,
      paymentMethod: metodo_pago,
      paymentForm: forma_pago,
      cfdiUse: uso_cfdi,
      stamp: {
        generateStamp: true,
        version: '4.0'
      }
    }

    if (clientId) {
      alegraPayload.client = {
        id: clientId,
        ...(regimen_fiscal ? { taxRegime: regimen_fiscal } : {})
      }
    }

    const res = await fetch('https://api.alegra.com/api/v1/invoices', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(alegraPayload)
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Alegra API Error:', data)
      return NextResponse.json({ success: false, error: data.message || 'Error al crear/timbrar factura en Alegra' }, { status: 400 })
    }

    // Step 2: Update local quote status
    await prisma.cotizaciones.update({
      where: { id },
      data: { estado: 'Facturado' }
    })

    return NextResponse.json({ success: true, factura: data })
  } catch (err: any) {
    console.error('[POST /api/cotizaciones/[id]/timbrar] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
