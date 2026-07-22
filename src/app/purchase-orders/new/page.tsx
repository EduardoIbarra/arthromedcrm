'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import SearchableSelect from '@/components/SearchableSelect'
import { Product } from '@/types/database'
import {
  ArrowLeft, PlusCircle, Trash2, FileCheck, Loader2, AlertCircle,
  AlertTriangle, Package, PackageCheck, FileText, ChevronDown, ChevronRight,
  RefreshCw
} from 'lucide-react'

interface MissingProductItem {
  product_id: string
  name: string
  code: string
  missing: number
  covered_by_stock?: number
  covered_by_invoices?: number
}

interface ByInvoiceGroup {
  invoice_id: string
  numero_factura: string
  cliente_nombre: string
  items: Array<{ product_id: string; name: string; code: string; missing: number }>
}

interface ShortageData {
  data: MissingProductItem[]
  byInvoice: ByInvoiceGroup[]
  totalMissing: number
  purchaseInvoiceSources: Array<{
    id: string
    numero_factura: string
    nombre: string | null
    status: string | null
    items: Array<{ product_id: string; quantity: number; nombre: string }>
  }>
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()

  // Form state
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'PENDING' | 'COMPLETED' | 'CANCELLED' | 'PARTIAL'>('PENDING')
  const [items, setItems] = useState<{ product_id: string; quantity: number }[]>([{ product_id: '', quantity: 1 }])
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Product data
  const [products, setProducts] = useState<Product[]>([])

  // Shortage data
  const [shortage, setShortage] = useState<ShortageData | null>(null)
  const [shortageLoading, setShortageLoading] = useState(false)
  const [shortageView, setShortageView] = useState<'product' | 'invoice'>('product')
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(j => setProducts(j.data || []))
      .catch(console.error)

    loadShortage()
  }, [])

  const loadShortage = async () => {
    setShortageLoading(true)
    try {
      const res = await fetch('/api/facturas/missing-products')
      if (!res.ok) throw new Error('Error al cargar faltantes')
      const json: ShortageData = await res.json()
      setShortage(json)
    } catch (err: any) {
      console.error(err)
    } finally {
      setShortageLoading(false)
    }
  }

  const productOptions = useMemo(() => {
    return products.map(prod => {
      const listName = (prod as any).nombre_lista || prod.description || (prod as any).nombre || 'Producto'
      const extras = [
        prod.model ? `(${prod.model})` : null,
        prod.order_code ? prod.order_code : null,
      ].filter(Boolean).join(' · ')
      return {
        value: prod.id,
        label: extras ? `${listName} · ${extras}` : listName,
      }
    }).sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [products])

  const handleAddRow = () => setItems(prev => [...prev, { product_id: '', quantity: 1 }])
  const handleRemoveRow = (index: number) => setItems(prev => prev.filter((_, i) => i !== index))
  const handleItemChange = (index: number, key: 'product_id' | 'quantity', value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item
      return { ...item, [key]: key === 'quantity' ? Math.max(1, parseInt(value, 10) || 1) : value }
    }))
  }

  const handleFillFromShortage = () => {
    if (!shortage || shortage.data.length === 0) return
    const newItems = shortage.data.map(item => ({
      product_id: item.product_id,
      quantity: item.missing
    }))
    setItems(newItems)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const validItems = items.filter(item => item.product_id.trim() !== '')
    if (validItems.length === 0) {
      setFormError('La orden debe contener al menos un producto válido.')
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes, es_pre_orden: true, items: validItems })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al guardar')

      // Download excel if available
      if (json.data) {
        try {
          const dlRes = await fetch(`/api/purchase-orders/${json.data.id}/download`)
          if (dlRes.ok) {
            const blob = await dlRes.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `PO_${json.data.numero_orden || json.data.id}.xlsx`
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.URL.revokeObjectURL(url)
          }
        } catch (err) {
          console.error('Error downloading excel:', err)
        }
      }

      router.push('/purchase-orders?tab=pre_orders')
    } catch (err: any) {
      console.error(err)
      setFormError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleInvoice = (id: string) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalFormUnits = items.reduce((s, i) => s + (i.quantity || 0), 0)

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">

        {/* Header */}
        <header className="flex items-center gap-4">
          <button
            onClick={() => router.push('/purchase-orders?tab=orders')}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nueva Orden de Compra</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gestión de Compras / Nueva Pre-Orden</p>
          </div>
        </header>

        {/* Two-column grid: Form | Shortage Panel */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 items-start">

          {/* ── Left: PO Form ── */}
          <form onSubmit={handleSave} className="space-y-5">
            <div className="bg-white border border-gray-150 rounded-2xl shadow-sm p-6 space-y-5">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <FileText size={18} className="text-[#0763a9]" />
                Detalles de la Orden
              </h2>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-sm rounded-xl flex items-start gap-2">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Notas / Observaciones</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Instrucciones especiales, proveedor, etc."
                    className="erp-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Estado de Orden</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="erp-input w-full py-2.5"
                  >
                    <option value="PENDING">Pendiente</option>
                    <option value="COMPLETED">Surtida</option>
                    <option value="PARTIAL">Parcial</option>
                    <option value="CANCELLED">Cancelada</option>
                  </select>
                </div>
              </div>

              {/* Autoabastecimiento */}
              <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                <span className="text-xs text-gray-400 italic">
                  Completa los productos o usa la función de autoabastecimiento:
                </span>
                <button
                  type="button"
                  onClick={handleFillFromShortage}
                  disabled={shortageLoading || !shortage || shortage.data.length === 0}
                  className="btn-secondary text-xs flex items-center gap-1.5 bg-blue-50/50 hover:bg-blue-50 text-[#0763a9] border-[#0763a9]/10 disabled:opacity-50"
                >
                  {shortageLoading ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />}
                  Llenar con Faltante
                  {shortage && shortage.totalMissing > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
                      {shortage.totalMissing}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Products table */}
            <div className="bg-white border border-gray-150 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Package size={16} className="text-gray-400" />
                  Productos Solicitados
                  {items.filter(i => i.product_id).length > 0 && (
                    <span className="text-xs text-gray-400 font-normal">
                      — {items.filter(i => i.product_id).length} líneas · {totalFormUnits} uds
                    </span>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="text-xs text-[#0763a9] hover:text-blue-700 font-semibold flex items-center gap-1"
                >
                  <PlusCircle size={14} /> Agregar Producto
                </button>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-[500px] overflow-y-auto bg-gray-50/30">
                {items.map((item, idx) => {
                  const prod = products.find(p => p.id === item.product_id)
                  return (
                    <div key={idx} className="p-3 flex items-center gap-3">
                      <span className="text-xs font-semibold text-gray-400 w-6 shrink-0">#{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <SearchableSelect
                          options={productOptions}
                          value={item.product_id}
                          onChange={val => handleItemChange(idx, 'product_id', val)}
                          placeholder="Buscar producto..."
                        />
                      </div>
                      <div className="w-28 shrink-0">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                          className="erp-input w-full py-2 text-center"
                          placeholder="Cant."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push('/purchase-orders?tab=orders')}
                className="btn-secondary"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary flex items-center gap-2"
                disabled={isSaving}
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Guardar Pre-Orden'}
              </button>
            </div>
          </form>

          {/* ── Right: Shortage Analysis Panel ── */}
          <div className="space-y-4 xl:sticky xl:top-6">
            <div className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden">
              {/* Panel Header */}
              <div className="p-5 bg-gradient-to-br from-rose-50 to-orange-50 border-b border-rose-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                      <AlertTriangle size={18} className="text-rose-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Piezas Faltantes</p>
                      {shortageLoading ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Loader2 size={14} className="animate-spin text-rose-400" />
                          <span className="text-sm text-rose-400">Calculando...</span>
                        </div>
                      ) : (
                        <p className="text-3xl font-black text-rose-700">
                          {shortage?.totalMissing?.toLocaleString() ?? '—'}
                          <span className="text-sm font-semibold text-rose-500 ml-1">uds</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={loadShortage}
                    disabled={shortageLoading}
                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                    title="Recargar"
                  >
                    <RefreshCw size={15} className={shortageLoading ? 'animate-spin' : ''} />
                  </button>
                </div>

                {/* Coverage note */}
                {shortage && shortage.purchaseInvoiceSources.length > 0 && (
                  <div className="mt-3 p-2.5 bg-white/70 rounded-xl border border-rose-100">
                    <p className="text-xs text-rose-600 flex items-center gap-1.5">
                      <PackageCheck size={13} />
                      <span>
                        <strong>{shortage.purchaseInvoiceSources.length}</strong> factura{shortage.purchaseInvoiceSources.length !== 1 ? 's' : ''} de compra cubren parte del faltante
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Tab Toggle */}
              <div className="flex border-b border-gray-100 bg-gray-50/40">
                <button
                  onClick={() => setShortageView('product')}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                    shortageView === 'product'
                      ? 'text-[#0763a9] border-b-2 border-[#0763a9] bg-white'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Por Producto ({shortage?.data.length ?? 0})
                </button>
                <button
                  onClick={() => setShortageView('invoice')}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                    shortageView === 'invoice'
                      ? 'text-[#0763a9] border-b-2 border-[#0763a9] bg-white'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Por Factura ({shortage?.byInvoice.length ?? 0})
                </button>
              </div>

              {/* Content */}
              <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-100">
                {shortageLoading ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="animate-spin text-gray-300" size={24} />
                  </div>
                ) : !shortage || (shortageView === 'product' ? shortage.data.length === 0 : shortage.byInvoice.length === 0) ? (
                  <div className="p-8 text-center">
                    <PackageCheck size={32} className="mx-auto mb-2 text-emerald-400" />
                    <p className="text-sm font-semibold text-gray-500">Sin faltantes detectados</p>
                    <p className="text-xs text-gray-400 mt-1">Todo el stock cubre la demanda pendiente</p>
                  </div>
                ) : shortageView === 'product' ? (
                  /* By-Product View */
                  shortage.data
                    .sort((a, b) => b.missing - a.missing)
                    .map(item => (
                      <div key={item.product_id} className="px-4 py-3 hover:bg-gray-50/60 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate leading-snug">{item.name}</p>
                            {item.code && (
                              <p className="text-[10px] text-gray-400 font-mono mt-0.5">{item.code}</p>
                            )}
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5">
                            <span className="text-sm font-black text-rose-600 tabular-nums w-10 text-right">
                              {item.missing}
                            </span>
                            <span className="text-xs text-gray-400">uds</span>
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  /* By-Invoice View */
                  shortage.byInvoice.map(group => {
                    const isExpanded = expandedInvoices.has(group.invoice_id)
                    const groupTotal = group.items.reduce((s, i) => s + i.missing, 0)
                    return (
                      <div key={group.invoice_id}>
                        <button
                          onClick={() => toggleInvoice(group.invoice_id)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-bold text-[#0763a9]">{group.numero_factura}</span>
                              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                {group.items.length} {group.items.length === 1 ? 'prod' : 'prods'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{group.cliente_nombre}</p>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <span className="text-sm font-black text-rose-600 tabular-nums">{groupTotal}</span>
                            {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="bg-gray-50/70 divide-y divide-gray-100 border-t border-gray-100">
                            {group.items.map(item => (
                              <div key={item.product_id} className="px-6 py-2 flex items-center justify-between">
                                <div className="min-w-0">
                                  <p className="text-xs text-gray-700 truncate">{item.name}</p>
                                  {item.code && <p className="text-[10px] text-gray-400 font-mono">{item.code}</p>}
                                </div>
                                <span className="text-xs font-bold text-rose-600 shrink-0 ml-2 tabular-nums">{item.missing} uds</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  )
}
