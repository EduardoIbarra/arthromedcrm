'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import {
  Save, Brain, Info, CheckCircle2, Search, Loader2, Sparkles,
  AlertCircle, Package, ShoppingCart, ChevronDown, ChevronRight,
  RefreshCw, Download, FileText, User, Tag, History, ArrowRight,
  Clock, Calendar, Warehouse, Plus, X, MessageSquare, Printer, FileSpreadsheet
} from 'lucide-react'
import Link from 'next/link'
import {
  calendarDaysDiff,
  computeDeliveryLimit,
  DELIVERY_REFERENCE_TOOLTIP,
  toIsoDate,
} from '@/lib/delivery-limit'

// ── Delivery limit (5 weeks from first payment; <60% = reference only) ──

function shippingInfoFromLimit(limitDate: Date | null, isReference: boolean) {
  if (!limitDate) {
    return { label: 'Sin primer pago', cls: 'bg-gray-100 text-gray-500 border-gray-200', pastDue: false, daysUntil: null }
  }
  const diffDays = calendarDaysDiff(new Date(), limitDate)
  if (isReference) {
    if (diffDays < 0) {
      return { label: `Ref. vencida ${Math.abs(diffDays)}d`, cls: 'bg-slate-100 text-slate-600 border-slate-200', pastDue: false, daysUntil: diffDays }
    }
    return { label: `Ref. ${diffDays}d`, cls: 'bg-sky-50 text-sky-700 border-sky-200', pastDue: false, daysUntil: diffDays }
  }
  if (diffDays < 0) {
    return { label: `Vencido ${Math.abs(diffDays)}d`, cls: 'bg-red-100 text-red-700 border-red-200', pastDue: true, daysUntil: diffDays }
  }
  if (diffDays <= 7) {
    return { label: `${diffDays}d para vencer`, cls: 'bg-amber-100 text-amber-700 border-amber-200', pastDue: false, daysUntil: diffDays }
  }
  return { label: `${diffDays}d restantes`, cls: 'bg-green-100 text-green-700 border-green-200', pastDue: false, daysUntil: diffDays }
}

function ShippingLimitBadge({ invoice }: { invoice: any }) {
  const delivery = computeDeliveryLimit(invoice)
  const info = shippingInfoFromLimit(delivery.limitDate, delivery.isReferenceOnly)
  const limit = delivery.limitDate ? delivery.limitDate.toLocaleDateString() : null
  const title = delivery.isReferenceOnly
    ? `${DELIVERY_REFERENCE_TOOLTIP}${limit ? ` · ${limit}` : ''}`
    : limit
      ? `Límite envío: ${limit}`
      : ''
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${info.cls}`} title={title}>
      {limit ? `Límite: ${limit}${delivery.isReferenceOnly ? ' (ref.)' : ''} · ` : ''}{info.label}
    </span>
  )
}

function getInvoiceShippingLimit(inv: any): string | null {
  const delivery = computeDeliveryLimit(inv)
  if (delivery.limitDate) return toIsoDate(delivery.limitDate)
  if (inv.fecha_expedicion) return toIsoDate(new Date(inv.fecha_expedicion))
  return null
}

/** Fallback for allocations that only store paymentDate string */
function shippingInfoFromPaymentDate(paymentDate: string | null, isReference = false) {
  if (!paymentDate) return shippingInfoFromLimit(null, false)
  const delivery = computeDeliveryLimit({
    primer_pago_fecha: paymentDate,
    // Unknown amount → treat as reference if caller says so, else assume qualifies
    primer_pago_monto: isReference ? 1 : 100,
    total: 100,
  })
  return shippingInfoFromLimit(delivery.limitDate, isReference || delivery.isReferenceOnly)
}

function buildAllocationFromInvoiceProduct(inv: any, fp: any, allocatedQty = 0): Allocation {
  const delivery = computeDeliveryLimit(inv)
  return {
    id: fp.id,
    folio: inv.numero_factura,
    customerName: inv.cliente_nombre,
    product: fp.producto_nombre || '',
    facturadaQty: fp.cantidad_facturada || 0,
    requestedQty: fp.cantidad_pendiente || 0,
    allocatedQty,
    paymentDate: delivery.firstPaymentDate
      ? toIsoDate(delivery.firstPaymentDate)
      : inv.fecha_pago
        ? new Date(inv.fecha_pago).toISOString()
        : null,
    shippingLimit: getInvoiceShippingLimit(inv),
    deliveryIsReference: delivery.isReferenceOnly,
  } as Allocation
}

function productRowStyle(product: string, lineColors: Record<string, string>): React.CSSProperties {
  const color = lineColors[product.trim().toLowerCase()]
  if (!color) return {}
  return {
    backgroundColor: `${color}55`,
    borderLeft: `4px solid ${color}`,
  }
}

function mergeAllocationsWithSelectedInvoices(apiAllocations: Allocation[], selectedInvoices: any[]): Allocation[] {
  const byId = new Map(apiAllocations.map(a => [a.id, a]))
  const result = [...apiAllocations]

  for (const inv of selectedInvoices) {
    const pendingProducts = (inv.factura_productos || []).filter((fp: any) => (fp.cantidad_pendiente || 0) > 0)
    for (const fp of pendingProducts) {
      if (!byId.has(fp.id)) {
        const alloc = buildAllocationFromInvoiceProduct(inv, fp, 0)
        result.push(alloc)
        byId.set(fp.id, alloc)
      }
    }
  }

  return result
}

/** Map a cotización (with productos) into the invoice-like shape used by surtido selection. */
function cotizacionToSurtidoItem(cot: any) {
  return {
    id: cot.id,
    numero_factura: cot.numero_cotizacion,
    cliente_nombre: cot.cliente_nombre,
    fecha_expedicion: cot.fecha_expedicion,
    estado_surtido: null,
    isCotizacion: true,
    planes_pago: cot.planes_pago || [],
    factura_productos: (cot.productos || []).map((p: any) => ({
      id: p.id,
      producto_nombre: p.productos?.nombre_lista || p.producto_nombre,
      producto_codigo: p.producto_codigo,
      cantidad_facturada: Number(p.cantidad) || 0,
      cantidad_pendiente: Number(p.cantidad) || 0,
      productos: p.productos || null,
    })),
  }
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
  facturadaQty: number
  requestedQty: number
  allocatedQty: number
  paymentDate?: string | null
  shippingLimit?: string | null
  deliveryIsReference?: boolean
  manualAdjustment?: boolean
  isManual?: boolean
  comment?: string
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
  /** When set, treat that order's cantidad_ordenada as available (as if fully received). */
  const [useOrderedQtyOrderIds, setUseOrderedQtyOrderIds] = useState<Set<string>>(new Set())
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

  // ── Cotizaciones modal ────────────────────────────────
  const [showCotizacionModal, setShowCotizacionModal] = useState(false)
  const [cotizacionSearch, setCotizacionSearch] = useState('')
  const [cotizacionResults, setCotizacionResults] = useState<any[]>([])
  const [isSearchingCotizaciones, setIsSearchingCotizaciones] = useState(false)
  const [isAddingCotizacion, setIsAddingCotizacion] = useState(false)

  // ── Results ───────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [remainingInventory, setRemainingInventory] = useState<Record<string, number>>({})
  const [initialInventory, setInitialInventory] = useState<Record<string, number>>({})
  const [aiReasoning, setAiReasoning] = useState('')
  const [invoiceIdFromChina, setInvoiceIdFromChina] = useState('')
  const [hasProcessed, setHasProcessed] = useState(false)
  const [addingProductFolio, setAddingProductFolio] = useState<string | null>(null)
  const [newProduct, setNewProduct] = useState({ product: '', allocatedQty: 0, comment: '' })
  const [repartitionComment, setRepartitionComment] = useState('')
  const [invoiceComments, setInvoiceComments] = useState<Record<string, string>>({})
  const [allocationsSearch, setAllocationsSearch] = useState('')
  const [productLineColors, setProductLineColors] = useState<Record<string, string>>({})
  const [isPacking, setIsPacking] = useState(false)
  const [mixFacturas, setMixFacturas] = useState(true)
  const [packedBoxes, setPackedBoxes] = useState<any[]>([])
  const [unpackedItems, setUnpackedItems] = useState<any[]>([])
  const [hasPacked, setHasPacked] = useState(false)
  const [packingError, setPackingError] = useState('')

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
        setSelectedOrderIds(new Set())
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

  // Folios starting with F or N are ignored in repartition (historical / non-delivery invoices)
  const isExcludedPrefixedFactura = (inv: any) =>
    /^[FN]/i.test(String(inv?.numero_factura || '').trim())

  // Load pending invoices + ordenes on mount
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const [res1, res2, res3, res4] = await Promise.all([
          fetch('/api/invoices?status=pagada&estado_surtido=no_surtida&pageSize=500'),
          fetch('/api/invoices?status=pagada&estado_surtido=parcial&pageSize=500'),
          fetch('/api/invoices?status=parcial&estado_surtido=no_surtida&pageSize=500'),
          fetch('/api/invoices?status=parcial&estado_surtido=parcial&pageSize=500'),
        ])
        const [d1, d2, d3, d4] = await Promise.all([res1.json(), res2.json(), res3.json(), res4.json()])
        const merged: any[] = []
        const seen = new Set<string>()
        for (const inv of [...(d1.data || []), ...(d2.data || []), ...(d3.data || []), ...(d4.data || [])]) {
          if (isExcludedPrefixedFactura(inv)) continue
          if (!seen.has(inv.id)) {
            seen.add(inv.id)
            merged.push(inv)
          }
        }
        // Sort by delivery deadline (from payment date), most urgent first
        merged.sort((a, b) => {
          const la = computeDeliveryLimit(a).limitDate
          const lb = computeDeliveryLimit(b).limitDate
          if (!la && !lb) return 0
          if (!la) return 1
          if (!lb) return -1
          return la.getTime() - lb.getTime()
        })
        setPendingInvoices(merged)
        // Default select past-due by delivery deadline (payment date + 5 weeks)
        const initialSelected = merged.filter(inv => {
          const d = computeDeliveryLimit(inv)
          if (!d.limitDate) return false
          return calendarDaysDiff(new Date(), d.limitDate) < 0
        })
        setSelectedInvoices(initialSelected)
      } catch (err) { console.error(err) }
    }
    fetchPending()
    fetchOrdenes()
  }, [])

  // Lazy-load history
  useEffect(() => {
    if (mainTab === 'historial' && history.length === 0) fetchHistory()
  }, [mainTab])

  // Invoice search (exclude F* / N* folios)
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (invoiceSearch.length < 2) { setInvoiceResults([]); return }
      setIsSearchingInvoices(true)
      try {
        const res = await fetch(`/api/invoices?search=${encodeURIComponent(invoiceSearch)}&pageSize=50`)
        const data = await res.json()
        setInvoiceResults((data.data || []).filter((inv: any) => !isExcludedPrefixedFactura(inv)))
      } catch (err) { console.error(err) }
      finally { setIsSearchingInvoices(false) }
    }, 300)
    return () => clearTimeout(delay)
  }, [invoiceSearch])

  // Cotización search (modal)
  useEffect(() => {
    if (!showCotizacionModal) return
    const delay = setTimeout(async () => {
      setIsSearchingCotizaciones(true)
      try {
        const params = new URLSearchParams()
        if (cotizacionSearch.trim()) params.set('search', cotizacionSearch.trim())
        const res = await fetch(`/api/cotizaciones?${params.toString()}`)
        const data = await res.json()
        setCotizacionResults(data.data || [])
      } catch (err) {
        console.error(err)
        setCotizacionResults([])
      } finally {
        setIsSearchingCotizaciones(false)
      }
    }, cotizacionSearch.trim() ? 300 : 0)
    return () => clearTimeout(delay)
  }, [cotizacionSearch, showCotizacionModal])

  // ─────────────────────────────────────────────────────
  // Toggles
  // ─────────────────────────────────────────────────────
  const toggleOrder = (id: string) => setSelectedOrderIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) {
      next.delete(id)
      setUseOrderedQtyOrderIds(prevU => {
        const u = new Set(prevU)
        u.delete(id)
        return u
      })
    } else {
      next.add(id)
    }
    return next
  })
  const toggleExpandOrder = (id: string) => setExpandedOrders(prev => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next
  })
  const toggleUseOrderedQty = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setUseOrderedQtyOrderIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    // Ensure order is selected when enabling "use ordered qty"
    setSelectedOrderIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }
  const toggleInvoice = (inv: any) => {
    setSelectedInvoices(prev =>
      prev.find(i => i.id === inv.id)
        ? prev.filter(i => i.id !== inv.id)
        : [...prev, inv]
    )
  }

  const openCotizacionModal = () => {
    setCotizacionSearch('')
    setCotizacionResults([])
    setShowCotizacionModal(true)
  }

  const handleSelectCotizacion = async (cotSummary: any) => {
    if (selectedInvoices.some(i => i.id === cotSummary.id)) {
      setShowCotizacionModal(false)
      return
    }
    setIsAddingCotizacion(true)
    try {
      const res = await fetch(`/api/cotizaciones/${cotSummary.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar la cotización')
      const cot = data.data
      if (!cot?.productos?.length) {
        setError('La cotización no tiene productos para surtir.')
        return
      }
      const item = cotizacionToSurtidoItem(cot)
      setSelectedInvoices(prev => {
        if (prev.some(i => i.id === item.id)) return prev
        return [...prev, item]
      })
      setShowCotizacionModal(false)
      setError('')
    } catch (err: any) {
      setError(err.message || 'Error al agregar cotización')
    } finally {
      setIsAddingCotizacion(false)
    }
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
    const hasStock = useStockFisico
    if (!hasOrders && !hasStock) { setError('Selecciona al menos una fuente de inventario.'); return }
    const facturas = selectedInvoices
      .filter(i => !i.isCotizacion && !isExcludedPrefixedFactura(i))
      .map(i => String(i.numero_factura))
    const cotizacionIds = selectedInvoices
      .filter(i => i.isCotizacion)
      .map(i => i.id)
    if (!facturas.length && !cotizacionIds.length) {
      setError('Selecciona facturas o cotizaciones a surtir.')
      return
    }

    setLoading(true); setError(''); setSuccessMsg('')
    setAllocations([]); setRemainingInventory({}); setInitialInventory({}); setAiReasoning('')
    setHasProcessed(false); setAddingProductFolio(null)
    setRepartitionComment(''); setInvoiceComments({})
    setAllocationsSearch('')
    setPackedBoxes([])
    setUnpackedItems([])
    setHasPacked(false)
    setPackingError('')

    try {
      // Ensure stock list is loaded for UI; API also reloads stock físico server-side
      let stockItems = stockFisico
      if (useStockFisico && stockItems.length === 0) {
        try {
          const resStock = await fetch('/api/stock-fisico')
          const dataStock = await resStock.json()
          stockItems = dataStock.data || []
          setStockFisico(stockItems)
        } catch { /* API will still load stock server-side */ }
      }

      const selectedStockFisico = useStockFisico
        ? stockItems.map(s => ({
            producto_id: s.producto_id,
            nombre: s.nombre,
            cantidad: s.cantidad,
          }))
        : []

      const res = await fetch('/api/imports/repartition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedOrderIds: Array.from(selectedOrderIds),
          useOrderedQtyOrderIds: Array.from(useOrderedQtyOrderIds),
          selectedStockFisico,
          useStockFisico,
          facturas,
          cotizacionIds,
          locale
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      let mergedAllocations = mergeAllocationsWithSelectedInvoices(data.allocations || [], selectedInvoices)

      // Hard cap: never show more allocated than total inventory for that product
      // (total = remaining after API + sum of API allocations)
      const invCap: Record<string, number> = { ...(data.remainingInventory || {}) }
      for (const a of mergedAllocations) {
        invCap[a.product] = (invCap[a.product] || 0) + (Number(a.allocatedQty) || 0)
      }
      const usedSoFar: Record<string, number> = {}
      mergedAllocations = mergedAllocations.map(a => {
        const cap = Math.max(0, Math.floor(Number(invCap[a.product]) || 0))
        const used = usedSoFar[a.product] || 0
        const left = Math.max(0, cap - used)
        const requested = Math.max(0, Math.floor(Number(a.allocatedQty) || 0))
        const capped = Math.min(requested, left, Math.max(0, Math.floor(Number(a.requestedQty) || 0) || requested))
        usedSoFar[a.product] = used + capped
        return capped === a.allocatedQty ? a : { ...a, allocatedQty: capped }
      })

      const remaining: Record<string, number> = {}
      for (const [product, cap] of Object.entries(invCap)) {
        remaining[product] = Math.max(0, Math.floor(Number(cap) || 0) - (usedSoFar[product] || 0))
      }

      setAllocations(mergedAllocations)
      setRemainingInventory(remaining)
      setAiReasoning(data.aiReasoning || '')
      if (data.invoiceIdFromChina) setInvoiceIdFromChina(data.invoiceIdFromChina)
      setHasProcessed(true)
      setInitialInventory(invCap)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  const syncRemainingForProduct = (allocs: Allocation[], product: string) => {
    if (!product) return
    const totalAvailable = initialInventory[product] || 0
    const totalAllocated = allocs.filter(a => a.product === product).reduce((acc, curr) => acc + curr.allocatedQty, 0)
    setRemainingInventory(prevInv => ({ ...prevInv, [product]: totalAvailable - totalAllocated }))
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
      const maxQty = oldAlloc.isManual ? maxAllowed : oldAlloc.requestedQty
      let validQty = Math.max(0, Math.min(newQty, maxAllowed, maxQty))
      copy[index] = { ...oldAlloc, allocatedQty: validQty, manualAdjustment: true }
      syncRemainingForProduct(copy, product)
      return copy
    })
  }

  const getMaxAllocatable = (product: string, allocs: Allocation[], excludeId?: string) => {
    const totalAvailable = initialInventory[product] || 0
    const totalAllocatedOther = allocs
      .filter(a => a.product === product && a.id !== excludeId)
      .reduce((acc, curr) => acc + curr.allocatedQty, 0)
    return Math.max(0, totalAvailable - totalAllocatedOther)
  }

  const availableStockProducts = useMemo(
    () => Object.keys(initialInventory)
      .filter(p => getMaxAllocatable(p, allocations) > 0)
      .sort((a, b) => a.localeCompare(b)),
    [initialInventory, allocations]
  )

  const handleAllocationCommentChange = (id: string, comment: string) => {
    setAllocations(prev => prev.map(a => a.id === id ? { ...a, comment, manualAdjustment: true } : a))
  }

  const handleInvoiceCommentChange = (folio: string, comment: string) => {
    setInvoiceComments(prev => ({ ...prev, [folio]: comment }))
  }

  const handleManualFieldChange = (id: string, field: keyof Allocation, value: string | number) => {
    setAllocations(prev => {
      const copy = [...prev]
      const index = copy.findIndex(a => a.id === id)
      if (index === -1 || !copy[index].isManual) return prev
      const oldAlloc = copy[index]
      const oldProduct = oldAlloc.product

      if (field === 'product') {
        const nextProduct = String(value)
        if (!initialInventory[nextProduct]) return prev
        copy[index] = { ...oldAlloc, product: nextProduct, allocatedQty: 0, manualAdjustment: true }
        syncRemainingForProduct(copy, oldProduct)
        syncRemainingForProduct(copy, nextProduct)
        return copy
      }

      const num = Math.max(0, Number(value) || 0)
      if (field === 'allocatedQty') {
        const totalAllocatedOther = copy.filter(a => a.product === oldAlloc.product && a.id !== id).reduce((acc, curr) => acc + curr.allocatedQty, 0)
        const totalAvailable = initialInventory[oldAlloc.product] || 0
        const maxAllowed = totalAvailable - totalAllocatedOther
        const validQty = Math.max(0, Math.min(num, maxAllowed))
        copy[index] = { ...oldAlloc, allocatedQty: validQty, manualAdjustment: true }
        syncRemainingForProduct(copy, oldAlloc.product)
        return copy
      }
      copy[index] = { ...oldAlloc, [field]: num, manualAdjustment: true }
      return copy
    })
  }

  const handleAddManualProduct = (group: { folio: string; customerName: string; paymentDate: string | null; shippingLimit: string | null }) => {
    const product = newProduct.product.trim()
    if (!product) { setError('Selecciona un producto del inventario.'); return }
    if (!initialInventory[product]) { setError('El producto debe estar disponible en el inventario procesado.'); return }
    const maxAlloc = getMaxAllocatable(product, allocations)
    if (maxAlloc <= 0) { setError(`No hay stock disponible de ${product}.`); return }
    const requestedQty = Math.max(0, newProduct.allocatedQty)
    if (requestedQty <= 0) { setError('Ingresa la cantidad a asignar.'); return }
    const allocatedQty = Math.min(requestedQty, maxAlloc)
    if (allocatedQty < requestedQty) {
      setError(`Solo hay ${maxAlloc} unidades disponibles de ${product}. Se asignaron ${allocatedQty}.`)
    }

    const alloc: Allocation = {
      id: `manual-${crypto.randomUUID()}`,
      folio: group.folio,
      customerName: group.customerName,
      product,
      facturadaQty: 0,
      requestedQty: 0,
      allocatedQty,
      paymentDate: group.paymentDate,
      shippingLimit: group.shippingLimit,
      isManual: true,
      manualAdjustment: true,
      comment: newProduct.comment.trim() || undefined,
    }

    setAllocations(prev => {
      const next = [...prev, alloc]
      syncRemainingForProduct(next, product)
      return next
    })
    setNewProduct({ product: '', allocatedQty: 0, comment: '' })
    setAddingProductFolio(null)
    if (allocatedQty >= requestedQty) setError('')
  }

  const handleRemoveManualProduct = (id: string) => {
    setAllocations(prev => {
      const removed = prev.find(a => a.id === id)
      const next = prev.filter(a => a.id !== id)
      if (removed) syncRemainingForProduct(next, removed.product)
      return next
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
        body: JSON.stringify({
          allocations,
          remainingInventory,
          aiReasoning,
          invoiceIdFromChina,
          selectedSources,
          repartitionComment,
          invoiceComments,
        }),
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

  useEffect(() => {
    if (!hasProcessed) return
    fetch('/api/products')
      .then(r => r.json())
      .then(d => {
        const map: Record<string, string> = {}
        for (const p of d.data || []) {
          if (!p.line_color) continue
          const keys = [p.nombre_lista, p.nombre, p.description].filter(Boolean) as string[]
          for (const key of keys) map[key.trim().toLowerCase()] = p.line_color
        }
        setProductLineColors(map)
      })
      .catch(err => console.error(err))
  }, [hasProcessed])

  const allocationsSearchQuery = allocationsSearch.trim().toLowerCase()

  const allocationMatchesSearch = (alloc: Allocation) => {
    if (!allocationsSearchQuery) return true
    return (
      alloc.folio.toLowerCase().includes(allocationsSearchQuery) ||
      alloc.customerName.toLowerCase().includes(allocationsSearchQuery) ||
      alloc.product.toLowerCase().includes(allocationsSearchQuery)
    )
  }

  const invoiceMatchesSearch = (folio: string, customerName: string) => {
    if (!allocationsSearchQuery) return true
    return (
      folio.toLowerCase().includes(allocationsSearchQuery) ||
      customerName.toLowerCase().includes(allocationsSearchQuery)
    )
  }

  const filteredAllocations = useMemo(
    () => allocations.filter(allocationMatchesSearch),
    [allocations, allocationsSearchQuery]
  )

  const handlePackBoxes = async () => {
    setIsPacking(true)
    setPackingError('')
    try {
      const res = await fetch('/api/imports/pack-boxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations,
          mixFacturas
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPackedBoxes(data.packedBoxes || [])
      setUnpackedItems(data.unpackedItems || [])
      setHasPacked(true)
    } catch (err: any) {
      setPackingError(err.message)
    } finally {
      setIsPacking(false)
    }
  }

  const downloadCSVReport = () => {
    if (hasPacked && packedBoxes.length > 0) {
      // Export packing details
      const headers = [
        'Caja Num',
        'Tipo Caja',
        'Dimensiones Caja (cm)',
        'Peso Max Caja (kg)',
        'Peso Actual Caja (kg)',
        'Utilizacion Vol (%)',
        'Factura Folio',
        'Cliente',
        'Producto',
        'Cantidad',
        'Peso Producto (kg)',
        'Dimensiones Estimatizadas'
      ]
      
      const rows: any[] = []
      packedBoxes.forEach((box, idx) => {
        box.items.forEach((item: any) => {
          rows.push([
            `Caja ${idx + 1}`,
            box.boxType,
            `${box.dimensions.largo}x${box.dimensions.ancho}x${box.dimensions.alto}`,
            box.maxWeight,
            box.currentWeight.toFixed(2),
            box.volumeUtilization,
            item.folio,
            item.customerName,
            item.productName,
            item.qty,
            item.weight.toFixed(2),
            item.missingDimensions ? 'SI' : 'NO'
          ])
        })
      })

      if (unpackedItems.length > 0) {
        unpackedItems.forEach((item: any) => {
          rows.push([
            'NO CABE',
            '—',
            '—',
            '—',
            '—',
            '—',
            item.folio,
            item.customerName,
            item.productName,
            1,
            item.weight.toFixed(2),
            item.missingDimensions ? 'SI' : 'NO'
          ])
        })
      }

      const csv = [headers.join(','), ...rows.map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `reporte_empaque_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      // Export normal allocations CSV
      handleExportCSV()
    }
  }

  const downloadPDFReport = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    let html = `
      <html>
        <head>
          <title>Reporte de Repartición y Empaque - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 20px; }
            h1 { font-size: 24px; margin-bottom: 5px; color: #0f172a; }
            h2 { font-size: 18px; margin-top: 25px; margin-bottom: 10px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; }
            h3 { font-size: 14px; margin-top: 15px; margin-bottom: 5px; color: #334155; }
            .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .meta-table td { padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 12px; }
            .meta-table td.label { font-weight: bold; background-color: #f8fafc; width: 150px; }
            .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
            .data-table th { background-color: #f1f5f9; font-weight: bold; text-align: left; padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 11px; text-transform: uppercase; }
            .data-table td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 11px; }
            .box-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 15px; margin-bottom: 20px; page-break-inside: avoid; }
            .box-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 10px; }
            .box-title { font-weight: bold; font-size: 14px; display: flex; align-items: center; gap: 8px; }
            .box-badge { display: inline-block; width: 12px; height: 12px; border-radius: 3px; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
            .badge-green { background-color: #dcfce7; color: #15803d; }
            .badge-amber { background-color: #fef3c7; color: #b45309; }
            .badge-red { background-color: #fee2e2; color: #b91c1c; }
            .badge-gray { background-color: #f1f5f9; color: #475569; }
            .warning-banner { background-color: #fffbeb; border: 1px solid #fde68a; color: #b45309; padding: 10px; border-radius: 6px; font-size: 11px; margin-bottom: 20px; }
            .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            @media print {
              body { margin: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <h1>Arthromed - Reporte de Repartición</h1>
              <p style="margin: 0; font-size: 12px; color: #64748b;">Generado el ${new Date().toLocaleString()}</p>
            </div>
            <button class="no-print" onclick="window.print()" style="padding: 8px 16px; background-color: #0f172a; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold;">
              Imprimir / Guardar PDF
            </button>
          </div>

          <h2>Resumen de Repartición</h2>
          <table class="meta-table">
            <tr>
              <td class="label">Comentarios generales:</td>
              <td>${repartitionComment || 'Ninguno'}</td>
            </tr>
            <tr>
              <td class="label">Total Asignaciones:</td>
              <td>${allocations.filter(a => a.allocatedQty > 0).reduce((s, a) => s + a.allocatedQty, 0)} unidades</td>
            </tr>
            <tr>
              <td class="label">Estado de Empaque:</td>
              <td>${hasPacked ? `Empacado en ${packedBoxes.length} caja(s)` : 'No empacado'}</td>
            </tr>
          </table>
    `

    if (hasPacked) {
      const missingDimsCount = unpackedItems.length + packedBoxes.reduce((acc, box) => acc + box.items.filter((i: any) => i.missingDimensions).length, 0)
      if (missingDimsCount > 0) {
        html += `
          <div class="warning-banner">
            ⚠️ <strong>Advertencia:</strong> Hay productos sin dimensiones de empaque configuradas en la base de datos. Se utilizaron tamaños estimados de 5x5x5 cm para empaque.
          </div>
        `
      }

      html += `<h2>Detalle de Empaque en Cajas</h2>`

      packedBoxes.forEach((box, idx) => {
        html += `
          <div class="box-card">
            <div class="box-header">
              <div class="box-title">
                <span class="box-badge" style="background-color: ${box.boxColor};"></span>
                Box #${idx + 1}: ${box.boxType} (${box.dimensions.largo}x${box.dimensions.ancho}x${box.dimensions.alto} cm)
              </div>
              <div style="font-size: 12px; color: #475569;">
                Peso: <strong>${box.currentWeight.toFixed(2)} kg</strong> / ${box.maxWeight} kg max | 
                Vol: <strong>${box.volumeUtilization}%</strong> util.
              </div>
            </div>
            <table class="data-table" style="margin-bottom: 0;">
              <thead>
                <tr>
                  <th>Factura / Folio</th>
                  <th>Cliente</th>
                  <th>Producto</th>
                  <th style="text-align: center; width: 60px;">Cant.</th>
                  <th style="text-align: right; width: 80px;">Peso Total</th>
                </tr>
              </thead>
              <tbody>
        `

        box.items.forEach((item: any) => {
          html += `
            <tr>
              <td>${item.folio}</td>
              <td>${item.customerName}</td>
              <td>${item.productName} ${item.missingDimensions ? '<span style="color: #b45309; font-size: 9px;">(Estimado)</span>' : ''}</td>
              <td style="text-align: center;">${item.qty}</td>
              <td style="text-align: right;">${item.weight.toFixed(2)} kg</td>
            </tr>
          `
        })

        html += `
              </tbody>
            </table>
          </div>
        `
      })

      if (unpackedItems.length > 0) {
        html += `
          <h2>Productos que no caben en ninguna caja</h2>
          <table class="data-table">
            <thead>
              <tr>
                <th>Factura / Folio</th>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Dimensiones</th>
                <th>Peso</th>
              </tr>
            </thead>
            <tbody>
        `
        unpackedItems.forEach((item: any) => {
          html += `
            <tr>
              <td>${item.folio}</td>
              <td>${item.customerName}</td>
              <td>${item.productName}</td>
              <td>${item.dimensions.largo}x${item.dimensions.ancho}x${item.dimensions.alto} cm</td>
              <td>${item.weight.toFixed(2)} kg</td>
            </tr>
          `
        })
        html += `
            </tbody>
          </table>
        `
      }
    } else {
      html += `
        <h2>Detalle de Asignaciones</h2>
        <table class="data-table">
          <thead>
            <tr>
              <th>Factura / Folio</th>
              <th>Cliente</th>
              <th>Producto</th>
              <th style="text-align: center; width: 60px;">Facturada</th>
              <th style="text-align: center; width: 60px;">Pendiente</th>
              <th style="text-align: center; width: 60px;">Asignada</th>
            </tr>
          </thead>
          <tbody>
      `
      const sorted = [...allocations].sort((a, b) => {
        if (!a.shippingLimit && !b.shippingLimit) return 0
        if (!a.shippingLimit) return 1
        if (!b.shippingLimit) return -1
        return new Date(a.shippingLimit).getTime() - new Date(b.shippingLimit).getTime()
      })
      
      sorted.forEach((a) => {
        if (a.allocatedQty <= 0) return
        html += `
          <tr>
            <td>${a.folio}</td>
            <td>${a.customerName}</td>
            <td>${a.product}</td>
            <td style="text-align: center;">${a.facturadaQty}</td>
            <td style="text-align: center;">${a.requestedQty}</td>
            <td style="text-align: center; font-weight: bold; color: #4f46e5;">${a.allocatedQty}</td>
          </tr>
        `
      })
      html += `
          </tbody>
        </table>
      `
    }

    html += `
          <div class="footer">
            Arthromed ERP - Repartición & Empaque
          </div>
          <script>
            window.addEventListener('DOMContentLoaded', () => {
              setTimeout(() => {
                window.print();
              }, 500);
            });
          </script>
        </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
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
    const groups: Record<string, { folio: string; customerName: string; paymentDate: string | null; shippingLimit: string | null; items: Allocation[] }> = {}

    for (const inv of selectedInvoices) {
      const folio = inv.numero_factura
      if (!invoiceMatchesSearch(folio, inv.cliente_nombre)) continue
      if (!groups[folio]) {
        groups[folio] = {
          folio,
          customerName: inv.cliente_nombre,
          paymentDate: inv.fecha_pago ? new Date(inv.fecha_pago).toISOString() : null,
          shippingLimit: getInvoiceShippingLimit(inv),
          items: [],
        }
      }
    }

    for (const alloc of filteredAllocations) {
      if (!groups[alloc.folio]) {
        groups[alloc.folio] = { folio: alloc.folio, customerName: alloc.customerName, paymentDate: alloc.paymentDate || null, shippingLimit: alloc.shippingLimit || null, items: [] }
      }
      groups[alloc.folio].items.push(alloc)
    }
    return Object.values(groups)
      .filter(g => g.items.length > 0 || invoiceMatchesSearch(g.folio, g.customerName))
      .sort((a, b) => {
        if (!a.shippingLimit && !b.shippingLimit) return 0
        if (!a.shippingLimit) return 1
        if (!b.shippingLimit) return -1
        return new Date(a.shippingLimit).getTime() - new Date(b.shippingLimit).getTime()
      })
  }, [filteredAllocations, selectedInvoices, allocationsSearchQuery])

  const allocationsByCustomer = useMemo(() => {
    const groups: Record<string, { customerName: string; minLimit: string | null; items: Allocation[] }> = {}

    for (const inv of selectedInvoices) {
      const name = inv.cliente_nombre
      if (!invoiceMatchesSearch(inv.numero_factura, name)) continue
      const limit = getInvoiceShippingLimit(inv)
      if (!groups[name]) {
        groups[name] = { customerName: name, minLimit: limit, items: [] }
      } else if (limit) {
        const cur = groups[name].minLimit
        if (!cur || new Date(limit) < new Date(cur)) groups[name].minLimit = limit
      }
    }

    for (const alloc of filteredAllocations) {
      if (!groups[alloc.customerName]) {
        groups[alloc.customerName] = { customerName: alloc.customerName, minLimit: alloc.shippingLimit || null, items: [] }
      } else if (alloc.shippingLimit) {
        const cur = groups[alloc.customerName].minLimit
        if (!cur || new Date(alloc.shippingLimit) < new Date(cur)) groups[alloc.customerName].minLimit = alloc.shippingLimit
      }
      groups[alloc.customerName].items.push(alloc)
    }
    return Object.values(groups)
      .filter(g => g.items.length > 0 || g.customerName.toLowerCase().includes(allocationsSearchQuery))
      .sort((a, b) => {
        if (!a.minLimit && !b.minLimit) return 0
        if (!a.minLimit) return 1
        if (!b.minLimit) return -1
        return new Date(a.minLimit).getTime() - new Date(b.minLimit).getTime()
      })
  }, [filteredAllocations, selectedInvoices, allocationsSearchQuery])

  const allocationsByProduct = useMemo(() => {
    const groups: Record<string, { product: string; items: Allocation[] }> = {}
    for (const alloc of filteredAllocations) {
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
  }, [filteredAllocations])

  // ── Displayed invoices (+ selected cotizaciones); never show F*/N* facturas ──
  const displayedInvoicesMap = new Map<string, any>()
  pendingInvoices.forEach(inv => {
    if (!isExcludedPrefixedFactura(inv)) displayedInvoicesMap.set(inv.id, inv)
  })
  selectedInvoices.forEach(inv => {
    if (inv.isCotizacion || !isExcludedPrefixedFactura(inv)) displayedInvoicesMap.set(inv.id, inv)
  })
  invoiceResults.forEach(inv => {
    if (!isExcludedPrefixedFactura(inv)) displayedInvoicesMap.set(inv.id, inv)
  })
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
  const totalSelRecibido = selectedOrdenesData.reduce((s, o) => {
    // If "use ordered qty" is on for this order, count as fully received for the summary
    if (useOrderedQtyOrderIds.has(o.id)) return s + o.total_ordenado
    return s + o.total_recibido
  }, 0)

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
              <p className="text-sm font-medium">
                Prioridad estricta por <strong>fecha de pago</strong> y <strong>límite de entrega</strong> (sin mínimo de repartición).
                Se ignoran facturas con folio que empieza en <strong>F</strong> o <strong>N</strong>.
              </p>
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
                        const useOrdered = useOrderedQtyOrderIds.has(orden.id)
                        const displayRecibido = useOrdered ? orden.total_ordenado : orden.total_recibido
                        const incomplete = orden.total_recibido < orden.total_ordenado
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
                                  <span className={`text-[10px] font-mono px-1 py-0.5 rounded border ${
                                    useOrdered
                                      ? 'text-violet-700 bg-violet-50 border-violet-200'
                                      : incomplete
                                        ? 'text-amber-700 bg-amber-50 border-amber-200'
                                        : 'text-green-700 bg-green-50 border-green-200'
                                  }`}>
                                    ({displayRecibido}/{orden.total_ordenado})
                                    {useOrdered && incomplete ? ' *' : ''}
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-500 truncate">{orden.proveedor || '—'}</p>
                                {incomplete && (
                                  <label
                                    className="mt-1.5 flex items-center gap-1.5 text-[10px] text-violet-700 cursor-pointer select-none w-fit"
                                    onClick={e => toggleUseOrderedQty(orden.id, e)}
                                  >
                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${useOrdered ? 'bg-violet-600 border-violet-600 text-white' : 'border-violet-300 bg-white'}`}>
                                      {useOrdered && <CheckCircle2 className="w-2.5 h-2.5" />}
                                    </div>
                                    Usar cantidad ordenada ({orden.total_ordenado}/{orden.total_ordenado})
                                  </label>
                                )}
                              </div>
                              <button onClick={e => { e.stopPropagation(); toggleExpandOrder(orden.id) }} className="text-gray-400 p-0.5">
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              </button>
                            </div>
                            {isExpanded && (
                              <div className="px-3 pb-2 bg-gray-50/50 border-t border-gray-100">
                                {orden.productos.map(p => {
                                  const rec = useOrdered ? p.cantidad_ordenada : (p.cantidad_recibida || 0)
                                  return (
                                    <div key={p.id} className="flex justify-between text-[10px] gap-2 py-0.5">
                                      <span className="text-gray-600 truncate">{p.producto_nombre}</span>
                                      <span className={`font-mono shrink-0 ${
                                        useOrdered
                                          ? 'text-violet-700'
                                          : rec < p.cantidad_ordenada
                                            ? 'text-amber-700'
                                            : 'text-green-700'
                                      }`}>
                                        ({rec}/{p.cantidad_ordenada})
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="px-4 pb-3 flex justify-between items-center">
                      <span className="text-[10px] text-gray-500">
                        {selectedOrderIds.size}/{ordenes.length} seleccionadas
                        {useOrderedQtyOrderIds.size > 0 && (
                          <span className="text-violet-600"> · {useOrderedQtyOrderIds.size} con qty ordenada</span>
                        )}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedOrderIds(new Set(ordenes.map(o => o.id)))} className="text-[10px] text-indigo-600 font-medium">Todas</button>
                        <span className="text-gray-300">|</span>
                        <button onClick={() => { setSelectedOrderIds(new Set()); setUseOrderedQtyOrderIds(new Set()) }} className="text-[10px] text-gray-500 font-medium">Ninguna</button>
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
                          ) : filteredStock.map((item, idx) => (
                            <div key={`${item.producto_id}-${idx}`} className="flex justify-between items-center px-3 py-2 text-xs">
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
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Facturas a surtir</h2>
                      <p className="text-xs text-gray-500 mt-1">Las facturas no vencidas se cargarán desmarcadas por defecto.</p>
                    </div>
                    <button
                      type="button"
                      onClick={openCotizacionModal}
                      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Cotización
                    </button>
                  </div>

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
                      const isSelected = !!selectedInvoices.find(i => i.id === inv.id)
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
                              {inv.isCotizacion ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-violet-50 text-violet-700 border-violet-200">
                                  Cotización
                                </span>
                              ) : (
                                <>
                                  <ShippingLimitBadge invoice={inv} />
                                  {surtidoBadge(inv.estado_surtido)}
                                </>
                              )}
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
                    <button
                      type="button"
                      onClick={() => setSelectedInvoices(displayedInvoices.filter((i: any) => !i.isCotizacion).concat(selectedInvoices.filter(i => i.isCotizacion)))}
                      className="text-indigo-600 font-medium"
                    >
                      Seleccionar visibles
                    </button>
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
                      <p className="text-indigo-600 text-center max-w-sm text-sm">Procesando inventario y asignación de facturas...</p>
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

                  {!loading && hasProcessed && (
                    <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                      {/* Header */}
                      <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">Asignaciones</h2>
                          <p className="text-xs text-gray-500 mt-0.5">Ordenadas por límite de entrega / fecha de pago (más urgentes primero)</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={downloadPDFReport} className="py-2 px-3 border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 flex items-center gap-1.5">
                            <Printer className="w-3.5 h-3.5" /> PDF
                          </button>
                          <button onClick={downloadCSVReport} className="py-2 px-3 border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 flex items-center gap-1.5">
                            <Download className="w-3.5 h-3.5" /> CSV
                          </button>
                          <button onClick={handleSave} disabled={loading || !!successMsg} className="py-2 px-4 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-2 disabled:opacity-50">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar
                          </button>
                        </div>
                      </div>

                      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/40">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                          <MessageSquare className="w-3.5 h-3.5" /> Comentarios de la repartición
                        </label>
                        <textarea
                          value={repartitionComment}
                          onChange={e => setRepartitionComment(e.target.value)}
                          rows={2}
                          placeholder="Notas generales sobre esta repartición..."
                          className="w-full border border-gray-200 rounded-lg py-2 px-3 text-xs outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                        />
                      </div>

                      {/* Box Packing controls */}
                      <div className="px-5 py-4 border-b border-gray-100 bg-indigo-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                            <Package className="w-4 h-4 text-indigo-600" /> Empaque en Cajas
                          </h3>
                          <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer mt-1">
                            <input
                              type="checkbox"
                              checked={mixFacturas}
                              onChange={(e) => {
                                setMixFacturas(e.target.checked);
                                if (hasPacked) {
                                  // Re-pack automatically on change
                                  setTimeout(() => handlePackBoxes(), 50);
                                }
                              }}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            Permitir mezclar facturas del mismo cliente en la misma caja
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handlePackBoxes}
                            disabled={isPacking}
                            className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            {isPacking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                            {hasPacked ? 'Recalcular Empaque' : 'Calcular Empaque'}
                          </button>
                        </div>
                      </div>

                      {packingError && (
                        <div className="px-5 py-3 border-b border-gray-100 bg-red-50 text-red-700 text-xs">
                          ⚠️ Error al empacar: {packingError}
                        </div>
                      )}

                      {/* Box packing results */}
                      {hasPacked && (
                        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-gray-800">Resultado de Empaque ({packedBoxes.length} cajas)</h4>
                            {unpackedItems.length > 0 && (
                              <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-medium border border-red-200">
                                Warning: {unpackedItems.length} items no caben en ninguna caja
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {packedBoxes.map((box, idx) => {
                              const missingDimsCount = box.items.filter((i: any) => i.missingDimensions).length
                              return (
                                <div key={box.boxId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                                  <div className="h-2" style={{ backgroundColor: box.boxColor }} />
                                  <div className="p-4 flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <h5 className="font-bold text-gray-900 text-xs sm:text-sm">
                                          Caja #{idx + 1}: {box.boxType}
                                        </h5>
                                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                          {box.dimensions.largo} x {box.dimensions.ancho} x {box.dimensions.alto} cm
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <span className="inline-block text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                                          {box.currentWeight.toFixed(2)} kg / {box.maxWeight} kg max
                                        </span>
                                      </div>
                                    </div>

                                    {/* Volume utilization progress bar */}
                                    <div className="mb-3">
                                      <div className="flex justify-between items-center text-[10px] text-gray-500 mb-1">
                                        <span>Utilización de Volumen</span>
                                        <span className="font-bold">{box.volumeUtilization}%</span>
                                      </div>
                                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                                        <div
                                          className="bg-indigo-600 h-1.5 rounded-full"
                                          style={{ width: `${Math.min(100, box.volumeUtilization)}%` }}
                                        />
                                      </div>
                                    </div>

                                    {/* Warning for missing dimensions */}
                                    {missingDimsCount > 0 && (
                                      <div className="mb-2 p-1.5 bg-amber-50 text-amber-850 rounded border border-amber-100 text-[10px] flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        <span>{missingDimsCount} item(s) con dimensiones estimadas</span>
                                      </div>
                                    )}

                                    {/* Items inside */}
                                    <div className="divide-y divide-gray-50 max-h-40 overflow-y-auto border border-gray-50 rounded-lg">
                                      {box.items.map((item: any, iIdx: number) => (
                                        <div key={iIdx} className="py-1.5 px-2 flex justify-between items-center text-xs">
                                          <div className="min-w-0 flex-1 mr-2">
                                            <p className="font-medium text-gray-800 truncate">{item.productName}</p>
                                            <p className="text-[9px] text-gray-400">
                                              Factura: {item.folio} · Cliente: {item.customerName}
                                            </p>
                                          </div>
                                          <span className="bg-gray-100 text-gray-700 font-bold px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0">
                                            x{item.qty}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}

                            {unpackedItems.length > 0 && (
                              <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-4 col-span-1 md:col-span-2">
                                <h5 className="font-bold text-red-900 text-xs sm:text-sm flex items-center gap-2 mb-2">
                                  <AlertCircle className="w-4 h-4 text-red-600" /> Productos que no caben en ninguna caja
                                </h5>
                                <div className="divide-y divide-red-100 border border-red-100 rounded-lg bg-white overflow-hidden">
                                  {unpackedItems.map((item: any, iIdx: number) => (
                                    <div key={iIdx} className="py-2 px-3 flex justify-between items-center text-xs">
                                      <div>
                                        <p className="font-semibold text-gray-900">{item.productName}</p>
                                        <p className="text-[10px] text-gray-500">
                                          Dimensiones: {item.dimensions.largo}x{item.dimensions.ancho}x{item.dimensions.alto} cm · Peso: {item.weight} kg
                                        </p>
                                      </div>
                                      <span className="text-red-700 font-medium bg-red-50 px-2 py-0.5 rounded text-[10px]">
                                        Factura: {item.folio}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="px-5 py-3 border-b border-gray-100">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={allocationsSearch}
                            onChange={e => setAllocationsSearch(e.target.value)}
                            placeholder="Buscar por factura, cliente o producto..."
                            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                          />
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
                          const sInfo = shippingInfoFromPaymentDate(
                            group.paymentDate ? new Date(group.paymentDate).toISOString() : null,
                            !!(group as any).deliveryIsReference
                          )
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
                              <div className="mb-3">
                                <label className="text-[10px] text-gray-500 block mb-0.5">Comentarios de la factura</label>
                                <textarea
                                  value={invoiceComments[group.folio] || ''}
                                  onChange={e => handleInvoiceCommentChange(group.folio, e.target.value)}
                                  rows={2}
                                  placeholder="Notas para esta factura..."
                                  className="w-full border border-gray-200 rounded-lg py-1.5 px-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                                />
                              </div>
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase">
                                  <tr>
                                    <th className="px-3 py-1.5 text-left rounded-l">Producto</th>
                                    <th className="px-3 py-1.5 text-center w-20">Límite Envío</th>
                                    <th className="px-3 py-1.5 text-center w-20">Facturada</th>
                                    <th className="px-3 py-1.5 text-center w-24">Pendiente</th>
                                    <th className="px-3 py-1.5 text-center w-24">Asignado</th>
                                    <th className="px-3 py-1.5 text-left rounded-r">Comentario</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {group.items.length === 0 && (
                                    <tr>
                                      <td colSpan={6} className="px-3 py-3 text-center text-xs text-gray-400">Sin productos asignados</td>
                                    </tr>
                                  )}
                                  {group.items.map(alloc => (
                                    <tr key={alloc.id} className="hover:brightness-[0.98] transition-all" style={productRowStyle(alloc.product, productLineColors)}>
                                      <td className="px-3 py-2 text-gray-900 text-xs font-medium">
                                        {alloc.isManual ? (
                                          <div className="flex items-center gap-1">
                                            <select
                                              value={alloc.product}
                                              onChange={e => handleManualFieldChange(alloc.id, 'product', e.target.value)}
                                              className="w-full border border-gray-200 rounded py-1 px-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                                            >
                                              <option value="">Seleccionar...</option>
                                              {availableStockProducts.map(p => (
                                                <option key={p} value={p}>
                                                  {p} ({remainingInventory[p] ?? 0} disp.)
                                                </option>
                                              ))}
                                            </select>
                                            <button onClick={() => handleRemoveManualProduct(alloc.id)} className="text-gray-400 hover:text-red-600 shrink-0" title="Eliminar">
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            {alloc.product}
                                            {alloc.allocatedQty < alloc.requestedQty && (
                                              <span className="ml-1.5 text-[11px] font-bold text-rose-600">({alloc.allocatedQty - alloc.requestedQty})</span>
                                            )}
                                          </>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-center text-gray-400 font-mono text-xs">{alloc.shippingLimit ? new Date(alloc.shippingLimit).toLocaleDateString() : '—'}</td>
                                      <td className="px-3 py-2 text-center text-gray-400 font-mono text-xs">{alloc.isManual ? '—' : (alloc.facturadaQty ?? '—')}</td>
                                      <td className="px-3 py-2 text-center text-gray-500 font-mono text-xs">{alloc.isManual ? '—' : alloc.requestedQty}</td>
                                      <td className="px-3 py-2 text-center">
                                        <input type="number" min={0} max={alloc.isManual ? getMaxAllocatable(alloc.product, allocations, alloc.id) : alloc.requestedQty} value={alloc.allocatedQty}
                                          onChange={e => alloc.isManual
                                            ? handleManualFieldChange(alloc.id, 'allocatedQty', parseInt(e.target.value || '0', 10))
                                            : handleQtyChange(alloc.id, parseInt(e.target.value || '0', 10))}
                                          className={`w-14 text-center border rounded py-1 px-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${alloc.manualAdjustment ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'border-gray-200'}`}
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="text"
                                          value={alloc.comment || ''}
                                          onChange={e => handleAllocationCommentChange(alloc.id, e.target.value)}
                                          placeholder="Comentario..."
                                          className="w-full border border-gray-200 rounded py-1 px-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                  <tr className="bg-gray-50/50">
                                    <td colSpan={6} className="px-3 py-2">
                                      {addingProductFolio === group.folio ? (
                                        <div className="flex flex-wrap items-end gap-2">
                                          <div className="flex-1 min-w-[160px]">
                                            <label className="text-[10px] text-gray-500 block mb-0.5">Producto (inventario)</label>
                                            <select
                                              value={newProduct.product}
                                              onChange={e => {
                                                const product = e.target.value
                                                const max = product ? getMaxAllocatable(product, allocations) : 0
                                                setNewProduct(p => ({
                                                  ...p,
                                                  product,
                                                  allocatedQty: Math.min(p.allocatedQty, max),
                                                }))
                                              }}
                                              className="w-full border border-gray-200 rounded py-1 px-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                                            >
                                              <option value="">Seleccionar producto...</option>
                                              {availableStockProducts.map(p => (
                                                <option key={p} value={p}>
                                                  {p} ({getMaxAllocatable(p, allocations)} disp.)
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-gray-500 block mb-0.5">
                                              Asignado{newProduct.product ? ` (máx. ${getMaxAllocatable(newProduct.product, allocations)})` : ''}
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              max={newProduct.product ? getMaxAllocatable(newProduct.product, allocations) : undefined}
                                              value={newProduct.allocatedQty}
                                              onChange={e => {
                                                const raw = parseInt(e.target.value || '0', 10)
                                                const max = newProduct.product ? getMaxAllocatable(newProduct.product, allocations) : raw
                                                setNewProduct(p => ({ ...p, allocatedQty: Math.min(Math.max(0, raw), max) }))
                                              }}
                                              className="w-16 text-center border border-gray-200 rounded py-1 px-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                          </div>
                                          <div className="flex-1 min-w-[140px]">
                                            <label className="text-[10px] text-gray-500 block mb-0.5">Comentario</label>
                                            <input type="text" value={newProduct.comment} onChange={e => setNewProduct(p => ({ ...p, comment: e.target.value }))}
                                              className="w-full border border-gray-200 rounded py-1 px-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500" />
                                          </div>
                                          <button onClick={() => handleAddManualProduct(group)} disabled={!newProduct.product || !newProduct.allocatedQty || availableStockProducts.length === 0} className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">Agregar</button>
                                          <button onClick={() => { setAddingProductFolio(null); setNewProduct({ product: '', allocatedQty: 0, comment: '' }) }} className="px-2.5 py-1 border border-gray-200 text-gray-600 rounded text-xs hover:bg-gray-100">Cancelar</button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setAddingProductFolio(group.folio)}
                                          disabled={availableStockProducts.length === 0}
                                          className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          <Plus className="w-3.5 h-3.5" /> Agregar producto del inventario
                                        </button>
                                      )}
                                    </td>
                                  </tr>
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
                                    <th className="px-3 py-1.5 text-center w-16">Fact.</th>
                                    <th className="px-3 py-1.5 text-center w-20">Pend.</th>
                                    <th className="px-3 py-1.5 text-center w-24">Asig.</th>
                                    <th className="px-3 py-1.5 text-left rounded-r">Comentario</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {group.items.length === 0 && (
                                    <tr>
                                      <td colSpan={7} className="px-3 py-3 text-center text-xs text-gray-400">Sin productos asignados</td>
                                    </tr>
                                  )}
                                  {group.items.map(alloc => {
                                    const si = shippingInfoFromPaymentDate(
                                      alloc.paymentDate || null,
                                      !!(alloc as any).deliveryIsReference
                                    )
                                    return (
                                      <tr key={alloc.id} className="hover:brightness-[0.98] transition-all" style={productRowStyle(alloc.product, productLineColors)}>
                                        <td className="px-3 py-2 font-mono font-medium text-gray-900">{alloc.folio}</td>
                                        <td className="px-3 py-2">
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${si.cls}`}>{si.label}</span>
                                        </td>
                                        <td className="px-3 py-2 text-gray-700 font-medium">
                                          {alloc.product}
                                          {alloc.isManual && <span className="ml-1 text-[10px] text-indigo-600">(extra)</span>}
                                          {alloc.allocatedQty < alloc.requestedQty && (
                                            <span className="ml-1.5 text-[11px] font-bold text-rose-600">({alloc.allocatedQty - alloc.requestedQty})</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-center text-gray-400 font-mono">{alloc.isManual ? '—' : (alloc.facturadaQty ?? '—')}</td>
                                        <td className="px-3 py-2 text-center text-gray-500 font-mono">{alloc.isManual ? '—' : alloc.requestedQty}</td>
                                        <td className="px-3 py-2 text-center">
                                          <input type="number" min={0} max={alloc.isManual ? getMaxAllocatable(alloc.product, allocations, alloc.id) : alloc.requestedQty} value={alloc.allocatedQty}
                                            onChange={e => alloc.isManual
                                              ? handleManualFieldChange(alloc.id, 'allocatedQty', parseInt(e.target.value || '0', 10))
                                              : handleQtyChange(alloc.id, parseInt(e.target.value || '0', 10))}
                                            className={`w-14 text-center border rounded py-1 px-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${alloc.manualAdjustment ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'border-gray-200'}`}
                                          />
                                        </td>
                                        <td className="px-3 py-2">
                                          <input
                                            type="text"
                                            value={alloc.comment || ''}
                                            onChange={e => handleAllocationCommentChange(alloc.id, e.target.value)}
                                            placeholder="Comentario..."
                                            className="w-full border border-gray-200 rounded py-1 px-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
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
                            <div key={group.product} className="p-5" style={productRowStyle(group.product, productLineColors)}>
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
                                    <th className="px-3 py-1.5 text-center w-16">Fact.</th>
                                    <th className="px-3 py-1.5 text-center w-20">Pend.</th>
                                    <th className="px-3 py-1.5 text-center w-24">Asig.</th>
                                    <th className="px-3 py-1.5 text-left rounded-r">Comentario</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {group.items.map(alloc => {
                                    const si = shippingInfoFromPaymentDate(
                                      alloc.paymentDate || null,
                                      !!(alloc as any).deliveryIsReference
                                    )
                                    return (
                                      <tr key={alloc.id} className="hover:brightness-[0.98] transition-all" style={productRowStyle(alloc.product, productLineColors)}>
                                        <td className="px-3 py-2 font-mono font-medium text-gray-900">
                                          {alloc.folio}
                                          {alloc.isManual && <span className="ml-1 text-[10px] text-indigo-600">(extra)</span>}
                                          {alloc.allocatedQty < alloc.requestedQty && (
                                            <span className="ml-1.5 text-[11px] font-bold text-rose-600">({alloc.allocatedQty - alloc.requestedQty})</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600 max-w-[130px] truncate">{alloc.customerName}</td>
                                        <td className="px-3 py-2">
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${si.cls}`}>{si.label}</span>
                                        </td>
                                        <td className="px-3 py-2 text-center text-gray-400 font-mono">{alloc.isManual ? '—' : (alloc.facturadaQty ?? '—')}</td>
                                        <td className="px-3 py-2 text-center text-gray-500 font-mono">{alloc.isManual ? '—' : alloc.requestedQty}</td>
                                        <td className="px-3 py-2 text-center">
                                          <input type="number" min={0} max={alloc.isManual ? getMaxAllocatable(alloc.product, allocations, alloc.id) : alloc.requestedQty} value={alloc.allocatedQty}
                                            onChange={e => alloc.isManual
                                              ? handleManualFieldChange(alloc.id, 'allocatedQty', parseInt(e.target.value || '0', 10))
                                              : handleQtyChange(alloc.id, parseInt(e.target.value || '0', 10))}
                                            className={`w-14 text-center border rounded py-1 px-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${alloc.manualAdjustment ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'border-gray-200'}`}
                                          />
                                        </td>
                                        <td className="px-3 py-2">
                                          <input
                                            type="text"
                                            value={alloc.comment || ''}
                                            onChange={e => handleAllocationCommentChange(alloc.id, e.target.value)}
                                            placeholder="Comentario..."
                                            className="w-full border border-gray-200 rounded py-1 px-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
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

                  {!loading && !hasProcessed && (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="min-h-[400px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-white p-6">
                      <ShoppingCart className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="font-semibold text-gray-500">Selecciona fuentes y facturas para comenzar</p>
                      <p className="text-sm mt-1">La asignación usará solo fecha de pago y límite de entrega.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        open={showCotizacionModal}
        onClose={() => !isAddingCotizacion && setShowCotizacionModal(false)}
        title="Agregar cotización al surtido"
        maxWidth="560px"
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Busca por número de cotización, cliente o RFC. La cotización se incluirá en el análisis de repartición junto con las facturas.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              autoFocus
              placeholder="Buscar cotización..."
              value={cotizacionSearch}
              onChange={e => setCotizacionSearch(e.target.value)}
              className="erp-input pl-10 w-full"
              disabled={isAddingCotizacion}
            />
            {isSearchingCotizaciones && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
            )}
          </div>

          <div className="border border-gray-100 rounded-xl overflow-y-auto divide-y divide-gray-50 bg-gray-50/40 max-h-[340px]">
            {isAddingCotizacion ? (
              <div className="py-10 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
                Cargando cotización...
              </div>
            ) : isSearchingCotizaciones && cotizacionResults.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">Buscando...</div>
            ) : cotizacionResults.length > 0 ? (
              cotizacionResults.map((cot: any) => {
                const already = selectedInvoices.some(i => i.id === cot.id)
                return (
                  <button
                    key={cot.id}
                    type="button"
                    disabled={already || isAddingCotizacion}
                    onClick={() => handleSelectCotizacion(cot)}
                    className={`w-full text-left p-3 flex items-start gap-3 transition-colors ${
                      already
                        ? 'bg-violet-50/60 opacity-70 cursor-default'
                        : 'bg-white hover:bg-violet-50/40'
                    }`}
                  >
                    <div className="mt-0.5 w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900">{cot.numero_cotizacion}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-gray-50 text-gray-600 border-gray-200">
                          {cot.estado || 'pendiente'}
                        </span>
                        {already && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-violet-100 text-violet-700 border-violet-200">
                            Ya agregada
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{cot.cliente_nombre}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {cot.fecha_expedicion
                          ? new Date(cot.fecha_expedicion).toLocaleDateString()
                          : '—'}
                        {cot.total != null ? ` · $${Number(cot.total).toLocaleString('es-MX')}` : ''}
                      </p>
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="py-10 text-center text-gray-400">
                <Search className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {cotizacionSearch.trim()
                    ? 'Sin resultados'
                    : 'Escribe para buscar o espera la lista reciente'}
                </p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}
