import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAlegraAuthHeader, toAlegraTaxRegime } from '@/lib/alegra'

const ALEGRA_BASE = 'https://api.alegra.com/api/v1'

function extractZipCode(contact: any, localZip?: string | null): string | null {
  const fromContact =
    contact?.address?.zipCode ||
    contact?.address?.zip ||
    contact?.zipCode ||
    null
  const zip = (fromContact || localZip || '').toString().trim()
  return zip || null
}

function extractName(contact: any, fallback?: string | null): string | null {
  const name = (
    contact?.name ||
    contact?.nameObject?.name ||
    [contact?.nameObject?.firstName, contact?.nameObject?.secondName, contact?.nameObject?.lastName]
      .filter(Boolean)
      .join(' ') ||
    fallback ||
    ''
  ).toString().trim()
  return name || null
}

function extractIdentification(contact: any, fallback?: string | null): string | null {
  const id =
    contact?.identification ||
    contact?.identificationObject?.number ||
    fallback ||
    ''
  return id.toString().trim() || null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { metodo_pago = 'PUE', uso_cfdi = 'G03', forma_pago = '01', regimen_fiscal } = body

    const quote = await prisma.cotizaciones.findUnique({
      where: { id },
      include: { clientes: true },
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

    const jsonHeaders = {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    // Fetch estimate to get the associated client id
    let estimateClientId: string | number | undefined
    try {
      const estimateRes = await fetch(`${ALEGRA_BASE}/estimates/${quote.alegra_id}`, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      })
      if (estimateRes.ok) {
        const estimateData = await estimateRes.json()
        estimateClientId = estimateData.client?.id
      }
    } catch (err) {
      console.error('Error fetching estimate to get client:', err)
    }

    if (!estimateClientId) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró el cliente de la cotización en Alegra',
      }, { status: 400 })
    }

    // Fetch full contact — estimate only returns a partial client snapshot
    let contact: any = null
    try {
      const contactRes = await fetch(`${ALEGRA_BASE}/contacts/${estimateClientId}`, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      })
      if (contactRes.ok) {
        contact = await contactRes.json()
      } else {
        const errBody = await contactRes.json().catch(() => ({}))
        console.error('Error fetching Alegra contact:', errBody)
      }
    } catch (err) {
      console.error('Error fetching Alegra contact:', err)
    }

    if (!contact) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo obtener el contacto en Alegra para validar datos fiscales',
      }, { status: 400 })
    }

    // Local ERP fallbacks (cotización / catálogo clientes)
    const localCliente = quote.clientes
    const name = extractName(contact, quote.cliente_nombre || localCliente?.nombre)
    const identification = extractIdentification(
      contact,
      quote.cliente_rfc || localCliente?.rfc
    )
    const zipCode = extractZipCode(contact, localCliente?.codigo_postal)
    const alegraTaxRegime =
      toAlegraTaxRegime(regimen_fiscal) ||
      toAlegraTaxRegime(contact.taxRegime) ||
      toAlegraTaxRegime(localCliente?.regimen_fiscal)

    // Pre-validate CFDI 4.0 receptor requirements before calling stamp
    const missing: string[] = []
    if (!name) missing.push('nombre del cliente')
    if (!identification) missing.push('RFC del cliente')
    if (!alegraTaxRegime) missing.push('régimen fiscal del cliente')
    if (!zipCode) missing.push('código postal fiscal del cliente')

    if (missing.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Faltan datos fiscales para timbrar: ${missing.join(', ')}. Complétalos en el cliente de Alegra o en el ERP e intenta de nuevo.`,
      }, { status: 400 })
    }

    // Update contact with required fields. Alegra PUT requires `name` even for partial updates
    // (sending only { taxRegime } returns "El nombre del contacto es obligatorio").
    const existingAddress =
      contact.address && typeof contact.address === 'object' ? contact.address : {}
    const contactUpdate: Record<string, unknown> = {
      name,
      identification,
      taxRegime: alegraTaxRegime,
      address: {
        // Only re-send known fiscal address fields Alegra accepts
        ...(existingAddress.street ? { street: existingAddress.street } : {}),
        ...(existingAddress.exteriorNumber ? { exteriorNumber: existingAddress.exteriorNumber } : {}),
        ...(existingAddress.interiorNumber ? { interiorNumber: existingAddress.interiorNumber } : {}),
        ...(existingAddress.colony ? { colony: existingAddress.colony } : {}),
        ...(existingAddress.locality ? { locality: existingAddress.locality } : {}),
        ...(existingAddress.municipality ? { municipality: existingAddress.municipality } : {}),
        ...(existingAddress.state ? { state: existingAddress.state } : {}),
        ...(existingAddress.country ? { country: existingAddress.country } : {}),
        zipCode,
      },
    }

    try {
      const updateRes = await fetch(`${ALEGRA_BASE}/contacts/${estimateClientId}`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify(contactUpdate),
      })

      if (!updateRes.ok) {
        const errBody = await updateRes.json().catch(() => ({}))
        console.error('Error updating Alegra contact:', errBody)
        return NextResponse.json({
          success: false,
          error: errBody.message || `No se pudo actualizar el contacto en Alegra (${updateRes.status})`,
        }, { status: 400 })
      }
    } catch (err) {
      console.error('Error updating Alegra contact:', err)
      return NextResponse.json({
        success: false,
        error: 'Error de red al actualizar el contacto en Alegra',
      }, { status: 500 })
    }

    // Refresh the estimate's client snapshot so stamp uses updated fiscal data
    try {
      await fetch(`${ALEGRA_BASE}/estimates/${quote.alegra_id}`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({ client: estimateClientId }),
      })
    } catch (err) {
      console.error('Error refreshing estimate client snapshot:', err)
    }

    // Create invoice from estimate and stamp
    const alegraPayload: Record<string, unknown> = {
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      estimate: quote.alegra_id,
      client: estimateClientId,
      paymentMethod: metodo_pago,
      paymentForm: forma_pago,
      cfdiUse: uso_cfdi,
      stamp: {
        generateStamp: true,
        version: '4.0',
      },
    }

    const res = await fetch(`${ALEGRA_BASE}/invoices`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(alegraPayload),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Alegra API Error:', data)
      return NextResponse.json({
        success: false,
        error: data.message || 'Error al crear/timbrar factura en Alegra',
      }, { status: 400 })
    }

    await prisma.cotizaciones.update({
      where: { id },
      data: { estado: 'Facturado' },
    })

    return NextResponse.json({ success: true, factura: data })
  } catch (err: any) {
    console.error('[POST /api/cotizaciones/[id]/timbrar] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
