'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import {
  ShieldCheck, Building2, MapPin, FileText,
  CheckCircle2, XCircle, Loader2, Calendar, ExternalLink, AlertTriangle, ChevronDown, ChevronUp
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

interface DistributorBasic {
  id: string
  name: string
  rfc: string | null
  states: string[] | null
  status: string
  distributor_id: string | null
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
  const expDateStr = vigencia.split('T')[0]
  const todayStr = new Date().toISOString().split('T')[0]
  return expDateStr >= todayStr
}

export default function DistributorDetailPage() {
  const params = useParams()
  const distributorId = params?.distributorId as string

  const [client, setClient] = useState<DistributorBasic | null>(null)
  const [carta, setCarta] = useState<CartaDistribucion | null>(null)
  const [otherCartas, setOtherCartas] = useState<CartaDistribucion[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showOthers, setShowOthers] = useState(false)

  useEffect(() => {
    if (!distributorId) return
    fetch(`/api/public/distributors/${encodeURIComponent(distributorId)}`)
      .then(async res => {
        if (res.status === 404) { setNotFound(true); return }
        const json = await res.json()
        if (json.data) {
          setClient(json.data.client || null)
          setCarta(json.data.carta || null)
          setOtherCartas(json.data.otherCartas || [])
        } else {
          setNotFound(true)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [distributorId])

  const vigente = carta ? isVigente(carta.vigencia) : false

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#37383a] selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-blue-100/80 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-white/90">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
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
            <span>Verificación de Carta</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 className="w-12 h-12 text-[#0763a9] animate-spin" />
            <p className="text-[#64748b]">Verificando carta de distribución...</p>
          </div>
        ) : notFound || (!client && !carta) ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-red-100 rounded-3xl p-12 text-center space-y-4 shadow-sm"
          >
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-[#1e293b]">Carta no encontrada</h3>
              <p className="text-[#64748b]">
                No se encontró una carta de distribución registrada con el código <code className="bg-slate-100 px-2 py-0.5 rounded font-mono text-sm">{distributorId}</code>
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
          <AnimatePresence mode="wait">
            {/* Status Banner */}
            {carta && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-2xl p-5 flex items-center gap-4 shadow-sm border ${
                  vigente
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 shadow-inner ${
                  vigente ? 'bg-white text-emerald-600' : 'bg-white text-red-500'
                }`}>
                  {vigente ? <CheckCircle2 size={30} /> : <XCircle size={30} />}
                </div>
                <div>
                  <p className={`text-lg font-extrabold ${vigente ? 'text-emerald-700' : 'text-red-700'}`}>
                    {vigente ? 'Carta Vigente y Válida' : 'Carta Vencida'}
                  </p>
                  <p className={`text-sm ${vigente ? 'text-emerald-600' : 'text-red-600'}`}>
                    {vigente
                      ? `Válida hasta el ${formatDate(carta.vigencia)}`
                      : `Venció el ${formatDate(carta.vigencia)}`}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Distributor Info */}
            {client && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-white border border-blue-100 rounded-2xl p-6 shadow-sm"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-[#94a3b8] mb-3">Distribuidor Autorizado</p>
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-[#0763a9] flex-shrink-0">
                    <Building2 size={22} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-[#1e293b]">{client.name}</h2>
                      {client.distributor_id && (
                        <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-[#475569] bg-slate-100 px-2 py-0.5 rounded-md">
                          {client.distributor_id}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                        client.status === 'Activo'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-600'
                      }`}>
                        {client.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-[#64748b]">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-[#0763a9]" />
                        <span className="font-mono">{client.rfc || 'Sin RFC registrado'}</span>
                      </span>
                      {client.states && client.states.length > 0 && (
                        <span className="flex items-center gap-1.5">
                          <MapPin size={14} className="text-red-400" />
                          {client.states.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Carta Details Card */}
            {carta ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`bg-white rounded-2xl p-6 shadow-sm border ${vigente ? 'border-emerald-100' : 'border-slate-200'}`}
              >
                <div className="flex items-start gap-3 mb-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${vigente ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#94a3b8] mb-0.5">Dirigida a</p>
                    <h1 className="text-xl font-extrabold text-[#1e293b]">
                      {carta.destinatario || 'Destinatario General'}
                    </h1>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  <div className="flex items-center gap-2 text-sm text-[#64748b]">
                    <Calendar size={15} className="text-blue-400 flex-shrink-0" />
                    <span>
                      Vigente hasta:{' '}
                      <strong className={vigente ? 'text-emerald-700' : 'text-red-600'}>
                        {formatDate(carta.vigencia)}
                      </strong>
                    </span>
                  </div>
                  {carta.fecha_creacion && (
                    <div className="flex items-center gap-2 text-sm text-[#64748b]">
                      <Calendar size={15} className="text-slate-300 flex-shrink-0" />
                      <span>Emitida: {formatDate(carta.fecha_creacion)}</span>
                    </div>
                  )}
                  {carta.estado_region && (
                    <div className="flex items-center gap-2 text-sm text-[#64748b]">
                      <MapPin size={15} className="text-red-400 flex-shrink-0" />
                      <span>{carta.estado_region}</span>
                    </div>
                  )}
                </div>

                {carta.lineas_producto && carta.lineas_producto.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#94a3b8] mb-2">Líneas de Producto Autorizadas</p>
                    <div className="flex flex-wrap gap-2">
                      {carta.lineas_producto.map(line => (
                        <span
                          key={line}
                          className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold bg-blue-50 text-[#0763a9] border border-blue-100"
                        >
                          {line}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {carta.letter_url && (
                  <a
                    href={carta.letter_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0763a9] text-white font-semibold rounded-xl hover:bg-[#064d85] transition-colors shadow-sm text-sm"
                  >
                    <ExternalLink size={16} />
                    Ver carta original en PDF
                  </a>
                )}
              </motion.div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center text-[#94a3b8]">
                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                <p>Este distribuidor no cuenta con cartas de distribución registradas.</p>
              </div>
            )}

            {/* Other Cartas Accordion (if any) */}
            {otherCartas.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
              >
                <button
                  onClick={() => setShowOthers(!showOthers)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-[#64748b] flex items-center gap-2">
                    <FileText size={16} className="text-[#0763a9]" />
                    Otras cartas emitidas a este distribuidor ({otherCartas.length})
                  </span>
                  {showOthers ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </button>

                {showOthers && (
                  <div className="px-6 pb-6 pt-2 border-t border-slate-100 space-y-3">
                    {otherCartas.map(oc => {
                      const ocVigente = isVigente(oc.vigencia)
                      return (
                        <div
                          key={oc.id}
                          className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <h4 className="font-bold text-[#1e293b] text-sm">
                              {oc.destinatario || 'Destinatario General'}
                            </h4>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748b]">
                              <span>Vigencia: {formatDate(oc.vigencia)}</span>
                              {oc.estado_region && <span>• {oc.estado_region}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              ocVigente
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}>
                              {ocVigente ? 'Vigente' : 'Vencida'}
                            </span>
                            {oc.letter_url && (
                              <a
                                href={oc.letter_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg text-[#0763a9] hover:bg-blue-50 transition-colors"
                                title="Ver carta PDF"
                              >
                                <ExternalLink size={15} />
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
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
