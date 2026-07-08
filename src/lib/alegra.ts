export function getAlegraAuthHeader(): string | null {
  const email = process.env.ALEGRA_API_EMAIL
  const token = process.env.ALEGRA_API_TOKEN
  if (!email || !token) return null
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
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