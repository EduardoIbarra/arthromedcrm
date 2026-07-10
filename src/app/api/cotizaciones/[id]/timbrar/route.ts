import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAlegraAuthHeader, toAlegraTaxRegime } from '@/lib/alegra'

const ALEGRA_BASE = 'https://api.alegra.com/api/v1'

/** SAT forma de pago (01, 03, …) → Alegra paymentMethod */
const SAT_FORMA_TO_ALEGRA_METHOD: Record<string, string> = {
  '01': 'cash',
  '02': 'check',
  '03': 'transfer',
  '04': 'credit-card',
  '28': 'debit-card',
  '99': 'other',
}

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

/** Alegra may return regime as string, array, or regimeObject[] */
function extractExistingRegime(contact: any): string | null {
  if (!contact) return null
  if (typeof contact.regime === 'string' && contact.regime) {
    return toAlegraTaxRegime(contact.regime)
  }
  if (Array.isArray(contact.regime) && contact.regime[0]) {
    return toAlegraTaxRegime(contact.regime[0])
  }
  if (Array.isArray(contact.regimeObject) && contact.regimeObject[0]) {
    return toAlegraTaxRegime(contact.regimeObject[0])
  }
  if (typeof contact.taxRegime === 'string' && contact.taxRegime) {
    return toAlegraTaxRegime(contact.taxRegime)
  }
  return null
}

/**
 * Map UI payment fields to Alegra Mexico invoice fields.
 * - paymentType = SAT método (PUE | PPD)
 * - paymentMethod = forma (cash, transfer, other, …)
 * PPD only allows paymentMethod "other" (Por definir).
 */
function mapPaymentFields(metodo_pago: string, forma_pago: string) {
  const paymentType = (metodo_pago || 'PUE').toUpperCase() === 'PPD' ? 'PPD' : 'PUE'
  let paymentMethod =
    SAT_FORMA_TO_ALEGRA_METHOD[String(forma_pago || '').trim()] ||
    // already an Alegra method name
    (['cash', 'transfer', 'check', 'credit-card', 'debit-card', 'other', 'deposit'].includes(
      String(forma_pago || '').toLowerCase()
    )
      ? String(forma_pago).toLowerCase()
      : 'transfer')

  if (paymentType === 'PPD') {
    paymentMethod = 'other'
  }

  return { paymentType, paymentMethod }
}

function mapEstimateItemsToInvoice(items: any[]): any[] {
  return (items || []).map((item: any) => {
    const mapped: Record<string, unknown> = {
      id: item.id,
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
    }
    if (item.description || item.name) {
      mapped.description = item.description || item.name
    }
    if (item.reference) {
      mapped.reference = item.reference
    }
    if (item.discount != null && Number(item.discount) > 0) {
      mapped.discount = Number(item.discount)
    }
    if (Array.isArray(item.tax) && item.tax.length > 0) {
      mapped.tax = item.tax
        .map((t: any) => (t?.id != null ? { id: t.id } : null))
        .filter(Boolean)
    }
    return mapped
  })
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

    // Fetch full estimate (client + items). Alegra requires items when converting estimate → invoice.
    let estimateData: any = null
    try {
      const estimateRes = await fetch(`${ALEGRA_BASE}/estimates/${quote.alegra_id}`, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      })
      if (estimateRes.ok) {
        estimateData = await estimateRes.json()
      } else {
        const errBody = await estimateRes.json().catch(() => ({}))
        return NextResponse.json({
          success: false,
          error: errBody.message || 'No se pudo obtener la cotización en Alegra',
        }, { status: 400 })
      }
    } catch (err) {
      console.error('Error fetching estimate:', err)
      return NextResponse.json({
        success: false,
        error: 'Error de red al obtener la cotización en Alegra',
      }, { status: 500 })
    }

    const estimateClientId = estimateData?.client?.id
    if (!estimateClientId) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró el cliente de la cotización en Alegra',
      }, { status: 400 })
    }

    const estimateItems = Array.isArray(estimateData.items) ? estimateData.items : []
    if (estimateItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'La cotización en Alegra no tiene partidas (items). No se puede timbrar.',
      }, { status: 400 })
    }

    // Full contact — estimate client snapshot does not include regime
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

    const localCliente = quote.clientes
    const name = extractName(contact, quote.cliente_nombre || localCliente?.nombre)
    const identification = extractIdentification(
      contact,
      quote.cliente_rfc || localCliente?.rfc
    )
    const zipCode = extractZipCode(contact, localCliente?.codigo_postal)
    const country =
      (contact.address?.country || 'MEX').toString().trim() || 'MEX'
    const thirdType =
      (contact.thirdType || 'NATIONAL').toString().trim() || 'NATIONAL'

    // Alegra México: contact uses regime + regimeObject[]; invoice stamp requires regimeClient
    const alegraTaxRegime =
      toAlegraTaxRegime(regimen_fiscal) ||
      extractExistingRegime(contact) ||
      toAlegraTaxRegime(localCliente?.regimen_fiscal)

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

    const existingAddress =
      contact.address && typeof contact.address === 'object' ? contact.address : {}

    const contactUpdate: Record<string, unknown> = {
      name,
      identification,
      thirdType,
      regime: alegraTaxRegime,
      regimeObject: [alegraTaxRegime],
      address: {
        ...(existingAddress.street ? { street: existingAddress.street } : {}),
        ...(existingAddress.exteriorNumber ? { exteriorNumber: existingAddress.exteriorNumber } : {}),
        ...(existingAddress.interiorNumber ? { interiorNumber: existingAddress.interiorNumber } : {}),
        ...(existingAddress.colony ? { colony: existingAddress.colony } : {}),
        ...(existingAddress.locality ? { locality: existingAddress.locality } : {}),
        ...(existingAddress.municipality ? { municipality: existingAddress.municipality } : {}),
        ...(existingAddress.state ? { state: existingAddress.state } : {}),
        country,
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

    // Refresh estimate client snapshot (best-effort)
    try {
      await fetch(`${ALEGRA_BASE}/estimates/${quote.alegra_id}`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({ client: estimateClientId }),
      })
    } catch (err) {
      console.error('Error refreshing estimate client snapshot:', err)
    }

    const { paymentType, paymentMethod } = mapPaymentFields(metodo_pago, forma_pago)
    const invoiceItems = mapEstimateItemsToInvoice(estimateItems)

    // Verified: stamp fails with "El régimen fiscal del cliente es requerido"
    // unless regimeClient is set on the invoice payload (contact update alone is not enough).
    // Alegra also requires explicit items when converting from an estimate.
    const alegraPayload: Record<string, unknown> = {
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      estimate: quote.alegra_id,
      client: estimateClientId,
      items: invoiceItems,
      paymentType,
      paymentMethod,
      cfdiUse: uso_cfdi,
      regimeClient: alegraTaxRegime,
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
      console.error('Alegra API Error:', data, 'payload keys', Object.keys(alegraPayload), {
        paymentType,
        paymentMethod,
        regimeClient: alegraTaxRegime,
        itemsCount: invoiceItems.length,
      })
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
