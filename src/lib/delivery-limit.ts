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

export type InvoiceDeliveryInput = {
  total?: number | string | null
  fecha_pago?: string | Date | null
  estado?: string | null
  planes_pago?: PlanPagoLike[] | null
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

/**
 * Resolve first payment date/amount and 5-week delivery limit.
 * - With plan: uses parcialidad #1 if paid
 * - Fully paid without plan: uses fecha_pago as 100% payment
 */
export function computeDeliveryLimit(invoice: InvoiceDeliveryInput): DeliveryLimitInfo {
  const invoiceTotal = toNumber(invoice.total)
  const weeks = DELIVERY_WEEKS

  let firstPaymentDate: Date | null = null
  let firstPaymentAmount: number | null = null
  let baseTotal = invoiceTotal

  // Prefer explicit precomputed fields from API
  if (invoice.first_payment_date != null || invoice.first_payment_amount != null) {
    firstPaymentDate = parseDateOnly(invoice.first_payment_date)
    firstPaymentAmount =
      invoice.first_payment_amount != null ? toNumber(invoice.first_payment_amount) : null
  } else {
    const plan = Array.isArray(invoice.planes_pago) ? invoice.planes_pago[0] : null
    const first =
      plan?.parcialidades?.find((p) => Number(p.numero) === 1) ||
      plan?.parcialidades?.slice().sort((a, b) => Number(a.numero) - Number(b.numero))[0]

    if (first && first.pagado && first.fecha_pago) {
      firstPaymentDate = parseDateOnly(first.fecha_pago)
      firstPaymentAmount = toNumber(first.monto)
      const planTotal = toNumber(plan?.total_con_descuento || plan?.total_sin_descuento)
      if (planTotal > 0) baseTotal = planTotal
    } else if (
      invoice.fecha_pago &&
      ['pagada', 'pagado'].includes(String(invoice.estado || '').toLowerCase())
    ) {
      // Full payment recorded on the invoice
      firstPaymentDate = parseDateOnly(invoice.fecha_pago)
      firstPaymentAmount = invoiceTotal > 0 ? invoiceTotal : null
    }
  }

  if (invoice.first_payment_percent != null && firstPaymentAmount == null && baseTotal > 0) {
    firstPaymentAmount = (invoice.first_payment_percent / 100) * baseTotal
  }

  let percentFirst: number | null = null
  if (firstPaymentAmount != null && baseTotal > 0) {
    percentFirst = firstPaymentAmount / baseTotal
  } else if (invoice.first_payment_percent != null) {
    percentFirst = invoice.first_payment_percent > 1
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
