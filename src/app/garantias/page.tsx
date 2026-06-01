'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  Wrench,
  Search,
  X,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  DollarSign,
  ClipboardList,
  ChevronRight,
  TrendingUp,
  Clock,
  ArrowUpDown,
  Filter,
  RefreshCw,
  Loader2,
  Check,
  ChevronDown
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { useI18n } from '@/contexts/I18nContext'
import { useUser } from '@/contexts/UserContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type Warranty = {
  id: string
  cliente_id: string | null
  cliente_nombre: string
  producto_id: string | null
  producto_nombre: string
  numero_serie: string | null
  modelo: string | null
  descripcion_falla: string
  estado: string // recibido, en_revision, aprobado, rechazado, en_reparacion, completado, entregado
  fecha_recepcion: string
  fecha_resolucion: string | null
  diagnostico: string | null
  resolucion: string | null
  costo_reparacion: number | null
  notas: string | null
  created_at: string
  updated_at: string
  clients?: {
    name: string
    email_primary: string | null
    phone: string | null
  } | null
  productos?: {
    nombre: string
    categoria: string | null
  } | null
}

type ClientItem = {
  id: string
  name: string
}

type ProductItem = {
  id: string
  nombre: string
  categoria: string | null
}

type SortField = 'cliente_nombre' | 'producto_nombre' | 'fecha_recepcion' | 'estado'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_FLOW = [
  { value: 'recibido', label: 'Recibido', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100', dot: 'bg-blue-500' },
  { value: 'en_revision', label: 'En revisión', color: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100', dot: 'bg-yellow-500' },
  { value: 'aprobado', label: 'Aprobado', color: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100', dot: 'bg-teal-500' },
  { value: 'rechazado', label: 'Rechazado', color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100', dot: 'bg-red-500' },
  { value: 'en_reparacion', label: 'En reparación', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100', dot: 'bg-indigo-500' },
  { value: 'completado', label: 'Completado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100', dot: 'bg-emerald-500' },
  { value: 'entregado', label: 'Entregado / Devuelto', color: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100', dot: 'bg-gray-500' },
]

function getStatusDetails(status: string) {
  return STATUS_FLOW.find(s => s.value === status) || {
    value: status,
    label: status,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    dot: 'bg-gray-400'
  }
}

function formatDate(isoString: string | null): string {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WarrantiesPage() {
  const { t } = useI18n()
  const { hasPermission } = useUser()

  // Permissions
  const canCreate = hasPermission('warranties', 'create')
  const canEdit = hasPermission('warranties', 'edit')
  const canDelete = hasPermission('warranties', 'delete')

  // Main list state
  const [warranties, setWarranties] = useState<Warranty[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search & Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortField, setSortField] = useState<SortField>('fecha_recepcion')
  const [sortAsc, setSortAsc] = useState(false)

  // Autocomplete data lists
  const [clients, setClients] = useState<ClientItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [isLoadingAutocompletes, setIsLoadingAutocompletes] = useState(false)

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [processingItem, setProcessingItem] = useState<Warranty | null>(null)

  // Form states - Create Warranty
  const [createForm, setCreateForm] = useState({
    cliente_id: '',
    cliente_nombre: '',
    producto_id: '',
    producto_nombre: '',
    numero_serie: '',
    modelo: '',
    descripcion_falla: '',
    notas: '',
    estado: 'recibido'
  })
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Refs for dropdowns to handle click outside
  const clientRef = useRef<HTMLDivElement>(null)
  const productRef = useRef<HTMLDivElement>(null)

  // Form states - Process/Update Warranty
  const [processForm, setProcessForm] = useState({
    estado: '',
    diagnostico: '',
    resolucion: '',
    costo_reparacion: '',
    notas: '',
    numero_serie: '',
    modelo: ''
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)

  // ─── Fetch Warranties ────────────────────────────────────────────────────────

  const fetchWarranties = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/garantias')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al obtener garantías')
      setWarranties(json.data || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWarranties()
  }, [fetchWarranties])

  // ─── Load Autocompletes ──────────────────────────────────────────────────────

  const loadAutocompletes = async () => {
    setIsLoadingAutocompletes(true)
    try {
      const [resClients, resProducts] = await Promise.all([
        fetch('/api/ventas/clients'),
        fetch('/api/inventario')
      ])

      if (resClients.ok) {
        const cJson = await resClients.json()
        setClients(cJson.data || [])
      }

      if (resProducts.ok) {
        const pJson = await resProducts.json()
        setProducts(pJson.data || [])
      }
    } catch (err) {
      console.error('Error cargando autocompletados:', err)
    } finally {
      setIsLoadingAutocompletes(false)
    }
  }

  // Load autocompletes once when the user opens the creation modal
  useEffect(() => {
    if (isCreateOpen && clients.length === 0) {
      loadAutocompletes()
    }
  }, [isCreateOpen, clients.length])

  // Click outside listener for searchable dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clientRef.current && !clientRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false)
      }
      if (productRef.current && !productRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ─── Autocomplete Filters ────────────────────────────────────────────────────

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients.slice(0, 10)
    return clients.filter(c =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase())
    ).slice(0, 10)
  }, [clients, clientSearch])

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 10)
    return products.filter(p =>
      p.nombre.toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 10)
  }, [products, productSearch])

  // ─── Sorting and Filtering Derived Data ──────────────────────────────────────

  const filteredWarranties = useMemo(() => {
    let result = [...warranties]

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(w => w.estado === statusFilter)
    }

    // Search query
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        w =>
          w.cliente_nombre.toLowerCase().includes(q) ||
          w.producto_nombre.toLowerCase().includes(q) ||
          (w.numero_serie && w.numero_serie.toLowerCase().includes(q)) ||
          (w.modelo && w.modelo.toLowerCase().includes(q))
      )
    }

    // Sorting
    return result.sort((a, b) => {
      if (sortField === 'fecha_recepcion') {
        const av = new Date(a.fecha_recepcion).getTime()
        const bv = new Date(b.fecha_recepcion).getTime()
        return sortAsc ? av - bv : bv - av
      }

      const av = a[sortField] || ''
      const bv = b[sortField] || ''
      if (av === bv) return 0
      const cmp = av < bv ? -1 : 1
      return sortAsc ? cmp : -cmp
    })
  }, [warranties, statusFilter, search, sortField, sortAsc])

  // KPIs
  const kpi = useMemo(() => {
    return {
      total: warranties.length,
      active: warranties.filter(w => ['recibido', 'en_revision', 'aprobado', 'en_reparacion'].includes(w.estado)).length,
      completed: warranties.filter(w => w.estado === 'completado').length,
      delivered: warranties.filter(w => w.estado === 'entregado').length,
    }
  }, [warranties])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(a => !a)
    else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const resetCreateForm = () => {
    setCreateForm({
      cliente_id: '',
      cliente_nombre: '',
      producto_id: '',
      producto_nombre: '',
      numero_serie: '',
      modelo: '',
      descripcion_falla: '',
      notas: '',
      estado: 'recibido'
    })
    setClientSearch('')
    setProductSearch('')
    setFormError(null)
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // Fallback: if user typed something but did not select from dropdown, use the typed string as name
    const finalClientName = createForm.cliente_nombre || clientSearch
    const finalProductName = createForm.producto_nombre || productSearch

    if (!finalClientName || !finalProductName || !createForm.descripcion_falla) {
      setFormError('Cliente, Producto y Descripción de la falla son requeridos.')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        ...createForm,
        cliente_nombre: finalClientName,
        producto_nombre: finalProductName
      }

      const res = await fetch('/api/garantias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || 'Error al guardar la garantía')

      setWarranties(prev => [json.data, ...prev])
      setIsCreateOpen(false)
      resetCreateForm()
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenProcess = (item: Warranty) => {
    setProcessingItem(item)
    setProcessForm({
      estado: item.estado,
      diagnostico: item.diagnostico || '',
      resolucion: item.resolucion || '',
      costo_reparacion: item.costo_reparacion !== null && item.costo_reparacion !== undefined ? String(item.costo_reparacion) : '',
      notas: item.notas || '',
      numero_serie: item.numero_serie || '',
      modelo: item.modelo || ''
    })
    setProcessError(null)
  }

  const handleProcessSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!processingItem) return

    setIsUpdating(true)
    setProcessError(null)
    try {
      const res = await fetch(`/api/garantias/${processingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: processForm.estado,
          diagnostico: processForm.diagnostico,
          resolucion: processForm.resolucion,
          costo_reparacion: processForm.costo_reparacion,
          notas: processForm.notas,
          numero_serie: processForm.numero_serie,
          modelo: processForm.modelo
        })
      })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || 'Error al actualizar registro')

      setWarranties(prev =>
        prev.map(w => w.id === processingItem.id ? json.data : w)
      )
      setProcessingItem(null)
    } catch (err: any) {
      setProcessError(err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro de garantía? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      const res = await fetch(`/api/garantias/${id}`, { method: 'DELETE' })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || 'Error al eliminar')

      setWarranties(prev => prev.filter(w => w.id !== id))
      if (processingItem?.id === id) {
        setProcessingItem(null)
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  // ─── Rendering Icons ─────────────────────────────────────────────────────────

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown
      size={13}
      className={sortField === field ? 'text-brand-500' : 'text-gray-300'}
    />
  )

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#37383a] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-500 shadow-sm border border-brand-100">
                <Wrench size={22} />
              </div>
              {t('warranties' as any) || 'Garantías y Soporte'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Recepción, diagnóstico y procesamiento de equipos con fallas en garantía.</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              id="btn-refresh-garantias"
              onClick={fetchWarranties}
              className="btn-secondary text-sm"
              disabled={isLoading}
              title="Actualizar tabla"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>
            {canCreate && (
              <button
                id="btn-nueva-garantia"
                onClick={() => { resetCreateForm(); setIsCreateOpen(true) }}
                className="btn-primary text-sm shadow-sm"
              >
                <Plus size={15} />
                Ingresar Equipo
              </button>
            )}
          </div>
        </header>

        {/* KPIs Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setStatusFilter('all')}
            className={`card p-4 text-left transition-all duration-200 card-hover ${statusFilter === 'all' ? 'ring-2 ring-brand-500 border-brand-200' : ''}`}
          >
            <div className="flex items-center justify-between text-gray-400">
              <p className="text-xs font-semibold uppercase tracking-wide">Total Recibidos</p>
              <ClipboardList size={16} />
            </div>
            <p className="text-3xl font-bold text-gray-800 mt-2">{kpi.total}</p>
            <p className="text-xs text-gray-400 mt-1">garantías ingresadas</p>
          </button>

          <button
            onClick={() => setStatusFilter('en_revision')}
            className={`card p-4 text-left transition-all duration-200 card-hover ${statusFilter === 'en_revision' ? 'ring-2 ring-yellow-500 border-yellow-200' : ''}`}
          >
            <div className="flex items-center justify-between text-yellow-500">
              <p className="text-xs font-semibold uppercase tracking-wide">En Proceso</p>
              <Clock size={16} />
            </div>
            <p className="text-3xl font-bold text-yellow-600 mt-2">{kpi.active}</p>
            <p className="text-xs text-gray-400 mt-1">requieren diagnóstico</p>
          </button>

          <button
            onClick={() => setStatusFilter('completado')}
            className={`card p-4 text-left transition-all duration-200 card-hover ${statusFilter === 'completado' ? 'ring-2 ring-emerald-500 border-emerald-200' : ''}`}
          >
            <div className="flex items-center justify-between text-emerald-500">
              <p className="text-xs font-semibold uppercase tracking-wide">Reparados / Listos</p>
              <CheckCircle2 size={16} />
            </div>
            <p className="text-3xl font-bold text-emerald-600 mt-2">{kpi.completed}</p>
            <p className="text-xs text-gray-400 mt-1">esperando entrega</p>
          </button>

          <button
            onClick={() => setStatusFilter('entregado')}
            className={`card p-4 text-left transition-all duration-200 card-hover ${statusFilter === 'entregado' ? 'ring-2 ring-gray-400 border-gray-200' : ''}`}
          >
            <div className="flex items-center justify-between text-gray-400">
              <p className="text-xs font-semibold uppercase tracking-wide">Entregados</p>
              <Check size={16} />
            </div>
            <p className="text-3xl font-bold text-gray-700 mt-2">{kpi.delivered}</p>
            <p className="text-xs text-gray-400 mt-1">historial completado</p>
          </button>
        </div>

        {/* Filters and search */}
        <div className="card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              id="garantias-search"
              type="text"
              placeholder="Buscar por cliente, equipo, número de serie o modelo…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="erp-input w-full"
              style={{ paddingLeft: '2.25rem' }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Filter size={15} className="text-gray-400 shrink-0" />
            <select
              id="garantias-filter-status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="erp-input text-sm"
              style={{ width: '170px' }}
            >
              <option value="all">Todos los estados</option>
              {STATUS_FLOW.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Main content table */}
        {isLoading ? (
          <div className="card p-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            <p className="text-xs text-gray-400">Cargando registros de garantías...</p>
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-red-500 bg-red-50 border-red-100 flex items-center justify-center gap-2">
            <AlertCircle size={18} />
            <span>Error al cargar información: {error}</span>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th
                      onClick={() => handleSort('cliente_nombre')}
                      className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Cliente <SortIcon field="cliente_nombre" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('producto_nombre')}
                      className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Equipo / Producto <SortIcon field="producto_nombre" />
                      </div>
                    </th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Modelo / Serie
                    </th>
                    <th
                      onClick={() => handleSort('fecha_recepcion')}
                      className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Ingreso <SortIcon field="fecha_recepcion" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('estado')}
                      className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Estado <SortIcon field="estado" />
                      </div>
                    </th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Costo Rep.
                    </th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-24">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredWarranties.map(item => {
                    const statusInfo = getStatusDetails(item.estado)
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-brand-50/20 transition-colors text-sm group"
                      >
                        {/* Cliente */}
                        <td className="p-4 font-medium text-gray-900">
                          {item.cliente_nombre}
                        </td>

                        {/* Producto */}
                        <td className="p-4">
                          <div>
                            <span className="font-medium text-gray-800">{item.producto_nombre}</span>
                            {item.descripcion_falla && (
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1" title={item.descripcion_falla}>
                                {item.descripcion_falla}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Modelo / Serie */}
                        <td className="p-4 text-xs text-gray-500">
                          {item.modelo && <div className="font-medium text-gray-700">Mod: {item.modelo}</div>}
                          {item.numero_serie ? (
                            <div>S/N: <span className="font-mono text-gray-800 font-medium">{item.numero_serie}</span></div>
                          ) : (
                            <span className="text-gray-300">Sin S/N</span>
                          )}
                        </td>

                        {/* Recepcion Date */}
                        <td className="p-4 text-xs text-gray-500 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-gray-400" />
                            {formatDate(item.fecha_recepcion)}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Cost */}
                        <td className="p-4 text-gray-600 font-medium">
                          {item.costo_reparacion !== null && item.costo_reparacion !== undefined ? (
                            <span className="flex items-center gap-0.5 text-xs">
                              <DollarSign size={12} className="text-gray-400" />
                              {Number(item.costo_reparacion).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                            <button
                              id={`btn-process-warranty-${item.id}`}
                              onClick={() => handleOpenProcess(item)}
                              className="p-1.5 text-brand-500 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
                              title="Procesar / Actualizar"
                            >
                              <ChevronRight size={18} />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredWarranties.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-gray-400 italic">
                        No se encontraron registros de garantía en este momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between text-xs text-gray-400">
              <span>
                {filteredWarranties.length} garantía{filteredWarranties.length !== 1 ? 's' : ''} en la vista
              </span>
              <span>
                Arthromed ERP
              </span>
            </div>
          </div>
        )}

      </div>

      {/* ─── Create Warranty Modal ────────────────────────────────────────────── */}
      <Modal
        open={isCreateOpen}
        onClose={() => { if (!isSaving) setIsCreateOpen(false) }}
        title="Ingresar Equipo a Garantía"
        maxWidth="600px"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Searchable Client Autocomplete */}
            <div ref={clientRef} className="relative sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Cliente / Distribuidor <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  required
                  type="text"
                  placeholder="Buscar y seleccionar cliente o escribir nombre..."
                  className="erp-input w-full"
                  value={clientSearch}
                  onChange={e => {
                    setClientSearch(e.target.value)
                    setShowClientDropdown(true)
                    setCreateForm(prev => ({
                      ...prev,
                      cliente_id: '',
                      cliente_nombre: e.target.value
                    }))
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowClientDropdown(prev => !prev)}
                >
                  <ChevronDown size={16} />
                </button>
              </div>

              {showClientDropdown && (
                <div className="absolute left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-20 animate-fade-in">
                  {isLoadingAutocompletes && (
                    <div className="p-3 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" /> Cargando...
                    </div>
                  )}
                  {filteredClients.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors flex items-center justify-between"
                      onClick={() => {
                        setCreateForm(prev => ({
                          ...prev,
                          cliente_id: c.id,
                          cliente_nombre: c.name
                        }))
                        setClientSearch(c.name)
                        setShowClientDropdown(false)
                      }}
                    >
                      <span>{c.name}</span>
                      {createForm.cliente_id === c.id && <Check size={14} className="text-brand-500" />}
                    </button>
                  ))}
                  {filteredClients.length === 0 && !isLoadingAutocompletes && (
                    <div className="p-3 text-center text-xs text-gray-400 italic">
                      Usa el texto ingresado como cliente nuevo.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Searchable Product Autocomplete */}
            <div ref={productRef} className="relative sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Equipo / Producto <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  required
                  type="text"
                  placeholder="Buscar y seleccionar producto de catálogo..."
                  className="erp-input w-full"
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value)
                    setShowProductDropdown(true)
                    setCreateForm(prev => ({
                      ...prev,
                      producto_id: '',
                      producto_nombre: e.target.value
                    }))
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowProductDropdown(prev => !prev)}
                >
                  <ChevronDown size={16} />
                </button>
              </div>

              {showProductDropdown && (
                <div className="absolute left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-20 animate-fade-in">
                  {isLoadingAutocompletes && (
                    <div className="p-3 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" /> Cargando...
                    </div>
                  )}
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors flex items-center justify-between"
                      onClick={() => {
                        setCreateForm(prev => ({
                          ...prev,
                          producto_id: p.id,
                          producto_nombre: p.nombre
                        }))
                        setProductSearch(p.nombre)
                        setShowProductDropdown(false)
                      }}
                    >
                      <div>
                        <div className="font-medium">{p.nombre}</div>
                        {p.categoria && <div className="text-xs text-gray-400">{p.categoria}</div>}
                      </div>
                      {createForm.producto_id === p.id && <Check size={14} className="text-brand-500" />}
                    </button>
                  ))}
                  {filteredProducts.length === 0 && !isLoadingAutocompletes && (
                    <div className="p-3 text-center text-xs text-gray-400 italic">
                      Usa el texto ingresado como producto nuevo.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Modelo
              </label>
              <input
                type="text"
                placeholder="Ej. Shaver II"
                className="erp-input"
                value={createForm.modelo}
                onChange={e => setCreateForm({ ...createForm, modelo: e.target.value })}
              />
            </div>

            {/* Serial Number */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Número de Serie
              </label>
              <input
                type="text"
                placeholder="Ej. SN-9821382A"
                className="erp-input font-mono"
                value={createForm.numero_serie}
                onChange={e => setCreateForm({ ...createForm, numero_serie: e.target.value })}
              />
            </div>

            {/* Falla description */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Descripción de la Falla <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Describa el comportamiento fallido detectado..."
                className="erp-input w-full resize-none"
                value={createForm.descripcion_falla}
                onChange={e => setCreateForm({ ...createForm, descripcion_falla: e.target.value })}
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Notas iniciales / Comentarios
              </label>
              <textarea
                rows={2}
                placeholder="Accesorios que acompañan el equipo, notas de empaque, etc."
                className="erp-input w-full resize-none"
                value={createForm.notas}
                onChange={e => setCreateForm({ ...createForm, notas: e.target.value })}
              />
            </div>

          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="btn-secondary text-sm"
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary text-sm shadow-sm"
              disabled={isSaving}
            >
              {isSaving ? 'Registrando...' : 'Registrar Ingreso'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Process/Edit Warranty Modal ──────────────────────────────────────── */}
      <Modal
        open={processingItem !== null}
        onClose={() => { if (!isUpdating) setProcessingItem(null) }}
        title="Procesamiento de Garantía"
        maxWidth="650px"
      >
        {processingItem && (
          <form onSubmit={handleProcessSubmit} className="space-y-5">
            {processError && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{processError}</span>
              </div>
            )}

            {/* Quick Summary Banner */}
            <div className="p-4 bg-brand-50/50 rounded-xl border border-brand-100 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400 font-medium block">Cliente</span>
                <span className="text-sm font-semibold text-gray-800">{processingItem.cliente_nombre}</span>
              </div>
              <div>
                <span className="text-gray-400 font-medium block">Equipo</span>
                <span className="text-sm font-semibold text-gray-800">{processingItem.producto_nombre}</span>
              </div>
              <div>
                <span className="text-gray-400 font-medium block">Ingreso</span>
                <span className="font-medium text-gray-700">{formatDate(processingItem.fecha_recepcion)}</span>
              </div>
              <div>
                <span className="text-gray-400 font-medium block">Falla Reportada</span>
                <span className="font-medium text-gray-700 truncate block" title={processingItem.descripcion_falla}>
                  {processingItem.descripcion_falla}
                </span>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Status Selector */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Estado del Proceso <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STATUS_FLOW.map(s => {
                    const isSelected = processForm.estado === s.value
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setProcessForm({ ...processForm, estado: s.value })}
                        className={`px-3 py-2 text-xs font-semibold border rounded-lg transition-all text-left flex flex-col justify-between h-16 ${
                          isSelected
                            ? 'bg-brand-50 border-brand-500 text-brand-700 ring-1 ring-brand-500'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                        <span>{s.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Model override */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Modelo / Versión
                </label>
                <input
                  type="text"
                  className="erp-input text-xs"
                  value={processForm.modelo}
                  onChange={e => setProcessForm({ ...processForm, modelo: e.target.value })}
                  placeholder="Ej. Shaver II"
                />
              </div>

              {/* Serial Number override */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Número de Serie
                </label>
                <input
                  type="text"
                  className="erp-input text-xs font-mono"
                  value={processForm.numero_serie}
                  onChange={e => setProcessForm({ ...processForm, numero_serie: e.target.value })}
                  placeholder="Ej. SN-9821382A"
                />
              </div>

              {/* Diagnosis */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Diagnóstico Técnico
                </label>
                <textarea
                  rows={2}
                  className="erp-input w-full resize-none text-xs"
                  value={processForm.diagnostico}
                  onChange={e => setProcessForm({ ...processForm, diagnostico: e.target.value })}
                  placeholder="Ej. Fusible de entrada quemado y circuito de control secundario averiado debido a sobretensión..."
                />
              </div>

              {/* Resolution details */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Resolución / Acción Tomada
                </label>
                <textarea
                  rows={2}
                  className="erp-input w-full resize-none text-xs"
                  value={processForm.resolucion}
                  onChange={e => setProcessForm({ ...processForm, resolucion: e.target.value })}
                  placeholder="Ej. Reemplazo de circuito de control secundario por refacción original, calibración y pruebas de ciclo continuo completadas."
                />
              </div>

              {/* Repair Cost */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Costo de Reparación
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 select-none text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="erp-input w-full !pl-8 text-xs font-semibold"
                    placeholder="0.00"
                    value={processForm.costo_reparacion}
                    onChange={e => setProcessForm({ ...processForm, costo_reparacion: e.target.value })}
                  />
                </div>
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Notas Internas
                </label>
                <input
                  type="text"
                  className="erp-input text-xs"
                  value={processForm.notas}
                  onChange={e => setProcessForm({ ...processForm, notas: e.target.value })}
                  placeholder="Comentarios confidenciales del taller..."
                />
              </div>

            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => handleDelete(processingItem.id)}
                  className="btn-ghost text-red-500 hover:text-red-700 hover:bg-red-50 text-xs px-2.5 py-1.5"
                >
                  <Trash2 size={14} />
                  Eliminar Garantía
                </button>
              ) : <div />}
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setProcessingItem(null)}
                  className="btn-secondary text-xs px-4 py-2"
                  disabled={isUpdating}
                >
                  Cerrar
                </button>
                {canEdit && (
                  <button
                    type="submit"
                    className="btn-primary text-xs px-4 py-2"
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Actualizando...' : 'Guardar Cambios'}
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </Modal>

    </AppShell>
  )
}
