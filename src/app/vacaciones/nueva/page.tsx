'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Palmtree, Calendar, User, FileText, AlertCircle, Info } from 'lucide-react'
import SearchableSelectWithOtro, { PersonOption } from '@/components/SearchableSelectWithOtro'
import AppShell from '@/components/AppShell'

function calculateWorkingDaysEnd(startDateStr: string, numWorkingDays: number) {
  if (!startDateStr || !numWorkingDays || numWorkingDays <= 0) return null
  const [y, m, d] = startDateStr.split('-').map(Number)
  let curr = new Date(Date.UTC(y, m - 1, d))
  
  // If startDate falls on weekend, move to next Monday
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

  // Return date = next working day after endDate
  let returnDate = new Date(curr)
  returnDate.setUTCDate(returnDate.getUTCDate() + 1)
  while (returnDate.getUTCDay() === 0 || returnDate.getUTCDay() === 6) {
    returnDate.setUTCDate(returnDate.getUTCDate() + 1)
  }
  const returnDateStr = returnDate.toISOString().split('T')[0]

  return { endDateStr, returnDateStr }
}

export default function NuevaVacacionPage() {
  const router = useRouter()
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [users, setUsers] = useState<PersonOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form State
  const [fechaSolicitud, setFechaSolicitud] = useState(new Date().toISOString().split('T')[0])
  const [empleadoId, setEmpleadoId] = useState('')
  const [empleadoNombre, setEmpleadoNombre] = useState('')
  const [empleadoCargo, setEmpleadoCargo] = useState('')
  const [tipo, setTipo] = useState<'VACACIONES' | 'PERMISO'>('VACACIONES')
  const [conGoceSueldo, setConGoceSueldo] = useState<boolean>(true)
  const [diasSolicitados, setDiasSolicitados] = useState<number | ''>(1)
  const [periodoCorrespondiente, setPeriodoCorrespondiente] = useState(new Date().getFullYear().toString())
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [fechaRegreso, setFechaRegreso] = useState('')
  const [observaciones, setObservaciones] = useState('')

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
        console.error('Error fetching users:', err)
      } finally {
        setLoadingUsers(false)
      }
    }
    loadUsers()
  }, [])

  // Auto-calculate Fecha Termina & Regreso based on Working Days (Lunes a Viernes)
  useEffect(() => {
    if (fechaInicio && diasSolicitados && Number(diasSolicitados) > 0) {
      const res = calculateWorkingDaysEnd(fechaInicio, Number(diasSolicitados))
      if (res) {
        setFechaFin(res.endDateStr)
        setFechaRegreso(res.returnDateStr)
      }
    }
  }, [fechaInicio, diasSolicitados])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!empleadoNombre) {
      setError('Por favor seleccione o especifique el nombre del empleado solicitante.')
      return
    }
    if (!empleadoCargo) {
      setError('Por favor especifique el cargo del empleado.')
      return
    }
    if (!diasSolicitados || Number(diasSolicitados) <= 0) {
      setError('Por favor ingrese una cantidad válida de días solicitados.')
      return
    }
    if (!fechaInicio || !fechaFin || !fechaRegreso) {
      setError('Por favor complete las fechas del periodo de vacaciones y de regreso a labores.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/vacaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          log_usuario: empleadoNombre
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear la solicitud')

      router.push(`/vacaciones/${data.data.id}`)
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/vacaciones"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} /> Volver a Solicitudes
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title Card matching Excel Header */}
          <div className="bg-gradient-to-r from-teal-700 to-teal-900 text-white p-6 rounded-2xl shadow-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs">
                <Palmtree size={28} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wide uppercase">Formato Solicitud de Vacaciones</h1>
                <p className="text-xs text-teal-100 mt-0.5">Conformidad con Art. 76, 77 y 78 de la Ley Federal del Trabajo</p>
              </div>
            </div>
            <div className="text-right">
              <label className="block text-[11px] font-medium uppercase tracking-wider text-teal-200">Fecha de Solicitud</label>
              <input
                type="date"
                value={fechaSolicitud}
                onChange={e => setFechaSolicitud(e.target.value)}
                className="mt-1 bg-white/20 border border-teal-300/30 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Datos del Empleado Solicitante */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b pb-3 border-gray-100">
              <User size={18} className="text-teal-600" />
              Datos del Empleado Solicitante
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Solicitante Person Selector */}
              <SearchableSelectWithOtro
                options={users}
                selectedId={empleadoId}
                customName={empleadoId === 'otro' ? empleadoNombre : ''}
                onChange={({ selectedId, selectedName, position }) => {
                  setEmpleadoId(selectedId)
                  setEmpleadoNombre(selectedName)
                  if (position) setEmpleadoCargo(position)
                }}
                label="Nombre del Empleado Solicitante"
                placeholder="Buscar o seleccionar empleado..."
                customNamePlaceholder="Ingrese el nombre completo..."
                disabled={loadingUsers}
              />

              {/* Cargo */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Cargo que Desempeña
                </label>
                <input
                  type="text"
                  placeholder="Ej. Especialista de Producto / Contabilidad..."
                  value={empleadoCargo}
                  onChange={e => setEmpleadoCargo(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-xs"
                />
              </div>
            </div>

            {/* Tipo y Goce de sueldo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-gray-100">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Tipo de Solicitud
                </label>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800 cursor-pointer">
                    <input
                      type="radio"
                      name="tipo_solicitud"
                      value="VACACIONES"
                      checked={tipo === 'VACACIONES'}
                      onChange={() => setTipo('VACACIONES')}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                    />
                    Vacaciones
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800 cursor-pointer">
                    <input
                      type="radio"
                      name="tipo_solicitud"
                      value="PERMISO"
                      checked={tipo === 'PERMISO'}
                      onChange={() => setTipo('PERMISO')}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                    />
                    Permiso
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Goce de Sueldo
                </label>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={conGoceSueldo}
                      onChange={e => setConGoceSueldo(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                    />
                    <span className={conGoceSueldo ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                      {conGoceSueldo ? 'Con goce de sueldo' : 'Sin goce de sueldo'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Detalle de Días y Periodo */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b pb-3 border-gray-100">
              <Calendar size={18} className="text-teal-600" />
              Periodo y Días Solicitados (Días Hábiles)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Días Hábiles a Gozar
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={diasSolicitados}
                  onChange={e => setDiasSolicitados(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Correspondientes al Año / Ejercicio
                </label>
                <input
                  type="text"
                  placeholder="Ej. 2024, 2025"
                  value={periodoCorrespondiente}
                  onChange={e => setPeriodoCorrespondiente(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-xs"
                />
              </div>
            </div>

            <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-100/80 space-y-4">
              <div className="flex items-center justify-between text-xs text-teal-900 font-medium">
                <span>Por medio del presente solicito la autorización de los días indicados a gozarse en el siguiente periodo:</span>
                <span className="flex items-center gap-1 text-[11px] text-teal-700 font-semibold bg-teal-100/80 px-2 py-0.5 rounded-md">
                  <Info size={13} /> Cálculo automático (Lunes a Viernes)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-teal-900 uppercase">Fecha Inicia</label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={e => setFechaInicio(e.target.value)}
                    className="mt-1 w-full bg-white border border-teal-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-teal-900 uppercase">Fecha Termina (Auto)</label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={e => setFechaFin(e.target.value)}
                    className="mt-1 w-full bg-white border border-teal-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 shadow-xs font-semibold text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-teal-900 uppercase">Regresando a labores el día (Auto)</label>
                  <input
                    type="date"
                    value={fechaRegreso}
                    onChange={e => setFechaRegreso(e.target.value)}
                    className="mt-1 w-full bg-white border border-teal-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 shadow-xs font-semibold text-teal-700"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Observaciones / Notas Adicionales
              </label>
              <textarea
                rows={3}
                placeholder="Notas u observaciones de la solicitud..."
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-xs"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/vacaciones"
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm rounded-xl transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm rounded-xl shadow-sm transition-all hover:shadow disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? 'Guardando Solicitud...' : 'Guardar y Generar Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
