'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ShieldCheck, Calendar, Loader2, AlertTriangle,
  CheckCircle2, XCircle, Clock, Ban, User, Info, Building2, Paperclip,
  Check, Copy, Edit3, MessageSquarePlus, Plus, Trash2, Save, X, FileText,
  UserCheck, LogIn
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useUser } from '@/contexts/UserContext'
import AppShell from '@/components/AppShell'

interface RequisicionItem {
  id?: string
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

export default function RequisitionVerificationPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const { profile, loading: userLoading } = useUser()

  const [requisicion, setRequisicion] = useState<Requisicion | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Copy state
  const [copied, setCopied] = useState(false)

  // Modal / Action state
  const [activeModal, setActiveModal] = useState<'APPROVE' | 'REJECT' | 'NOTE' | null>(null)
  const [authorizerName, setAuthorizerName] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)

  // Item modification state
  const [isEditingItems, setIsEditingItems] = useState(false)
  const [editableItems, setEditableItems] = useState<RequisicionItem[]>([])
  const [editNote, setEditNote] = useState('')

  const userFullName = profile
    ? ([profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email)
    : ''

  useEffect(() => {
    if (userFullName) {
      setAuthorizerName(userFullName)
    }
  }, [userFullName])

  const fetchRequisition = async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/public/requisiciones/${id}`)
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
      setEditableItems(json.data.items || [])
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequisition()
  }, [id])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handlePostAction = async (action: 'APROBAR' | 'RECHAZAR' | 'ADD_NOTE' | 'MODIFICAR', payloadExtra?: any) => {
    if (!id) return
    try {
      setSubmittingAction(true)
      const payload = {
        action,
        authorizer_name: authorizerName || userFullName || 'Usuario Registrado',
        note: actionNote || editNote,
        ...payloadExtra
      }

      const res = await fetch(`/api/public/requisiciones/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Error al procesar la acción')
      }

      // Reset state and refresh
      setActiveModal(null)
      setIsEditingItems(false)
      setAuthorizerName(userFullName)
      setActionNote('')
      setEditNote('')
      fetchRequisition()
    } catch (err: any) {
      alert(err.message || 'Error al guardar cambios')
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleItemChange = (index: number, field: keyof RequisicionItem, value: any) => {
    const next = [...editableItems]
    next[index] = { ...next[index], [field]: value }
    setEditableItems(next)
  }

  const handleAddItem = () => {
    setEditableItems([
      ...editableItems,
      { descripcion: '', cantidad: 1, unidad: 'Pieza', costo_estimado: 0 }
    ])
  }

  const handleRemoveItem = (index: number) => {
    if (editableItems.length <= 1) {
      alert('La requisición debe tener al menos 1 ítem.')
      return
    }
    setEditableItems(editableItems.filter((_, i) => i !== index))
  }

  const handleSaveModifiedItems = () => {
    for (const item of editableItems) {
      if (!item.descripcion.trim()) {
        alert('Por favor ingrese una descripción válida para todos los ítems.')
        return
      }
      if (item.cantidad <= 0) {
        alert('La cantidad debe ser mayor a 0.')
        return
      }
    }

    handlePostAction('MODIFICAR', { items: editableItems })
  }

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val)
  }

  const getRequisitionTotal = (itemsList: RequisicionItem[]) => {
    return itemsList.reduce((acc, curr) => acc + (curr.cantidad * (curr.costo_estimado || 0)), 0)
  }

  const status = requisicion?.status || 'PENDIENTE'
  const isValid = status === 'APROBADA' || status === 'COMPRADA'

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-blue-50/80 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="text-[#0763a9]" size={28} />
              Revisión y Autorización de Requisición
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Revise la información, modifique los bienes/servicios o responda con autorización / rechazo.
            </p>
          </div>
          <button
            onClick={handleCopyLink}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all shadow-xs active:scale-95 ${
              copied
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-[#0763a9] hover:bg-[#054e85] text-white border-transparent'
            }`}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Enlace Copiado' : 'Copiar Enlace para Enviar'}</span>
          </button>
        </div>

        {/* User Session Banner */}
        {profile ? (
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 flex items-center justify-between text-xs text-blue-900 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#0763a9] text-white flex items-center justify-center font-bold">
                {userFullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="font-semibold block text-slate-800">Sesión activa de usuario:</span>
                <span className="text-slate-600">{userFullName} ({profile.email})</span>
              </div>
            </div>
            <span className="bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1">
              <UserCheck size={13} /> Sesión Autenticada
            </span>
          </div>
        ) : !userLoading && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-amber-600" size={18} />
              <span>Para registrar una respuesta con su usuario oficial, inicie sesión en el sistema.</span>
            </div>
            <button
              onClick={() => router.push(`/login?redirectTo=/requisiciones/verificar/${id}`)}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg font-semibold"
            >
              <LogIn size={14} /> Iniciar Sesión
            </button>
          </div>
        )}

        {/* Content Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Loader2 className="w-10 h-10 text-[#0763a9] animate-spin" />
            <p className="text-slate-400 text-sm">Cargando requisición...</p>
          </div>
        ) : notFound || !requisicion ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-red-100 rounded-2xl p-12 text-center space-y-4 shadow-sm"
          >
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-800">Requisición no encontrada</h3>
              <p className="text-slate-500 text-sm">
                La requisición solicitada no existe o el folio es inválido.
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Status Banner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs border ${
                isValid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : status === 'RECHAZADA'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              <div className="flex items-center gap-4">
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
                    {status === 'APROBADA' && 'Requisición Autorizada y Aprobada'}
                    {status === 'PENDIENTE' && 'Requisición Pendiente de Autorización'}
                    {status === 'RECHAZADA' && 'Requisición Rechazada / Cancelada'}
                  </h2>
                  <p className="text-sm opacity-90">
                    Folio: <span className="font-mono font-bold">{requisicion.folio}</span>. 
                    {status === 'APROBADA' && ` Autorizada por ${requisicion.autorizacion_nombre || requisicion.aprobacion_nombre || 'Dirección'}.`}
                    {status === 'COMPRADA' && ` Adquirida de forma satisfactoria.`}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Quick Action Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="text-[#0763a9]" size={18} />
                  Acciones para la Requisición
                </h3>
                <span className="text-xs text-slate-400">Elija la acción que desea realizar</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <button
                  onClick={() => {
                    setActiveModal('APPROVE')
                    setAuthorizerName(userFullName || requisicion.autorizacion_nombre || '')
                    setActionNote('')
                  }}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-xs active:scale-95"
                >
                  <CheckCircle2 size={18} />
                  Autorizar
                </button>

                <button
                  onClick={() => {
                    setActiveModal('REJECT')
                    setAuthorizerName(userFullName || requisicion.autorizacion_nombre || '')
                    setActionNote('')
                  }}
                  className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-xs active:scale-95"
                >
                  <XCircle size={18} />
                  Rechazar
                </button>

                <button
                  onClick={() => {
                    setIsEditingItems(!isEditingItems)
                    setEditableItems(requisicion.items || [])
                    setAuthorizerName(userFullName)
                  }}
                  className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-xs active:scale-95"
                >
                  <Edit3 size={18} />
                  {isEditingItems ? 'Cancelar Edición' : 'Modificar'}
                </button>

                <button
                  onClick={() => {
                    setActiveModal('NOTE')
                    setAuthorizerName(userFullName)
                    setActionNote('')
                  }}
                  className="flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-[#0763a9] border border-blue-200 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-xs active:scale-95"
                >
                  <MessageSquarePlus size={18} />
                  Agregar Nota
                </button>
              </div>
            </div>

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
              {requisicion.observaciones && (
                <div className="bg-slate-50 p-3.5 rounded-xl text-xs text-slate-600 mt-2 border border-slate-100">
                  <span className="font-bold text-slate-700 block mb-1">Observaciones originales:</span>
                  {requisicion.observaciones}
                </div>
              )}
            </div>

            {/* Items Table / Editing Form */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Bienes o Servicios Solicitados {isEditingItems && '(Modo Edición)'}
                </h3>
                {isEditingItems && (
                  <button
                    onClick={handleAddItem}
                    className="flex items-center gap-1.5 bg-[#0763a9] hover:bg-[#054e85] text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Plus size={14} />
                    Agregar Ítem
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                {isEditingItems ? (
                  <div className="p-4 space-y-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 text-xs font-semibold uppercase">
                          <th className="p-2">Descripción</th>
                          <th className="p-2 w-24 text-center">Cant</th>
                          <th className="p-2 w-28">Unidad</th>
                          <th className="p-2 w-32 text-right">Costo Est.</th>
                          <th className="p-2 w-32 text-right">Subtotal</th>
                          <th className="p-2 w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {editableItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.descripcion}
                                onChange={e => handleItemChange(idx, 'descripcion', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                                placeholder="Descripción del artículo..."
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min={1}
                                value={item.cantidad}
                                onChange={e => handleItemChange(idx, 'cantidad', Number(e.target.value))}
                                className="w-full text-center px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.unidad}
                                onChange={e => handleItemChange(idx, 'unidad', e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.costo_estimado}
                                onChange={e => handleItemChange(idx, 'costo_estimado', Number(e.target.value))}
                                className="w-full text-right px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                              />
                            </td>
                            <td className="p-2 text-right font-semibold text-slate-800">
                              {formatMoney(item.cantidad * (item.costo_estimado || 0))}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => handleRemoveItem(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="pt-3 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Usuario Registrado
                        </label>
                        <input
                          type="text"
                          value={authorizerName}
                          onChange={e => setAuthorizerName(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 bg-slate-50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Nota o Justificación del cambio (opcional)
                        </label>
                        <input
                          type="text"
                          value={editNote}
                          onChange={e => setEditNote(e.target.value)}
                          placeholder="Ej. Se ajustó precio según cotización actualizada..."
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          onClick={() => setIsEditingItems(false)}
                          className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSaveModifiedItems}
                          disabled={submittingAction}
                          className="flex items-center gap-1.5 bg-[#0763a9] hover:bg-[#054e85] text-white px-5 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
                        >
                          {submittingAction ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          Guardar Modificaciones
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
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
                          {formatMoney(getRequisitionTotal(requisicion.items))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Action Logs Bitacora */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-50 pb-2">
                Historial de Registro, Autorizaciones e Incidencias (Log)
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
      </div>

      {/* Action Modals */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                {activeModal === 'APPROVE' && (
                  <>
                    <CheckCircle2 className="text-emerald-600" size={20} />
                    Autorizar Requisición
                  </>
                )}
                {activeModal === 'REJECT' && (
                  <>
                    <XCircle className="text-rose-600" size={20} />
                    Rechazar Requisición
                  </>
                )}
                {activeModal === 'NOTE' && (
                  <>
                    <MessageSquarePlus className="text-[#0763a9]" size={20} />
                    Agregar Nota a Bitácora
                  </>
                )}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Usuario {activeModal === 'APPROVE' ? 'autorizador' : activeModal === 'REJECT' ? 'que rechaza' : 'que registra la nota'}
                </label>
                <input
                  type="text"
                  value={authorizerName}
                  onChange={e => setAuthorizerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-sm bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {activeModal === 'REJECT' ? 'Motivo del Rechazo' : 'Nota u Observación (opcional)'}
                </label>
                <textarea
                  rows={3}
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                  placeholder={
                    activeModal === 'REJECT'
                      ? 'Describa la razón por la que se rechaza esta solicitud...'
                      : 'Comentarios adicionales o instrucciones...'
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>

              {activeModal === 'APPROVE' && (
                <button
                  onClick={() => handlePostAction('APROBAR')}
                  disabled={submittingAction}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                >
                  {submittingAction && <Loader2 size={14} className="animate-spin" />}
                  Confirmar Autorización
                </button>
              )}

              {activeModal === 'REJECT' && (
                <button
                  onClick={() => handlePostAction('RECHAZAR')}
                  disabled={submittingAction}
                  className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                >
                  {submittingAction && <Loader2 size={14} className="animate-spin" />}
                  Confirmar Rechazo
                </button>
              )}

              {activeModal === 'NOTE' && (
                <button
                  onClick={() => handlePostAction('ADD_NOTE')}
                  disabled={submittingAction || !actionNote.trim()}
                  className="flex items-center gap-1.5 bg-[#0763a9] hover:bg-[#054e85] text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                >
                  {submittingAction && <Loader2 size={14} className="animate-spin" />}
                  Guardar Nota
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AppShell>
  )
}
