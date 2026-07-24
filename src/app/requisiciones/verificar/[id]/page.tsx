'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import {
  ShieldCheck, Calendar, Loader2, AlertTriangle,
  CheckCircle2, XCircle, Clock, Ban, User, Info, Building2, Paperclip
} from 'lucide-react'
import { motion } from 'framer-motion'

interface RequisicionItem {
  id: string
  descripcion: string
  cantidad: number
  unidad: string
  costo_estimado: number
}

interface RequisicionLog {
  id: string
  fecha: string
  usuario: string
  accion: string
  archivo_url?: string | null
  archivo_nombre?: string | null
}

interface Requisicion {
  id: string
  folio: string
  fecha_solicitud: string
  departamento: string
  fecha_requerida: string
  solicitante_nombre: string
  solicitante_telefono: string | null
  observaciones: string | null
  aprobacion_nombre: string | null
  aprobacion_fecha: string | null
  autorizacion_nombre: string | null
  autorizacion_fecha: string | null
  status: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'COMPRADA'
  created_at: string
  items: RequisicionItem[]
  logs: RequisicionLog[]
}

export default function PublicRequisitionVerificationPage() {
  const params = useParams()
  const id = params?.id as string

  const [requisicion, setRequisicion] = useState<Requisicion | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/public/requisiciones/${id}`)
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
        setRequisicion(json.data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val)
  }

  const getRequisitionTotal = (req: Requisicion) => {
    return req.items.reduce((acc, curr) => acc + (curr.cantidad * curr.costo_estimado), 0)
  }

  const status = requisicion?.status || 'PENDIENTE'
  const isValid = status === 'APROBADA' || status === 'COMPRADA'

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#37383a] selection:bg-blue-100">
      {/* Public Header */}
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
            <span>Verificación de Requisición</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 className="w-12 h-12 text-[#0763a9] animate-spin" />
            <p className="text-[#64748b]">Verificando folio de requisición...</p>
          </div>
        ) : notFound || !requisicion ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-red-100 rounded-3xl p-12 text-center space-y-4 shadow-sm"
          >
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-[#1e293b]">Requisición no encontrada</h3>
              <p className="text-[#64748b]">
                Esta requisición de compra no existe en los registros oficiales de Arthromed o el código QR es inválido.
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Status Banner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-2xl p-6 flex items-start gap-4 shadow-sm border ${
                isValid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : status === 'RECHAZADA'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 shadow-inner bg-white ${
                  isValid
                    ? 'text-emerald-600'
                    : status === 'RECHAZADA'
                      ? 'text-red-500'
                      : 'text-amber-600'
                }`}
              >
                {status === 'COMPRADA' ? (
                  <CheckCircle2 size={30} />
                ) : status === 'APROBADA' ? (
                  <CheckCircle2 size={30} />
                ) : status === 'RECHAZADA' ? (
                  <Ban size={30} />
                ) : (
                  <Clock size={30} />
                )}
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold">
                  {status === 'COMPRADA' && 'Requisición Comprada'}
                  {status === 'APROBADA' && 'Requisición Válida y Aprobada'}
                  {status === 'PENDIENTE' && 'Requisición Registrada (Pendiente de Aprobación)'}
                  {status === 'RECHAZADA' && 'Requisición Rechazada / Cancelada'}
                </h2>
                <p className="text-sm opacity-90">
                  Folio verificado: <span className="font-mono font-bold">{requisicion.folio}</span>. 
                  {status === 'APROBADA' && ` Aprobada por ${requisicion.aprobacion_nombre || 'Compras'}.`}
                  {status === 'COMPRADA' && ` Adquirida de forma satisfactoria.`}
                </p>
              </div>
            </motion.div>

            {/* General Info Card */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-50 pb-2">
                Información de la Solicitud
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <User size={18} className="text-slate-400" />
                  <div>
                    <span className="text-xs text-slate-400 block">Solicitante</span>
                    <span className="font-semibold text-slate-700">{requisicion.solicitante_nombre}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-slate-400" />
                  <div>
                    <span className="text-xs text-slate-400 block">Departamento</span>
                    <span className="font-semibold text-slate-700">{requisicion.departamento}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-slate-400" />
                  <div>
                    <span className="text-xs text-slate-400 block">Fecha de Solicitud</span>
                    <span className="font-semibold text-slate-700">
                      {new Date(requisicion.fecha_solicitud).toLocaleDateString('es-MX', { timeZone: 'UTC' })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-slate-400" />
                  <div>
                    <span className="text-xs text-slate-400 block">Fecha Requerida</span>
                    <span className="font-semibold text-slate-700">
                      {new Date(requisicion.fecha_requerida).toLocaleDateString('es-MX', { timeZone: 'UTC' })}
                    </span>
                  </div>
                </div>
                {requisicion.aprobacion_nombre && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                    <div>
                      <span className="text-xs text-slate-400 block">Aprobado Por</span>
                      <span className="font-semibold text-slate-700 text-xs sm:text-sm">{requisicion.aprobacion_nombre}</span>
                    </div>
                  </div>
                )}
                {requisicion.autorizacion_nombre && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                    <div>
                      <span className="text-xs text-slate-400 block">Autorizado Por</span>
                      <span className="font-semibold text-slate-700 text-xs sm:text-sm">{requisicion.autorizacion_nombre}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Bienes o Servicios Solicitados
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                      <th className="px-6 py-3">Descripción</th>
                      <th className="px-6 py-3 text-center">Cant</th>
                      <th className="px-6 py-3">Unidad</th>
                      <th className="px-6 py-3 text-right">Costo Estimado</th>
                      <th className="px-6 py-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                    {requisicion.items.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/30">
                        <td className="px-6 py-4 font-medium text-slate-800">{item.descripcion}</td>
                        <td className="px-6 py-4 text-center">{item.cantidad}</td>
                        <td className="px-6 py-4 text-slate-500">{item.unidad}</td>
                        <td className="px-6 py-4 text-right text-slate-600">{formatMoney(item.costo_estimado)}</td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-800">
                          {formatMoney(item.cantidad * item.costo_estimado)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/55 font-bold border-t border-slate-200">
                      <td colSpan={4} className="px-6 py-4 text-slate-700">Total Estimado</td>
                      <td className="px-6 py-4 text-right text-[#0763a9] text-base">
                        {formatMoney(getRequisitionTotal(requisicion))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Logs Bitacora */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-50 pb-2">
                Historial de Registro e Incidencias (Log)
              </h3>
              <div className="relative border-l border-slate-200 ml-4 pl-6 space-y-6">
                {requisicion.logs.map((log, idx) => (
                  <div key={log.id || idx} className="relative">
                    <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-600 ring-4 ring-white">
                      <div className="h-2 w-2 rounded-full bg-[#0763a9]" />
                    </span>
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-800">{log.usuario}</span>
                        <span className="text-slate-400 text-[10px]">
                          {new Date(log.fecha).toLocaleString('es-MX', { timeZone: 'America/Monterrey' })}
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs mt-1">{log.accion}</p>
                      {log.archivo_url && (
                        <div className="pt-1.5">
                          <a
                            href={log.archivo_url}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-[10px] text-[#0763a9] hover:underline font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-100"
                          >
                            <Paperclip size={10} />
                            {log.archivo_nombre || 'Ver archivo'}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 py-8 text-center text-xs text-slate-400 space-y-2">
        <p>ARTHROMED SA DE CV - Documento de control interno con validez digital de verificación mediante código QR.</p>
        <p>© {new Date().getFullYear()} Arthromed. Todos los derechos reservados.</p>
      </footer>
    </div>
  )
}
