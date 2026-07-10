export function getAlegraAuthHeader(): string | null {
  const email = process.env.ALEGRA_API_EMAIL
  const token = process.env.ALEGRA_API_TOKEN
  if (!email || !token) return null
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
}

/**
 * Alegra México expects regime catalog enum IDs, not SAT numeric codes.
 * Contacts API fields (MX electronic invoicing): `regime` + `regimeObject: [regime]`.
 * Note: `taxRegime` is NOT accepted and is silently ignored / rejected.
 * @see https://developer.alegra.com/reference/méxico
 */
const SAT_TO_ALEGRA_TAX_REGIME: Record<string, string> = {
  '601': 'GENERAL_REGIME_OF_MORAL_PEOPLE_LAW',
  '603': 'REGIME_OF_MORAL_PEOPLE_NOT_PROFIT',
  '605': 'SALARIED_REGIME',
  '606': 'LEASEHOLD_REGIME',
  '611': 'DIVIDEND_INCOME',
  '612': 'BUSINESS_ACTIVITIES_REGIME',
  '616': 'SIMPLIFIED_REGIME',
  '620': 'REGIME_OF_COOPERATIVE_PRODUCTION_SOCIETIES',
  '621': 'FISCAL_INCORPORATION_REGIME',
  '622': 'PRIMARY_SECTOR_REGIME',
  '623': 'SOCIETIES_OPTIONAL_REGIME',
  '624': 'REGIME_OF_THE_COORDINATED',
  '625': 'REGIME_OF_THE_TECHNOLOGICAL_PLATFORMS_INCOME_ACTIVITIES',
  '626': 'REGIME_OF_TRUST',
}

const ALEGRA_TAX_REGIME_IDS = new Set([
  ...Object.values(SAT_TO_ALEGRA_TAX_REGIME),
  'NO_REGIME',
])

/**
 * Map a SAT code (e.g. "612") or Alegra enum (e.g. "BUSINESS_ACTIVITIES_REGIME")
 * to the Alegra `regime` value required by the contacts API (México).
 */
export function toAlegraTaxRegime(regimen: string | null | undefined): string | null {
  if (!regimen) return null
  const trimmed = String(regimen).trim()
  if (!trimmed) return null

  // Already an Alegra enum
  if (ALEGRA_TAX_REGIME_IDS.has(trimmed)) return trimmed

  // SAT numeric code (with or without text after)
  const satMatch = trimmed.match(/\b(60[1-9]|61[0-6]|62[0-6])\b/)
  if (satMatch) {
    return SAT_TO_ALEGRA_TAX_REGIME[satMatch[1]] || null
  }

  // Case-insensitive enum match
  const upper = trimmed.toUpperCase().replace(/\s+/g, '_')
  if (ALEGRA_TAX_REGIME_IDS.has(upper)) return upper

  return null
}

const ALEGRA_BASE = 'https://api.alegra.com/api/v1'

export function mapAlegraPaymentMethod(method: string | null | undefined): string {
  switch ((method || '').toLowerCase()) {
    case 'cash':
      return 'Efectivo'
    case 'transfer':
      return 'Transferencia'
    case 'check':
      return 'Cheque'
    case 'card':
    case 'credit-card':
      return 'Tarjeta de crédito'
    case 'debit-card':
      return 'Tarjeta de débito'
    case 'deposit':
      return 'Depósito'
    default:
      return method || 'No especificado'
  }
}

export async function fetchAlegraInvoice(alegraId: string, fields?: string): Promise<any> {
  const authHeader = getAlegraAuthHeader()
  if (!authHeader) {
    throw new Error('Alegra API credentials are not configured')
  }

  const url = fields
    ? `${ALEGRA_BASE}/invoices/${alegraId}?fields=${fields}`
    : `${ALEGRA_BASE}/invoices/${alegraId}`

  const res = await fetch(url, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Alegra API error ${res.status}: ${txt}`)
  }

  return res.json()
}

export async function fetchAlegraPayment(paymentId: string): Promise<any> {
  const authHeader = getAlegraAuthHeader()
  if (!authHeader) {
    throw new Error('Alegra API credentials are not configured')
  }

  const res = await fetch(`${ALEGRA_BASE}/payments/${paymentId}`, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Alegra API error ${res.status}: ${txt}`)
  }

  return res.json()
}

/**
 * Payments applied to a specific Alegra invoice (complementos de pago / REPs).
 * Prefers invoice.payments, falls back to client payment list when needed.
 */
export async function fetchAlegraPaymentsForInvoice(
  alegraInvoiceId: string,
  preloadedInvoice?: any
): Promise<{
  invoice: any
  payments: AlegraInvoicePayment[]
}> {
  const invoice = preloadedInvoice || (await fetchAlegraInvoice(alegraInvoiceId))
  const invoiceIdStr = String(alegraInvoiceId)

  let paymentSummaries: any[] = Array.isArray(invoice.payments) ? [...invoice.payments] : []

  // Fallback: payments linked via client that reference this invoice
  if (paymentSummaries.length === 0 && invoice.client?.id) {
    const authHeader = getAlegraAuthHeader()
    if (authHeader) {
      try {
        const res = await fetch(
          `${ALEGRA_BASE}/payments?limit=30&type=in&client_id=${invoice.client.id}&order_direction=DESC`,
          { headers: { Authorization: authHeader, Accept: 'application/json' } }
        )
        if (res.ok) {
          const all = await res.json()
          if (Array.isArray(all)) {
            paymentSummaries = all.filter((p: any) =>
              (p.invoices || []).some((inv: any) => String(inv.id) === invoiceIdStr)
            )
          }
        }
      } catch (err) {
        console.error('Error fetching client payments from Alegra:', err)
      }
    }
  }

  const payments = await Promise.all(
    paymentSummaries.map(async (summary: any): Promise<AlegraInvoicePayment> => {
      let detail: any = summary
      try {
        if (summary?.id) {
          detail = await fetchAlegraPayment(String(summary.id))
        }
      } catch (err) {
        console.warn(`Could not load payment ${summary?.id} detail:`, err)
      }

      const appliedToInvoice = (detail.invoices || summary.invoices || []).find(
        (inv: any) => String(inv.id) === invoiceIdStr
      )
      const amount =
        Number(appliedToInvoice?.amount ?? summary.amount ?? detail.amount ?? 0) || 0
      const stamp = detail.stamp || null

      return {
        id: String(detail.id || summary.id),
        number: detail.number ?? summary.number ?? null,
        date: detail.date || summary.date || null,
        amount,
        paymentMethod: mapAlegraPaymentMethod(detail.paymentMethod || summary.paymentMethod),
        paymentMethodRaw: detail.paymentMethod || summary.paymentMethod || null,
        status: detail.status || summary.status || null,
        observations: detail.observations || summary.observations || null,
        anotation: detail.anotation || summary.anotation || null,
        stampUuid: stamp?.uuid || null,
        stampDate: stamp?.stampDate || stamp?.date || null,
        stampVersion: stamp?.version || detail.stampVersion || summary.stampVersion || null,
        satVerificationUrl: stamp?.barCodeContent || null,
        bankAccount: detail.bankAccount?.name || detail.account?.name || null,
      }
    })
  )

  // Newest first
  payments.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))

  return { invoice, payments }
}

export type AlegraInvoicePayment = {
  id: string
  number: string | number | null
  date: string | null
  amount: number
  paymentMethod: string
  paymentMethodRaw: string | null
  status: string | null
  observations: string | null
  anotation: string | null
  stampUuid: string | null
  stampDate: string | null
  stampVersion: string | null
  satVerificationUrl: string | null
  bankAccount: string | null
}

export function extractAlegraFileUrl(data: any, field: 'pdf' | 'xml'): string | null {
  if (!data) return null
  const value = data[field]
  if (typeof value === 'string' && value.startsWith('http')) return value
  if (value && typeof value === 'object' && typeof value.url === 'string') return value.url
  return null
}