'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search,
  Loader2,
  FileText,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  User,
  Filter,
  Check,
  X,
  Edit2,
  History,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import PermissionGuard from '@/components/PermissionGuard'
import { useDebounce } from '@/hooks/useDebounce'
import Modal from '@/components/Modal'

type CartaRow = {
  id: string
  codigo: string | null
  empresa_nombre: string
  rfc: string
  estado_region: string
  destinatario: string | null
  lineas_producto: string[]
  vigencia: string
  fecha_creacion: string | null
  created_at: string | null
  letter_url: string | null
  client_id: string | null
  client_name: string | null
  distributor_id: string | null
}

type SolicitudRow = {
  id: string
  created_at: string
  updated_at: string
  client_id: string
  user_id: string
  lineas_producto: string[]
  estados: string[]
  hospital: string
  status: 'pending' | 'approved' | 'rejected'
  clientes: {
    id: string
    nombre: string
    rfc: string | null
  }
  users: {
    id: string
    email: string
  }
  solicitud_carta_acciones: Array<{
    id: string
    created_at: string
    action: string
    comment: string | null
    users: {
      email: string
    } | null
  }>
}

type SortKey =
  | 'codigo'
  | 'empresa_nombre'
  | 'rfc'
  | 'destinatario'
  | 'estado_region'
  | 'vigencia'
  | 'fecha_creacion'
  | 'created_at'

const ESTADOS_MEXICO = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
  'Chihuahua', 'Coahuila', 'Colima', 'Ciudad de México (CDMX)', 'Durango',
  'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'México (Edomex)',
  'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca',
  'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz',
  'Yucatán', 'Zacatecas'
]

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '—'
  }
}

function SortIcon({ active, order }: { active: boolean; order: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown size={12} className="text-gray-300" />
  return order === 'asc'
    ? <ArrowUp size={12} className="text-[#0763a9]" />
    : <ArrowDown size={12} className="text-[#0763a9]" />
}

export default function CartasDistribuidorPage() {
  const [rows, setRows] = useState<CartaRow[]>([])
  const [solicitudes, setSolicitudes] = useState<SolicitudRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [clientId, setClientId] = useState('')
  const [destinatario, setDestinatario] = useState('')
  const [sort, setSort] = useState<SortKey>('created_at')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [status, setStatus] = useState<'active' | 'expired' | 'solicitudes'>('active')
  const [solicitudFilterStatus, setSolicitudFilterStatus] = useState<string>('pending')

  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([])
  const [institutionOptions, setInstitutionOptions] = useState<string[]>([])
  const [catalogLines, setCatalogLines] = useState<{ id: string; name: string }[]>([])

  // Modal states
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudRow | null>(null)
  
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const [editApproveModalOpen, setEditApproveModalOpen] = useState(false)
  const [editHospital, setEditHospital] = useState('')
  const [editDistributorName, setEditDistributorName] = useState('')
  const [editRfc, setEditRfc] = useState('')
  const [editSelectedLines, setEditSelectedLines] = useState<string[]>([])
  const [editSelectedStates, setEditSelectedStates] = useState<string[]>([])
  const [editExpirationDate, setEditExpirationDate] = useState('')
  const [editCoverage, setEditCoverage] = useState('')

  // Fetch catalog lines
  useEffect(() => {
    fetch('/api/catalogos/lineas')
      .then(res => res.json())
      .then(json => {
        if (json.data) setCatalogLines(json.data)
      })
      .catch(err => console.error('Error fetching catalog lines:', err))
  }, [])

  const fetchCartas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (clientId) params.set('client_id', clientId)
      if (destinatario) params.set('destinatario', destinatario)
      params.set('sort', sort)
      params.set('order', order)
      params.set('status', status)

      const res = await fetch(`/api/cartas-distribucion?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al cargar cartas')
      setRows(json.data || [])
      if (json.filters?.clients) setClientOptions(json.filters.clients)
      if (json.filters?.institutions) setInstitutionOptions(json.filters.institutions)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Error al cargar cartas')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, clientId, destinatario, sort, order, status])

  const fetchSolicitudes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (clientId) params.set('client_id', clientId)
      params.set('status', solicitudFilterStatus)

      const res = await fetch(`/api/cartas-distribucion/solicitudes?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al cargar solicitudes')
      setSolicitudes(json.data || [])
      if (json.filters?.clients) setClientOptions(json.filters.clients)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Error al cargar solicitudes')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, clientId, solicitudFilterStatus])

  useEffect(() => {
    if (status === 'solicitudes') {
      fetchSolicitudes()
    } else {
      fetchCartas()
    }
  }, [status, fetchCartas, fetchSolicitudes])

  const toggleSort = (key: SortKey) => {
    if (sort === key) {
      setOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(key)
      setOrder(key === 'empresa_nombre' || key === 'destinatario' || key === 'codigo' ? 'asc' : 'desc')
    }
  }

  const clearFilters = () => {
    setSearch('')
    setClientId('')
    setDestinatario('')
  }

  const hasActiveFilters = !!(search || clientId || (status !== 'solicitudes' && destinatario))

  // Solicitud actions
  const handleDirectApprove = async (solicitud: SolicitudRow) => {
    if (!confirm(`¿Estás seguro de que deseas aprobar directamente la solicitud de ${solicitud.clientes.nombre} para el hospital ${solicitud.hospital}?`)) {
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/cartas-distribucion/solicitudes/${solicitud.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al aprobar solicitud')
      alert('La solicitud ha sido aprobada y la Carta de Distribución ha sido generada con éxito.')
      fetchSolicitudes()
    } catch (err: any) {
      alert(err.message || 'Ocurrió un error al procesar la aprobación')
    } finally {
      setActionLoading(false)
    }
  }

  const openRejectModal = (solicitud: SolicitudRow) => {
    setSelectedSolicitud(solicitud)
    setRejectComment('')
    setRejectModalOpen(true)
  }

  const handleReject = async () => {
    if (!selectedSolicitud || !rejectComment.trim()) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/cartas-distribucion/solicitudes/${selectedSolicitud.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', comment: rejectComment })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al rechazar solicitud')
      setRejectModalOpen(false)
      fetchSolicitudes()
    } catch (err: any) {
      alert(err.message || 'Ocurrió un error al procesar el rechazo')
    } finally {
      setActionLoading(false)
    }
  }

  const openEditApproveModal = (solicitud: SolicitudRow) => {
    setSelectedSolicitud(solicitud)
    setEditHospital(solicitud.hospital)
    setEditDistributorName(solicitud.clientes.nombre)
    setEditRfc(solicitud.clientes.rfc || '')
    setEditSelectedLines(solicitud.lineas_producto)
    setEditSelectedStates(solicitud.estados)
    
    // Default expiration date to January 31 of next year
    const nextYear = new Date().getFullYear() + 1
    setEditExpirationDate(`${nextYear}-01-31`)
    setEditCoverage(solicitud.estados.join(', '))
    
    setEditApproveModalOpen(true)
  }

  const handleEditApprove = async () => {
    if (!selectedSolicitud) return
    if (!editHospital || editSelectedLines.length === 0 || editSelectedStates.length === 0) {
      alert('Por favor complete todos los campos obligatorios: Institución, Líneas de producto y Estados.')
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/cartas-distribucion/solicitudes/${selectedSolicitud.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          editedDetails: {
            hospital: editHospital,
            distributorName: editDistributorName,
            rfc: editRfc,
            lineas_producto: editSelectedLines,
            estados: editSelectedStates,
            expirationDate: editExpirationDate,
            coverage: editCoverage
          }
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al aprobar solicitud')
      setEditApproveModalOpen(false)
      fetchSolicitudes()
      alert('Carta de Distribución generada con éxito.')
    } catch (err: any) {
      alert(err.message || 'Ocurrió un error al procesar la aprobación')
    } finally {
      setActionLoading(false)
    }
  }

  const viewHistory = (solicitud: SolicitudRow) => {
    setSelectedSolicitud(solicitud)
    setHistoryModalOpen(true)
  }

  const columns = useMemo(
    () =>
      [
        { key: 'codigo' as SortKey, label: 'Código' },
        { key: 'empresa_nombre' as SortKey, label: 'Cliente / Empresa' },
        { key: 'rfc' as SortKey, label: 'RFC' },
        { key: 'destinatario' as SortKey, label: 'Institución (destinatario)' },
        { key: 'estado_region' as SortKey, label: 'Estado / Región' },
        { key: 'vigencia' as SortKey, label: 'Vigencia' },
        { key: 'fecha_creacion' as SortKey, label: 'Fecha creación' },
      ] as const,
    []
  )

  const getStatusBadge = (statusVal: string) => {
    switch (statusVal) {
      case 'pending':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Pendiente</span>
      case 'approved':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Aprobada</span>
      case 'rejected':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">Rechazada</span>
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">{statusVal}</span>
    }
  }

  return (
    <AppShell>
      <PermissionGuard section="clients" action="view">
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="text-[#0763a9]" size={22} />
                Cartas de Distribuidor
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {status === 'solicitudes'
                  ? 'Gestiona, aprueba, edita o rechaza las solicitudes de carta de distribución.'
                  : 'Busca y filtra cartas de distribución por cliente e institución destinataria.'}
              </p>
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              {loading ? 'Cargando…' : status === 'solicitudes' ? `${solicitudes.length} solicitud${solicitudes.length === 1 ? '' : 'es'}` : `${rows.length} carta${rows.length === 1 ? '' : 's'}`}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setStatus('active')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                status === 'active'
                  ? 'border-[#0763a9] text-[#0763a9]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Vigentes
            </button>
            <button
              type="button"
              onClick={() => setStatus('expired')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                status === 'expired'
                  ? 'border-[#0763a9] text-[#0763a9]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Vencidas
            </button>
            <button
              type="button"
              onClick={() => setStatus('solicitudes')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                status === 'solicitudes'
                  ? 'border-[#0763a9] text-[#0763a9]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Solicitudes
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Filter size={14} /> Filtros
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={status === 'solicitudes' ? 'Buscar institución, cliente...' : 'Buscar código, empresa, RFC, institución...'}
                  className="erp-input pl-10 w-full"
                />
              </div>

              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="erp-input pl-10 w-full"
                >
                  <option value="">Todos los clientes</option>
                  {clientOptions.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {status === 'solicitudes' ? (
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={solicitudFilterStatus}
                    onChange={e => setSolicitudFilterStatus(e.target.value)}
                    className="erp-input pl-10 w-full"
                  >
                    <option value="pending">Pendientes</option>
                    <option value="approved">Aprobadas</option>
                    <option value="rejected">Rechazadas</option>
                    <option value="all">Todas</option>
                  </select>
                </div>
              ) : (
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={destinatario}
                    onChange={e => setDestinatario(e.target.value)}
                    className="erp-input pl-10 w-full"
                  >
                    <option value="">Todas las instituciones</option>
                    {institutionOptions.map(inst => (
                      <option key={inst} value={inst}>
                        {inst}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-[#0763a9] hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-sm rounded-xl">
              {error}
            </div>
          )}

          {status === 'solicitudes' ? (
            /* Solicitudes List */
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3 font-semibold">Cliente / Empresa</th>
                      <th className="px-4 py-3 font-semibold">Institución (Destino)</th>
                      <th className="px-4 py-3 font-semibold">Líneas</th>
                      <th className="px-4 py-3 font-semibold">Estados</th>
                      <th className="px-4 py-3 font-semibold">Creado el</th>
                      <th className="px-4 py-3 font-semibold">Estatus</th>
                      <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          Cargando solicitudes…
                        </td>
                      </tr>
                    ) : solicitudes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          No se encontraron solicitudes con los filtros actuales.
                        </td>
                      </tr>
                    ) : (
                      solicitudes.map(sol => (
                        <tr key={sol.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{sol.clientes?.nombre || 'Cliente desconocido'}</div>
                            {sol.clientes?.rfc && (
                              <div className="text-[11px] font-mono text-gray-400">{sol.clientes.rfc}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-800 font-medium">
                            {sol.hospital}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {sol.lineas_producto.map(line => (
                                <span
                                  key={line}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-[#0763a9] border border-blue-100"
                                >
                                  {line}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            <span className="line-clamp-2 text-xs" title={sol.estados.join(', ')}>
                              {sol.estados.join(', ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                            <div>{formatDate(sol.created_at)}</div>
                            <div className="text-[10px] text-gray-400">{sol.users?.email}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {getStatusBadge(sol.status)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {sol.status === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleDirectApprove(sol)}
                                    disabled={actionLoading}
                                    title="Aprobar directamente"
                                    className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                  >
                                    <Check size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditApproveModal(sol)}
                                    disabled={actionLoading}
                                    title="Editar y Aprobar"
                                    className="p-1.5 rounded-lg bg-blue-50 text-[#0763a9] hover:bg-blue-100 transition-colors"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openRejectModal(sol)}
                                    disabled={actionLoading}
                                    title="Rechazar"
                                    className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                                  >
                                    <X size={16} />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => viewHistory(sol)}
                                title="Ver bitácora"
                                className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
                              >
                                <History size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Cartas List (Existing UI) */
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                      {columns.map(col => (
                        <th key={col.key} className="px-4 py-3 font-semibold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort(col.key)}
                            className="inline-flex items-center gap-1.5 hover:text-gray-800"
                          >
                            {col.label}
                            <SortIcon active={sort === col.key} order={order} />
                          </button>
                        </th>
                      ))}
                      <th className="px-4 py-3 font-semibold">Líneas</th>
                      <th className="px-4 py-3 font-semibold text-right">Carta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-16 text-center text-gray-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          Cargando cartas…
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-16 text-center text-gray-400">
                          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          No se encontraron cartas con los filtros actuales.
                        </td>
                      </tr>
                    ) : (
                      rows.map(row => (
                        <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800 whitespace-nowrap">
                            {row.codigo || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{row.client_name || row.empresa_nombre}</div>
                            {row.client_name && row.client_name !== row.empresa_nombre && (
                              <div className="text-[11px] text-gray-400">{row.empresa_nombre}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                            {row.rfc || '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-800 max-w-[220px]">
                            <span className="line-clamp-2" title={row.destinatario || undefined}>
                              {row.destinatario || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[180px]">
                            <span className="line-clamp-2" title={row.estado_region || undefined}>
                              {row.estado_region || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                            {formatDate(row.vigencia)}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {formatDate(row.fecha_creacion || row.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {(row.lineas_producto || []).slice(0, 3).map(line => (
                                <span
                                  key={line}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-[#0763a9] border border-blue-100"
                                >
                                  {line}
                                </span>
                              ))}
                              {(row.lineas_producto || []).length > 3 && (
                                <span className="text-[10px] text-gray-400">
                                  +{row.lineas_producto.length - 3}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {row.letter_url ? (
                              <a
                                href={row.letter_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0763a9] hover:underline"
                              >
                                Ver PDF <ExternalLink size={12} />
                              </a>
                            ) : row.distributor_id ? (
                              <a
                                href={`/distribuidores/${row.distributor_id}/${row.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0763a9] hover:underline"
                              >
                                Abrir <ExternalLink size={12} />
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </PermissionGuard>

      {/* Reject Modal */}
      <Modal open={rejectModalOpen} onClose={() => setRejectModalOpen(false)} title="Rechazar Solicitud">
        {selectedSolicitud && (
          <div className="space-y-4">
            <div className="text-xs text-gray-500 space-y-1">
              <p><strong>Cliente:</strong> {selectedSolicitud.clientes?.nombre}</p>
              <p><strong>Destinatario:</strong> {selectedSolicitud.hospital}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 block">Comentarios del Rechazo *</label>
              <textarea
                value={rejectComment}
                onChange={e => setRejectComment(e.target.value)}
                placeholder="Indica el motivo del rechazo para informar al distribuidor..."
                rows={4}
                className="erp-input w-full p-2.5 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading || !rejectComment.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                Rechazar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit and Approve Modal */}
      <Modal open={editApproveModalOpen} onClose={() => setEditApproveModalOpen(false)} title="Editar y Aprobar Solicitud" maxWidth="600px">
        {selectedSolicitud && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 block">Razón Social del Distribuidor</label>
                <input
                  type="text"
                  value={editDistributorName}
                  onChange={e => setEditDistributorName(e.target.value)}
                  className="erp-input w-full text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 block">RFC</label>
                <input
                  type="text"
                  value={editRfc}
                  onChange={e => setEditRfc(e.target.value)}
                  className="erp-input w-full text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 block">Institución / Hospital de Destino *</label>
              <input
                type="text"
                value={editHospital}
                onChange={e => setEditHospital(e.target.value)}
                className="erp-input w-full text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 block">Líneas de Producto Autorizadas *</label>
              <div className="grid grid-cols-3 gap-2 border border-gray-100 rounded-xl p-2.5 max-h-[120px] overflow-y-auto bg-gray-50/50">
                {catalogLines.map(line => (
                  <label key={line.id} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editSelectedLines.includes(line.name) || editSelectedLines.includes(line.id)}
                      onChange={e => {
                        const targetVal = line.name // we can support name matching on backend
                        setEditSelectedLines(prev =>
                          e.target.checked
                            ? [...prev, targetVal]
                            : prev.filter(x => x !== targetVal && x !== line.id)
                        )
                      }}
                      className="rounded text-[#0763a9]"
                    />
                    <span>{line.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 block">Estados / Región de Validez *</label>
              <div className="grid grid-cols-3 gap-2 border border-gray-100 rounded-xl p-2.5 max-h-[160px] overflow-y-auto bg-gray-50/50">
                {ESTADOS_MEXICO.map(st => (
                  <label key={st} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editSelectedStates.includes(st)}
                      onChange={e => {
                        const updated = e.target.checked
                          ? [...editSelectedStates, st]
                          : editSelectedStates.filter(x => x !== st)
                        setEditSelectedStates(updated)
                        // Auto-fill coverage with selected states
                        setEditCoverage(updated.join(', '))
                      }}
                      className="rounded text-[#0763a9]"
                    />
                    <span>{st}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 block">Fecha de Vencimiento *</label>
                <input
                  type="date"
                  value={editExpirationDate}
                  onChange={e => setEditExpirationDate(e.target.value)}
                  className="erp-input w-full text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 block">Cobertura (Texto de la carta)</label>
                <input
                  type="text"
                  value={editCoverage}
                  onChange={e => setEditCoverage(e.target.value)}
                  placeholder="Ej: Aguascalientes, Jalisco..."
                  className="erp-input w-full text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditApproveModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEditApprove}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0763a9] hover:bg-[#065088] rounded-lg transition-colors flex items-center gap-1.5"
              >
                {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                Generar y Aprobar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* History Log Modal */}
      <Modal open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} title="Bitácora de Acciones" maxWidth="500px">
        {selectedSolicitud && (
          <div className="space-y-4">
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-xs text-gray-700 space-y-1">
              <p><strong>Cliente:</strong> {selectedSolicitud.clientes?.nombre}</p>
              <p><strong>Destinatario:</strong> {selectedSolicitud.hospital}</p>
              <p><strong>Estatus Actual:</strong> {getStatusBadge(selectedSolicitud.status)}</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Línea de Tiempo</h3>
              {selectedSolicitud.solicitud_carta_acciones.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No hay acciones registradas aún en esta solicitud.</p>
              ) : (
                <div className="relative border-l border-gray-100 pl-4 space-y-4 ml-1">
                  {selectedSolicitud.solicitud_carta_acciones.map(act => (
                    <div key={act.id} className="relative text-xs">
                      {/* Node circle */}
                      <span className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-[#0763a9] shadow-sm" />
                      
                      <div className="flex items-center justify-between font-semibold text-gray-700">
                        <span>
                          {act.action === 'approve' && 'Aprobada & Generada'}
                          {act.action === 'reject' && 'Rechazada'}
                          {act.action === 'comment' && 'Comentario'}
                          {!['approve', 'reject', 'comment'].includes(act.action) && act.action}
                        </span>
                        <span className="text-[10px] text-gray-400 font-normal">
                          {formatDate(act.created_at)}
                        </span>
                      </div>
                      {act.users?.email && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Por: {act.users.email}
                        </div>
                      )}
                      {act.comment && (
                        <div className="mt-1.5 p-2 bg-gray-50 rounded-lg text-gray-600 border border-gray-100/50">
                          {act.comment}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  )
}
