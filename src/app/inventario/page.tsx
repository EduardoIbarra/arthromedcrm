'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Package,
  Search,
  X,
  Edit3,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  ArrowUpDown,
  Filter,
  RefreshCw,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import SearchableSelect from '@/components/SearchableSelect'
import Link from 'next/link'
import { MinusCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Producto = {
  id: string
  nombre: string
  categoria: string | null
  tipo: string | null
  activo: boolean | null
  stock_actual: number
  precio_unitario: number
  stock_updated_at: string | null
  inventarios: { id: string; nombre: string; stock: number; updated_at: string }[]
}

type TipoInventario = {
  id: string
  nombre: string
}

type SortField = 'nombre' | 'categoria' | 'tipo' | 'stock_actual'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stockBadge(qty: number) {
  if (qty <= 0)
    return { label: 'Sin stock', cls: 'bg-red-100 text-red-700 border-red-200' }
  if (qty <= 5)
    return { label: `${qty} uds`, cls: 'bg-amber-100 text-amber-700 border-amber-200' }
  return { label: `${qty} uds`, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
}

function stockDot(qty: number) {
  if (qty <= 0) return 'bg-red-500'
  if (qty <= 5) return 'bg-amber-400'
  return 'bg-emerald-500'
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'ahora mismo'
  if (mins  < 60) return `hace ${mins} min`
  if (hours < 24) return `hace ${hours} h`
  if (days  < 30) return `hace ${days} día${days !== 1 ? 's' : ''}`
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InventarioPage() {
  // Data
  const [items, setItems] = useState<Producto[]>([])
  const [tiposInventario, setTiposInventario] = useState<TipoInventario[]>([])
  const [users, setUsers] = useState<{id: string, email: string}[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Table controls
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('nombre')
  const [sortAsc, setSortAsc] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_stock' | 'low' | 'out'>('all')
  const [filterActivo, setFilterActivo] = useState<'all' | 'active' | 'inactive'>('active')
  const [filterInventario, setFilterInventario] = useState<string>('all')

  // Edit modal
  const [editItem, setEditItem] = useState<Producto | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editInventarioId, setEditInventarioId] = useState<string>('')
  // Salida modal
  const [isSalidaModalOpen, setIsSalidaModalOpen] = useState(false)
  const [salidaItems, setSalidaItems] = useState<{producto_id: string, inventario_id: string, cantidad: string, stock: number}[]>([])
  const [salidaMotivo, setSalidaMotivo] = useState('')
  const [salidaAutorizador, setSalidaAutorizador] = useState('')
  const [isSavingSalida, setIsSavingSalida] = useState(false)
  const [salidaError, setSalidaError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchInventario = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [resInv, resTipos, resUsers] = await Promise.all([
        fetch('/api/inventario'),
        fetch('/api/inventario/tipos'),
        fetch('/api/users')
      ])
      const jsonInv = await resInv.json()
      const jsonTipos = await resTipos.json()
      const jsonUsers = await resUsers.json()
      
      if (!resInv.ok) throw new Error(jsonInv.error)
      if (!resTipos.ok) throw new Error(jsonTipos.error)
      if (!resUsers.ok) throw new Error(jsonUsers.error)
        
      setItems(jsonInv.data as Producto[])
      setTiposInventario(jsonTipos.data)
      setUsers(jsonUsers.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchInventario() }, [fetchInventario])

  // ─── Edit Handlers ────────────────────────────────────────────────────────

  const openEdit = (item: Producto) => {
    setEditItem(item)
    // Select default inventory
    const defaultInv = filterInventario !== 'all' ? filterInventario : (tiposInventario[0]?.id || '')
    setEditInventarioId(defaultInv)
    const stockInDefault = item.inventarios?.find(i => i.id === defaultInv)?.stock || 0
    setEditValue(String(filterInventario !== 'all' ? stockInDefault : item.stock_actual))
    setSaveError(null)
  }

  const handleSave = async () => {
    if (!editItem) return
    const val = parseInt(editValue, 10)
    if (isNaN(val) || val < 0) {
      setSaveError('Ingresa un número entero positivo.')
      return
    }
    if (!editInventarioId) {
      setSaveError('Selecciona un tipo de inventario.')
      return
    }
    setIsSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/inventario/${editItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_actual: val, inventario_id: editInventarioId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      // Optimistic update
      fetchInventario() // Re-fetch to get correct totals across inventories
      setEditItem(null)
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const openSalida = () => {
    setIsSalidaModalOpen(true)
    setSalidaItems([{ producto_id: '', inventario_id: tiposInventario[0]?.id || '', cantidad: '', stock: 0 }])
    setSalidaMotivo('')
    setSalidaAutorizador('')
    setSalidaError(null)
  }

  const addSalidaRow = () => {
    setSalidaItems([...salidaItems, { producto_id: '', inventario_id: tiposInventario[0]?.id || '', cantidad: '', stock: 0 }])
  }

  const updateSalidaRow = (index: number, field: string, value: any) => {
    const newItems = [...salidaItems]
    newItems[index] = { ...newItems[index], [field]: value }
    if (field === 'producto_id' || field === 'inventario_id') {
      const prod = items.find(p => p.id === newItems[index].producto_id)
      const invId = newItems[index].inventario_id
      newItems[index].stock = prod?.inventarios?.find(i => i.id === invId)?.stock || 0
    }
    setSalidaItems(newItems)
  }

  const removeSalidaRow = (index: number) => {
    setSalidaItems(salidaItems.filter((_, i) => i !== index))
  }

  const handleSalida = async () => {
    const validItems = salidaItems.filter(i => i.producto_id && i.inventario_id && parseInt(i.cantidad, 10) > 0)
    if (validItems.length === 0) {
      setSalidaError('Agrega al menos un producto válido (cantidad mayor a 0).')
      return
    }

    setIsSavingSalida(true)
    setSalidaError(null)
    try {
      const res = await fetch(`/api/inventario/salidas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: validItems, 
          motivo: salidaMotivo, 
          autorizador_id: salidaAutorizador || null 
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      
      fetchInventario()
      setIsSalidaModalOpen(false)
    } catch (e: any) {
      setSalidaError(e.message)
    } finally {
      setIsSavingSalida(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(a => !a)
    else { setSortField(field); setSortAsc(true) }
  }

  // ─── Derived Data ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = items.map(p => {
      if (filterInventario === 'all') return p
      const invStock = p.inventarios?.find(i => i.id === filterInventario)?.stock || 0
      return { ...p, stock_actual: invStock }
    })

    // Active filter
    if (filterActivo === 'active') result = result.filter(p => p.activo !== false)
    else if (filterActivo === 'inactive') result = result.filter(p => p.activo === false)

    // Stock filter
    if (filterStatus === 'in_stock') result = result.filter(p => p.stock_actual > 5)
    else if (filterStatus === 'low') result = result.filter(p => p.stock_actual > 0 && p.stock_actual <= 5)
    else if (filterStatus === 'out') result = result.filter(p => p.stock_actual <= 0)

    // Search
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.categoria?.toLowerCase() || '').includes(q) ||
        (p.tipo?.toLowerCase() || '').includes(q)
      )
    }

    // Sort
    return [...result].sort((a, b) => {
      const av = a[sortField]
      const bv = b[sortField]
      if (av === bv) return 0
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      const cmp = av < bv ? -1 : 1
      return sortAsc ? cmp : -cmp
    })
  }, [items, search, sortField, sortAsc, filterStatus, filterActivo, filterInventario])

  // KPI totals
  const kpi = useMemo(() => {
    const active = items.filter(p => p.activo !== false)
    return {
      total: active.length,
      inStock: active.filter(p => p.stock_actual > 5).length,
      low: active.filter(p => p.stock_actual > 0 && p.stock_actual <= 5).length,
      out: active.filter(p => p.stock_actual <= 0).length,
      units: active.reduce((acc, p) => acc + p.stock_actual, 0),
    }
  }, [filtered])

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown
      size={13}
      className={sortField === field ? 'text-blue-600' : 'text-gray-300'}
    />
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">

        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="text-blue-600" size={28} />
              Inventario
            </h1>
            <p className="text-sm text-gray-500 mt-1">Arthromed ERP / Inventario de Productos</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openSalida}
              className="btn-primary bg-red-600 hover:bg-red-700 ring-red-600 border-none text-white shadow-sm text-sm"
              disabled={isLoading}
            >
              <MinusCircle size={15} /> Registrar Salida
            </button>
            <Link href="/inventario/tipos" className="btn-secondary text-sm">
              Gestionar Tipos
            </Link>
            <button
              id="btn-refresh-inventario"
              onClick={fetchInventario}
              className="btn-secondary text-sm"
              disabled={isLoading}
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>
        </header>

        {/* KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button
            id="kpi-all"
            onClick={() => setFilterStatus('all')}
            className={`card p-4 text-left transition-all hover:shadow-md ${filterStatus === 'all' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total SKUs</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{kpi.total}</p>
            <p className="text-xs text-gray-400 mt-0.5">{kpi.units} unidades totales</p>
          </button>

          <button
            id="kpi-in-stock"
            onClick={() => setFilterStatus('in_stock')}
            className={`card p-4 text-left transition-all hover:shadow-md ${filterStatus === 'in_stock' ? 'ring-2 ring-emerald-500' : ''}`}
          >
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">En Stock</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{kpi.inStock}</p>
            <p className="text-xs text-gray-400 mt-0.5">más de 5 unidades</p>
          </button>

          <button
            id="kpi-low-stock"
            onClick={() => setFilterStatus('low')}
            className={`card p-4 text-left transition-all hover:shadow-md ${filterStatus === 'low' ? 'ring-2 ring-amber-500' : ''}`}
          >
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Stock Bajo</p>
            <p className="text-3xl font-bold text-amber-500 mt-1">{kpi.low}</p>
            <p className="text-xs text-gray-400 mt-0.5">1 – 5 unidades</p>
          </button>

          <button
            id="kpi-out-of-stock"
            onClick={() => setFilterStatus('out')}
            className={`card p-4 text-left transition-all hover:shadow-md ${filterStatus === 'out' ? 'ring-2 ring-red-500' : ''}`}
          >
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Sin Stock</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{kpi.out}</p>
            <p className="text-xs text-gray-400 mt-0.5">0 unidades</p>
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4 flex flex-col sm:flex-row gap-3">
          {/* Search — takes up all available space */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              id="inventario-search"
              type="text"
              placeholder="Buscar por producto, categoría o tipo…"
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

          {/* Inventario filter */}
          <div className="flex items-center gap-2 shrink-0">
            <Package size={15} className="text-gray-400 shrink-0" />
            <select
              value={filterInventario}
              onChange={e => setFilterInventario(e.target.value)}
              className="erp-input text-sm"
              style={{ width: '150px' }}
            >
              <option value="all">Todos los Inventarios</option>
              {tiposInventario.map(t => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2 shrink-0">
            <Filter size={15} className="text-gray-400 shrink-0" />
            <select
              id="inventario-filter-status"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="erp-input text-sm"
              style={{ width: '150px' }}
            >
              <option value="all">Todos</option>
              <option value="in_stock">En stock (&gt;5)</option>
              <option value="low">Stock bajo (1–5)</option>
              <option value="out">Sin stock</option>
            </select>
          </div>

          {/* Active filter — compact */}
          <select
            id="inventario-filter-activo"
            value={filterActivo}
            onChange={e => setFilterActivo(e.target.value as any)}
            className="erp-input text-sm shrink-0"
            style={{ width: '130px' }}
          >
            <option value="active">Activos</option>
            <option value="all">Todos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="card p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-red-500 bg-red-50 border-red-100">
            {error}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th
                      onClick={() => handleSort('nombre')}
                      className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Producto <SortIcon field="nombre" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('categoria')}
                      className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        Categoría <SortIcon field="categoria" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('tipo')}
                      className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        Tipo <SortIcon field="tipo" />
                      </div>
                    </th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Estado
                    </th>
                    <th
                      onClick={() => handleSort('stock_actual')}
                      className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        Stock Actual <SortIcon field="stock_actual" />
                      </div>
                    </th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Última actualización
                    </th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-20">
                      Ajustar
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(item => {
                    const badge = stockBadge(item.stock_actual)
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-blue-50/30 transition-colors"
                      >
                        {/* Nombre */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${stockDot(item.stock_actual)}`}
                            />
                            <span className={`text-sm font-medium ${item.activo === false ? 'text-gray-400' : 'text-gray-900'}`}>
                              {item.nombre}
                            </span>
                          </div>
                        </td>

                        {/* Categoría */}
                        <td className="p-4 text-sm text-gray-500">
                          {item.categoria || <span className="text-gray-300">—</span>}
                        </td>

                        {/* Tipo */}
                        <td className="p-4 text-sm text-gray-500 whitespace-nowrap">
                          {item.tipo || <span className="text-gray-300">—</span>}
                        </td>

                        {/* Estado activo */}
                        <td className="p-4">
                          {item.activo === false ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                              <AlertCircle size={11} /> Inactivo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                              <CheckCircle2 size={11} /> Activo
                            </span>
                          )}
                        </td>

                        {/* Stock badge */}
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.cls}`}
                          >
                            {item.stock_actual <= 0 && <TrendingDown size={11} />}
                            {badge.label}
                          </span>
                        </td>

                        {/* Last updated */}
                        <td className="p-4 whitespace-nowrap">
                          <span
                            className="text-xs text-gray-400"
                            title={item.stock_updated_at ? new Date(item.stock_updated_at).toLocaleString('es-MX') : 'Sin registro'}
                          >
                            {timeAgo(item.stock_updated_at)}
                          </span>
                        </td>

                        {/* Edit button */}
                        <td className="p-4 text-right">
                          <button
                            id={`btn-edit-stock-${item.id}`}
                            onClick={() => openEdit(item)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Ajustar stock"
                          >
                            <Edit3 size={15} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-gray-400">
                        No se encontraron productos con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between text-xs text-gray-400">
              <span>
                {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
                {(search || filterStatus !== 'all') && ` de ${items.filter(p => filterActivo === 'active' ? p.activo !== false : filterActivo === 'inactive' ? p.activo === false : true).length} total`}
              </span>
              <span>
                {filtered.reduce((s, p) => s + p.stock_actual, 0)} unidades en vista
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Edit Stock Modal ────────────────────────────────────────────────── */}
      <Modal
        open={editItem !== null}
        onClose={() => { if (!isSaving) setEditItem(null) }}
        title="Ajustar Stock"
        maxWidth="420px"
      >
        {editItem && (
          <div className="space-y-5">
            {/* Product info */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 mb-0.5">Producto</p>
              <p className="text-sm font-semibold text-gray-800">{editItem.nombre}</p>
              {editItem.categoria && (
                <p className="text-xs text-gray-400 mt-0.5">{editItem.categoria}</p>
              )}
            </div>

            {/* Select Inventario */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Inventario a ajustar <span className="text-red-500">*</span></label>
              <select
                className="erp-input w-full text-sm"
                value={editInventarioId}
                onChange={e => {
                  setEditInventarioId(e.target.value)
                  const currentInvStock = editItem.inventarios?.find(i => i.id === e.target.value)?.stock || 0
                  setEditValue(String(currentInvStock))
                }}
              >
                <option value="" disabled>Selecciona un inventario</option>
                {tiposInventario.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>

            {/* Current stock display */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Stock actual</p>
                <div className={`text-2xl font-bold text-gray-900`}>
                  {editInventarioId ? (editItem.inventarios?.find(i => i.id === editInventarioId)?.stock || 0) : editItem.stock_actual} uds
                </div>
              </div>
              <div className="w-px h-12 bg-gray-200" />
              <div className="flex-1">
                <label
                  htmlFor="edit-stock-input"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Nuevo valor <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-stock-input"
                  type="number"
                  min="0"
                  step="1"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                  className="erp-input text-lg font-bold w-full"
                  autoFocus
                />
              </div>
            </div>

            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {saveError}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setEditItem(null)}
                className="btn-secondary"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                id="btn-save-stock"
                onClick={handleSave}
                className="btn-primary"
                disabled={isSaving}
              >
                {isSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Salida Global Modal */}
      <Modal open={isSalidaModalOpen} onClose={() => { if (!isSavingSalida) setIsSalidaModalOpen(false) }} title="Registrar Salida de Inventario" maxWidth="800px">
        <div className="space-y-5">
          <p className="text-sm text-gray-500">
            Agrega los productos que deseas retirar del inventario, indicando la cantidad y el origen de cada uno.
          </p>

          <div className="space-y-3">
            {salidaItems.map((row, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg relative">
                
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Producto <span className="text-red-500">*</span></label>
                  <SearchableSelect
                    options={items.map(p => ({ value: p.id, label: p.nombre }))}
                    value={row.producto_id}
                    onChange={val => updateSalidaRow(index, 'producto_id', val)}
                    placeholder="Selecciona producto..."
                  />
                </div>
                
                <div className="sm:w-48">
                  <label className="block text-xs text-gray-500 mb-1">Inventario <span className="text-red-500">*</span></label>
                  <select
                    className="erp-input w-full text-sm"
                    value={row.inventario_id}
                    onChange={e => updateSalidaRow(index, 'inventario_id', e.target.value)}
                  >
                    <option value="" disabled>Origen...</option>
                    {tiposInventario.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:w-32 flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Cant.</label>
                    <input
                      type="number"
                      min="1"
                      className="erp-input w-full text-sm text-center"
                      value={row.cantidad}
                      onChange={e => updateSalidaRow(index, 'cantidad', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="sm:w-16 flex flex-col items-center justify-center pt-5">
                  <span className="text-xs text-gray-400 mb-1">Disp.</span>
                  <span className="font-semibold text-gray-600">{row.stock}</span>
                </div>

                {salidaItems.length > 1 && (
                  <button
                    onClick={() => removeSalidaRow(index)}
                    className="absolute -top-2 -right-2 p-1 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-red-500 shadow-sm"
                    title="Eliminar fila"
                  >
                    <MinusCircle size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button onClick={addSalidaRow} className="btn-secondary text-sm">
            + Agregar otro producto
          </button>

          <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
            {/* Motivo */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Motivo General de la Salida</label>
              <textarea
                className="erp-input w-full text-sm"
                rows={2}
                value={salidaMotivo}
                onChange={e => setSalidaMotivo(e.target.value)}
                placeholder="Ej. Traspaso a camioneta, merma, consumo..."
              />
            </div>

            {/* Autorizador */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Autorizador (Opcional)</label>
              <select
                className="erp-input w-full text-sm"
                value={salidaAutorizador}
                onChange={e => setSalidaAutorizador(e.target.value)}
              >
                <option value="">Ninguno / Yo mismo</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.email}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Error & Actions */}
          {salidaError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2 text-red-600">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="text-sm">{salidaError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => setIsSalidaModalOpen(false)}
              className="btn-secondary"
              disabled={isSavingSalida}
            >
              Cancelar
            </button>
            <button
              onClick={handleSalida}
              className="btn-primary bg-red-600 hover:bg-red-700 ring-red-600 border-none text-white shadow-sm"
              disabled={isSavingSalida}
            >
              {isSavingSalida ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando...</>
              ) : (
                <><MinusCircle size={15} /> Confirmar Salida</>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}
