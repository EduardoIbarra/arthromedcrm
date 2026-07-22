'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import SearchableSelect from '@/components/SearchableSelect'
import { Product } from '@/types/database'
import {
  ArrowLeft, PlusCircle, Trash2, FileCheck, Loader2, AlertCircle,
  FileText, Package, FileSpreadsheet
} from 'lucide-react'

export default function EditPurchaseOrderPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isPreOrder, setIsPreOrder] = useState(true)

  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'PENDING' | 'COMPLETED' | 'CANCELLED' | 'PARTIAL'>('PENDING')
  const [items, setItems] = useState<{ product_id: string; quantity: number }[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [orderNumber, setOrderNumber] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      try {
        const [orderRes, productsRes] = await Promise.all([
          fetch(`/api/purchase-orders/${id}`),
          fetch('/api/products')
        ])
        if (!orderRes.ok) { setNotFound(true); setLoading(false); return }

        const orderJson = await orderRes.json()
        const productsJson = await productsRes.json()

        const order = orderJson.data
        setNotes(order.notes || '')
        setStatus(order.status)
        setIsPreOrder(order.es_pre_orden ?? true)
        setOrderNumber(order.numero_orden || '')
        setItems(
          (order.items || []).map((item: any) => ({
            product_id: item.product_id,
            quantity: item.quantity
          }))
        )
        setProducts(productsJson.data || [])
      } catch (err: any) {
        setNotFound(true)
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

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

  const handleDownloadExcel = async () => {
    try {
      const res = await fetch(`/api/purchase-orders/${id}/download`)
      if (!res.ok) throw new Error('Error al descargar el archivo Excel')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `PO_${orderNumber || id}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err.message || 'Error al descargar Excel')
    }
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
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes, es_pre_orden: isPreOrder, items: validItems })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al guardar')
      router.push(`/purchase-orders?tab=${isPreOrder ? 'pre_orders' : 'orders'}`)
    } catch (err: any) {
      console.error(err)
      setFormError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const totalUnits = items.reduce((s, i) => s + (i.quantity || 0), 0)

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 max-w-5xl mx-auto flex justify-center items-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-[#0763a9] rounded-full animate-spin" />
            <p className="text-sm font-semibold text-gray-500">Cargando orden de compra...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (notFound) {
    return (
      <AppShell>
        <div className="p-8 max-w-5xl mx-auto">
          <div className="p-8 text-center bg-rose-50 rounded-2xl border border-rose-100">
            <AlertCircle size={32} className="mx-auto mb-2 text-rose-500" />
            <p className="font-semibold text-rose-700">Orden no encontrada</p>
            <button
              onClick={() => router.push('/purchase-orders?tab=orders')}
              className="mt-4 btn-secondary"
            >
              Volver
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in space-y-6">

        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/purchase-orders?tab=${isPreOrder ? 'pre_orders' : 'orders'}`)}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Editar {isPreOrder ? 'Pre-Orden' : 'Orden de Compra'}
                {orderNumber && (
                  <span className="ml-2 text-lg font-mono text-[#0763a9]">#{orderNumber}</span>
                )}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Gestión de Compras / {isPreOrder ? 'Pre Órdenes' : 'Órdenes de Compra'} / Editar
              </p>
            </div>
          </div>
          <button
            onClick={handleDownloadExcel}
            className="btn-secondary flex items-center gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
          >
            <FileSpreadsheet size={16} /> Descargar Excel
          </button>
        </header>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Details card */}
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
              <div className="space-y-4">
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
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo</label>
                  <select
                    value={isPreOrder ? 'pre_order' : 'order'}
                    onChange={e => setIsPreOrder(e.target.value === 'pre_order')}
                    className="erp-input w-full py-2.5"
                  >
                    <option value="pre_order">Pre-Orden</option>
                    <option value="order">Orden de Compra</option>
                  </select>
                </div>
              </div>
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
                    — {items.filter(i => i.product_id).length} líneas · {totalUnits} uds
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
              {items.map((item, idx) => (
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
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push(`/purchase-orders?tab=${isPreOrder ? 'pre_orders' : 'orders'}`)}
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
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
