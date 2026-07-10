import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAlegraAuthHeader, toAlegraTaxRegime } from '@/lib/alegra'

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

    // Fetch estimate from Alegra to get the client details
    let alegraClient: any = undefined
    try {
      const estimateRes = await fetch(`https://api.alegra.com/api/v1/estimates/${quote.alegra_id}`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      })
      if (estimateRes.ok) {
        const estimateData = await estimateRes.json()
        alegraClient = estimateData.client
      }
    } catch (err) {
      console.error('Error fetching estimate to get client:', err)
    }

    // Alegra México requires taxRegime as catalog enums (e.g. BUSINESS_ACTIVITIES_REGIME),
    // not SAT codes (e.g. "612"). Map before updating the contact.
    const alegraTaxRegime = toAlegraTaxRegime(regimen_fiscal)

    // Step 1: Update client's taxRegime in Alegra if provided
    if (alegraClient?.id && regimen_fiscal) {
      if (!alegraTaxRegime) {
        return NextResponse.json({
          success: false,
          error: `Régimen fiscal no reconocido: "${regimen_fiscal}". Usa un código SAT (ej. 612) o el id de Alegra (ej. BUSINESS_ACTIVITIES_REGIME).`
        }, { status: 400 })
      }

      try {
        // Prefer /contacts (official); /clients is a legacy alias in some accounts
        const contactRes = await fetch(`https://api.alegra.com/api/v1/contacts/${alegraClient.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ taxRegime: alegraTaxRegime })
        })

        if (!contactRes.ok) {
          const errBody = await contactRes.json().catch(() => ({}))
          console.error('Error updating Alegra contact taxRegime:', errBody)
          return NextResponse.json({
            success: false,
            error: errBody.message || `No se pudo actualizar el régimen fiscal del cliente en Alegra (${contactRes.status})`
          }, { status: 400 })
        }
      } catch (err) {
        console.error('Error updating Alegra contact taxRegime:', err)
        return NextResponse.json({
          success: false,
          error: 'Error de red al actualizar el régimen fiscal del cliente en Alegra'
        }, { status: 500 })
      }
    }

    // Step 1.5: Refresh the estimate's client snapshot so it picks up any updated taxRegime
    if (alegraClient?.id) {
      try {
        await fetch(`https://api.alegra.com/api/v1/estimates/${quote.alegra_id}`, {
          method: 'PUT',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ client: alegraClient.id })
        })
      } catch (err) {
        console.error('Error refreshing estimate client snapshot:', err)
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

    // When we know the client, pin it on the invoice so stamp uses the updated contact
    if (alegraClient?.id) {
      alegraPayload.client = alegraClient.id
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

    // Step 3: Update local quote status
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
