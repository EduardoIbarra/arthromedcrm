'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import {
  Save, Brain, Info, CheckCircle2, Search, Loader2, Sparkles,
  AlertCircle, Package, ShoppingCart, ChevronDown, ChevronRight,
  RefreshCw, Download, FileText, User, Tag
} from 'lucide-react'

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
  fecha_esperada: string | null
  estado: string | null
  observaciones: string | null
  created_at: string | null
  productos: OrdenProducto[]
  total_ordenado: number
  total_recibido: number
}

interface Allocation {
  id: string
  folio: string
  customerName: string
  product: string
  requestedQty: number
  allocatedQty: number
  paymentDate?: string | null
  manualAdjustment?: boolean
}

export default function ImportRepartitionPage() {
  const { t, locale } = useI18n()

  // ── Tab state for grouping results ─────────────────────
  const [activeTab, setActiveTab] = useState<'invoice' | 'customer' | 'product'>('invoice')

  // ── Ordenes de compra (segunda DB) ──────────────────────
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [loadingOrdenes, setLoadingOrdenes] = useState(true)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())

  // ── Facturas a surtir ───────────────────────────────────
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [invoiceResults, setInvoiceResults] = useState<any[]>([])
  const [isSearchingInvoices, setIsSearchingInvoices] = useState(false)
  const [selectedInvoices, setSelectedInvoices] = useState<any[]>([])
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([])

  // ── Process results ──────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [remainingInventory, setRemainingInventory] = useState<Record<string, number>>({})
  const [initialInventory, setInitialInventory] = useState<Record<string, number>>({})
  const [aiReasoning, setAiReasoning] = useState<string>('')
  const [invoiceIdFromChina, setInvoiceIdFromChina] = useState<string>('')

  // ── Load ordenes de compra ───────────────────────────────
  const fetchOrdenes = async () => {
    setLoadingOrdenes(true)
    try {
      const res = await fetch('/api/ordenes-compra')
      const data = await res.json()
      if (data.data) {
        setOrdenes(data.data)
        // Check all by default
        setSelectedOrderIds(new Set(data.data.map((o: OrdenCompra) => o.id)))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingOrdenes(false)
    }
  }

  // ── Load facturas (no_surtida + parcial) ─────────────────
  useEffect(() => {
    const fetchPending = async () => {
      try {
        // Fetch no_surtida
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
        // Sort: earliest payment date (fecha_pago) first. Unpaid invoices to the end
        merged.sort((a, b) => {
          if (a.fecha_pago && b.fecha_pago) {
            return new Date(a.fecha_pago).getTime() - new Date(b.fecha_pago).getTime()
          }
          if (a.fecha_pago) return -1
          if (b.fecha_pago) return 1
          return new Date(a.fecha_expedicion).getTime() - new Date(b.fecha_expedicion).getTime()
        })
        setPendingInvoices(merged)
        setSelectedInvoices(merged)
      } catch (err) {
        console.error(err)
      }
    }
    fetchPending()
    fetchOrdenes()
  }, [])

  // ── Invoice search ───────────────────────────────────────
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (invoiceSearch.length < 2) {
        setInvoiceResults([])
        return
      }
      setIsSearchingInvoices(true)
      try {
        const isMultiple = invoiceSearch.includes(',')
        const size = isMultiple ? 100 : 5
        const res = await fetch(`/api/invoices?search=${encodeURIComponent(invoiceSearch)}&pageSize=${size}`)
        const data = await res.json()
        const results = data.data || []
        setInvoiceResults(results)
        if (isMultiple && results.length > 0) {
          const terms = invoiceSearch.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean)
          const cleanedTerms = terms.map((s: string) => s.replace(/^F-/i, ''))
          const matches = results.filter((inv: any) => {
            const folUpper = String(inv.numero_factura).toUpperCase()
            return terms.includes(folUpper) || cleanedTerms.some((t: string) => folUpper.includes(t))
          })
          if (matches.length > 0) {
            setSelectedInvoices(prev => {
              const newSel = [...prev]
              matches.forEach((m: any) => {
                if (!newSel.find(i => i.numero_factura === m.numero_factura)) newSel.push(m)
              })
              return newSel
            })
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsSearchingInvoices(false)
      }
    }, 300)
    return () => clearTimeout(delay)
  }, [invoiceSearch])

  // ── Toggle helpers ───────────────────────────────────────
  const toggleOrder = (id: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleExpandOrder = (id: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleInvoice = (invoice: any) => {
    if (selectedInvoices.find(i => i.numero_factura === invoice.numero_factura)) {
      setSelectedInvoices(prev => prev.filter(i => i.numero_factura !== invoice.numero_factura))
    } else {
      setSelectedInvoices(prev => [...prev, invoice])
    }
  }

  // ── Process ──────────────────────────────────────────────
  const handleProcess = async () => {
    if (selectedOrderIds.size === 0) {
      setError('Selecciona al menos una orden de compra.')
      return
    }
    const facturas = selectedInvoices.map(i => String(i.numero_factura))
    if (facturas.length === 0) {
      setError(t('invoicesToFulfill'))
      return
    }

    setLoading(true)
    setError('')
    setSuccessMsg('')
    setAllocations([])
    setRemainingInventory({})
    setInitialInventory({})
    setAiReasoning('')
    setInvoiceIdFromChina('')

    try {
      const res = await fetch('/api/imports/repartition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedOrderIds: Array.from(selectedOrderIds), facturas, locale }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error processing repartition')

      setAllocations(data.allocations || [])
      setRemainingInventory(data.remainingInventory || {})
      setAiReasoning(data.aiReasoning || '')
      if (data.invoiceIdFromChina) setInvoiceIdFromChina(data.invoiceIdFromChina)

      // Build initial inventory from allocations + remaining
      const initInv: Record<string, number> = { ...data.remainingInventory }
      data.allocations?.forEach((a: Allocation) => {
        initInv[a.product] = (initInv[a.product] || 0) + a.allocatedQty
      })
      setInitialInventory(initInv)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
      let validQty = Math.max(0, Math.min(newQty, maxAllowed))
      validQty = Math.min(validQty, oldAlloc.requestedQty)
      copy[index] = { ...oldAlloc, allocatedQty: validQty, manualAdjustment: true }
      const newTotalAllocated = totalAllocatedOther + validQty
      setRemainingInventory(prevInv => ({ ...prevInv, [product]: totalAvailable - newTotalAllocated }))
      return copy
    })
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/imports/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations, remainingInventory, aiReasoning, invoiceIdFromChina }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error saving allocations')
      setSuccessMsg(t('saveAllocationSuccess'))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── CSV Export ───────────────────────────────────────────
  const handleExportCSV = () => {
    if (allocations.length === 0) return

    // Sort allocations by payment date (earliest first, nulls last)
    const sorted = [...allocations].sort((a, b) => {
      if (!a.paymentDate && !b.paymentDate) return 0
      if (!a.paymentDate) return 1
      if (!b.paymentDate) return -1
      return new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
    })

    const headers = ['Folio Factura', 'Cliente', 'Fecha de Pago', 'Producto', 'Cantidad Pendiente', 'Cantidad Asignada']
    const rows = sorted.map(a => [
      a.folio,
      a.customerName,
      a.paymentDate ? new Date(a.paymentDate).toLocaleDateString() : 'Sin Pago',
      a.product,
      a.requestedQty,
      a.allocatedQty
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    // Add BOM for proper UTF-8 formatting in Excel
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `reparticion_asignaciones_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ── Grouped Computations ─────────────────────────────────
  
  // 1. Grouped by Invoice (Sorted by paymentDate: earliest first, nulls last)
  const allocationsByInvoice = React.useMemo(() => {
    const groups: Record<string, { folio: string; customerName: string; paymentDate: string | null; items: Allocation[] }> = {}
    for (const alloc of allocations) {
      if (!groups[alloc.folio]) {
        groups[alloc.folio] = {
          folio: alloc.folio,
          customerName: alloc.customerName,
          paymentDate: alloc.paymentDate || null,
          items: []
        }
      }
      groups[alloc.folio].items.push(alloc)
    }

    return Object.values(groups).sort((a, b) => {
      if (!a.paymentDate && !b.paymentDate) return 0
      if (!a.paymentDate) return 1
      if (!b.paymentDate) return -1
      return new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
    })
  }, [allocations])

  // 2. Grouped by Customer (Sorted by earliest paymentDate of customer's invoices)
  const allocationsByCustomer = React.useMemo(() => {
    const groups: Record<string, { customerName: string; minPaymentDate: string | null; items: Allocation[] }> = {}
    for (const alloc of allocations) {
      if (!groups[alloc.customerName]) {
        groups[alloc.customerName] = {
          customerName: alloc.customerName,
          minPaymentDate: alloc.paymentDate || null,
          items: []
        }
      } else if (alloc.paymentDate) {
        if (!groups[alloc.customerName].minPaymentDate || new Date(alloc.paymentDate).getTime() < new Date(groups[alloc.customerName].minPaymentDate!).getTime()) {
          groups[alloc.customerName].minPaymentDate = alloc.paymentDate
        }
      }
      groups[alloc.customerName].items.push(alloc)
    }

    return Object.values(groups).sort((a, b) => {
      if (!a.minPaymentDate && !b.minPaymentDate) return 0
      if (!a.minPaymentDate) return 1
      if (!b.minPaymentDate) return -1
      return new Date(a.minPaymentDate).getTime() - new Date(b.minPaymentDate).getTime()
    })
  }, [allocations])

  // 3. Grouped by Product (Inside each product, sorted by paymentDate of allocations)
  const allocationsByProduct = React.useMemo(() => {
    const groups: Record<string, { product: string; items: Allocation[] }> = {}
    for (const alloc of allocations) {
      if (!groups[alloc.product]) {
        groups[alloc.product] = {
          product: alloc.product,
          items: []
        }
      }
      groups[alloc.product].items.push(alloc)
    }

    for (const g of Object.values(groups)) {
      g.items.sort((a, b) => {
        if (!a.paymentDate && !b.paymentDate) return 0
        if (!a.paymentDate) return 1
        if (!b.paymentDate) return -1
        return new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
      })
    }

    return Object.values(groups).sort((a, b) => a.product.localeCompare(b.product))
  }, [allocations])

  // Displayed invoices (merge pending + search results, filter by search)
  const displayedInvoicesMap = new Map()
  pendingInvoices.forEach(inv => displayedInvoicesMap.set(inv.numero_factura, inv))
  selectedInvoices.forEach(inv => displayedInvoicesMap.set(inv.numero_factura, inv))
  invoiceResults.forEach(inv => displayedInvoicesMap.set(inv.numero_factura, inv))
  let displayedInvoices = Array.from(displayedInvoicesMap.values())
  if (invoiceSearch.trim()) {
    const terms = invoiceSearch.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean)
    const cleanedTerms = terms.map((s: string) => s.replace(/^F-/i, ''))
    displayedInvoices = displayedInvoices.filter((inv: any) => {
      const folUpper = String(inv.numero_factura).toUpperCase()
      const cliUpper = String(inv.cliente_nombre || '').toUpperCase()
      return terms.includes(folUpper) ||
        cleanedTerms.some(t => folUpper.includes(t)) ||
        cliUpper.includes(invoiceSearch.trim().toUpperCase())
    })
  }

  // Totals for selected orders
  const selectedOrdenesData = ordenes.filter(o => selectedOrderIds.has(o.id))
  const totalSelOrdenado = selectedOrdenesData.reduce((s, o) => s + (o.total_ordenado || 0), 0)
  const totalSelRecibido = selectedOrdenesData.reduce((s, o) => s + (o.total_recibido || 0), 0)

  // ── Status badge helper ───────────────────────────────────
  const estadoBadge = (estado: string | null) => {
    switch (estado) {
      case 'pendiente':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">Pendiente</span>
      case 'parcial':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">Parcial</span>
      case 'completa':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">Completa</span>
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">{estado || '—'}</span>
    }
  }

  const surtidoBadge = (estado_surtido: string | null) => {
    switch (estado_surtido) {
      case 'no_surtida':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-medium border border-red-200">No surtida</span>
      case 'parcial':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 font-medium border border-amber-200">Parcial</span>
      default:
        return null
    }
  }

  // ─────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto min-h-screen space-y-8 bg-gray-50/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('repartition')}</h1>
            <p className="text-gray-500 mt-1">{t('tagline')}</p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 flex items-start gap-3 shadow-sm">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium font-sans">Al completar la repartición, se notificará automáticamente al personal asignado (vía WhatsApp) para que confirmen la dirección de envío con sus clientes.</p>
          </div>
        </motion.div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </motion.div>
        )}

        {successMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-100 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{successMsg}</p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left Column ──────────────────────────────── */}
          <div className="lg:col-span-1 space-y-6">

            {/* Ordenes de Compra */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-indigo-600" />
                  <h2 className="text-base font-semibold text-gray-900">Órdenes de compra pendientes</h2>
                </div>
                <div className="flex items-center gap-2">
                  {selectedOrderIds.size > 0 && (
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {totalSelRecibido}/{totalSelOrdenado} uds.
                    </span>
                  )}
                  <button
                    onClick={fetchOrdenes}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                    title="Recargar"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
                {loadingOrdenes ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Cargando órdenes...</span>
                  </div>
                ) : ordenes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <Package className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">No hay órdenes pendientes</p>
                  </div>
                ) : ordenes.map(orden => {
                  const isSelected = selectedOrderIds.has(orden.id)
                  const isExpanded = expandedOrders.has(orden.id)
                  const pendingCount = orden.productos.filter(
                    p => (p.cantidad_recibida || 0) < p.cantidad_ordenada
                  ).length

                  return (
                    <div key={orden.id} className={`transition-colors ${isSelected ? 'bg-indigo-50/30' : 'bg-white'}`}>
                      <div
                        className="px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-indigo-50/50 group"
                        onClick={() => toggleOrder(orden.id)}
                      >
                        {/* Checkbox */}
                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>
                          {isSelected && <CheckCircle2 className="w-3 h-3" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{orden.numero_orden}</span>
                            {estadoBadge(orden.estado)}
                            {/* Units indicator */}
                            <span className={`text-xs font-mono font-medium ${orden.total_recibido < orden.total_ordenado ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-green-700 bg-green-50 border border-green-200'} px-1.5 py-0.5 rounded`}>
                              ({orden.total_recibido}/{orden.total_ordenado})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500 truncate">{orden.proveedor || '—'}</span>
                            {orden.fecha_orden && (
                              <span className="text-xs text-gray-400">{new Date(orden.fecha_orden).toLocaleDateString()}</span>
                            )}
                          </div>
                          {pendingCount > 0 && (
                            <span className="text-[10px] text-amber-600 font-medium">{pendingCount} artículo{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}</span>
                          )}
                        </div>

                        {/* Expand toggle */}
                        <button
                          onClick={e => { e.stopPropagation(); toggleExpandOrder(orden.id) }}
                          className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-400 shrink-0"
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Products sub-list */}
                      {isExpanded && (
                        <div className="px-4 pb-3 bg-gray-50/50 border-t border-gray-100">
                          <div className="space-y-1 pt-2">
                            {orden.productos.map(p => {
                              const recibida = p.cantidad_recibida || 0
                              const pendiente = p.cantidad_ordenada - recibida
                              return (
                                <div key={p.id} className="flex items-center justify-between text-xs gap-2">
                                  <span className="text-gray-700 truncate flex-1" title={p.producto_nombre || ''}>{p.producto_nombre}</span>
                                  <span className={`font-mono font-semibold shrink-0 ${pendiente > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                                    ({recibida}/{p.cantidad_ordenada})
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="px-4 py-2.5 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  Seleccionadas: <span className="font-semibold text-indigo-600">{selectedOrderIds.size}</span>/<span className="text-gray-700">{ordenes.length}</span>
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedOrderIds(new Set(ordenes.map(o => o.id)))} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Todas</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => setSelectedOrderIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Ninguna</button>
                </div>
              </div>
            </div>

            {/* Facturas a Surtir */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col" style={{ minHeight: 380 }}>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{t('invoicesToFulfill')}</h2>

              <div className="relative mb-3">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar facturas por folio, cliente, RFC..."
                  value={invoiceSearch}
                  onChange={e => setInvoiceSearch(e.target.value)}
                  className="erp-input pl-10 w-full"
                />
                {isSearchingInvoices && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 border border-gray-100 rounded-xl overflow-y-auto divide-y divide-gray-50 shadow-sm bg-gray-50/30" style={{ maxHeight: 280 }}>
                {displayedInvoices.length > 0 ? displayedInvoices.map(inv => {
                  const isSelected = !!selectedInvoices.find(i => i.numero_factura === inv.numero_factura)
                  return (
                    <div
                      key={inv.id}
                      onClick={() => toggleInvoice(inv)}
                      className={`p-3 cursor-pointer transition-colors flex items-start gap-3 hover:bg-indigo-50/50 ${isSelected ? 'bg-indigo-50/30' : 'bg-white'}`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>
                        {isSelected && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-sm flex items-center gap-2 flex-wrap">
                          Folio: {inv.numero_factura}
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-150">
                            {inv.fecha_pago ? `Pago: ${new Date(inv.fecha_pago).toLocaleDateString()}` : 'Sin pago'}
                          </span>
                          {surtidoBadge(inv.estado_surtido)}
                          {!isSelected && <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-400">Omitida</span>}
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">{inv.cliente_nombre}</div>
                      </div>
                    </div>
                  )
                }) : (
                  <div className="p-6 text-center text-gray-400 flex flex-col items-center justify-center h-full">
                    <Search className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">No se encontraron facturas</p>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">Seleccionadas: <span className="text-indigo-600 font-bold">{selectedInvoices.length}</span></span>
                <button onClick={() => setSelectedInvoices(displayedInvoices)} className="text-indigo-600 hover:text-indigo-700 font-medium text-xs">
                  Seleccionar todas visibles
                </button>
              </div>
            </div>

            <button
              onClick={handleProcess}
              disabled={loading || selectedOrderIds.size === 0 || selectedInvoices.length === 0}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium shadow-md shadow-indigo-200 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              <span>Analizar y Repartir</span>
            </button>
          </div>

          {/* ── Right Column: Results ─────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence mode="popLayout">
              {loading && (
                <motion.div
                  key="loading-state"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 rounded-2xl bg-indigo-50/50 p-6"
                >
                  <div className="relative mb-6">
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center animate-pulse">
                      <Brain className="w-8 h-8 text-indigo-600 animate-bounce" />
                    </div>
                    <div className="absolute top-0 right-0 -mt-1 -mr-1">
                      <Sparkles className="w-6 h-6 text-violet-500 animate-ping" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-indigo-900 mb-2">La IA está analizando</h3>
                  <p className="text-indigo-600 text-center max-w-sm font-sans">
                    Procesando el inventario disponible y distribuyendo según prioridad de pago...
                  </p>
                </motion.div>
              )}

              {!loading && aiReasoning && (
                <motion.div
                  key="ai-reasoning"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-gradient-to-br from-violet-50 to-fuchsia-50 p-6 rounded-2xl border border-violet-100 shadow-sm relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Brain className="w-24 h-24 text-violet-600" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-5 h-5 text-violet-600" />
                      <h3 className="font-bold text-violet-900">{t('aiReasoning')}</h3>
                    </div>
                    <p className="text-violet-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">{aiReasoning}</p>
                  </div>
                </motion.div>
              )}

              {!loading && allocations.length > 0 && (
                <motion.div
                  key="allocations-dashboard"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  {/* Dashboard Header */}
                  <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{t('allocationDashboard')}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Asignación ordenada según la prioridad de fecha de pago.</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleExportCSV}
                        className="py-2 px-3 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Exportar CSV</span>
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={loading || successMsg !== ''}
                        className="py-2 px-4 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {t('saveAllocation')}
                      </button>
                    </div>
                  </div>

                  {/* Tabs Toggle */}
                  <div className="flex border-b border-gray-100 bg-gray-50/50 p-1.5 gap-1.5">
                    <button
                      onClick={() => setActiveTab('invoice')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${activeTab === 'invoice' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Por factura</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('customer')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${activeTab === 'customer' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Por Cliente</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('product')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${activeTab === 'product' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>Por Producto</span>
                    </button>
                  </div>

                  {/* Tab Contents */}
                  <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                    
                    {/* Tab 1: Grouped by Invoice */}
                    {activeTab === 'invoice' && allocationsByInvoice.map(group => {
                      const totalRequested = group.items.reduce((s, item) => s + item.requestedQty, 0)
                      const totalAllocated = group.items.reduce((s, item) => s + item.allocatedQty, 0)
                      const missingCount = group.items.reduce((s, item) => s + (item.requestedQty - item.allocatedQty), 0)
                      const pct = totalRequested > 0 ? Math.round((totalAllocated / totalRequested) * 100) : 0

                      return (
                        <div key={group.folio} className="p-6 hover:bg-gray-50/50 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">F</div>
                              <div>
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                                  Folio: {group.folio}
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                                    {group.paymentDate ? `Pago: ${new Date(group.paymentDate).toLocaleDateString()}` : 'Sin pago'}
                                  </span>
                                  {missingCount > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-xs font-medium border border-red-100">
                                      <AlertCircle className="w-3.5 h-3.5" /> Faltan {missingCount}
                                    </span>
                                  )}
                                </h4>
                                <p className="text-xs text-gray-500 font-sans mt-0.5">Cliente: {group.customerName}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <div className="text-center px-3 py-1.5 bg-green-50 text-green-700 rounded-md font-medium">Asignado: {totalAllocated}/{totalRequested} ({pct}%)</div>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] tracking-wider">
                                <tr>
                                  <th className="px-4 py-2 rounded-l-lg">Producto</th>
                                  <th className="px-4 py-2 text-center w-28">Pendiente</th>
                                  <th className="px-4 py-2 text-center w-36 rounded-r-lg">Asignado</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {group.items.map(alloc => (
                                  <tr key={alloc.id} className="hover:bg-white transition-colors">
                                    <td className="px-4 py-3 text-gray-900 font-medium font-sans">
                                      <div className="flex items-center gap-2">
                                        <span>{alloc.product}</span>
                                        {alloc.requestedQty - alloc.allocatedQty > 0 && (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 text-[10px] font-medium border border-red-100">
                                            Faltan {alloc.requestedQty - alloc.allocatedQty}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-500 font-mono font-medium">{alloc.requestedQty}</td>
                                    <td className="px-4 py-3 text-center">
                                      <input
                                        type="number"
                                        min="0"
                                        max={alloc.requestedQty}
                                        value={alloc.allocatedQty}
                                        onChange={e => handleQtyChange(alloc.id, parseInt(e.target.value || '0', 10))}
                                        className={`w-16 text-center border rounded-md py-1 px-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${alloc.manualAdjustment ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'border-gray-200'}`}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })}

                    {/* Tab 2: Grouped by Customer */}
                    {activeTab === 'customer' && allocationsByCustomer.map(group => {
                      const totalRequested = group.items.reduce((s, item) => s + item.requestedQty, 0)
                      const totalAllocated = group.items.reduce((s, item) => s + item.allocatedQty, 0)
                      const missingCount = group.items.reduce((s, item) => s + (item.requestedQty - item.allocatedQty), 0)

                      return (
                        <div key={group.customerName} className="p-6 hover:bg-gray-50/50 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">C</div>
                              <div>
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                                  {group.customerName}
                                  {missingCount > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-xs font-medium border border-red-100">
                                      <AlertCircle className="w-3.5 h-3.5" /> Faltan {missingCount}
                                    </span>
                                  )}
                                </h4>
                                <p className="text-xs text-gray-500 font-sans mt-0.5">
                                  {group.minPaymentDate ? `Prioridad de Pago: ${new Date(group.minPaymentDate).toLocaleDateString()}` : 'Sin pago registrado'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <div className="text-center px-3 py-1.5 bg-green-50 text-green-700 rounded-md font-medium">Asignado: {totalAllocated}/{totalRequested}</div>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] tracking-wider">
                                <tr>
                                  <th className="px-4 py-2 rounded-l-lg">Factura</th>
                                  <th className="px-4 py-2">Fecha Pago</th>
                                  <th className="px-4 py-2">Producto</th>
                                  <th className="px-4 py-2 text-center w-28">Pendiente</th>
                                  <th className="px-4 py-2 text-center w-36 rounded-r-lg">Asignado</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {group.items.map(alloc => (
                                  <tr key={`cust-alloc-${alloc.id}`} className="hover:bg-white transition-colors">
                                    <td className="px-4 py-3 text-gray-900 font-semibold font-mono">{alloc.folio}</td>
                                    <td className="px-4 py-3 text-gray-600 font-sans text-xs">
                                      {alloc.paymentDate ? new Date(alloc.paymentDate).toLocaleDateString() : 'Sin pago'}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 font-sans">{alloc.product}</td>
                                    <td className="px-4 py-3 text-center text-gray-500 font-mono font-medium">{alloc.requestedQty}</td>
                                    <td className="px-4 py-3 text-center">
                                      <input
                                        type="number"
                                        min="0"
                                        max={alloc.requestedQty}
                                        value={alloc.allocatedQty}
                                        onChange={e => handleQtyChange(alloc.id, parseInt(e.target.value || '0', 10))}
                                        className={`w-16 text-center border rounded-md py-1 px-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${alloc.manualAdjustment ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'border-gray-200'}`}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })}

                    {/* Tab 3: Grouped by Product */}
                    {activeTab === 'product' && allocationsByProduct.map(group => {
                      const totalReceived = initialInventory[group.product] || 0
                      const currentAllocated = group.items.reduce((acc, curr) => acc + curr.allocatedQty, 0)
                      const rem = remainingInventory[group.product] || 0
                      const missingCount = group.items.reduce((acc, curr) => acc + (curr.requestedQty - curr.allocatedQty), 0)

                      return (
                        <div key={group.product} className="p-6 hover:bg-gray-50/50 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">{group.product.charAt(0)}</div>
                              <div>
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                                  {group.product}
                                  {missingCount > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-xs font-medium border border-red-100">
                                      <AlertCircle className="w-3.5 h-3.5" /> Faltan {missingCount}
                                    </span>
                                  )}
                                </h4>
                                <p className="text-xs text-gray-500 font-sans mt-0.5">{t('received')}: {totalReceived}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-semibold">
                              <div className="text-center px-2.5 py-1 bg-green-50 text-green-700 rounded border border-green-150">Asignado: {currentAllocated}</div>
                              <div className={`text-center px-2.5 py-1 rounded border ${rem > 0 ? 'bg-amber-50 text-amber-700 border-amber-150' : 'bg-gray-50 text-gray-600 border-gray-150'}`}>Excedente: {rem}</div>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] tracking-wider">
                                <tr>
                                  <th className="px-4 py-2 rounded-l-lg">Factura</th>
                                  <th className="px-4 py-2">Cliente</th>
                                  <th className="px-4 py-2">Fecha Pago</th>
                                  <th className="px-4 py-2 text-center w-28">Pendiente</th>
                                  <th className="px-4 py-2 text-center w-36 rounded-r-lg">Asignado</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {group.items.map(alloc => (
                                  <tr key={`prod-alloc-${alloc.id}`} className="hover:bg-white transition-colors">
                                    <td className="px-4 py-3 font-semibold text-gray-900 font-mono">{alloc.folio}</td>
                                    <td className="px-4 py-3 text-gray-600 font-sans max-w-[180px] truncate" title={alloc.customerName}>{alloc.customerName}</td>
                                    <td className="px-4 py-3 text-gray-500 font-sans text-xs">
                                      {alloc.paymentDate ? new Date(alloc.paymentDate).toLocaleDateString() : 'Sin pago'}
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-500 font-mono font-medium">{alloc.requestedQty}</td>
                                    <td className="px-4 py-3 text-center">
                                      <input
                                        type="number"
                                        min="0"
                                        max={alloc.requestedQty}
                                        value={alloc.allocatedQty}
                                        onChange={e => handleQtyChange(alloc.id, parseInt(e.target.value || '0', 10))}
                                        className={`w-16 text-center border rounded-md py-1 px-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${alloc.manualAdjustment ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'border-gray-200'}`}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {!loading && allocations.length === 0 && !aiReasoning && (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="h-full min-h-[400px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-white p-6"
                >
                  <ShoppingCart className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="font-semibold text-gray-500">Selecciona órdenes y facturas para comenzar</p>
                  <p className="text-sm mt-1">La IA analizará la mejor distribución del inventario pendiente.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
