'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { 
  ArrowLeft, Palmtree, UserCheck, XCircle, Clock, CheckCircle2, 
  Calendar, User, ShieldCheck, Printer, History, AlertCircle, FileText, Info 
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import SearchableSelectWithOtro, { PersonOption } from '@/components/SearchableSelectWithOtro'
import AppShell from '@/components/AppShell'

interface VacacionDetail {
  id: string
  folio: string
  fecha_solicitud: string
  empleado_id?: string
  empleado_nombre: string
  empleado_cargo: string
  dias_solicitados: number
  periodo_correspondiente: string
  fecha_inicio: string
  fecha_fin: string
  fecha_regreso: string
  observaciones?: string
  status: 'PENDIENTE' | 'AUTORIZADO' | 'RECHAZADO' | 'CANCELADO'
  fecha_autorizacion?: string
  autorizador_id?: string
  autorizador_nombre?: string
  autorizador_cargo?: string
  periodo_autorizado_inicio?: string
  periodo_autorizado_fin?: string
  dias_autorizados?: number
  motivo_rechazo?: string
  created_at: string
  logs?: {
    id: string
    fecha: string
    usuario: string
    accion: string
    detalles?: string
  }[]
}

function calculateWorkingDaysEnd(startDateStr: string, numWorkingDays: number) {
  if (!startDateStr || !numWorkingDays || numWorkingDays <= 0) return null
  const [y, m, d] = startDateStr.split('-').map(Number)
  let curr = new Date(Date.UTC(y, m - 1, d))
  
  while (curr.getUTCDay() === 0 || curr.getUTCDay() === 6) {
    curr.setUTCDate(curr.getUTCDate() + 1)
  }

  let added = 1
  while (added < numWorkingDays) {
    curr.setUTCDate(curr.getUTCDate() + 1)
    if (curr.getUTCDay() !== 0 && curr.getUTCDay() !== 6) {
      added++
    }
  }

  const endDateStr = curr.toISOString().split('T')[0]

  let returnDate = new Date(curr)
  returnDate.setUTCDate(returnDate.getUTCDate() + 1)
  while (returnDate.getUTCDay() === 0 || returnDate.getUTCDay() === 6) {
    returnDate.setUTCDate(returnDate.getUTCDate() + 1)
  }
  const returnDateStr = returnDate.toISOString().split('T')[0]

  return { endDateStr, returnDateStr }
}

export default function VacacionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [vacacion, setVacacion] = useState<VacacionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<PersonOption[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  // Authorization Form State
  const [autorizadorId, setAutorizadorId] = useState('')
  const [autorizadorNombre, setAutorizadorNombre] = useState('')
  const [autorizadorCargo, setAutorizadorCargo] = useState('')
  const [fechaAutorizacion, setFechaAutorizacion] = useState(new Date().toISOString().split('T')[0])
  const [periodoAutInicio, setPeriodoAutInicio] = useState('')
  const [periodoAutFin, setPeriodoAutFin] = useState('')
  const [diasAutorizados, setDiasAutorizados] = useState<number | ''>('')
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)

  const fetchVacacion = async () => {
    try {
      const res = await fetch(`/api/vacaciones/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al obtener la solicitud')
      
      const v = data.data as VacacionDetail
      setVacacion(v)

      // Pre-fill authorization form
      setAutorizadorId(v.autorizador_id || '')
      setAutorizadorNombre(v.autorizador_nombre || '')
      setAutorizadorCargo(v.autorizador_cargo || '')
      setFechaAutorizacion(v.fecha_autorizacion ? v.fecha_autorizacion.split('T')[0] : new Date().toISOString().split('T')[0])
      setPeriodoAutInicio(v.periodo_autorizado_inicio ? v.periodo_autorizado_inicio.split('T')[0] : (v.fecha_inicio ? v.fecha_inicio.split('T')[0] : ''))
      setPeriodoAutFin(v.periodo_autorizado_fin ? v.periodo_autorizado_fin.split('T')[0] : (v.fecha_fin ? v.fecha_fin.split('T')[0] : ''))
      setDiasAutorizados(v.dias_autorizados !== undefined && v.dias_autorizados !== null ? v.dias_autorizados : v.dias_solicitados)
      setMotivoRechazo(v.motivo_rechazo || '')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch('/api/cirugias/usuarios')
        if (res.ok) {
          const json = await res.json()
          const list: PersonOption[] = (json.data || []).map((u: any) => ({
            id: u.id,
            name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
            position: u.position || '',
            email: u.email
          }))
          setUsers(list)
        }
      } catch (err) {
        console.error('Error loading users:', err)
      } finally {
        setLoadingUsers(false)
      }
    }

    loadUsers()
    fetchVacacion()
  }, [id])

  // Auto-calculate authorized end date when authorized start date or days change
  useEffect(() => {
    if (periodoAutInicio && diasAutorizados && Number(diasAutorizados) > 0) {
      const res = calculateWorkingDaysEnd(periodoAutInicio, Number(diasAutorizados))
      if (res) {
        setPeriodoAutFin(res.endDateStr)
      }
    }
  }, [periodoAutInicio, diasAutorizados])

  const handleProcessAuthorization = async (actionType: 'AUTHORIZE' | 'REJECT') => {
    if (!autorizadorNombre) {
      alert('Por favor seleccione o especifique la persona que autoriza.')
      return
    }

    if (actionType === 'REJECT' && !motivoRechazo.trim()) {
      alert('Por favor especifique el motivo del rechazo.')
      return
    }

    setSubmittingAction(true)
    try {
      const res = await fetch(`/api/vacaciones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          status: actionType === 'AUTHORIZE' ? 'AUTORIZADO' : 'RECHAZADO',
          fecha_autorizacion: fechaAutorizacion,
          autorizador_id: autorizadorId,
          autorizador_nombre: autorizadorNombre,
          autorizador_cargo: autorizadorCargo,
          periodo_autorizado_inicio: periodoAutInicio,
          periodo_autorizado_fin: periodoAutFin,
          dias_autorizados: Number(diasAutorizados),
          motivo_rechazo: motivoRechazo,
          log_usuario: autorizadorNombre
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al procesar')

      await fetchVacacion()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSubmittingAction(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  }

  const validationUrl = typeof window !== 'undefined' ? `${window.location.origin}/vacaciones/${id}` : `https://erp.arthromed.com.mx/vacaciones/${id}`

  if (loading) {
    return (
      <AppShell>
        <div className="p-12 text-center text-gray-500">
          <Clock className="animate-spin mx-auto mb-2 text-teal-600" size={28} />
          Cargando detalle de vacaciones...
        </div>
      </AppShell>
    )
  }

  if (error || !vacacion) {
    return (
      <AppShell>
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          <Link href="/vacaciones" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft size={16} /> Volver a Solicitudes
          </Link>
          <div className="p-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3">
            <AlertCircle size={24} />
            <span>{error || 'Solicitud no encontrada'}</span>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Top Control Bar (Screen Only) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <Link
            href="/vacaciones"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} /> Volver a Solicitudes
          </Link>
          <div className="flex items-center gap-2">
            <a
              href={`/api/vacaciones/${id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
            >
              <Printer size={16} /> Descargar PDF (Formato Oficial)
            </a>
          </div>
        </div>

        {/* SCREEN & PRINT CONTAINER */}
        <div className="space-y-8">
          {/* PAGE 1: FORMATO SOLICITUD DE VACACIONES */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden page-break-after print:shadow-none print:border-gray-300 print:rounded-none" style={{ breakAfter: 'page', pageBreakAfter: 'always' }}>
            {/* Document Header (Prices Format Layout) */}
            <div className="bg-slate-900 text-white p-6 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-xl">
                  <Image src="/logo.png" alt="Arthromed Logo" width={110} height={40} className="object-contain" />
                </div>
                <div>
                  <div className="text-teal-400 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                    <Palmtree size={14} /> Arthromed ERP — Recurso Humano
                  </div>
                  <h1 className="text-xl font-black mt-0.5 tracking-tight uppercase">Formato Solicitud de Vacaciones</h1>
                  <p className="text-[11px] text-slate-300">Documento Oficial de Registro de Descanso</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">Folio de Solicitud</span>
                  <span className="text-base font-black text-teal-300">{vacacion.folio}</span>
                </div>
                {/* QR Code Validation */}
                <div className="bg-white p-1.5 rounded-lg shadow-xs border border-gray-200">
                  <QRCodeSVG value={validationUrl} size={54} level="M" />
                </div>
              </div>
            </div>

            {/* Solicitud Body */}
            <div className="p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha de la Solicitud:</span>
                <span className="text-sm font-bold text-gray-900">{formatDate(vacacion.fecha_solicitud)}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre del Empleado Solicitante</span>
                  <span className="text-base font-bold text-gray-900 mt-0.5 block">{vacacion.empleado_nombre}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Cargo que Desempeña</span>
                  <span className="text-base font-medium text-gray-800 mt-0.5 block">{vacacion.empleado_cargo}</span>
                </div>
              </div>

              {/* Legal statement block from Excel */}
              <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-xl text-xs text-teal-950 space-y-2 leading-relaxed">
                <p className="italic">
                  &quot;Por medio del presente y de conformidad con los artículos 76, 77, y 78 de la Ley Federal del Trabajo, solicito la autorización de{' '}
                  <strong className="text-teal-900 font-bold">{vacacion.dias_solicitados} días hábiles</strong> del total de vacaciones correspondientes al ejercicio/año{' '}
                  <strong className="text-teal-900 font-bold">{vacacion.periodo_correspondiente}</strong>, las cuales deseo gozar en el siguiente periodo:&quot;
                </p>
              </div>

              {/* Solicitud Dates Table */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-white border border-gray-200 rounded-xl">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Fecha Inicia</span>
                  <span className="text-sm font-bold text-gray-900 block mt-1">{formatDate(vacacion.fecha_inicio)}</span>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-xl">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Fecha Termina</span>
                  <span className="text-sm font-bold text-gray-900 block mt-1">{formatDate(vacacion.fecha_fin)}</span>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-xl bg-teal-50/40">
                  <span className="text-xs font-semibold text-teal-800 uppercase">Regreso a Labores</span>
                  <span className="text-sm font-bold text-teal-700 block mt-1">{formatDate(vacacion.fecha_regreso)}</span>
                </div>
              </div>

              {vacacion.observaciones && (
                <div>
                  <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Observaciones</span>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">{vacacion.observaciones}</p>
                </div>
              )}

              {/* Signatures & Footer Validation */}
              <div className="pt-10 flex items-end justify-between border-t border-gray-200">
                <div className="text-center w-64">
                  <div className="border-t-2 border-gray-800 pt-2">
                    <p className="text-xs font-bold text-gray-800 uppercase">Firma del Empleado</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{vacacion.empleado_nombre}</p>
                  </div>
                </div>

                <div className="text-right text-[10px] text-gray-400 font-mono space-y-0.5">
                  <p>DOCUMENTO DE SOLICITUD — ARTHROMED ERP</p>
                  <p>VALIDEZ DIGITAL QR: {id.slice(0, 18)}...</p>
                </div>
              </div>
            </div>
          </div>

          {/* PAGE 2: FORMATO AUTORIZACIÓN DE VACACIONES */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden print:shadow-none print:border-gray-300 print:rounded-none">
            {/* Document Header (Prices Format Layout) */}
            <div className="bg-slate-900 text-white p-6 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-xl">
                  <Image src="/logo.png" alt="Arthromed Logo" width={110} height={40} className="object-contain" />
                </div>
                <div>
                  <div className="text-teal-400 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldCheck size={14} /> Arthromed ERP — Dirección General
                  </div>
                  <h1 className="text-xl font-black mt-0.5 tracking-tight uppercase">Formato Autorización de Vacaciones</h1>
                  <p className="text-[11px] text-slate-300">Dictamen y Autorización Administrativa</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">Folio</span>
                  <span className="text-base font-black text-teal-300">{vacacion.folio}</span>
                </div>
                {/* QR Code Validation */}
                <div className="bg-white p-1.5 rounded-lg shadow-xs border border-gray-200">
                  <QRCodeSVG value={validationUrl} size={54} level="M" />
                </div>
              </div>
            </div>

            {/* Autorización Body & Interactive Form */}
            <div className="p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Estatus de la Solicitud:</span>
                <div>
                  {vacacion.status === 'AUTORIZADO' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs">
                      <CheckCircle2 size={14} /> AUTORIZADO
                    </span>
                  ) : vacacion.status === 'RECHAZADO' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-800 rounded-full font-bold text-xs">
                      <XCircle size={14} /> RECHAZADO
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full font-bold text-xs">
                      <Clock size={14} /> PENDIENTE
                    </span>
                  )}
                </div>
              </div>

              {/* Authorizer Form / View */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Searchable Select for Authorizer */}
                  <SearchableSelectWithOtro
                    options={users}
                    selectedId={autorizadorId}
                    customName={autorizadorId === 'otro' ? autorizadorNombre : autorizadorNombre}
                    onChange={({ selectedId, selectedName, position }) => {
                      setAutorizadorId(selectedId)
                      setAutorizadorNombre(selectedName)
                      if (position) setAutorizadorCargo(position)
                    }}
                    label="Nombre de quien Autoriza"
                    placeholder="Buscar o seleccionar autorizador..."
                    customNamePlaceholder="Nombre de quien autoriza..."
                    disabled={loadingUsers}
                  />

                  {/* Cargo of Authorizer */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Cargo de quien Autoriza
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Dirección General / Gerencia de RRHH..."
                      value={autorizadorCargo}
                      onChange={e => setAutorizadorCargo(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-teal-500 shadow-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Fecha Autorización</label>
                    <input
                      type="date"
                      value={fechaAutorizacion}
                      onChange={e => setFechaAutorizacion(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Periodo Aut. Inicia</label>
                    <input
                      type="date"
                      value={periodoAutInicio}
                      onChange={e => setPeriodoAutInicio(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Periodo Aut. Termina (Auto)
                    </label>
                    <input
                      type="date"
                      value={periodoAutFin}
                      onChange={e => setPeriodoAutFin(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 shadow-xs font-semibold text-gray-900"
                    />
                  </div>
                </div>

                {/* Motivo de rechazo field if rejecting or rejected */}
                {(vacacion.status === 'RECHAZADO' || motivoRechazo) && (
                  <div>
                    <label className="block text-xs font-semibold text-rose-700 uppercase tracking-wider mb-1">
                      Motivo de Rechazo
                    </label>
                    <textarea
                      rows={2}
                      value={motivoRechazo}
                      onChange={e => setMotivoRechazo(e.target.value)}
                      placeholder="Escriba la justificación o motivo del rechazo..."
                      className="w-full bg-white border border-rose-300 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-rose-500 shadow-xs"
                    />
                  </div>
                )}

                {/* Signatures & Action Buttons */}
                <div className="pt-10 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-gray-200">
                  <div className="text-center w-64">
                    <div className="border-t-2 border-gray-800 pt-2">
                      <p className="text-xs font-bold text-gray-800 uppercase">Firma de quien Autoriza</p>
                      <p className="text-sm font-semibold text-gray-900 mt-0.5">{autorizadorNombre || 'Pendiente'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 print:hidden">
                    <button
                      type="button"
                      disabled={submittingAction}
                      onClick={() => handleProcessAuthorization('REJECT')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50"
                    >
                      <XCircle size={18} /> Rechazar Solicitud
                    </button>
                    <button
                      type="button"
                      disabled={submittingAction}
                      onClick={() => handleProcessAuthorization('AUTHORIZE')}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-md transition-all hover:shadow-lg disabled:opacity-50"
                    >
                      <UserCheck size={18} /> Autorizar Solicitud
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Logs Section (Screen Only) */}
        {vacacion.logs && vacacion.logs.length > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 print:hidden">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b pb-3">
              <History size={16} className="text-teal-600" /> Historial de Movimientos
            </h3>
            <div className="space-y-3">
              {vacacion.logs.map(log => (
                <div key={log.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl text-xs">
                  <div>
                    <span className="font-semibold text-gray-900">{log.usuario}</span>
                    <span className="text-gray-500 ml-2">[{log.accion}]</span>
                    {log.detalles && <p className="text-gray-700 mt-0.5">{log.detalles}</p>}
                  </div>
                  <span className="text-gray-400 text-[11px] shrink-0 ml-4">
                    {new Date(log.fecha).toLocaleString('es-MX')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
