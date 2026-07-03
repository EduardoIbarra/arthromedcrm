'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import {
  Save, Brain, Info, CheckCircle2, Search, Loader2, Sparkles,
  AlertCircle, Package, ShoppingCart, ChevronDown, ChevronRight,
  RefreshCw, Download, FileText, User, Tag, History, ArrowRight,
  Clock, Calendar, Warehouse
} from 'lucide-react'
import Link from 'next/link'

// ── Constants ─────────────────────────────────────────────
const SHIPPING_WEEKS = 4

function getShippingLimit(fechaPago: string | Date): Date {
  const d = new Date(fechaPago)
  d.setDate(d.getDate() + SHIPPING_WEEKS * 7)
  return d
}

function shippingInfo(fechaPago: string | null) {
  if (!fechaPago) return { label: 'Sin fecha pago', cls: 'bg-gray-100 text-gray-500 border-gray-200', pastDue: false, daysUntil: null }
  const limit = getShippingLimit(fechaPago)
  const now = new Date()
  const diffDays = Math.floor((limit.getTime() - now.getTime()) / 86400000)
  if (diffDays < 0) {
    return { label: `Vencido ${Math.abs(diffDays)}d`, cls: 'bg-red-100 text-red-700 border-red-200', pastDue: true, daysUntil: diffDays }
  }
  if (diffDays <= 7) {
    return { label: `${diffDays}d para vencer`, cls: 'bg-amber-100 text-amber-700 border-amber-200', pastDue: false, daysUntil: diffDays }
  }
  return { label: `${diffDays}d restantes`, cls: 'bg-green-100 text-green-700 border-green-200', pastDue: false, daysUntil: diffDays }
}

function ShippingLimitBadge({ fechaPago }: { fechaPago: string | null }) {
  const info = shippingInfo(fechaPago)
  const limit = fechaPago ? getShippingLimit(fechaPago).toLocaleDateString() : null
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${info.cls}`} title={limit ? `Límite envío: ${limit}` : ''}>
      {limit ? `Límite: ${limit} · ` : ''}{info.label}
    </span>
  )
}

// ── Types ─────────────────────────────────────────────────
interface OrdenProducto {
  id: string
  orden_id: string
  producto_id: string | null
  producto_nombre: string | null
  cantidad_ordenada: number
  cantidad_recibida: number | null
}

interface OrdenCompra {
  id: string
  numero_orden: string
  proveedor: string | null
  fecha_orden: string | null
  estado: string | null
  productos: OrdenProducto[]
  total_ordenado: number
  total_recibido: number
}

interface StockFisicoItem {
  producto_id: string
  nombre: string
  cantidad: number
}

interface Allocation {
  id: string
  folio: string
  customerName: string
  product: string
  requestedQty: number
  allocatedQty: number
  paymentDate?: string | null
  shippingLimit?: string | null
  manualAdjustment?: boolean
}

interface HistoryEntry {
  id: string
  created_at: string
  status: string
  importacion_items: any[]
  importacion_fuentes: any[]
}

// ── Main Component ────────────────────────────────────────
export default function ImportRepartitionPage() {
  const { t, locale } = useI18n()
  const router = useRouter()

  // ── Tab for main view ─────────────────────────────────
  const [mainTab, setMainTab] = useState<'nueva' | 'historial'>('nueva')

  // ── Results grouping tab ──────────────────────────────
  const [resultsTab, setResultsTab] = useState<'invoice' | 'customer' | 'product'>('invoice')

  // ── Ordenes de compra ─────────────────────────────────
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [loadingOrdenes, setLoadingOrdenes] = useState(true)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())

  // ── Stock físico ──────────────────────────────────────
  const [stockFisico, setStockFisico] = useState<StockFisicoItem[]>([])
  const [loadingStock, setLoadingStock] = useState(false)
  const [useStockFisico, setUseStockFisico] = useState(false)
  const [stockSearchQuery, setStockSearchQuery] = useState('')

  // ── Facturas ──────────────────────────────────────────
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [invoiceResults, setInvoiceResults] = useState<any[]>([])
  const [isSearchingInvoices, setIsSearchingInvoices] = useState(false)
  const [selectedInvoices, setSelectedInvoices] = useState<any[]>([])
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([])

  // ── Results ───────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [remainingInventory, setRemainingInventory] = useState<Record<string, number>>({})
  const [initialInventory, setInitialInventory] = useState<Record<string, number>>({})
  const [aiReasoning, setAiReasoning] = useState('')
  const [invoiceIdFromChina, setInvoiceIdFromChina] = useState('')

  // ── History ───────────────────────────────────────────
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // ─────────────────────────────────────────────────────
  // Data fetchers
  // ─────────────────────────────────────────────────────
  const fetchOrdenes = async () => {
    setLoadingOrdenes(true)
    try {
      const res = await fetch('/api/ordenes-compra')
      const data = await res.json()
      if (data.data) {
        setOrdenes(data.data)
        setSelectedOrderIds(new Set(data.data.map((o: OrdenCompra) => o.id)))
      }
    } catch (err) { console.error(err) }
    finally { setLoadingOrdenes(false) }
  }

  const fetchStockFisico = async () => {
    setLoadingStock(true)
    try {
      const res = await fetch('/api/stock-fisico')
      const data = await res.json()
      setStockFisico(data.data || [])
    } catch (err) { console.error(err) }
    finally { setLoadingStock(false) }
  }

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/imports/history')
      const data = await res.json()
      setHistory(data.data || [])
    } catch (err) { console.error(err) }
    finally { setLoadingHistory(false) }
  }

  // Load pending invoices + ordenes on mount
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const [res1, res2] = await Promise.all([
          fetch('/api/invoices?status=pagada&estado_surtido=no_surtida&pageSize=500'),
          fetch('/api/invoices?status=pagada&estado_surtido=parcial&pageSize=500'),
        ])
        const [d1, d2] = await Promise.all([res1.json(), res2.json()])
        const merged: any[] = []
        const seen = new Set<string>()
        for (const inv of [...(d1.data || []), ...(d2.data || [])]) {
          if (!seen.has(inv.id)) {
            seen.add(inv.id)
            merged.push(inv)
          }
        }
        // Sort by shipping limit: most overdue first
        merged.sort((a, b) => {
          const la = a.fecha_pago ? getShippingLimit(a.fecha_pago) : null
          const lb = b.fecha_pago ? getShippingLimit(b.fecha_pago) : null
          if (!la && !lb) return 0
          if (!la) return 1
          if (!lb) return -1
          return la.getTime() - lb.getTime()
        })
        setPendingInvoices(merged)
        setSelectedInvoices(merged)
      } catch (err) { console.error(err) }
    }
    fetchPending()
    fetchOrdenes()
  }, [])

  // Lazy-load history
  useEffect(() => {
    if (mainTab === 'historial' && history.length === 0) fetchHistory()
  }, [mainTab])

  // Invoice search
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (invoiceSearch.length < 2) { setInvoiceResults([]); return }
      setIsSearchingInvoices(true)
      try {
        const res = await fetch(`/api/invoices?search=${encodeURIComponent(invoiceSearch)}&pageSize=50`)
        const data = await res.json()
        setInvoiceResults(data.data || [])
      } catch (err) { console.error(err) }
      finally { setIsSearchingInvoices(false) }
    }, 300)
    return () => clearTimeout(delay)
  }, [invoiceSearch])

  // ─────────────────────────────────────────────────────
  // Toggles
  // ─────────────────────────────────────────────────────
  const toggleOrder = (id: string) => setSelectedOrderIds(prev => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next
  })
  const toggleExpandOrder = (id: string) => setExpandedOrders(prev => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next
  })
  const toggleInvoice = (inv: any) => {
    setSelectedInvoices(prev =>
      prev.find(i => i.numero_factura === inv.numero_factura)
        ? prev.filter(i => i.numero_factura !== inv.numero_factura)
        : [...prev, inv]
    )
  }
  const toggleUseStockFisico = () => {
    if (!useStockFisico && stockFisico.length === 0) fetchStockFisico()
    setUseStockFisico(v => !v)
  }

  // ─────────────────────────────────────────────────────
  // Process
  // ─────────────────────────────────────────────────────
  const handleProcess = async () => {
    const hasOrders = selectedOrderIds.size > 0
    const hasStock = useStockFisico && stockFisico.length > 0
    if (!hasOrders && !hasStock) { setError('Selecciona al menos una fuente de inventario.'); return }
    const facturas = selectedInvoices.map(i => String(i.numero_factura))
    if (!facturas.length) { setError('Selecciona facturas a surtir.'); return }

    setLoading(true); setError(''); setSuccessMsg('')
    setAllocations([]); setRemainingInventory({}); setInitialInventory({}); setAiReasoning('')

    try {
      const selectedStockFisico = useStockFisico
        ? stockFisico.map(s => ({ nombre: s.nombre, cantidad: s.cantidad }))
        : []

      const res = await fetch('/api/imports/repartition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedOrderIds: Array.from(selectedOrderIds),
          selectedStockFisico,
          facturas,
          locale
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setAllocations(data.allocations || [])
      setRemainingInventory(data.remainingInventory || {})
      setAiReasoning(data.aiReasoning || '')
      if (data.invoiceIdFromChina) setInvoiceIdFromChina(data.invoiceIdFromChina)

      const initInv: Record<string, number> = { ...data.remainingInventory }
      data.allocations?.forEach((a: Allocation) => {
        initInv[a.product] = (initInv[a.product] || 0) + a.allocatedQty
      })
      setInitialInventory(initInv)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handleQtyChange = (id: string, newQty: number) => {
    setAllocations(prev => {
      const copy = [...prev]
      const index = copy.findIndex(a => a.id === id)
      if (index === -1) return prev
      const oldAlloc = copy[index]
      const product = oldAlloc.product
      const totalAllocatedOther = copy.filter(a => a.product === product && a.id !== id).reduce((acc, curr) => acc + curr.allocatedQty, 0)
      const totalAvailable = initialInventory[product] || 0
      const maxAllowed = totalAvailable - totalAllocatedOther
      let validQty = Math.max(0, Math.min(newQty, maxAllowed, oldAlloc.requestedQty))
      copy[index] = { ...oldAlloc, allocatedQty: validQty, manualAdjustment: true }
      const newTotalAllocated = totalAllocatedOther + validQty
      setRemainingInventory(prevInv => ({ ...prevInv, [product]: totalAvailable - newTotalAllocated }))
      return copy
    })
  }

  const handleSave = async () => {
    setLoading(true); setError('')
    try {
      // Build selected sources list for the log
      const selectedSources: any[] = []
      for (const id of selectedOrderIds) {
        const orden = ordenes.find(o => o.id === id)
        if (orden) selectedSources.push({ type: 'orden_compra', id, label: orden.numero_orden })
      }
      if (useStockFisico) selectedSources.push({ type: 'stock_fisico', id: 'stock_fisico', label: 'Stock Físico' })

      const res = await fetch('/api/imports/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations, remainingInventory, aiReasoning, invoiceIdFromChina, selectedSources }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccessMsg('Repartición guardada.')
      if (data.repartitionId) {
        setTimeout(() => router.push(`/imports/repartition/${data.repartitionId}`), 800)
      }
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  // ── CSV Export ──────────────────────────────────────────
  const handleExportCSV = () => {
    if (!allocations.length) return
    const sorted = [...allocations].sort((a, b) => {
      if (!a.shippingLimit && !b.shippingLimit) return 0
      if (!a.shippingLimit) return 1
      if (!b.shippingLimit) return -1
      return new Date(a.shippingLimit).getTime() - new Date(b.shippingLimit).getTime()
    })
    const headers = ['Folio Factura', 'Cliente', 'Límite de Envío', 'Producto', 'Cantidad Pendiente', 'Cantidad Asignada']
    const rows = sorted.map(a => [
      a.folio, a.customerName,
      a.shippingLimit ? new Date(a.shippingLimit).toLocaleDateString() : 'Sin Pago',
      a.product, a.requestedQty, a.allocatedQty
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `reparticion_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  // ── Grouped results ─────────────────────────────────────
  const allocationsByInvoice = useMemo(() => {
    const groups: Record<string, { folio: string; customerName: string; shippingLimit: string | null; items: Allocation[] }> = {}
    for (const alloc of allocations) {
      if (!groups[alloc.folio]) {
        groups[alloc.folio] = { folio: alloc.folio, customerName: alloc.customerName, shippingLimit: alloc.shippingLimit || null, items: [] }
      }
      groups[alloc.folio].items.push(alloc)
    }
    return Object.values(groups).sort((a, b) => {
      if (!a.shippingLimit && !b.shippingLimit) return 0
      if (!a.shippingLimit) return 1
      if (!b.shippingLimit) return -1
      return new Date(a.shippingLimit).getTime() - new Date(b.shippingLimit).getTime()
    })
  }, [allocations])

  const allocationsByCustomer = useMemo(() => {
    const groups: Record<string, { customerName: string; minLimit: string | null; items: Allocation[] }> = {}
    for (const alloc of allocations) {
      if (!groups[alloc.customerName]) {
        groups[alloc.customerName] = { customerName: alloc.customerName, minLimit: alloc.shippingLimit || null, items: [] }
      } else if (alloc.shippingLimit) {
        const cur = groups[alloc.customerName].minLimit
        if (!cur || new Date(alloc.shippingLimit) < new Date(cur)) groups[alloc.customerName].minLimit = alloc.shippingLimit
      }
      groups[alloc.customerName].items.push(alloc)
    }
    return Object.values(groups).sort((a, b) => {
      if (!a.minLimit && !b.minLimit) return 0
      if (!a.minLimit) return 1
      if (!b.minLimit) return -1
      return new Date(a.minLimit).getTime() - new Date(b.minLimit).getTime()
    })
  }, [allocations])

  const allocationsByProduct = useMemo(() => {
    const groups: Record<string, { product: string; items: Allocation[] }> = {}
    for (const alloc of allocations) {
      if (!groups[alloc.product]) groups[alloc.product] = { product: alloc.product, items: [] }
      groups[alloc.product].items.push(alloc)
    }
    for (const g of Object.values(groups)) {
      g.items.sort((a, b) => {
        if (!a.shippingLimit && !b.shippingLimit) return 0
        if (!a.shippingLimit) return 1
        if (!b.shippingLimit) return -1
        return new Date(a.shippingLimit).getTime() - new Date(b.shippingLimit).getTime()
      })
    }
    return Object.values(groups).sort((a, b) => a.product.localeCompare(b.product))
  }, [allocations])

  // ── Displayed invoices ──────────────────────────────────
  const displayedInvoicesMap = new Map()
  pendingInvoices.forEach(inv => displayedInvoicesMap.set(inv.numero_factura, inv))
  selectedInvoices.forEach(inv => displayedInvoicesMap.set(inv.numero_factura, inv))
  invoiceResults.forEach(inv => displayedInvoicesMap.set(inv.numero_factura, inv))
  let displayedInvoices = Array.from(displayedInvoicesMap.values())
  if (invoiceSearch.trim()) {
    const q = invoiceSearch.trim().toUpperCase()
    displayedInvoices = displayedInvoices.filter((inv: any) =>
      String(inv.numero_factura).toUpperCase().includes(q) ||
      String(inv.cliente_nombre || '').toUpperCase().includes(q)
    )
  }

  // ── Order totals for selected ───────────────────────────
  const selectedOrdenesData = ordenes.filter(o => selectedOrderIds.has(o.id))
  const totalSelOrdenado = selectedOrdenesData.reduce((s, o) => s + o.total_ordenado, 0)
  const totalSelRecibido = selectedOrdenesData.reduce((s, o) => s + o.total_recibido, 0)

  // ── Helpers ─────────────────────────────────────────────
  const estadoBadge = (estado: string | null) => {
    const map: Record<string, string> = {
      pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
      parcial: 'bg-blue-100 text-blue-700 border-blue-200',
      completa: 'bg-green-100 text-green-700 border-green-200',
    }
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${map[estado || ''] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>{estado || '—'}</span>
  }

  const surtidoBadge = (e: string | null) => {
    if (e === 'no_surtida') return <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 border border-red-200 font-medium">No surtida</span>
    if (e === 'parcial') return <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 border border-amber-200 font-medium">Parcial</span>
    return null
  }

  const filteredStock = stockFisico.filter(s => !stockSearchQuery || s.nombre.toLowerCase().includes(stockSearchQuery.toLowerCase()))

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto min-h-screen space-y-6 bg-gray-50/50">
        {/* Page Header + Tab Toggle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('repartition')}</h1>
            <p className="text-gray-500 mt-1">{t('tagline')}</p>
          </div>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setMainTab('nueva')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${mainTab === 'nueva' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Sparkles className="w-4 h-4" /> Nueva Repartición
            </button>
            <button
              onClick={() => setMainTab('historial')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${mainTab === 'historial' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <History className="w-4 h-4" /> Historial
            </button>
          </div>
        </div>

        {/* ─── HISTORIAL TAB ─────────────────────────────── */}
        {mainTab === 'historial' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-500" /> Reparticiones anteriores
              </h2>
              <button onClick={fetchHistory} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" /><span>Cargando historial...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No hay reparticiones guardadas aún.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {history.map(entry => {
                  const totalItems = entry.importacion_items?.reduce((s: number, item: any) =>
                    s + (item.importacion_asignaciones?.reduce((ss: number, a: any) => ss + (a.cantidad_asignada || 0), 0) || 0), 0) || 0
                  const fuentes = entry.importacion_fuentes?.map((f: any) => f.numero_fuente).join(', ') || '—'
                  return (
                    <Link
                      key={entry.id}
                      href={`/imports/repartition/${entry.id}`}
                      className="flex items-center justify-between px-6 py-4 hover:bg-indigo-50/30 transition-colors group"
                    >
                      <div>
                        <p className="font-medium text-gray-900 group-hover:text-indigo-700 transition-colors flex items-center gap-2">
                          {new Date(entry.created_at).toLocaleString()}
                          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">{entry.status}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{entry.importacion_items?.length || 0} productos · {totalItems} uds. asignadas · Fuentes: {fuentes}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── NUEVA REPARTICIÓN ─────────────────────────── */}
        {mainTab === 'nueva' && (
          <>
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 flex items-start gap-3 shadow-sm">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">Solo se asignarán productos a facturas cuyo <strong>límite de envío</strong> (fecha de pago + 4 semanas) ya haya vencido.</p>
            </motion.div>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-start gap-3">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </motion.div>
            )}
            {successMsg && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-100 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{successMsg} Redirigiendo al detalle...</p>
              </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* ── Left Column ──────────────────────────── */}
              <div className="lg:col-span-1 space-y-5">

                {/* ── Fuentes de inventario ──────────────── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-indigo-600" />
                      <h2 className="text-base font-semibold text-gray-900">Fuentes de inventario</h2>
                    </div>
                  </div>

                  {/* Source 1: Órdenes de compra */}
                  <div className="border-b border-gray-100">
                    <div className="px-5 pt-3 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="w-3.5 h-3.5 text-indigo-500" />
                          <p className="text-sm font-semibold text-gray-800">Órdenes de compra</p>
                          {selectedOrderIds.size > 0 && (
                            <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full font-medium">
                              {totalSelRecibido}/{totalSelOrdenado} uds.
                            </span>
                          )}
                        </div>
                        <button onClick={fetchOrdenes} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-52 overflow-y-auto divide-y divide-gray-50 mx-2 mb-2 border border-gray-100 rounded-xl">
                      {loadingOrdenes ? (
                        <div className="flex items-center justify-center py-6 gap-2 text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Cargando...</span>
                        </div>
                      ) : ordenes.length === 0 ? (
                        <div className="py-6 text-center text-gray-400 text-sm">No hay órdenes pendientes</div>
                      ) : ordenes.map(orden => {
                        const isSelected = selectedOrderIds.has(orden.id)
                        const isExpanded = expandedOrders.has(orden.id)
                        return (
                          <div key={orden.id} className={isSelected ? 'bg-indigo-50/30' : 'bg-white'}>
                            <div className="px-3 py-2.5 flex items-start gap-2 cursor-pointer hover:bg-indigo-50/50" onClick={() => toggleOrder(orden.id)}>
                              <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}`}>
                                {isSelected && <CheckCircle2 className="w-3 h-3" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-gray-900 text-xs">{orden.numero_orden}</span>
                                  {estadoBadge(orden.estado)}
                                  <span className={`text-[10px] font-mono px-1 py-0.5 rounded border ${orden.total_recibido < orden.total_ordenado ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-green-700 bg-green-50 border-green-200'}`}>
                                    ({orden.total_recibido}/{orden.total_ordenado})
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-500 truncate">{orden.proveedor || '—'}</p>
                              </div>
                              <button onClick={e => { e.stopPropagation(); toggleExpandOrder(orden.id) }} className="text-gray-400 p-0.5">
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              </button>
                            </div>
                            {isExpanded && (
                              <div className="px-3 pb-2 bg-gray-50/50 border-t border-gray-100">
                                {orden.productos.map(p => (
                                  <div key={p.id} className="flex justify-between text-[10px] gap-2 py-0.5">
                                    <span className="text-gray-600 truncate">{p.producto_nombre}</span>
                                    <span className={`font-mono shrink-0 ${(p.cantidad_recibida || 0) < p.cantidad_ordenada ? 'text-amber-700' : 'text-green-700'}`}>
                                      ({p.cantidad_recibida || 0}/{p.cantidad_ordenada})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="px-4 pb-3 flex justify-between items-center">
                      <span className="text-[10px] text-gray-500">
                        {selectedOrderIds.size}/{ordenes.length} seleccionadas
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedOrderIds(new Set(ordenes.map(o => o.id)))} className="text-[10px] text-indigo-600 font-medium">Todas</button>
                        <span className="text-gray-300">|</span>
                        <button onClick={() => setSelectedOrderIds(new Set())} className="text-[10px] text-gray-500 font-medium">Ninguna</button>
                      </div>
                    </div>
                  </div>

                  {/* Source 2: Stock físico */}
                  <div>
                    <div className="px-5 py-3">
                      <div className="flex items-center gap-2 cursor-pointer" onClick={toggleUseStockFisico}>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${useStockFisico ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-300'}`}>
                          {useStockFisico && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                        <Warehouse className="w-3.5 h-3.5 text-emerald-600" />
                        <p className="text-sm font-semibold text-gray-800">Stock físico (almacén)</p>
                        {loadingStock && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                      </div>
                    </div>

                    {useStockFisico && (
                      <div className="px-3 pb-3">
                        <div className="relative mb-2">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                          <input
                            type="text"
                            value={stockSearchQuery}
                            onChange={e => setStockSearchQuery(e.target.value)}
                            placeholder="Filtrar productos..."
                            className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                          />
                        </div>
                        <div className="border border-gray-100 rounded-xl max-h-40 overflow-y-auto divide-y divide-gray-50">
                          {filteredStock.length === 0 ? (
                            <div className="py-4 text-center text-gray-400 text-xs">
                              {loadingStock ? 'Cargando...' : 'Sin productos'}
                            </div>
                          ) : filteredStock.map(item => (
                            <div key={item.producto_id} className="flex justify-between items-center px-3 py-2 text-xs">
                              <span className="text-gray-700 truncate flex-1 mr-2">{item.nombre}</span>
                              <span className="font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                                {item.cantidad} uds.
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1.5">{stockFisico.length} productos en almacén</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Facturas a Surtir ───────────────────── */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col" style={{ minHeight: 360 }}>
                  <h2 className="text-base font-semibold text-gray-900 mb-3">Facturas a surtir</h2>
                  <p className="text-xs text-gray-500 mb-2">Solo se asignarán artículos a facturas con límite de envío vencido.</p>

                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por folio, cliente..."
                      value={invoiceSearch}
                      onChange={e => setInvoiceSearch(e.target.value)}
                      className="erp-input pl-10 w-full"
                    />
                    {isSearchingInvoices && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                    )}
                  </div>

                  <div className="flex-1 border border-gray-100 rounded-xl overflow-y-auto divide-y divide-gray-50 bg-gray-50/30" style={{ maxHeight: 260 }}>
                    {displayedInvoices.length > 0 ? displayedInvoices.map(inv => {
                      const isSelected = !!selectedInvoices.find(i => i.numero_factura === inv.numero_factura)
                      const sInfo = shippingInfo(inv.fecha_pago || null)
                      return (
                        <div
                          key={inv.id}
                          onClick={() => toggleInvoice(inv)}
                          className={`p-3 cursor-pointer flex items-start gap-3 hover:bg-indigo-50/30 transition-colors ${isSelected ? 'bg-indigo-50/20' : 'bg-white'}`}
                        >
                          <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}`}>
                            {isSelected && <CheckCircle2 className="w-3 h-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-sm flex items-center gap-1.5 flex-wrap">
                              {inv.numero_factura}
                              <ShippingLimitBadge fechaPago={inv.fecha_pago || null} />
                              {surtidoBadge(inv.estado_surtido)}
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{inv.cliente_nombre}</p>
                          </div>
                        </div>
                      )
                    }) : (
                      <div className="py-8 text-center text-gray-400">
                        <Search className="w-6 h-6 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay facturas</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex justify-between items-center text-xs">
                    <span className="text-gray-500">Seleccionadas: <span className="font-bold text-indigo-600">{selectedInvoices.length}</span></span>
                    <button onClick={() => setSelectedInvoices(displayedInvoices)} className="text-indigo-600 font-medium">Seleccionar visibles</button>
                  </div>
                </div>

                <button
                  onClick={handleProcess}
                  disabled={loading || (selectedOrderIds.size === 0 && !useStockFisico) || selectedInvoices.length === 0}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium shadow-md shadow-indigo-200 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  Analizar y Repartir
                </button>
              </div>

              {/* ── Right Column: Results ─────────────────── */}
              <div className="lg:col-span-2 space-y-6">
                <AnimatePresence mode="popLayout">
                  {loading && (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 rounded-2xl bg-indigo-50/50 p-6">
                      <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center animate-pulse mb-4">
                        <Brain className="w-8 h-8 text-indigo-600 animate-bounce" />
                      </div>
                      <h3 className="text-xl font-bold text-indigo-900 mb-2">La IA está analizando</h3>
                      <p className="text-indigo-600 text-center max-w-sm text-sm">Procesando inventario y facturas vencidas...</p>
                    </motion.div>
                  )}

                  {!loading && aiReasoning && (
                    <motion.div key="reasoning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="bg-gradient-to-br from-violet-50 to-fuchsia-50 p-6 rounded-2xl border border-violet-100 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10"><Brain className="w-24 h-24 text-violet-600" /></div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-5 h-5 text-violet-600" />
                          <h3 className="font-bold text-violet-900">Razonamiento de la IA</h3>
                        </div>
                        <p className="text-violet-800 text-sm leading-relaxed whitespace-pre-wrap">{aiReasoning}</p>
                      </div>
                    </motion.div>
                  )}

                  {!loading && allocations.length > 0 && (
                    <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                      {/* Header */}
                      <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">Asignaciones</h2>
                          <p className="text-xs text-gray-500 mt-0.5">Ordenadas por límite de envío (más urgentes primero)</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleExportCSV} className="py-2 px-3 border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 flex items-center gap-1.5">
                            <Download className="w-3.5 h-3.5" /> CSV
                          </button>
                          <button onClick={handleSave} disabled={loading || !!successMsg} className="py-2 px-4 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-2 disabled:opacity-50">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar
                          </button>
                        </div>
                      </div>

                      {/* Results tabs */}
                      <div className="flex bg-gray-50/50 border-b border-gray-100 p-1.5 gap-1.5">
                        {[
                          { key: 'invoice', icon: FileText, label: 'Por Factura' },
                          { key: 'customer', icon: User, label: 'Por Cliente' },
                          { key: 'product', icon: Tag, label: 'Por Producto' },
                        ].map(({ key, icon: Icon, label }) => (
                          <button key={key} onClick={() => setResultsTab(key as any)}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${resultsTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>
                            <Icon className="w-3.5 h-3.5" />{label}
                          </button>
                        ))}
                      </div>

                      {/* Tab content */}
                      <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-100">

                        {/* Por Factura */}
                        {resultsTab === 'invoice' && allocationsByInvoice.map(group => {
                          const totalReq = group.items.reduce((s, i) => s + i.requestedQty, 0)
                          const totalAlloc = group.items.reduce((s, i) => s + i.allocatedQty, 0)
                          const missing = group.items.reduce((s, i) => s + (i.requestedQty - i.allocatedQty), 0)
                          const pct = totalReq > 0 ? Math.round((totalAlloc / totalReq) * 100) : 0
                          const sInfo = shippingInfo(group.shippingLimit ? new Date(group.shippingLimit).toISOString() : null)
                          // The shippingLimit here comes from AI payload which already has shippingLimit set
                          return (
                            <div key={group.folio} className="p-5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                <div>
                                  <h4 className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap text-sm">
                                    Folio: {group.folio}
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${sInfo.cls}`}>
                                      {sInfo.pastDue ? '🔴' : sInfo.daysUntil! <= 7 ? '🟡' : '🟢'} {sInfo.label}
                                    </span>
                                    {missing > 0 && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px] border border-red-100">
                                        <AlertCircle className="w-3 h-3" /> Faltan {missing}
                                      </span>
                                    )}
                                  </h4>
                                  <p className="text-xs text-gray-500 mt-0.5">{group.customerName}</p>
                                </div>
                                <div className="text-xs font-medium px-2.5 py-1 bg-green-50 text-green-700 rounded border border-green-200">
                                  {totalAlloc}/{totalReq} ({pct}%)
                                </div>
                              </div>
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase">
                                  <tr>
                                    <th className="px-3 py-1.5 text-left rounded-l">Producto</th>
                                    <th className="px-3 py-1.5 text-center w-24">Pendiente</th>
                                    <th className="px-3 py-1.5 text-center w-32 rounded-r">Asignado</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {group.items.map(alloc => (
                                    <tr key={alloc.id} className="hover:bg-white">
                                      <td className="px-3 py-2 text-gray-900 text-xs">{alloc.product}</td>
                                      <td className="px-3 py-2 text-center text-gray-500 font-mono text-xs">{alloc.requestedQty}</td>
                                      <td className="px-3 py-2 text-center">
                                        <input type="number" min={0} max={alloc.requestedQty} value={alloc.allocatedQty}
                                          onChange={e => handleQtyChange(alloc.id, parseInt(e.target.value || '0', 10))}
                                          className={`w-14 text-center border rounded py-1 px-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${alloc.manualAdjustment ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'border-gray-200'}`}
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )
                        })}

                        {/* Por Cliente */}
                        {resultsTab === 'customer' && allocationsByCustomer.map(group => {
                          const totalReq = group.items.reduce((s, i) => s + i.requestedQty, 0)
                          const totalAlloc = group.items.reduce((s, i) => s + i.allocatedQty, 0)
                          const missing = group.items.reduce((s, i) => s + (i.requestedQty - i.allocatedQty), 0)
                          return (
                            <div key={group.customerName} className="p-5">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div>
                                  <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                                    {group.customerName}
                                    {missing > 0 && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px] border border-red-100"><AlertCircle className="w-3 h-3" />Faltan {missing}</span>}
                                  </h4>
                                  <p className="text-xs text-gray-500 mt-0.5">{group.minLimit ? `Límite más urgente: ${new Date(group.minLimit).toLocaleDateString()}` : '—'}</p>
                                </div>
                                <div className="text-xs font-medium px-2.5 py-1 bg-green-50 text-green-700 rounded border border-green-200">{totalAlloc}/{totalReq}</div>
                              </div>
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase">
                                  <tr>
                                    <th className="px-3 py-1.5 text-left rounded-l">Factura</th>
                                    <th className="px-3 py-1.5">Límite Envío</th>
                                    <th className="px-3 py-1.5">Producto</th>
                                    <th className="px-3 py-1.5 text-center w-20">Pend.</th>
                                    <th className="px-3 py-1.5 text-center w-28 rounded-r">Asig.</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {group.items.map(alloc => {
                                    const si = shippingInfo(alloc.shippingLimit || null)
                                    return (
                                      <tr key={alloc.id} className="hover:bg-white">
                                        <td className="px-3 py-2 font-mono font-medium text-gray-900">{alloc.folio}</td>
                                        <td className="px-3 py-2">
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${si.cls}`}>{si.label}</span>
                                        </td>
                                        <td className="px-3 py-2 text-gray-700">{alloc.product}</td>
                                        <td className="px-3 py-2 text-center text-gray-500 font-mono">{alloc.requestedQty}</td>
                                        <td className="px-3 py-2 text-center">
                                          <input type="number" min={0} max={alloc.requestedQty} value={alloc.allocatedQty}
                                            onChange={e => handleQtyChange(alloc.id, parseInt(e.target.value || '0', 10))}
                                            className={`w-14 text-center border rounded py-1 px-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${alloc.manualAdjustment ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'border-gray-200'}`}
                                          />
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )
                        })}

                        {/* Por Producto */}
                        {resultsTab === 'product' && allocationsByProduct.map(group => {
                          const totalReceived = initialInventory[group.product] || 0
                          const currentAlloc = group.items.reduce((s, i) => s + i.allocatedQty, 0)
                          const rem = remainingInventory[group.product] || 0
                          const missing = group.items.reduce((s, i) => s + (i.requestedQty - i.allocatedQty), 0)
                          return (
                            <div key={group.product} className="p-5">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div>
                                  <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                                    {group.product}
                                    {missing > 0 && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px] border border-red-100"><AlertCircle className="w-3 h-3" />Faltan {missing}</span>}
                                  </h4>
                                  <p className="text-xs text-gray-500">Recibido: {totalReceived}</p>
                                </div>
                                <div className="flex gap-2 text-xs font-medium">
                                  <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded border border-green-200">Asig: {currentAlloc}</span>
                                  {rem > 0 && <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded border border-amber-200">Excedente: {rem}</span>}
                                </div>
                              </div>
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase">
                                  <tr>
                                    <th className="px-3 py-1.5 text-left rounded-l">Factura</th>
                                    <th className="px-3 py-1.5">Cliente</th>
                                    <th className="px-3 py-1.5">Límite Envío</th>
                                    <th className="px-3 py-1.5 text-center w-20">Pend.</th>
                                    <th className="px-3 py-1.5 text-center w-28 rounded-r">Asig.</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {group.items.map(alloc => {
                                    const si = shippingInfo(alloc.shippingLimit || null)
                                    return (
                                      <tr key={alloc.id} className="hover:bg-white">
                                        <td className="px-3 py-2 font-mono font-medium text-gray-900">{alloc.folio}</td>
                                        <td className="px-3 py-2 text-gray-600 max-w-[130px] truncate">{alloc.customerName}</td>
                                        <td className="px-3 py-2">
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${si.cls}`}>{si.label}</span>
                                        </td>
                                        <td className="px-3 py-2 text-center text-gray-500 font-mono">{alloc.requestedQty}</td>
                                        <td className="px-3 py-2 text-center">
                                          <input type="number" min={0} max={alloc.requestedQty} value={alloc.allocatedQty}
                                            onChange={e => handleQtyChange(alloc.id, parseInt(e.target.value || '0', 10))}
                                            className={`w-14 text-center border rounded py-1 px-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${alloc.manualAdjustment ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'border-gray-200'}`}
                                          />
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}

                  {!loading && allocations.length === 0 && !aiReasoning && (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="min-h-[400px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-white p-6">
                      <ShoppingCart className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="font-semibold text-gray-500">Selecciona fuentes y facturas para comenzar</p>
                      <p className="text-sm mt-1">La IA distribuirá según el límite de envío.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
