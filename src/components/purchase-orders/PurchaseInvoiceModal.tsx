import React, { useState, useEffect, useMemo } from 'react'
import Modal from '@/components/Modal'
import { Loader2, AlertCircle, PlusCircle, Trash2 } from 'lucide-react'
import { Product } from '@/types/database'
import SearchableSelect from '@/components/SearchableSelect'

export interface PurchaseInvoiceData {
  id: string
  numero_factura: string
  nombre?: string | null
  status?: 'Creado' | 'Listo para revisión' | 'Revisado' | string
  observaciones?: string | null
  fecha_factura?: string
  created_at?: string
  pre_orders?: { id: string; numero_orden: string }[]
  items: { id?: string; product_id: string; quantity: number; productos?: any }[]
}

interface PurchaseInvoiceModalProps {
  open: boolean
  onClose: () => void
  invoice: PurchaseInvoiceData | null
  onSuccess: () => void
}

export default function PurchaseInvoiceModal({ open, onClose, invoice, onSuccess }: PurchaseInvoiceModalProps) {
  const [nombre, setNombre] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [items, setItems] = useState<{ product_id: string; quantity: number }[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    if (open) {
      fetch('/api/products')
        .then(res => res.json())
        .then(json => setProducts(json.data || []))
        .catch(err => console.error(err))

      if (invoice) {
        setNombre(invoice.nombre || '')
        setObservaciones(invoice.observaciones || '')
        setItems(
          (invoice.items || []).map(it => ({
            product_id: it.product_id,
            quantity: it.quantity
          }))
        )
      } else {
        setNombre('')
        setObservaciones('')
        setItems([{ product_id: '', quantity: 1 }])
      }
      setError(null)
    }
  }, [open, invoice])

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

  const handleAddRow = () => {
    setItems(prev => [...prev, { product_id: '', quantity: 1 }])
  }

  const handleRemoveRow = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, key: 'product_id' | 'quantity', value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          [key]: key === 'quantity' ? Math.max(1, parseInt(value, 10) || 1) : value
        }
      }
      return item
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const validItems = items.filter(it => it.product_id.trim() !== '')
    if (validItems.length === 0) {
      setError('La factura de compra debe incluir al menos un producto válido.')
      return
    }

    setIsSaving(true)

    try {
      const url = invoice ? `/api/purchase-invoices/${invoice.id}` : '/api/purchase-invoices'
      const method = invoice ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          observaciones,
          items: validItems
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al guardar factura de compra')

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !isSaving && onClose()}
      title={invoice ? `Editar Factura de Compra (${invoice.numero_factura})` : 'Nueva Factura de Compra'}
      maxWidth="800px"
    >
      <form onSubmit={handleSave} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-start gap-2">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre de la Factura</label>
            <input
              type="text"
              required
              placeholder="Ej. Factura BONSS Julio 2026"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="erp-input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Observaciones / Notas</label>
            <textarea
              rows={1}
              placeholder="Notas u observaciones..."
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              className="erp-input w-full"
            />
          </div>
        </div>

        {invoice?.pre_orders && invoice.pre_orders.length > 0 && (
          <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-gray-600">
            <span className="font-bold text-gray-800">Pre-Órdenes Asociadas: </span>
            {invoice.pre_orders.map(p => p.numero_orden).join(', ')}
          </div>
        )}

        {/* Items List */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-700">Productos en Factura</h3>
            <button
              type="button"
              onClick={handleAddRow}
              className="text-xs text-[#0763a9] hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              <PlusCircle size={14} /> Agregar Producto
            </button>
          </div>

          <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-80 overflow-y-auto bg-gray-50/30">
            {items.map((item, idx) => (
              <div key={idx} className="p-3 flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-400 w-6">#{idx + 1}</span>

                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    options={productOptions}
                    value={item.product_id}
                    onChange={val => handleItemChange(idx, 'product_id', val)}
                    placeholder="Buscar producto..."
                    className="w-full text-sm"
                  />
                </div>

                <div className="w-24">
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="Cant."
                    value={item.quantity}
                    onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                    className="erp-input w-full text-sm text-center py-1.5"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveRow(idx)}
                  disabled={items.length <= 1}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={isSaving}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Guardar Factura'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
