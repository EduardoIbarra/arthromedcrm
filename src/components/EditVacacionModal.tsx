'use client'
import { useState, useEffect } from 'react'
import Modal from '@/components/Modal'
import SearchableSelectWithOtro, { PersonOption } from '@/components/SearchableSelectWithOtro'
import { Save, AlertCircle, Calendar, User, ShieldCheck, Palmtree, RefreshCw } from 'lucide-react'

interface Vacacion {
  id: string
  folio: string
  fecha_solicitud: string
  empleado_id?: string
  empleado_nombre: string
  empleado_cargo: string
  tipo?: string
  con_goce_sueldo?: boolean
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
}

interface EditVacacionModalProps {
  open: boolean
  onClose: () => void
  vacacion: Vacacion | null
  onSaved: () => void
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

export default function EditVacacionModal({
  open,
  onClose,
  vacacion,
  onSaved
}: EditVacacionModalProps) {
  const [users, setUsers] = useState<PersonOption[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Solicitud fields
  const [fechaSolicitud, setFechaSolicitud] = useState('')
  const [empleadoId, setEmpleadoId] = useState('')
  const [empleadoNombre, setEmpleadoNombre] = useState('')
  const [empleadoCargo, setEmpleadoCargo] = useState('')
  const [tipo, setTipo] = useState<'VACACIONES' | 'PERMISO'>('VACACIONES')
  const [conGoceSueldo, setConGoceSueldo] = useState<boolean>(true)
  const [diasSolicitados, setDiasSolicitados] = useState<number | ''>(1)
  const [periodoCorrespondiente, setPeriodoCorrespondiente] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [fechaRegreso, setFechaRegreso] = useState('')
  const [observaciones, setObservaciones] = useState('')

  // Autorización fields
  const [status, setStatus] = useState<string>('PENDIENTE')
  const [autorizadorId, setAutorizadorId] = useState('')
  const [autorizadorNombre, setAutorizadorNombre] = useState('')
  const [autorizadorCargo, setAutorizadorCargo] = useState('')
  const [fechaAutorizacion, setFechaAutorizacion] = useState('')
  const [periodoAutInicio, setPeriodoAutInicio] = useState('')
  const [periodoAutFin, setPeriodoAutFin] = useState('')
  const [diasAutorizados, setDiasAutorizados] = useState<number | ''>('')
  const [motivoRechazo, setMotivoRechazo] = useState('')

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
  }, [])

  useEffect(() => {
    if (vacacion) {
      setFechaSolicitud(vacacion.fecha_solicitud ? vacacion.fecha_solicitud.split('T')[0] : '')
      setEmpleadoId(vacacion.empleado_id || '')
      setEmpleadoNombre(vacacion.empleado_nombre || '')
      setEmpleadoCargo(vacacion.empleado_cargo || '')
      setTipo(vacacion.tipo === 'PERMISO' ? 'PERMISO' : 'VACACIONES')
      setConGoceSueldo(vacacion.con_goce_sueldo !== undefined && vacacion.con_goce_sueldo !== null ? vacacion.con_goce_sueldo : true)
      setDiasSolicitados(vacacion.dias_solicitados || 1)
      setPeriodoCorrespondiente(vacacion.periodo_correspondiente || '')
      setFechaInicio(vacacion.fecha_inicio ? vacacion.fecha_inicio.split('T')[0] : '')
      setFechaFin(vacacion.fecha_fin ? vacacion.fecha_fin.split('T')[0] : '')
      setFechaRegreso(vacacion.fecha_regreso ? vacacion.fecha_regreso.split('T')[0] : '')
      setObservaciones(vacacion.observaciones || '')

      setStatus(vacacion.status || 'PENDIENTE')
      setAutorizadorId(vacacion.autorizador_id || '')
      setAutorizadorNombre(vacacion.autorizador_nombre || '')
      setAutorizadorCargo(vacacion.autorizador_cargo || '')
      setFechaAutorizacion(vacacion.fecha_autorizacion ? vacacion.fecha_autorizacion.split('T')[0] : '')
      setPeriodoAutInicio(vacacion.periodo_autorizado_inicio ? vacacion.periodo_autorizado_inicio.split('T')[0] : '')
      setPeriodoAutFin(vacacion.periodo_autorizado_fin ? vacacion.periodo_autorizado_fin.split('T')[0] : '')
      setDiasAutorizados(vacacion.dias_autorizados !== undefined && vacacion.dias_autorizados !== null ? vacacion.dias_autorizados : '')
      setMotivoRechazo(vacacion.motivo_rechazo || '')
      setError(null)
    }
  }, [vacacion])

  const handleRecalculateDates = () => {
    if (fechaInicio && diasSolicitados && Number(diasSolicitados) > 0) {
      const res = calculateWorkingDaysEnd(fechaInicio, Number(diasSolicitados))
      if (res) {
        setFechaFin(res.endDateStr)
        setFechaRegreso(res.returnDateStr)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vacacion) return
    setError(null)

    if (!empleadoNombre) {
      setError('Por favor seleccione o especifique el nombre del empleado solicitante.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/vacaciones/${vacacion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE',
          fecha_solicitud: fechaSolicitud,
          empleado_id: empleadoId,
          empleado_nombre: empleadoNombre,
          empleado_cargo: empleadoCargo,
          tipo,
          con_goce_sueldo: conGoceSueldo,
          dias_solicitados: Number(diasSolicitados),
          periodo_correspondiente: periodoCorrespondiente,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          fecha_regreso: fechaRegreso,
          observaciones,
          status,
          autorizador_id: autorizadorId,
          autorizador_nombre: autorizadorNombre,
          autorizador_cargo: autorizadorCargo,
          fecha_autorizacion: fechaAutorizacion || null,
          periodo_autorizado_inicio: periodoAutInicio || null,
          periodo_autorizado_fin: periodoAutFin || null,
          dias_autorizados: diasAutorizados ? Number(diasAutorizados) : null,
          motivo_rechazo: motivoRechazo || null,
          log_usuario: empleadoNombre || 'Usuario'
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al actualizar la solicitud')

      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!vacacion) return null

  return (
    <Modal open={open} onClose={onClose} title={`Editar Solicitud - ${vacacion.folio}`} maxWidth="750px">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Section 1: Solicitud */}
        <div className="space-y-4 border-b pb-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
              <User size={16} /> Datos de la Solicitud
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-gray-500 uppercase">Fecha Solicitud</label>
              <input
                type="date"
                value={fechaSolicitud}
                onChange={e => setFechaSolicitud(e.target.value)}
                className="bg-gray-50 border border-gray-300 rounded-md px-2 py-1 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableSelectWithOtro
              options={users}
              selectedId={empleadoId}
              customName={empleadoId === 'otro' ? empleadoNombre : empleadoNombre}
              onChange={({ selectedId, selectedName, position }) => {
                setEmpleadoId(selectedId)
                setEmpleadoNombre(selectedName)
                if (position) setEmpleadoCargo(position)
              }}
              label="Nombre Solicitante"
              placeholder="Buscar o seleccionar empleado..."
              disabled={loadingUsers}
            />

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Cargo</label>
              <input
                type="text"
                value={empleadoCargo}
                onChange={e => setEmpleadoCargo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Tipo de Solicitud
              </label>
              <div className="flex items-center gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="edit_tipo_solicitud"
                    value="VACACIONES"
                    checked={tipo === 'VACACIONES'}
                    onChange={() => setTipo('VACACIONES')}
                    className="w-3.5 h-3.5 text-teal-600 focus:ring-teal-500"
                  />
                  Vacaciones
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="edit_tipo_solicitud"
                    value="PERMISO"
                    checked={tipo === 'PERMISO'}
                    onChange={() => setTipo('PERMISO')}
                    className="w-3.5 h-3.5 text-teal-600 focus:ring-teal-500"
                  />
                  Permiso
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Goce de Sueldo
              </label>
              <div className="flex items-center gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={conGoceSueldo}
                    onChange={e => setConGoceSueldo(e.target.checked)}
                    className="w-3.5 h-3.5 text-teal-600 rounded focus:ring-teal-500"
                  />
                  <span className={conGoceSueldo ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                    {conGoceSueldo ? 'Con goce de sueldo' : 'Sin goce de sueldo'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Días Hábiles</label>
              <input
                type="number"
                min="1"
                value={diasSolicitados}
                onChange={e => setDiasSolicitados(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Año / Periodo</label>
              <input
                type="text"
                value={periodoCorrespondiente}
                onChange={e => setPeriodoCorrespondiente(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleRecalculateDates}
                className="w-full py-1.5 px-3 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={13} /> Recalcular Fechas
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Fecha Inicia</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Fecha Termina</label>
              <input
                type="date"
                value={fechaFin}
                onChange={e => setFechaFin(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Regreso a Labores</label>
              <input
                type="date"
                value={fechaRegreso}
                onChange={e => setFechaRegreso(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Observaciones</label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
            />
          </div>
        </div>

        {/* Section 2: Autorización */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={16} /> Datos de Autorización
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-gray-500 uppercase">Estatus</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="bg-gray-50 border border-gray-300 rounded-md px-2 py-1 text-xs font-semibold"
              >
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="AUTORIZADO">AUTORIZADO</option>
                <option value="RECHAZADO">RECHAZADO</option>
                <option value="CANCELADO">CANCELADO</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableSelectWithOtro
              options={users}
              selectedId={autorizadorId}
              customName={autorizadorId === 'otro' ? autorizadorNombre : autorizadorNombre}
              onChange={({ selectedId, selectedName, position }) => {
                setAutorizadorId(selectedId)
                setAutorizadorNombre(selectedName)
                if (position) setAutorizadorCargo(position)
              }}
              label="Nombre Autorizador"
              placeholder="Buscar o seleccionar autorizador..."
              disabled={loadingUsers}
            />

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Cargo Autorizador</label>
              <input
                type="text"
                value={autorizadorCargo}
                onChange={e => setAutorizadorCargo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Fecha Aut.</label>
              <input
                type="date"
                value={fechaAutorizacion}
                onChange={e => setFechaAutorizacion(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Aut. Inicia</label>
              <input
                type="date"
                value={periodoAutInicio}
                onChange={e => setPeriodoAutInicio(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Aut. Termina</label>
              <input
                type="date"
                value={periodoAutFin}
                onChange={e => setPeriodoAutFin(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Días Aut.</label>
              <input
                type="number"
                min="1"
                value={diasAutorizados}
                onChange={e => setDiasAutorizados(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          {status === 'RECHAZADO' && (
            <div>
              <label className="block text-xs font-semibold text-rose-700 uppercase tracking-wider mb-1">Motivo de Rechazo</label>
              <textarea
                rows={2}
                value={motivoRechazo}
                onChange={e => setMotivoRechazo(e.target.value)}
                className="w-full border border-rose-300 rounded-lg p-2 text-sm"
              />
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
