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

export async function fetchAlegraInvoice(alegraId: string, fields?: string): Promise<any> {
  const authHeader = getAlegraAuthHeader()
  if (!authHeader) {
    throw new Error('Alegra API credentials are not configured')
  }

  const url = fields
    ? `https://api.alegra.com/api/v1/invoices/${alegraId}?fields=${fields}`
    : `https://api.alegra.com/api/v1/invoices/${alegraId}`

  const res = await fetch(url, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Alegra API error ${res.status}: ${txt}`)
  }

  return res.json()
}

export function extractAlegraFileUrl(data: any, field: 'pdf' | 'xml'): string | null {
  if (!data) return null
  const value = data[field]
  if (typeof value === 'string' && value.startsWith('http')) return value
  if (value && typeof value === 'object' && typeof value.url === 'string') return value.url
  return null
}