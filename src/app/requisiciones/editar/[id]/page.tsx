'use client'

import { useEffect, useState, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import { useUser } from '@/contexts/UserContext'
import {
  ClipboardList, ArrowLeft, Save, Plus, Trash2, Loader2, Download, FileSpreadsheet, Eye, MessageSquare, User, Upload, X, Paperclip, ExternalLink
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import PermissionGuard from '@/components/PermissionGuard'
import { createClient } from '@/lib/supabase/client'

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
  archivo_url: string | null
  archivo_nombre: string | null
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

  status: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'COMPRADA'
  created_at: string
  items: RequisicionItem[]
  logs: RequisicionLog[]
}

const DEPARTMENTS = [
  'Administración',
  'Compras',
  'Ventas',
  'Almacén / Inventario',
  'Logística / Entregas',
  'Soporte Técnico',
  'Dirección',
  'Otro'
]

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-200',
  APROBADA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RECHAZADA: 'bg-rose-50 text-rose-700 border-rose-200',
  COMPRADA: 'bg-sky-50 text-sky-700 border-sky-200'
}

export default function EditarRequisicionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const id = resolvedParams.id
  const { t } = useI18n()
  const router = useRouter()
  const { profile } = useUser()
  const supabase = createClient()

  // State
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [requisicion, setRequisicion] = useState<Requisicion | null>(null)
  const [systemUsers, setSystemUsers] = useState<any[]>([])

  // Form State
  const [form, setForm] = useState({
    fecha_solicitud: '',
    departamento: '',
    fecha_requerida: '',
    solicitante_nombre: '',
    solicitante_telefono: '',
    observaciones: '',
    status: 'PENDIENTE' as any,
    aprobacion_nombre: '',
    autorizacion_nombre: '',
    items: [] as RequisicionItem[],
    solicitante_otro: '',
    aprobador_otro: '',
    autorizador_otro: ''
  })

  // Action Log Form State
  const [logForm, setLogForm] = useState({
    usuario: '',
    usuario_otro: '',
    accion: '',
    archivo_url: '',
    archivo_nombre: ''
  })

  // New Item State
  const [newItem, setNewItem] = useState({
    descripcion: '',
    cantidad: 1,
    unidad: 'Pieza',
    costo_estimado: 0
  })

  const fetchRequisition = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/requisiciones/${id}`)
      if (!res.ok) throw new Error('Error al cargar la requisición')
      const json = await res.json()
      const req = json.data as Requisicion
      setRequisicion(req)

      const isCustomSolicitant = !userOptions.includes(req.solicitante_nombre) && req.solicitante_nombre !== 'Otro'
      const isCustomAprobador = req.aprobacion_nombre ? (!userOptions.includes(req.aprobacion_nombre) && req.aprobacion_nombre !== 'Otro') : false
      const isCustomAutorizador = req.autorizacion_nombre ? (!userOptions.includes(req.autorizacion_nombre) && req.autorizacion_nombre !== 'Otro') : false

      setForm({
        fecha_solicitud: req.fecha_solicitud.split('T')[0],
        departamento: req.departamento,
        fecha_requerida: req.fecha_requerida.split('T')[0],
        solicitante_nombre: isCustomSolicitant ? 'Otro' : req.solicitante_nombre,
        solicitante_telefono: req.solicitante_telefono || '',
        observaciones: req.observaciones || '',
        status: req.status,
        aprobacion_nombre: req.aprobacion_nombre ? (isCustomAprobador ? 'Otro' : req.aprobacion_nombre) : '',
        autorizacion_nombre: req.autorizacion_nombre ? (isCustomAutorizador ? 'Otro' : req.autorizacion_nombre) : '',

        items: [...req.items],
        solicitante_otro: isCustomSolicitant ? req.solicitante_nombre : '',
        aprobador_otro: isCustomAprobador ? (req.aprobacion_nombre || '') : '',
        autorizador_otro: isCustomAutorizador ? (req.autorizacion_nombre || '') : ''
      })
    } catch (err) {
      console.error(err)
      router.push('/requisiciones')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/cirugias/usuarios')
      if (res.ok) {
        const { data } = await res.json()
        setSystemUsers(data || [])
      }
    } catch (err) {
      console.error('Error fetching system users:', err)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Options lists
  const userOptions = useMemo(() => {
    const list = systemUsers.map(u => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim()
      return fullName || u.email
    })
    const unique = Array.from(new Set(list)).filter(Boolean)
    return [...unique, 'Otro']
  }, [systemUsers])

  useEffect(() => {
    if (userOptions.length > 1) {
      fetchRequisition()
    }
  }, [id, userOptions.length])

  const handleSolicitanteChange = (val: string) => {
    const userObj = systemUsers.find(u => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim()
      return (fullName || u.email) === val
    })
    setForm(prev => ({
      ...prev,
      solicitante_nombre: val,
      solicitante_telefono: userObj?.whatsapp || ''
    }))
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requisicion) return

    const solicitanteFinal = form.solicitante_nombre === 'Otro' ? form.solicitante_otro : form.solicitante_nombre
    const aprobadorFinal = form.status === 'APROBADA' || form.status === 'COMPRADA'
      ? (form.aprobacion_nombre === 'Otro' ? form.aprobador_otro : form.aprobacion_nombre)
      : ''
    const autorizadorFinal = form.autorizacion_nombre === 'Otro' ? form.autorizador_otro : form.autorizacion_nombre

    if (!solicitanteFinal || !form.fecha_requerida || form.items.length === 0) {
      alert('Por favor llene todos los campos requeridos y agregue al menos un producto.')
      return
    }

    if ((form.status === 'APROBADA' || form.status === 'COMPRADA') && !aprobadorFinal) {
      alert('Debe especificar un aprobador si la requisición está aprobada o comprada.')
      return
    }

    setIsSaving(true)
    try {
      const currentUser = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email : 'Usuario ERP'
      const res = await fetch(`/api/requisiciones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_solicitud: form.fecha_solicitud,
          departamento: form.departamento,
          fecha_requerida: form.fecha_requerida,
          solicitante_nombre: solicitanteFinal,
          solicitante_telefono: form.solicitante_telefono,
          observaciones: form.observaciones,
          status: form.status,
          aprobacion_nombre: aprobadorFinal || null,
          autorizacion_nombre: autorizadorFinal || null,

          items: form.items,
          log_usuario: currentUser,
          log_accion: `Actualizó campos generales o productos`
        })
      })

      if (!res.ok) throw new Error('Error al actualizar la requisición')
      fetchRequisition()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle uploading files for logs
  const handleLogFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'pdf'
      const timestamp = Date.now()
      const fileName = `log_${timestamp}.${ext}`
      const { data, error: uploadError } = await supabase.storage.from('documents').upload(`requisiciones/logs/${fileName}`, file)
      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(data.path)
      const url = publicUrlData.publicUrl

      setLogForm(prev => ({
        ...prev,
        archivo_url: url,
        archivo_nombre: file.name
      }))
    } catch (err: any) {
      console.error(err)
      alert('Error al subir el archivo: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  // Add a Log entry
  const handleAddLog = async () => {
    if (!requisicion) return
    const personFinal = logForm.usuario === 'Otro' ? logForm.usuario_otro : logForm.usuario
    if (!personFinal || !logForm.accion) {
      alert('Por favor seleccione una persona y escriba la acción.')
      return
    }

    try {
      const res = await fetch(`/api/requisiciones/${id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: personFinal,
          accion: logForm.accion,
          archivo_url: logForm.archivo_url || null,
          archivo_nombre: logForm.archivo_nombre || null
        })
      })

      if (!res.ok) throw new Error('Error al guardar log')
      const json = await res.json()
      
      setRequisicion(prev => prev ? {
        ...prev,
        logs: [json.data, ...prev.logs]
      } : null)

      setLogForm(prev => ({
        ...prev,
        accion: '',
        archivo_url: '',
        archivo_nombre: ''
      }))
    } catch (err: any) {
      alert(err.message)
    }
  }

  const addItem = () => {
    if (!newItem.descripcion || newItem.costo_estimado <= 0) {
      alert('Por favor ingrese una descripción y costo unitario válido.')
      return
    }
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { ...newItem }]
    }))
    setNewItem({ descripcion: '', cantidad: 1, unidad: 'Pieza', costo_estimado: 0 })
  }

  const removeItem = (idx: number) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }))
  }

  const total = form.items.reduce((acc, curr) => acc + (curr.cantidad * curr.costo_estimado), 0)

  if (loading || !requisicion) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-40">
          <Loader2 className="w-10 h-10 text-[#0763a9] animate-spin" />
          <p className="text-slate-400 text-sm mt-3">Cargando requisición...</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PermissionGuard section="requisiciones" action="edit">
        <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-blue-50/85 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/requisiciones')}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  Editar Requisición <span className="font-mono text-slate-500 font-semibold">{requisicion.folio}</span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">Vea detalles, apruebe o agregue a la bitácora de seguimiento.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`/requisiciones/verificar/${requisicion.id}`}
                target="_blank"
                className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition-all"
              >
                <Eye size={15} />
                Página Validación
              </a>
              <a
                href={`/api/requisiciones/${requisicion.id}/export`}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100/80 text-red-700 rounded-xl text-xs font-semibold transition-all border border-red-100"
              >
                <Download size={15} />
                PDF
              </a>
              <a
                href={`/api/requisiciones/${requisicion.id}/export-excel`}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 rounded-xl text-xs font-semibold transition-all border border-emerald-100"
              >
                <FileSpreadsheet size={15} />
                Excel
              </a>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Section */}
            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={handleUpdate} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                  <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Datos de la Solicitud</h2>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_COLORS[form.status]}`}>
                    {form.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Fecha de Solicitud</label>
                    <input
                      type="date"
                      required
                      value={form.fecha_solicitud}
                      onChange={e => setForm({ ...form, fecha_solicitud: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Fecha Requerida</label>
                    <input
                      type="date"
                      required
                      value={form.fecha_requerida}
                      onChange={e => setForm({ ...form, fecha_requerida: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Departamento Solicitante</label>
                    <select
                      value={form.departamento}
                      onChange={e => setForm({ ...form, departamento: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white"
                    >
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nombre del Solicitante</label>
                    <select
                      value={form.solicitante_nombre}
                      onChange={e => handleSolicitanteChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white"
                      required
                    >
                      <option value="">Seleccione solicitante...</option>
                      {userOptions.map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                    {form.solicitante_nombre === 'Otro' && (
                      <input
                        type="text"
                        placeholder="Escriba el nombre del solicitante..."
                        required
                        value={form.solicitante_otro}
                        onChange={e => setForm({ ...form, solicitante_otro: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg mt-2 focus:outline-none"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Teléfono</label>
                    <input
                      type="text"
                      value={form.solicitante_telefono}
                      onChange={e => setForm({ ...form, solicitante_telefono: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Estado</label>
                    <select
                      value={form.status}
                      onChange={e => setForm({ ...form, status: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white"
                    >
                      <option value="PENDIENTE">PENDIENTE</option>
                      <option value="APROBADA">APROBADA</option>
                      <option value="RECHAZADA">RECHAZADA</option>
                      <option value="COMPRADA">COMPRADA</option>
                    </select>
                  </div>

                  {/* Approver field */}
                  {(form.status === 'APROBADA' || form.status === 'COMPRADA') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Aprobador (Compras)</label>
                      <select
                        value={form.aprobacion_nombre}
                        onChange={e => setForm({ ...form, aprobacion_nombre: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white"
                        required
                      >
                        <option value="">Seleccione aprobador...</option>
                        {userOptions.map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                      {form.aprobacion_nombre === 'Otro' && (
                        <input
                          type="text"
                          placeholder="Nombre del aprobador..."
                          required
                          value={form.aprobador_otro}
                          onChange={e => setForm({ ...form, aprobador_otro: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg mt-2 focus:outline-none"
                        />
                      )}
                    </div>
                  )}

                  {/* Authorizer field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Autorizador (Dirección)</label>
                    <select
                      value={form.autorizacion_nombre}
                      onChange={e => setForm({ ...form, autorizacion_nombre: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white"
                    >
                      <option value="">Seleccione autorizador...</option>
                      {userOptions.map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                    {form.autorizacion_nombre === 'Otro' && (
                      <input
                        type="text"
                        placeholder="Nombre del autorizador..."
                        required
                        value={form.autorizador_otro}
                        onChange={e => setForm({ ...form, autorizador_otro: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg mt-2 focus:outline-none"
                      />
                    )}

                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Observaciones</label>
                    <textarea
                      rows={2}
                      value={form.observaciones}
                      onChange={e => setForm({ ...form, observaciones: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>

                {/* Products Section */}
                <div className="border-t border-slate-100 pt-6 space-y-4">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Productos o Servicios</h3>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Descripción del bien o servicio</label>
                      <input
                        type="text"
                        placeholder="Ej. Laptop HP, Mantenimiento..."
                        value={newItem.descripcion}
                        onChange={e => setNewItem({ ...newItem, descripcion: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Cantidad</label>
                      <input
                        type="number"
                        placeholder="1"
                        min={1}
                        value={newItem.cantidad}
                        onChange={e => setNewItem({ ...newItem, cantidad: parseInt(e.target.value) || 1 })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Unidad</label>
                      <select
                        value={newItem.unidad}
                        onChange={e => setNewItem({ ...newItem, unidad: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none"
                      >
                        <option value="Pieza">Pieza</option>
                        <option value="Servicio">Servicio</option>
                        <option value="Caja">Caja</option>
                        <option value="Paquete">Paquete</option>
                        <option value="Hora">Hora</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Costo Unit. Estimado</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        min={0}
                        step={0.01}
                        value={newItem.costo_estimado}
                        onChange={e => setNewItem({ ...newItem, costo_estimado: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none"
                      />
                    </div>
                    <div className="md:col-span-5 flex justify-end">
                      <button
                        type="button"
                        onClick={addItem}
                        className="bg-[#0763a9] hover:bg-[#054e85] text-white px-4 py-1.5 rounded-md text-xs font-semibold transition-colors"
                      >
                        Agregar Producto
                      </button>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-60">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase">
                          <th className="px-4 py-2.5">Descripción</th>
                          <th className="px-4 py-2.5 text-center">Cantidad</th>
                          <th className="px-4 py-2.5">Unidad</th>
                          <th className="px-4 py-2.5 text-right">Costo Unit.</th>
                          <th className="px-4 py-2.5 text-right">Precio Total</th>
                          <th className="px-4 py-2.5 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {form.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-5/30 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-slate-800">{it.descripcion}</td>
                            <td className="px-4 py-2.5 text-center text-slate-600 font-semibold">{it.cantidad}</td>
                            <td className="px-4 py-2.5 text-slate-500">{it.unidad}</td>
                            <td className="px-4 py-2.5 text-right text-slate-600">
                              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(it.costo_estimado)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-800">
                              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(it.cantidad * it.costo_estimado)}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Total & Save */}
                  <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block font-semibold uppercase">Total Estimado</span>
                      <span className="text-lg font-bold text-slate-800">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(total)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-5 py-2 bg-[#0763a9] hover:bg-[#054e85] text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        {isSaving && <Loader2 size={16} className="animate-spin" />}
                        <Save size={16} />
                        Guardar Requisición
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Bitacora / Log Panel */}
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6 flex flex-col h-fit">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-50 pb-3">
                <MessageSquare className="text-[#0763a9]" size={18} />
                Bitácora / Historial
              </h3>

              {/* Add action log inline form */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Persona que realiza acción</label>
                  <select
                    value={logForm.usuario}
                    onChange={e => setLogForm({ ...logForm, usuario: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none"
                  >
                    <option value="">Seleccione persona...</option>
                    {userOptions.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  {logForm.usuario === 'Otro' && (
                    <input
                      type="text"
                      placeholder="Nombre de la persona..."
                      required
                      value={logForm.usuario_otro}
                      onChange={e => setLogForm({ ...logForm, usuario_otro: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md mt-1.5 focus:outline-none"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Acción Realizada</label>
                  <input
                    type="text"
                    placeholder="Ej. Entregó factura, Cotizó en Home Depot..."
                    value={logForm.accion}
                    onChange={e => setLogForm({ ...logForm, accion: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none"
                  />
                </div>

                {/* Upload File / Picture */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Adjuntar Archivo o Imagen</label>
                  {logForm.archivo_url ? (
                    <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 p-2 rounded-lg border border-emerald-100 text-xs">
                      <span className="truncate pr-2 font-medium">{logForm.archivo_nombre}</span>
                      <button
                        type="button"
                        onClick={() => setLogForm(p => ({ ...p, archivo_url: '', archivo_nombre: '' }))}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 border border-dashed border-slate-200 hover:border-blue-400 p-2 rounded-lg cursor-pointer bg-white transition-all hover:bg-slate-50 text-slate-500 hover:text-blue-500">
                      {uploading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Subiendo...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          <span>Subir Documento o Imagen</span>
                        </>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleLogFileUpload}
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddLog}
                    className="bg-[#0763a9] hover:bg-[#054e85] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm"
                  >
                    Registrar Acción
                  </button>
                </div>
              </div>

              {/* Logs Timeline List */}
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {requisicion.logs.map(log => (
                  <div key={log.id} className="bg-slate-5/20 border border-slate-100 p-3 rounded-lg flex items-start gap-2.5 text-xs shadow-2xs">
                    <div className="bg-slate-100 p-1.5 rounded-lg text-slate-500">
                      <User size={14} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">{log.usuario}</span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(log.fecha).toLocaleString('es-MX', { timeZone: 'America/Monterrey' })}
                        </span>
                      </div>
                      <p className="text-slate-600 leading-normal">{log.accion}</p>

                      {/* Display attachment if exists */}
                      {log.archivo_url && (
                        <div className="pt-1.5">
                          <a
                            href={log.archivo_url}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-[10px] text-[#0763a9] hover:underline font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-100"
                          >
                            <Paperclip size={10} />
                            {log.archivo_nombre || 'Ver archivo'}
                            <ExternalLink size={8} />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PermissionGuard>
    </AppShell>
  )
}
