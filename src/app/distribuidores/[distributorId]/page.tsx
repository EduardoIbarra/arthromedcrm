'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import {
  ShieldCheck, Building2, MapPin, FileText,
  CheckCircle2, XCircle, Loader2, Calendar, ExternalLink, AlertTriangle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface CartaDistribucion {
  id: string
  destinatario: string | null
  vigencia: string
  fecha_creacion: string | null
  lineas_producto: string[]
  letter_url: string | null
  estado_region: string
}

interface DistributorDetail {
  id: string
  name: string
  rfc: string | null
  states: string[] | null
  status: string
  distributor_id: string | null
  cartas_distribucion: CartaDistribucion[]
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length === 3) {
    const day = parseInt(parts[2], 10)
    const month = parseInt(parts[1], 10) - 1
    const year = parseInt(parts[0], 10)
    return `${day} de ${MONTHS_ES[month]} de ${year}`
  }
  return dateStr
}

function isVigente(vigencia: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(vigencia + 'T00:00:00')
  return exp >= today
}

export default function DistributorDetailPage() {
  const params = useParams()
  const distributorId = params?.distributorId as string

  const [data, setData] = useState<DistributorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!distributorId) return
    fetch(`/api/public/distributors/${encodeURIComponent(distributorId)}`)
      .then(async res => {
        if (res.status === 404) { setNotFound(true); return }
        const json = await res.json()
        setData(json.data || null)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [distributorId])

  const vigentCartas = data?.cartas_distribucion.filter(c => isVigente(c.vigencia)) || []
  const expiredCartas = data?.cartas_distribucion.filter(c => !isVigente(c.vigencia)) || []
  const isActive = data?.status === 'Activo'

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#37383a] selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-blue-100/80 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-white/90">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <a href="/distribuidores" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image
              src="https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png"
              alt="Arthromed"
              width={140}
              height={40}
              className="object-contain"
              priority
            />
          </a>
          <div className="flex items-center gap-2 text-[#0763a9] bg-blue-50 px-3 py-1.5 rounded-full text-sm font-semibold border border-blue-100">
            <ShieldCheck size={18} />
            <span>Portal de Verificación</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 className="w-12 h-12 text-[#0763a9] animate-spin" />
            <p className="text-[#64748b]">Cargando información del distribuidor...</p>
          </div>
        ) : notFound || !data ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-red-100 rounded-3xl p-12 text-center space-y-4 shadow-sm"
          >
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-[#1e293b]">Distribuidor no encontrado</h3>
              <p className="text-[#64748b]">
                No se encontró un distribuidor registrado con el código <code className="bg-slate-100 px-2 py-0.5 rounded font-mono text-sm">{distributorId}</code>
              </p>
            </div>
            <a
              href="/distribuidores"
              className="inline-flex items-center gap-2 text-[#0763a9] font-semibold hover:underline"
            >
              ← Volver al directorio de distribuidores
            </a>
          </motion.div>
        ) : (
          <AnimatePresence>
            {/* Distributor Card */}
            <motion.div
              key="card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-blue-100 rounded-3xl p-8 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl flex-shrink-0 ${isActive ? 'bg-blue-50 text-[#0763a9]' : 'bg-slate-100 text-slate-400'}`}>
                    <Building2 size={28} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-extrabold text-[#1e293b]">{data.name}</h1>
                      {data.distributor_id && (
                        <span className="text-xs font-bold font-mono uppercase tracking-wider text-[#475569] bg-slate-100 px-2 py-1 rounded-md">
                          {data.distributor_id}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5 text-sm text-[#64748b]">
                        <ShieldCheck size={15} className="text-[#0763a9]" />
                        <span className="font-mono">{data.rfc || 'Sin RFC registrado'}</span>
                      </div>
                      {data.states && data.states.length > 0 && (
                        <div className="flex items-center gap-1.5 text-sm text-[#64748b]">
                          <MapPin size={15} className="text-red-400" />
                          <span>{data.states.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {isActive ? (
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-xl font-semibold text-sm">
                      <CheckCircle2 size={18} />
                      <span>Distribuidor Activo</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-xl font-semibold text-sm">
                      <XCircle size={18} />
                      <span>Inactivo / No vigente</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Vigent Letters */}
            <motion.section
              key="vigent"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 px-1">
                <div className="h-px flex-1 bg-emerald-100" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  Cartas de Distribución Vigentes ({vigentCartas.length})
                </h2>
                <div className="h-px flex-1 bg-emerald-100" />
              </div>

              {vigentCartas.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center text-[#94a3b8]">
                  <FileText size={32} className="mx-auto mb-2 opacity-30" />
                  <p>No hay cartas de distribución vigentes para este distribuidor.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {vigentCartas.map((carta, i) => (
                    <motion.div
                      key={carta.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0 mt-0.5">
                              <FileText size={18} />
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-[#94a3b8] mb-0.5">Dirigida a</p>
                              <h3 className="font-bold text-[#1e293b] text-lg leading-snug">
                                {carta.destinatario || 'Destinatario General'}
                              </h3>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-12">
                            <div className="flex items-center gap-2 text-sm text-[#64748b]">
                              <Calendar size={14} className="text-blue-400 flex-shrink-0" />
                              <span>Vigencia hasta: <strong className="text-[#1e293b]">{formatDate(carta.vigencia)}</strong></span>
                            </div>
                            {carta.fecha_creacion && (
                              <div className="flex items-center gap-2 text-sm text-[#64748b]">
                                <Calendar size={14} className="text-slate-300 flex-shrink-0" />
                                <span>Emitida: {formatDate(carta.fecha_creacion)}</span>
                              </div>
                            )}
                            {carta.estado_region && (
                              <div className="flex items-center gap-2 text-sm text-[#64748b]">
                                <MapPin size={14} className="text-red-400 flex-shrink-0" />
                                <span>{carta.estado_region}</span>
                              </div>
                            )}
                          </div>

                          {carta.lineas_producto && carta.lineas_producto.length > 0 && (
                            <div className="pl-12">
                              <p className="text-xs font-bold uppercase tracking-wider text-[#94a3b8] mb-1.5">Líneas de Producto</p>
                              <div className="flex flex-wrap gap-1.5">
                                {carta.lineas_producto.map(line => (
                                  <span
                                    key={line}
                                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-[#0763a9] border border-blue-100"
                                  >
                                    {line}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex-shrink-0 flex flex-col items-end gap-3">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={13} />
                            Vigente
                          </span>
                          {carta.letter_url && (
                            <a
                              href={carta.letter_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0763a9] hover:text-[#064d85] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <ExternalLink size={13} />
                              Ver carta
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>

            {/* Expired Letters */}
            {expiredCartas.length > 0 && (
              <motion.section
                key="expired"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-4 pt-4"
              >
                <div className="flex items-center gap-3 px-1">
                  <div className="h-px flex-1 bg-slate-200" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <XCircle size={14} />
                    Cartas Vencidas ({expiredCartas.length})
                  </h2>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {expiredCartas.map(carta => (
                    <div
                      key={carta.id}
                      className="bg-slate-50/60 border border-slate-200 rounded-2xl p-5 opacity-70 hover:opacity-100 transition-opacity"
                    >
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <FileText size={15} className="text-slate-400" />
                            <h3 className="font-semibold text-slate-600">{carta.destinatario || 'Destinatario General'}</h3>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Calendar size={13} />
                            <span>Venció: {formatDate(carta.vigencia)}</span>
                          </div>
                          {carta.lineas_producto && carta.lineas_producto.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {carta.lineas_producto.map(line => (
                                <span key={line} className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                  {line}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 flex-shrink-0">
                          <XCircle size={12} />
                          Vencida
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="h-px bg-gradient-to-r from-transparent via-blue-100 to-transparent" />
        <p className="text-sm text-[#94a3b8]">
          © {new Date().getFullYear()} Arthromed. Todos los derechos reservados.
        </p>
        <p className="text-xs text-[#cbd5e1] max-w-xl mx-auto leading-relaxed">
          Esta información es de carácter público y tiene como único fin la verificación de distribuidores autorizados.
        </p>
        <a href="/distribuidores" className="inline-block text-xs text-[#0763a9] hover:underline font-semibold">
          ← Ver todos los distribuidores
        </a>
      </footer>
    </div>
  )
}
