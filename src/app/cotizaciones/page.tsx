'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import { 
  FileText, Search, Filter, RefreshCw, ChevronRight,
  CheckCircle, AlertCircle, DollarSign, Calendar, MessageSquare, Paperclip, Zap, X
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { useRouter } from 'next/navigation'

interface Cotizacion {
  id: string
  alegra_id: string | null
  numero_cotizacion: string
  cliente_nombre: string
  cliente_rfc: string | null
  fecha_expedicion: string
  fecha_vencimiento: string | null
  estado: string
  subtotal: number
  iva: number
  total: number
  observaciones: string | null
  _count?: {
    comentarios: number
    documentos: number
  }
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pendiente: { label: 'Pendiente',  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100'  },
  aceptada:  { label: 'Aceptada',   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  rechazada: { label: 'Rechazada',  bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-100'   },
  cancelada: { label: 'Cancelada',  bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-100'  },
  billed:    { label: 'Facturado',    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  unbilled:  { label: 'No Facturado', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100'  },
  facturado: { label: 'Facturado',    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  'no facturado': { label: 'No Facturado', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
}

export default function CotizacionesPage() {
  const router = useRouter()
  const { t } = useI18n()
  
  const [quotes, setQuotes] = useState<Cotizacion[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null)
  
  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Timbrar Modal State
  const [showTimbrarModal, setShowTimbrarModal] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<Cotizacion | null>(null)
  const [isTimbrando, setIsTimbrando] = useState(false)
  const [timbrarMetodo, setTimbrarMetodo] = useState('PUE')
  const [timbrarUso, setTimbrarUso] = useState('G03')

  const fetchQuotes = async () => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams()
      if (search) queryParams.append('search', search)
      if (statusFilter !== 'all') queryParams.append('estado', statusFilter)

      const res = await fetch(`/api/cotizaciones?${queryParams.toString()}`)
      const data = await res.json()
      if (data.data) {
        setQuotes(data.data)
      }
    } catch (err) {
      console.error('Error fetching quotes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuotes()
  }, [search, statusFilter])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/cotizaciones/sync', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        const { created, updated, errors } = data.summary
        setSyncResult({
          success: true,
          message: `Sincronización exitosa: ${created} creadas, ${updated} actualizadas, ${errors} errores.`
        })
        fetchQuotes()
      } else {
        setSyncResult({
          success: false,
          message: data.error || 'Ocurrió un error al sincronizar con Alegra.'
        })
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err.message || 'Error al conectar con la API de sincronización.'
      })
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncResult(null), 6000)
    }
  }

  const handleTimbrar = async () => {
    if (!selectedQuote) return
    setIsTimbrando(true)
    try {
      const res = await fetch(`/api/cotizaciones/${selectedQuote.id}/timbrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metodo_pago: timbrarMetodo, uso_cfdi: timbrarUso })
      })
      const data = await res.json()
      if (data.success) {
        setSyncResult({ success: true, message: 'Cotización facturada y timbrada exitosamente.' })
        setShowTimbrarModal(false)
        fetchQuotes()
      } else {
        alert(data.error || 'Error al timbrar.')
      }
    } catch (err: any) {
      alert(err.message || 'Error de conexión.')
    } finally {
      setIsTimbrando(false)
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
  }

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Cotizaciones</h1>
            <p className="text-sm text-gray-500 mt-1">
              Visualiza y gestiona las cotizaciones sincronizadas directamente de Alegra.
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 gap-2 shadow-sm"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar con Alegra'}
          </button>
        </div>

        {/* Sync Toast Result */}
        {syncResult && (
          <div className={`p-4 rounded-lg flex items-start gap-3 border ${
            syncResult.success ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
          } transition-all duration-300`}>
            {syncResult.success ? <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} /> : <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />}
            <span className="text-sm font-medium">{syncResult.message}</span>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total de Cotizaciones</p>
              <h3 className="text-xl font-bold text-gray-800 mt-1">{quotes.length}</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <RefreshCw size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Pendientes</p>
              <h3 className="text-xl font-bold text-gray-800 mt-1">
                {quotes.filter(q => q.estado === 'pendiente').length}
              </h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Aceptadas</p>
              <h3 className="text-xl font-bold text-gray-800 mt-1">
                {quotes.filter(q => q.estado === 'aceptada').length}
              </h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-gray-50 text-gray-600 rounded-lg">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Monto Total</p>
              <h3 className="text-xl font-bold text-gray-800 mt-1">
                {formatCurrency(quotes.reduce((acc, q) => acc + Number(q.total || 0), 0))}
              </h3>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-4 justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por folio, cliente, rfc..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter size={16} className="text-gray-400" />
            <span className="text-sm text-gray-500 mr-2 whitespace-nowrap">Estado:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full md:w-48 py-2 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              <option value="all">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="aceptada">Aceptada</option>
              <option value="rechazada">Rechazada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
        </div>

        {/* Table / List */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="animate-spin text-blue-600" size={32} />
              <span className="text-sm text-gray-400 font-medium">Cargando cotizaciones...</span>
            </div>
          ) : quotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4">
                <FileText size={32} />
              </div>
              <h3 className="text-base font-semibold text-gray-800">No se encontraron cotizaciones</h3>
              <p className="text-sm text-gray-400 mt-1 max-w-sm">
                Intenta cambiar los filtros de búsqueda o realiza una nueva sincronización con Alegra.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
                    <th className="py-4 px-6 min-w-[200px] w-[220px]">Folio / Número</th>
                    <th className="py-4 px-6">Cliente</th>
                    <th className="py-4 px-6">Expedición</th>
                    <th className="py-4 px-6">Vencimiento</th>
                    <th className="py-4 px-6 text-right">Subtotal</th>
                    <th className="py-4 px-6 text-right">Total</th>
                    <th className="py-4 px-6 text-center">Estado</th>
                    <th className="py-4 px-6 text-center">Interacciones</th>
                    <th className="py-4 px-6 text-center">Acciones</th>
                    <th className="py-4 px-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {quotes.map(quote => {
                    const statusObj = STATUS_MAP[quote.estado?.toLowerCase()] || {
                      label: quote.estado,
                      bg: 'bg-gray-50',
                      text: 'text-gray-600',
                      border: 'border-gray-100'
                    }
                    return (
                      <tr 
                        key={quote.id} 
                        className="hover:bg-gray-50/50 transition cursor-pointer"
                        onClick={() => router.push(`/cotizaciones/${quote.id}`)}
                      >
                        <td className="py-4 px-6 min-w-[200px] w-[220px] font-medium text-gray-900">
                          {quote.numero_cotizacion}
                          {quote.alegra_id && (
                            <span className="block text-[10px] text-gray-400 font-normal">
                              ID Alegra: {quote.alegra_id}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 max-w-xs truncate">
                          <span className="font-medium text-gray-800 block truncate">
                            {quote.cliente_nombre}
                          </span>
                          {quote.cliente_rfc && (
                            <span className="text-xs text-gray-400 font-normal">
                              {quote.cliente_rfc}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={14} className="text-gray-400" />
                            {formatDate(quote.fecha_expedicion)}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-gray-500">
                          {quote.fecha_vencimiento ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar size={14} className="text-gray-400" />
                              {formatDate(quote.fecha_vencimiento)}
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right text-gray-500">
                          {formatCurrency(Number(quote.subtotal || 0))}
                        </td>
                        <td className="py-4 px-6 text-right font-semibold text-gray-900">
                          {formatCurrency(Number(quote.total || 0))}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusObj.bg} ${statusObj.text} ${statusObj.border}`}>
                            {statusObj.label}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-3 text-gray-400">
                            {quote._count && quote._count.comentarios > 0 && (
                              <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                <MessageSquare size={13} />
                                {quote._count.comentarios}
                              </span>
                            )}
                            {quote._count && quote._count.documentos > 0 && (
                              <span className="flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                                <Paperclip size={13} />
                                {quote._count.documentos}
                              </span>
                            )}
                            {(!quote._count || (quote._count.comentarios === 0 && quote._count.documentos === 0)) && (
                              <span className="text-xs text-gray-300">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {quote.estado?.toLowerCase() !== 'facturado' && quote.estado?.toLowerCase() !== 'billed' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedQuote(quote)
                                  setShowTimbrarModal(true)
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-medium transition"
                              >
                                <Zap size={14} /> Timbrar
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <ChevronRight className="text-gray-400 group-hover:text-blue-500 transition" size={18} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* TIMBRAR MODAL */}
      <Modal
        open={showTimbrarModal}
        onClose={() => !isTimbrando && setShowTimbrarModal(false)}
        title="Timbrar Cotización"
        maxWidth="500px"
      >
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            Estás a punto de convertir la cotización <strong>{selectedQuote?.numero_cotizacion}</strong> en una Factura y timbrarla ante el SAT.
          </p>
          <div className="space-y-3 mt-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Método de Pago</label>
              <select
                value={timbrarMetodo}
                onChange={e => setTimbrarMetodo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="PUE">PUE - Pago en una sola exhibición</option>
                <option value="PPD">PPD - Pago en parcialidades o diferido</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Uso de CFDI</label>
              <select
                value={timbrarUso}
                onChange={e => setTimbrarUso(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="G01">G01 - Adquisición de mercancías</option>
                <option value="G03">G03 - Gastos en general</option>
                <option value="S01">S01 - Sin efectos fiscales</option>
                <option value="D04">D04 - Donativos</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowTimbrarModal(false)}
              disabled={isTimbrando}
              className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleTimbrar}
              disabled={isTimbrando}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition disabled:opacity-50"
            >
              {isTimbrando ? <RefreshCw className="animate-spin w-4 h-4" /> : <Zap size={16} />}
              Confirmar y Timbrar
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}
