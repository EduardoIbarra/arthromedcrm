'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Palmtree, Plus, Search, Calendar, CheckCircle2, XCircle, Clock, 
  Eye, Trash2, FileText, UserCheck, AlertCircle, RefreshCw, Pencil 
} from 'lucide-react'
import PermissionGuard from '@/components/PermissionGuard'
import AppShell from '@/components/AppShell'
import EditVacacionModal from '@/components/EditVacacionModal'

interface Vacacion {
  id: string
  folio: string
  fecha_solicitud: string
  empleado_nombre: string
  empleado_cargo: string
  tipo?: string
  con_goce_sueldo?: boolean
  dias_solicitados: number
  periodo_correspondiente: string
  fecha_inicio: string
  fecha_fin: string
  fecha_regreso: string
  status: 'PENDIENTE' | 'AUTORIZADO' | 'RECHAZADO' | 'CANCELADO'
  autorizador_nombre?: string
  created_at: string
}

export default function VacacionesPage() {
  const [vacaciones, setVacaciones] = useState<Vacacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('TODOS')
  const [editingVacacion, setEditingVacacion] = useState<any | null>(null)

  const fetchVacaciones = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'TODOS') params.set('status', statusFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/vacaciones?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cargar vacaciones')
      setVacaciones(data.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVacaciones()
  }, [statusFilter])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchVacaciones()
  }

  const handleDelete = async (id: string, folio: string) => {
    if (!confirm(`¿Está seguro de eliminar la solicitud de vacaciones ${folio}?`)) return
    try {
      const res = await fetch(`/api/vacaciones/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al eliminar')
      }
      fetchVacaciones()
    } catch (err: any) {
      alert(err.message)
    }
  }

  // Calculate statistics
  const totalCount = vacaciones.length
  const pendientesCount = vacaciones.filter(v => v.status === 'PENDIENTE').length
  const autorizadasCount = vacaciones.filter(v => v.status === 'AUTORIZADO').length
  const rechazadasCount = vacaciones.filter(v => v.status === 'RECHAZADO').length

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AUTORIZADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={13} /> Autorizado
          </span>
        )
      case 'RECHAZADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={13} /> Rechazado
          </span>
        )
      case 'CANCELADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
            <XCircle size={13} /> Cancelado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <Clock size={13} /> Pendiente
          </span>
        )
    }
  }

  return (
    <AppShell>
      <PermissionGuard section="vacaciones" action="view">
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
                <Palmtree size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Vacaciones</h1>
                <p className="text-sm text-gray-500">Gestión y autorización de solicitudes de días de descanso</p>
              </div>
            </div>
            <Link
              href="/vacaciones/nueva"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm rounded-xl shadow-sm transition-all hover:shadow hover:-translate-y-0.5"
            >
              <Plus size={18} /> Nueva Solicitud
            </Link>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Solicitudes</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{totalCount}</h3>
              </div>
              <div className="p-3 bg-gray-50 text-gray-600 rounded-lg">
                <FileText size={20} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-amber-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Pendientes</p>
                <h3 className="text-2xl font-bold text-amber-600 mt-1">{pendientesCount}</h3>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                <Clock size={20} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Autorizadas</p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">{autorizadasCount}</h3>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                <UserCheck size={20} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-rose-600 uppercase tracking-wider">Rechazadas</p>
                <h3 className="text-2xl font-bold text-rose-600 mt-1">{rechazadasCount}</h3>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
                <XCircle size={20} />
              </div>
            </div>
          </div>

          {/* Filters and Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Status Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              {['TODOS', 'PENDIENTE', 'AUTORIZADO', 'RECHAZADO'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    statusFilter === st
                      ? 'bg-teal-600 text-white font-semibold shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {st === 'TODOS' ? 'Todas' : st.charAt(0) + st.slice(1).toLowerCase() + 's'}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-72">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por folio, empleado..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                />
              </div>
              <button
                type="submit"
                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                title="Actualizar"
              >
                <RefreshCw size={16} />
              </button>
            </form>
          </div>

          {/* Main Data Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-500">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-teal-600" />
                Cargando solicitudes de vacaciones...
              </div>
            ) : error ? (
              <div className="p-8 text-center text-rose-600 bg-rose-50/50">
                <AlertCircle size={24} className="mx-auto mb-2" />
                {error}
              </div>
            ) : vacaciones.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Palmtree size={36} className="mx-auto mb-3 text-gray-300" />
                <p className="text-base font-medium text-gray-700">No se encontraron solicitudes</p>
                <p className="text-xs text-gray-400 mt-1">Crea una nueva solicitud de vacaciones para comenzar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5">Folio / Fecha</th>
                      <th className="px-4 py-3.5">Empleado</th>
                      <th className="px-4 py-3.5 text-center">Días</th>
                      <th className="px-4 py-3.5">Periodo Solicitado</th>
                      <th className="px-4 py-3.5">Regreso a Labores</th>
                      <th className="px-4 py-3.5">Estatus</th>
                      <th className="px-4 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {vacaciones.map(v => (
                      <tr key={v.id} className="hover:bg-teal-50/30 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-gray-900">
                          <Link href={`/vacaciones/${v.id}`} className="hover:text-teal-600 hover:underline flex flex-col">
                            <span className="font-semibold text-teal-700">{v.folio}</span>
                            <span className="text-xs text-gray-400 font-normal">{formatDate(v.fecha_solicitud)}</span>
                            <div className="flex items-center gap-1 mt-1">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${v.tipo === 'PERMISO' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                {v.tipo === 'PERMISO' ? 'Permiso' : 'Vacaciones'}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${v.con_goce_sueldo === false ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {v.con_goce_sueldo === false ? 'Sin goce' : 'Con goce'}
                              </span>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-gray-900">{v.empleado_nombre}</div>
                          <div className="text-xs text-gray-500">{v.empleado_cargo}</div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-800 font-bold rounded-md text-xs">
                            {v.dias_solicitados} días
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-700">
                          <div className="text-xs flex items-center gap-1">
                            <Calendar size={13} className="text-teal-600" />
                            <span>{formatDate(v.fecha_inicio)} al {formatDate(v.fecha_fin)}</span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">Año: {v.periodo_correspondiente}</div>
                        </td>
                        <td className="px-4 py-3.5 text-gray-700 text-xs">
                          {formatDate(v.fecha_regreso)}
                        </td>
                        <td className="px-4 py-3.5">
                          {getStatusBadge(v.status)}
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-1">
                        <Link
                          href={`/vacaciones/${v.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                          title="Ver / Autorizar"
                        >
                          <Eye size={14} /> Detalle
                        </Link>
                        <button
                          onClick={() => setEditingVacacion(v)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} /> Editar
                        </button>
                        <button
                          onClick={() => handleDelete(v.id, v.folio)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Vacacion Modal */}
      <EditVacacionModal
        open={!!editingVacacion}
        onClose={() => setEditingVacacion(null)}
        vacacion={editingVacacion}
        onSaved={fetchVacaciones}
      />
    </PermissionGuard>
    </AppShell>
  )
}
