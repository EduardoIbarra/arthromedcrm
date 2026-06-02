'use client'

import { useEffect, useState, useRef } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import { 
  FileText, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, 
  X, CheckCircle, AlertCircle, DollarSign, Calendar, TrendingUp, Info
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useRouter } from 'next/navigation'

interface FacturaProducto {
  id: string
  producto_nombre: string
  producto_codigo: string | null
  cantidad_facturada: number
  cantidad_entregada: number
  cantidad_pendiente: number
  precio_unitario: number
  importe: number
}

interface Factura {
  id: string
  numero_factura: string
  cliente_nombre: string
  cliente_rfc: string | null
  fecha_expedicion: string
  fecha_vencimiento: string
  estado: string
  estado_surtido: string
  subtotal: number
  iva: number
  total: number
  observaciones: string | null
  alegra_id: string | null
  factura_productos: FacturaProducto[]
  fecha_pago: string | null
  metodo_pago: string | null
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pendiente: { label: 'Pendiente',  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100'  },
  pagada:    { label: 'Pagada',     bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  pagado:    { label: 'Pagado',     bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' }, // legacy alias
  parcial:   { label: 'Parcial',   bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100'   },
  completa:  { label: 'Completa',  bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-100'  },
  cancelada: { label: 'Cancelada', bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-100'   },
  anulado:   { label: 'Anulado',   bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-100'   }, // legacy alias
  borrador:  { label: 'Borrador',  bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-100'  }  // legacy alias
}

const ESTADO_SURTIDO_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  no_surtida: { label: 'No Surtida', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100' },
  parcial: { label: 'Parcial', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
  completa: { label: 'Completa', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' }
}

export default function FacturasPage() {
  const router = useRouter()
  const { t, locale } = useI18n()
  
  // State
  const [invoices, setInvoices] = useState<Factura[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null)
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false)
  
  // Filters state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  // Fetch Invoices
  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        search: searchTerm,
        status: statusFilter,
        start_date: startDate,
        end_date: endDate
      })

      const res = await fetch(`/api/invoices?${params.toString()}`)
      if (!res.ok) throw new Error('Error al obtener facturas')
      
      const result = await res.json()
      setInvoices(result.data)
      setTotalPages(result.pagination.totalPages)
      setTotalItems(result.pagination.total)
    } catch (err: any) {
      console.error('Error fetching invoices:', err)
    } finally {
      setLoading(false)
    }
  }

  // Trigger sync from Alegra
  const handleSync = async () => {
    try {
      setSyncing(true)
      setSyncResult(null)
      const res = await fetch('/api/alegra/sync')
      const data = await res.json()
      
      if (res.ok && data.success) {
        setSyncResult({
          success: true,
          message: `Sincronización exitosa. Se procesaron ${data.summary.totalSynced} facturas (${data.summary.created} creadas, ${data.summary.updated} actualizadas).`
        })
        setPage(1)
        fetchInvoices()
      } else {
        setSyncResult({
          success: false,
          message: data.error || 'Ocurrió un error al sincronizar con Alegra.'
        })
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err.message || 'Error de conexión durante la sincronización.'
      })
    } finally {
      setSyncing(false)
    }
  }

  // Trigger search when filter changes
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      setPage(1)
      setSelectedIds(new Set())
      fetchInvoices()
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [searchTerm, statusFilter, startDate, endDate])

  // Fetch on page change
  useEffect(() => {
    setSelectedIds(new Set())
    fetchInvoices()
  }, [page])

  // Formatting helpers
  const formatCurrency = (amount: number | string, compact = false) => {
    const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0
    const absNum = Math.abs(num)
    if (compact && absNum >= 1000000) {
      return `${num < 0 ? '-' : ''}$${(absNum / 1000000).toFixed(2)}M`
    }
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(num)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Calculated metrics (from current table state or all local invoices)
  // To keep it dynamic, we compute them from the items retrieved or general estimations
  const kpiTotalInvoiced = invoices.reduce((acc, inv) => acc + (!['cancelada', 'anulado'].includes(inv.estado) ? Number(inv.total) || 0 : 0), 0)
  const kpiTotalPaid = invoices.reduce((acc, inv) => acc + (['pagada', 'pagado'].includes(inv.estado) ? Number(inv.total) || 0 : 0), 0)
  const kpiTotalPending = invoices.reduce((acc, inv) => acc + (inv.estado === 'pendiente' ? Number(inv.total) || 0 : 0), 0)

  const handleBulkUpdate = async (status: string) => {
    try {
      setIsUpdatingBulk(true)
      const res = await fetch('/api/invoices/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          estado_surtido: status
        })
      })
      if (!res.ok) throw new Error('Error al actualizar')
      
      setSelectedIds(new Set())
      fetchInvoices()
    } catch (error) {
      console.error(error)
    } finally {
      setIsUpdatingBulk(false)
    }
  }

  const toggleAll = () => {
    if (selectedIds.size === invoices.length && invoices.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(invoices.map(i => i.id)))
    }
  }



  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="text-[#0763a9]" size={28} />
              Facturas Clientes
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('appName')} / Facturas Clientes
            </p>
          </div>

          {/* Sync status card & control button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn-primary !bg-[#0763a9] hover:!bg-[#054d85] !border-[#0763a9] flex items-center gap-2 whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar con Alegra'}
            </button>
          </div>
        </header>

        {/* FEEDBACK STATUS */}
        {syncResult && (
          <div className={`p-4 rounded-xl flex items-start gap-3 border ${
            syncResult.success 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-red-50 text-red-800 border-red-200'
          } animate-fade-in`}>
            {syncResult.success ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold">{syncResult.success ? 'Sincronización Completada' : 'Error en Sincronización'}</p>
              <p className="text-xs opacity-90 mt-0.5">{syncResult.message}</p>
            </div>
            <button onClick={() => setSyncResult(null)} className="text-gray-400 hover:text-gray-600 p-0.5 rounded-full">
              <X size={16} />
            </button>
          </div>
        )}

        {/* METRICS / KPIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4 flex flex-col justify-center border-l-4 border-l-[#0763a9] overflow-hidden">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <DollarSign size={14} className="text-gray-400" />
              Facturado en Página Actual
            </span>
            <span className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 truncate" title={formatCurrency(kpiTotalInvoiced)}>{formatCurrency(kpiTotalInvoiced, true)}</span>
          </div>
          <div className="card p-4 flex flex-col justify-center border-l-4 border-l-emerald-600 overflow-hidden">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <CheckCircle size={14} className="text-gray-400" />
              Pagado en Página Actual
            </span>
            <span className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 truncate" title={formatCurrency(kpiTotalPaid)}>{formatCurrency(kpiTotalPaid, true)}</span>
          </div>
          <div className="card p-4 flex flex-col justify-center border-l-4 border-l-amber-500 overflow-hidden">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <AlertCircle size={14} className="text-gray-400" />
              Pendiente en Página Actual
            </span>
            <span className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 truncate" title={formatCurrency(kpiTotalPending)}>{formatCurrency(kpiTotalPending, true)}</span>
          </div>
          <div className="card p-4 flex flex-col justify-center border-l-4 border-l-slate-400">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <FileText size={14} className="text-gray-400" />
              Total de Facturas
            </span>
            <span className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{totalItems}</span>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-white p-4 rounded-2xl border border-[#d4e0ec] flex flex-col md:flex-row md:items-center gap-4">
          {/* Search text */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por folio, cliente, rfc..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="erp-input pl-9 w-full !py-2 text-sm"
            />
          </div>

          {/* Status select */}
          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="erp-input w-full !py-2 text-sm"
              title="Estado"
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="pagada">Pagada</option>
              <option value="parcial">Parcial</option>
              <option value="completa">Completa</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          {/* Date Pickers */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-36">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="erp-input w-full !py-2 text-xs"
                title="Fecha Inicio"
              />
            </div>
            <span className="text-gray-400 text-xs">al</span>
            <div className="relative w-full md:w-36">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="erp-input w-full !py-2 text-xs"
                title="Fecha Fin"
              />
            </div>
          </div>

          {/* Reset button */}
          {(searchTerm || statusFilter || startDate || endDate) && (
            <button
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('')
                setStartDate('')
                setEndDate('')
              }}
              className="text-xs font-semibold text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-150 transition-colors whitespace-nowrap self-start md:self-auto border border-gray-200 bg-white cursor-pointer"
            >
              {t('cleanFilters')}
            </button>
          )}
        </div>

        {/* BULK ACTIONS */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl flex items-center justify-between animate-fade-in">
            <span className="text-sm font-semibold text-blue-900 ml-2">
              {selectedIds.size} {selectedIds.size === 1 ? 'factura seleccionada' : 'facturas seleccionadas'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-700 mr-2 font-medium hidden sm:inline">Marcar surtido como:</span>
              <button 
                disabled={isUpdatingBulk}
                onClick={() => handleBulkUpdate('no_surtida')} 
                className="px-3 py-1.5 bg-white border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold hover:bg-rose-50 transition-colors disabled:opacity-50"
              >
                No Surtida
              </button>
              <button 
                disabled={isUpdatingBulk}
                onClick={() => handleBulkUpdate('completa')} 
                className="px-3 py-1.5 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-50 transition-colors disabled:opacity-50"
              >
                Completa
              </button>
            </div>
          </div>
        )}

        {/* LIST TABLE */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-[#0763a9] animate-spin" />
              <p className="text-sm text-gray-500 font-medium">Buscando facturas...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-16 text-center text-gray-500">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-600">No se encontraron facturas</p>
              <p className="text-xs text-gray-400 mt-1">Intente ajustar los filtros de búsqueda o ejecute la sincronización de Alegra.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-[#e8f1f9] text-xs font-semibold uppercase text-gray-500">
                    <th className="p-4 pl-6 w-12 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-[#0763a9] focus:ring-[#0763a9] cursor-pointer"
                        checked={invoices.length > 0 && selectedIds.size === invoices.length}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="p-4">Folio / Número</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">RFC</th>
                    <th className="p-4">Fecha Expedición</th>
                    <th className="p-4">Vencimiento</th>
                    <th className="p-4 text-right">Subtotal</th>
                    <th className="p-4 text-right">IVA</th>
                    <th className="p-4 text-right font-bold">Total</th>
                    <th className="p-4 text-center">Surtido</th>
                    <th className="p-4 text-center">Estado Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8f1f9] text-sm">
                  {invoices.map((invoice) => {
                    const status = STATUS_MAP[invoice.estado] || { label: invoice.estado, bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-100' }
                    const surtido = ESTADO_SURTIDO_MAP[invoice.estado_surtido] || ESTADO_SURTIDO_MAP['no_surtida']
                    return (
                      <tr
                        key={invoice.id}
                        onClick={() => router.push(`/facturas/${invoice.id}`)}
                        className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                      >
                        <td className="p-4 pl-6 text-center" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-[#0763a9] focus:ring-[#0763a9] cursor-pointer"
                            checked={selectedIds.has(invoice.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedIds)
                              if (e.target.checked) newSet.add(invoice.id)
                              else newSet.delete(invoice.id)
                              setSelectedIds(newSet)
                            }}
                          />
                        </td>
                        <td className="p-4 font-semibold text-[#0763a9] group-hover:underline">
                          {invoice.numero_factura}
                        </td>
                        <td className="p-4 font-medium text-gray-900 max-w-[200px] truncate">
                          {invoice.cliente_nombre}
                        </td>
                        <td className="p-4 text-gray-600 font-mono text-xs">
                          {invoice.cliente_rfc || '-'}
                        </td>
                        <td className="p-4 text-gray-600">
                          {formatDate(invoice.fecha_expedicion)}
                        </td>
                        <td className="p-4 text-gray-600">
                          {formatDate(invoice.fecha_vencimiento)}
                        </td>
                        <td className="p-4 text-right text-gray-600 font-mono text-xs">
                          {formatCurrency(invoice.subtotal)}
                        </td>
                        <td className="p-4 text-right text-gray-600 font-mono text-xs">
                          {formatCurrency(invoice.iva)}
                        </td>
                        <td className="p-4 text-right font-bold text-gray-900 font-mono">
                          {formatCurrency(invoice.total)}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${surtido.bg} ${surtido.text} ${surtido.border}`}>
                            {surtido.label}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${status.bg} ${status.text} ${status.border}`}>
                              {status.label}
                            </span>
                            {(['pagada', 'pagado'].includes(invoice.estado)) && invoice.fecha_pago && (
                              <span className="text-[10px] text-gray-500 mt-1 font-semibold whitespace-nowrap">
                                Pago: {formatDate(invoice.fecha_pago)}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION */}
          {!loading && totalPages > 1 && (
            <div className="p-4 border-t border-[#e8f1f9] flex items-center justify-between bg-gray-50/50">
              <span className="text-xs text-gray-500 font-medium">
                Página <strong className="text-gray-950">{page}</strong> de <strong className="text-gray-950">{totalPages}</strong> ({totalItems} registros)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="btn-secondary !p-1.5 disabled:opacity-50"
                  aria-label="Anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="btn-secondary !p-1.5 disabled:opacity-50"
                  aria-label="Siguiente"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  )
}
