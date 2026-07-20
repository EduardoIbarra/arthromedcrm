'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import {
  ShieldCheck, Building2, Calendar, Loader2, AlertTriangle,
  CheckCircle2, XCircle, Clock, Ban,
} from 'lucide-react'
import { motion } from 'framer-motion'

interface Publication {
  id: string
  hospital_id: string | null
  hospital_name: string
  document_date: string
  vigencia: string
  status: string
  effective_status: 'active' | 'revoked' | 'expired'
  revoked_at: string | null
  revoke_reason: string | null
  include_iva: boolean
  currency: string
  min_purchase: number
  delivery_time: string
  created_at: string
}

interface PriceItem {
  model: string
  order_code: string
  description: string
  line: string
  price: number | null
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  const parts = String(dateStr).split('T')[0].split('-')
  if (parts.length === 3) {
    const day = parseInt(parts[2], 10)
    const month = parseInt(parts[1], 10) - 1
    const year = parseInt(parts[0], 10)
    return `${day} de ${MONTHS_ES[month]} de ${year}`
  }
  return dateStr
}

function formatMoney(val: number | null, currency: string) {
  if (val === null || val === undefined) return '—'
  return (
    new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val) +
    (currency ? ` ${currency}` : '')
  )
}

const LINE_TINTS: Record<string, string> = {
  'SPORTS MEDICINE': 'bg-orange-50',
  ENT: 'bg-sky-50',
  SPINE: 'bg-emerald-50',
  UBE: 'bg-cyan-50',
  URO: 'bg-amber-50',
  SHAVER: 'bg-violet-50',
  PINZAS: 'bg-violet-50',
  BUR: 'bg-violet-50',
}

function rowTint(line: string) {
  const u = (line || '').toUpperCase()
  for (const [k, v] of Object.entries(LINE_TINTS)) {
    if (u.includes(k)) return v
  }
  return 'bg-white'
}

export default function PublicPriceListPage() {
  const params = useParams()
  const id = params?.id as string

  const [publication, setPublication] = useState<Publication | null>(null)
  const [items, setItems] = useState<PriceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/public/price-lists/${id}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        const json = await res.json()
        if (json.error) {
          setNotFound(true)
          return
        }
        setPublication(json.publication)
        setItems(json.items || [])
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  const groups = useMemo(() => {
    const map = new Map<string, PriceItem[]>()
    for (const item of items) {
      const key = item.line || 'General'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return Array.from(map.entries())
  }, [items])

  const status = publication?.effective_status || 'active'
  const isValid = status === 'active'

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#37383a] selection:bg-blue-100">
      <header className="bg-white/90 border-b border-blue-100/80 sticky top-0 z-30 shadow-sm backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png"
              alt="Arthromed"
              width={140}
              height={40}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex items-center gap-2 text-[#0763a9] bg-blue-50 px-3 py-1.5 rounded-full text-sm font-semibold border border-blue-100">
            <ShieldCheck size={18} />
            <span>Verificación de Lista de Precios</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 className="w-12 h-12 text-[#0763a9] animate-spin" />
            <p className="text-[#64748b]">Verificando lista de precios...</p>
          </div>
        ) : notFound || !publication ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-red-100 rounded-3xl p-12 text-center space-y-4 shadow-sm"
          >
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-[#1e293b]">Lista no encontrada</h3>
              <p className="text-[#64748b]">
                Esta lista de precios no existe o el código QR no es válido.
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Status banner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-2xl p-5 flex items-start gap-4 shadow-sm border ${
                isValid
                  ? 'bg-emerald-50 border-emerald-200'
                  : status === 'revoked'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 shadow-inner bg-white ${
                  isValid
                    ? 'text-emerald-600'
                    : status === 'revoked'
                      ? 'text-red-500'
                      : 'text-amber-600'
                }`}
              >
                {isValid ? (
                  <CheckCircle2 size={30} />
                ) : status === 'revoked' ? (
                  <Ban size={30} />
                ) : (
                  <XCircle size={30} />
                )}
              </div>
              <div className="space-y-1">
                <p
                  className={`text-lg font-extrabold ${
                    isValid
                      ? 'text-emerald-700'
                      : status === 'revoked'
                        ? 'text-red-700'
                        : 'text-amber-800'
                  }`}
                >
                  {isValid
                    ? 'Lista vigente y válida'
                    : status === 'revoked'
                      ? 'Lista revocada'
                      : 'Lista vencida'}
                </p>
                <p
                  className={`text-sm ${
                    isValid
                      ? 'text-emerald-600'
                      : status === 'revoked'
                        ? 'text-red-600'
                        : 'text-amber-700'
                  }`}
                >
                  {isValid
                    ? `Válida hasta el ${formatDate(publication.vigencia)}`
                    : status === 'revoked'
                      ? `Revocada el ${formatDate(publication.revoked_at)}${
                          publication.revoke_reason
                            ? ` — ${publication.revoke_reason}`
                            : ''
                        }`
                      : `Venció el ${formatDate(publication.vigencia)}`}
                </p>
                {!isValid && (
                  <p className="text-sm text-slate-600 mt-2">
                    Esta lista de precios ya no es válida. Solicite una lista actualizada a
                    Arthromed.
                  </p>
                )}
              </div>
            </motion.div>

            {/* Meta card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white border border-blue-100 rounded-2xl p-6 shadow-sm space-y-4"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-[#0763a9] flex-shrink-0">
                  <Building2 size={22} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#94a3b8] mb-1">
                    Hospital / Lista
                  </p>
                  <h1 className="text-xl font-bold text-[#1e293b]">
                    {publication.hospital_name}
                  </h1>
                  <p className="text-sm text-[#64748b] mt-1">
                    PRODUCTOS BONSS MEDICAL · ARTHROMED SA DE CV
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Calendar size={12} /> Fecha del documento
                  </p>
                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {formatDate(publication.document_date)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Clock size={12} /> Vigencia
                  </p>
                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {formatDate(publication.vigencia)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Estado
                  </p>
                  <p
                    className={`text-sm font-bold mt-1 uppercase tracking-wide ${
                      isValid
                        ? 'text-emerald-600'
                        : status === 'revoked'
                          ? 'text-red-600'
                          : 'text-amber-600'
                    }`}
                  >
                    {isValid ? 'Vigente' : status === 'revoked' ? 'Revocada' : 'Vencida'}
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-600">
                {publication.include_iva
                  ? 'Precios con IVA incluido.'
                  : 'Precios sin IVA incluido.'}{' '}
                Moneda: <strong>{publication.currency}</strong>. Compra mínima:{' '}
                <strong>{formatMoney(publication.min_purchase, publication.currency)}</strong>.
                Entrega: <strong>{publication.delivery_time}</strong>.
              </p>
            </motion.div>

            {/* Price tables — shown even if revoked so users see what was published */}
            <div className={`space-y-8 ${!isValid ? 'opacity-75' : ''}`}>
              {groups.map(([line, lineItems]) => (
                <motion.div
                  key={line}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
                >
                  <div className="bg-[#1e385e] text-white text-center text-xs font-bold uppercase tracking-wider py-2.5 px-4">
                    {line}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                          <th className="px-3 py-2.5 font-semibold">Producto</th>
                          <th className="px-3 py-2.5 font-semibold">Referencia</th>
                          <th className="px-3 py-2.5 font-semibold">Descripción</th>
                          <th className="px-3 py-2.5 font-semibold text-right">Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((item, idx) => (
                          <tr
                            key={`${item.order_code}-${idx}`}
                            className={`border-b border-slate-100 last:border-0 ${rowTint(line)}`}
                          >
                            <td className="px-3 py-2.5 font-semibold text-slate-800 whitespace-nowrap align-top">
                              {item.model || '—'}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs text-slate-600 whitespace-nowrap align-top">
                              {item.order_code || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700 align-top">
                              {item.description || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-slate-800 whitespace-nowrap align-top">
                              {item.price !== null
                                ? new Intl.NumberFormat('es-MX', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }).format(item.price)
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              ))}
            </div>

            <p className="text-center text-xs text-slate-400 pt-4 pb-8">
              Documento verificado en arthromed · ID {publication.id.slice(0, 8)}…
            </p>
          </>
        )}
      </main>
    </div>
  )
}
