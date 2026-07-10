/** Delivery / shipping limit rules for client invoices. */

export const DELIVERY_WEEKS = 5
export const FIRST_PAYMENT_THRESHOLD = 0.6

export const DELIVERY_REFERENCE_TOOLTIP =
  'Referencia, no es una fecha límite formal: el primer pago fue menor al 60% del total. La política de entrega en 5 semanas aplica cuando el primer pago es ≥ 60%.'

export type ParcialidadLike = {
  numero: number
  monto: number | string
  pagado?: boolean | null
  fecha_pago?: string | Date | null
}

export type PlanPagoLike = {
  total_con_descuento?: number | string | null
  total_sin_descuento?: number | string | null
  parcialidades?: ParcialidadLike[] | null
}

/** A single payment applied to the invoice (Alegra complemento or local record). */
export type PaymentLike = {
  date?: string | Date | null
  amount?: number | string | null
}

export type InvoiceDeliveryInput = {
  total?: number | string | null
  fecha_pago?: string | Date | null
  estado?: string | null
  planes_pago?: PlanPagoLike[] | null
  /** Stored on facturas_cliente after sync / first payment */
  primer_pago_fecha?: string | Date | null
  primer_pago_monto?: number | string | null
  total_pagado?: number | string | null
  /** Live payments (e.g. from Alegra) — earliest is treated as first payment */
  payments?: PaymentLike[] | null
  /** Precomputed fields (API may attach these) */
  first_payment_date?: string | Date | null
  first_payment_amount?: number | string | null
  first_payment_percent?: number | null
}

export type DeliveryLimitInfo = {
  limitDate: Date | null
  firstPaymentDate: Date | null
  firstPaymentAmount: number | null
  invoiceTotal: number
  percentFirst: number | null
  /** True when first payment ≥ 60% — hard delivery deadline */
  qualifiesForDeadline: boolean
  /** True when we show a date but it is only a reference (< 60%) */
  isReferenceOnly: boolean
  weeks: number
}

function parseDateOnly(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }
  const str = String(value).split('T')[0]
  const parts = str.split('-')
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10) - 1
    const d = parseInt(parts[2], 10)
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d)
    }
  }
  const fallback = new Date(value)
  return isNaN(fallback.getTime()) ? null : fallback
}

function toNumber(v: number | string | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Add N calendar weeks to a date (date-only, local). */
export function addWeeks(start: Date, weeks: number): Date {
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  d.setDate(d.getDate() + weeks * 7)
  return d
}

export function calendarDaysDiff(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

/** Earliest payment by date (first complemento / abono). */
export function extractFirstPaymentFromList(
  payments: PaymentLike[] | null | undefined
): { date: Date; amount: number } | null {
  if (!Array.isArray(payments) || payments.length === 0) return null
  const parsed = payments
    .map((p) => ({
      date: parseDateOnly(p.date),
      amount: toNumber(p.amount),
    }))
    .filter((p) => p.date && p.amount > 0) as { date: Date; amount: number }[]
  if (parsed.length === 0) return null
  parsed.sort((a, b) => a.date.getTime() - b.date.getTime())
  return parsed[0]
}

/**
 * Resolve first payment date/amount and 5-week delivery limit.
 *
 * Priority:
 * 1. Explicit first_payment_* / primer_pago_* fields
 * 2. Paid plan installment #1
 * 3. Earliest entry in payments[] (Alegra complementos)
 * 4. Fully paid invoice with fecha_pago (100%)
 * 5. Partial: fecha_pago + total_pagado as first payment estimate
 */
export function computeDeliveryLimit(invoice: InvoiceDeliveryInput): DeliveryLimitInfo {
  const invoiceTotal = toNumber(invoice.total)
  const weeks = DELIVERY_WEEKS

  let firstPaymentDate: Date | null = null
  let firstPaymentAmount: number | null = null
  let baseTotal = invoiceTotal

  // 1. Explicit precomputed / stored fields
  const explicitDate =
    parseDateOnly(invoice.first_payment_date) || parseDateOnly(invoice.primer_pago_fecha)
  const explicitAmount =
    invoice.first_payment_amount != null
      ? toNumber(invoice.first_payment_amount)
      : invoice.primer_pago_monto != null
        ? toNumber(invoice.primer_pago_monto)
        : null

  if (explicitDate || explicitAmount != null) {
    firstPaymentDate = explicitDate
    firstPaymentAmount = explicitAmount
  }

  // 2. Payment plan installment #1
  if (!firstPaymentDate || firstPaymentAmount == null) {
    const plan = Array.isArray(invoice.planes_pago) ? invoice.planes_pago[0] : null
    const first =
      plan?.parcialidades?.find((p) => Number(p.numero) === 1) ||
      plan?.parcialidades?.slice().sort((a, b) => Number(a.numero) - Number(b.numero))[0]

    if (first && first.pagado && first.fecha_pago) {
      if (!firstPaymentDate) firstPaymentDate = parseDateOnly(first.fecha_pago)
      if (firstPaymentAmount == null) firstPaymentAmount = toNumber(first.monto)
      const planTotal = toNumber(plan?.total_con_descuento || plan?.total_sin_descuento)
      if (planTotal > 0) baseTotal = planTotal
    }
  }

  // 3. Live payments list (Alegra complementos de pago)
  if (!firstPaymentDate || firstPaymentAmount == null) {
    const fromList = extractFirstPaymentFromList(invoice.payments)
    if (fromList) {
      if (!firstPaymentDate) firstPaymentDate = fromList.date
      if (firstPaymentAmount == null) firstPaymentAmount = fromList.amount
    }
  }

  // 4. Fully paid without granular payment rows
  if (
    (!firstPaymentDate || firstPaymentAmount == null) &&
    invoice.fecha_pago &&
    ['pagada', 'pagado'].includes(String(invoice.estado || '').toLowerCase())
  ) {
    if (!firstPaymentDate) firstPaymentDate = parseDateOnly(invoice.fecha_pago)
    if (firstPaymentAmount == null && invoiceTotal > 0) firstPaymentAmount = invoiceTotal
  }

  // 5. Partial payment: use fecha_pago + total_pagado if we still lack data
  if (
    (!firstPaymentDate || firstPaymentAmount == null) &&
    (toNumber(invoice.total_pagado) > 0 ||
      ['parcial'].includes(String(invoice.estado || '').toLowerCase()))
  ) {
    if (!firstPaymentDate && invoice.fecha_pago) {
      firstPaymentDate = parseDateOnly(invoice.fecha_pago)
    }
    if (firstPaymentAmount == null && toNumber(invoice.total_pagado) > 0) {
      firstPaymentAmount = toNumber(invoice.total_pagado)
    }
  }

  if (invoice.first_payment_percent != null && firstPaymentAmount == null && baseTotal > 0) {
    firstPaymentAmount = (invoice.first_payment_percent / 100) * baseTotal
  }

  let percentFirst: number | null = null
  if (firstPaymentAmount != null && baseTotal > 0) {
    percentFirst = firstPaymentAmount / baseTotal
  } else if (invoice.first_payment_percent != null) {
    percentFirst =
      invoice.first_payment_percent > 1
        ? invoice.first_payment_percent / 100
        : invoice.first_payment_percent
  }

  const qualifiesForDeadline =
    percentFirst != null ? percentFirst + 1e-9 >= FIRST_PAYMENT_THRESHOLD : false

  const limitDate = firstPaymentDate ? addWeeks(firstPaymentDate, weeks) : null
  const isReferenceOnly = Boolean(limitDate && !qualifiesForDeadline)

  return {
    limitDate,
    firstPaymentDate,
    firstPaymentAmount,
    invoiceTotal: baseTotal,
    percentFirst,
    qualifiesForDeadline,
    isReferenceOnly,
    weeks,
  }
}

/** Attach delivery fields for API responses */
export function attachDeliveryLimitFields<T extends InvoiceDeliveryInput>(invoice: T) {
  const info = computeDeliveryLimit(invoice)
  return {
    ...invoice,
    delivery_limit_date: info.limitDate ? toIsoDate(info.limitDate) : null,
    delivery_is_reference: info.isReferenceOnly,
    delivery_qualifies: info.qualifiesForDeadline,
    first_payment_date: info.firstPaymentDate ? toIsoDate(info.firstPaymentDate) : null,
    first_payment_amount: info.firstPaymentAmount,
    first_payment_percent:
      info.percentFirst != null ? Math.round(info.percentFirst * 1000) / 10 : null,
  }
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDeliveryLimitMessage(info: DeliveryLimitInfo, locale = 'es-MX'): string {
  if (!info.limitDate) return 'sin límite de entrega calculable'
  const dateStr = info.limitDate.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  if (info.isReferenceOnly) {
    const pct =
      info.percentFirst != null ? `${Math.round(info.percentFirst * 100)}%` : '<60%'
    return `${dateStr} (referencia; primer pago ${pct} < 60%, no es fecha límite formal)`
  }
  return `${dateStr}`
}

/**
 * Build DB update payload for primer_pago_* / total_pagado from Alegra invoice JSON.
 */
export function firstPaymentFieldsFromAlegraInvoice(alegraInvoice: any): {
  primer_pago_fecha: Date | null
  primer_pago_monto: number | null
  total_pagado: number | null
  estadoHint: 'parcial' | 'pagada' | null
} {
  const total = toNumber(alegraInvoice?.total)
  const totalPaid = toNumber(alegraInvoice?.totalPaid)
  const balance = alegraInvoice?.balance != null ? toNumber(alegraInvoice.balance) : total - totalPaid

  const payments: PaymentLike[] = (Array.isArray(alegraInvoice?.payments) ? alegraInvoice.payments : []).map(
    (p: any) => ({
      date: p.date,
      amount: p.amount,
    })
  )
  const first = extractFirstPaymentFromList(payments)

  let estadoHint: 'parcial' | 'pagada' | null = null
  if (totalPaid > 0 && balance > 0.005) estadoHint = 'parcial'
  else if (totalPaid > 0 && balance <= 0.005) estadoHint = 'pagada'

  return {
    primer_pago_fecha: first?.date || null,
    primer_pago_monto: first?.amount ?? (totalPaid > 0 ? totalPaid : null),
    total_pagado: totalPaid > 0 ? totalPaid : null,
    estadoHint,
  }
}
