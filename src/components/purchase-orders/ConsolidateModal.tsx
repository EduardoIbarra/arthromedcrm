import React, { useState, useMemo } from 'react'
import Modal from '@/components/Modal'
import { Loader2, AlertCircle, FileCheck, Layers } from 'lucide-react'
import { PurchaseOrder } from '@/types/database'

interface ConsolidateModalProps {
  open: boolean
  onClose: () => void
  selectedPreOrders: PurchaseOrder[]
  onSuccess: () => void
}

export default function ConsolidateModal({ open, onClose, selectedPreOrders, onSuccess }: ConsolidateModalProps) {
  const [nombre, setNombre] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Aggregate items from all selected pre-orders
  const consolidatedItems = useMemo(() => {
    const map = new Map<string, { product_id: string; nombre: string; quantity: number }>()

    for (const po of selectedPreOrders) {
      for (const item of (po.items || [])) {
        if (!item.product_id) continue
        const prodName = item.productos?.nombre_lista || (item.productos as any)?.nombre || item.productos?.description || 'Producto'
        const existing = map.get(item.product_id)
        if (existing) {
          existing.quantity += item.quantity
        } else {
          map.set(item.product_id, {
            product_id: item.product_id,
            nombre: prodName,
            quantity: item.quantity
          })
        }
      }
    }

    return Array.from(map.values())
  }, [selectedPreOrders])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedPreOrders.length === 0) return

    setIsSaving(true)
    setError(null)

    try {
      const preOrderIds = selectedPreOrders.map(p => p.id)

      const res = await fetch('/api/purchase-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim() || `Factura Consolidada (${selectedPreOrders.length} Pre-Órdenes)`,
          observaciones,
          pre_order_ids: preOrderIds,
          items: consolidatedItems.map(i => ({
            product_id: i.product_id,
            quantity: i.quantity
          }))
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al consolidar pre-órdenes')

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={() => !isSaving && onClose()} title="Consolidar Pre Órdenes en Factura de Compra" maxWidth="750px">
      <form onSubmit={handleSave} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-start gap-2">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
          <div className="flex items-center gap-2 font-bold text-gray-900 mb-1">
            <Layers size={18} className="text-[#0763a9]" />
            <span>Pre-Órdenes a Consolidar ({selectedPreOrders.length})</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-600 mt-2">
            {selectedPreOrders.map(po => (
              <span key={po.id} className="bg-white border border-gray-200 px-2 py-1 rounded-md font-mono">
                {(po as any).numero_orden || po.id.slice(0, 8)}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre de la Factura de Compra</label>
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
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notas / Observaciones</label>
            <input
              type="text"
              placeholder="Instrucciones, folios, observaciones..."
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              className="erp-input w-full"
            />
          </div>
        </div>

        {/* Consolidated Items Preview */}
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-2">Resumen de Productos Consolidados</h3>
          <div className="border border-gray-100 rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-gray-50/30">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100/50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                  <th className="p-2.5">Producto</th>
                  <th className="p-2.5 text-center w-24">Cantidad Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {consolidatedItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-2.5 font-medium text-gray-800">{item.nombre}</td>
                    <td className="p-2.5 text-center font-bold text-gray-900">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={isSaving}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={isSaving}>
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <FileCheck size={18} />}
            <span>Consolidar en Factura</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}
