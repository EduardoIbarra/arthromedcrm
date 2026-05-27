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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Table controls
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('nombre')
  const [sortAsc, setSortAsc] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_stock' | 'low' | 'out'>('all')
  const [filterActivo, setFilterActivo] = useState<'all' | 'active' | 'inactive'>('active')

  // Edit modal
  const [editItem, setEditItem] = useState<Producto | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchInventario = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/inventario')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setItems(json.data as Producto[])
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
    setEditValue(String(item.stock_actual))
    setSaveError(null)
  }

  const handleSave = async () => {
    if (!editItem) return
    const val = parseInt(editValue, 10)
    if (isNaN(val) || val < 0) {
      setSaveError('Ingresa un número entero positivo.')
      return
    }
    setIsSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/inventario/${editItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_actual: val }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      // Optimistic update
      const updatedAt = json.stock_updated_at ?? new Date().toISOString()
      setItems(prev =>
        prev.map(p => p.id === editItem.id ? { ...p, stock_actual: val, stock_updated_at: updatedAt } : p)
      )
      setEditItem(null)
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(a => !a)
    else { setSortField(field); setSortAsc(true) }
  }

  // ─── Derived Data ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = items

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
  }, [items, search, sortField, sortAsc, filterStatus, filterActivo])

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
  }, [items])

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
          <button
            id="btn-refresh-inventario"
            onClick={fetchInventario}
            className="btn-secondary text-sm self-start sm:self-auto"
            disabled={isLoading}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            Actualizar
          </button>
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

            {/* Current stock display */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Stock actual</p>
                <div className={`text-2xl font-bold ${editItem.stock_actual <= 0 ? 'text-red-600' : editItem.stock_actual <= 5 ? 'text-amber-500' : 'text-emerald-600'}`}>
                  {editItem.stock_actual} uds
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
    </AppShell>
  )
}
