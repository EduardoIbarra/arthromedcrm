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
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import PermissionGuard from '@/components/PermissionGuard'
import { useDebounce } from '@/hooks/useDebounce'

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

type SortKey =
  | 'codigo'
  | 'empresa_nombre'
  | 'rfc'
  | 'destinatario'
  | 'estado_region'
  | 'vigencia'
  | 'fecha_creacion'
  | 'created_at'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [clientId, setClientId] = useState('')
  const [destinatario, setDestinatario] = useState('')
  const [sort, setSort] = useState<SortKey>('created_at')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')

  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([])
  const [institutionOptions, setInstitutionOptions] = useState<string[]>([])

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
  }, [debouncedSearch, clientId, destinatario, sort, order])

  useEffect(() => {
    fetchCartas()
  }, [fetchCartas])

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

  const hasActiveFilters = !!(search || clientId || destinatario)

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
                Busca y filtra cartas de distribución por cliente e institución destinataria.
              </p>
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              {loading ? 'Cargando…' : `${rows.length} carta${rows.length === 1 ? '' : 's'}`}
            </div>
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
                  placeholder="Buscar código, empresa, RFC, institución..."
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
        </div>
      </PermissionGuard>
    </AppShell>
  )
}
