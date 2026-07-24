'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import { useUser } from '@/contexts/UserContext'
import {
  ClipboardList, ArrowLeft, Save, Plus, Trash2, Loader2
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import PermissionGuard from '@/components/PermissionGuard'

interface RequisicionItem {
  descripcion: string
  cantidad: number
  unidad: string
  costo_estimado: number
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

export default function NuevaRequisicionPage() {
  const { t } = useI18n()
  const router = useRouter()
  const { profile } = useUser()

  const [systemUsers, setSystemUsers] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const getNextWorkingDayString = () => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const day = tomorrow.getDay()
    if (day === 6) { // Saturday
      tomorrow.setDate(tomorrow.getDate() + 2)
    } else if (day === 0) { // Sunday
      tomorrow.setDate(tomorrow.getDate() + 1)
    }
    return tomorrow.toISOString().split('T')[0]
  }

  // Form State
  const [form, setForm] = useState({
    fecha_solicitud: new Date().toISOString().split('T')[0],
    departamento: 'Administración',
    fecha_requerida: getNextWorkingDayString(),
    solicitante_nombre: '',
    solicitante_telefono: '',
    observaciones: '',
    status: 'PENDIENTE',
    aprobacion_nombre: '',
    autorizacion_nombre: '',
    items: [] as RequisicionItem[],
    solicitante_otro: '',
    aprobador_otro: '',
    autorizador_otro: ''
  })

  const [newItem, setNewItem] = useState({
    descripcion: '',
    cantidad: 1,
    unidad: 'Pieza',
    costo_estimado: 0
  })

  useEffect(() => {
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
    fetchUsers()
  }, [])

  useEffect(() => {
    if (profile && systemUsers.length > 0) {
      const userObj = systemUsers.find(u => u.email === profile.email)
      const fullName = userObj ? `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() : `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
      const finalName = fullName || profile.email

      setForm(prev => {
        if (prev.solicitante_nombre) return prev
        return {
          ...prev,
          solicitante_nombre: finalName,
          solicitante_telefono: userObj?.whatsapp || prev.solicitante_telefono || ''
        }
      })
    }
  }, [profile, systemUsers])

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

  // Options lists
  const userOptions = useMemo(() => {
    const list = systemUsers.map(u => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim()
      return fullName || u.email
    })
    const unique = Array.from(new Set(list)).filter(Boolean)
    return [...unique, 'Otro']
  }, [systemUsers])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

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
      const currentUser = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email : solicitanteFinal
      const res = await fetch('/api/requisiciones', {
        method: 'POST',
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
          log_usuario: currentUser
        })
      })

      if (!res.ok) throw new Error('Error al crear la requisición')
      router.push('/requisiciones')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSaving(false)
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

  return (
    <AppShell>
      <PermissionGuard section="requisiciones" action="create">
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/requisiciones')}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Nueva Requisición de Compra</h1>
                <p className="text-xs text-slate-500 mt-0.5">Complete los campos de la solicitud y detalle de productos.</p>
              </div>
            </div>
          </header>

          <form onSubmit={handleCreate} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Fecha de Solicitud</label>
                <input
                  type="date"
                  required
                  value={form.fecha_solicitud}
                  onChange={e => setForm({ ...form, fecha_solicitud: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Fecha Requerida</label>
                <input
                  type="date"
                  required
                  value={form.fecha_requerida}
                  onChange={e => setForm({ ...form, fecha_requerida: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Departamento Solicitante</label>
                <select
                  value={form.departamento}
                  onChange={e => setForm({ ...form, departamento: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
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
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
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
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg mt-2 focus:outline-none focus:border-blue-400"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Teléfono</label>
                <input
                  type="text"
                  value={form.solicitante_telefono}
                  onChange={e => setForm({ ...form, solicitante_telefono: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
                  placeholder="81XXXXXXXX"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Estado Requisición</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
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
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
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
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg mt-2 focus:outline-none focus:border-blue-400"
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
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
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
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg mt-2 focus:outline-none focus:border-blue-400"
                  />
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={form.observaciones}
                  onChange={e => setForm({ ...form, observaciones: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
                  placeholder="Observaciones de la requisición..."
                />
              </div>
            </div>

            {/* Products Form */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Productos o Servicios</h3>
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

              {/* Sum & Save */}
              <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block font-semibold uppercase">Total Estimado</span>
                  <span className="text-lg font-bold text-slate-800">
                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(total)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => router.push('/requisiciones')}
                    className="px-4 py-2 border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-[#0763a9] hover:bg-[#054e85] text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-1.5"
                  >
                    {isSaving && <Loader2 size={16} className="animate-spin" />}
                    Crear Requisición
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </PermissionGuard>
    </AppShell>
  )
}
