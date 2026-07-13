'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import {
  ClipboardList,
  Plus,
  Edit2,
  Trash2,
  Search,
  Loader2,
  Info,
  X,
  PlusCircle,
  FileCheck,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import PermissionGuard from '@/components/PermissionGuard'
import Modal from '@/components/Modal'
import { PurchaseOrder, Product } from '@/types/database'
import ImportModal from '@/components/purchase-orders/ImportModal'

interface MissingProductItem {
  product_id: string
  name: string
  code: string
  missing: number
}

export default function PurchaseOrdersPage() {
  const { t } = useI18n()

  // State
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(15)

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)

  // Form State
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'PENDING' | 'COMPLETED' | 'CANCELLED' | 'PARTIAL'>('PENDING')
  const [items, setItems] = useState<{ product_id: string; quantity: number }[]>([])
  
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isFaltanteLoading, setIsFaltanteLoading] = useState(false)

  // Fetch all orders
  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/purchase-orders')
      if (!res.ok) throw new Error('Error al cargar órdenes de compra')
      const json = await res.json()
      setOrders(json.data || [])
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch all products for selection
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error('Error al cargar productos')
      const json = await res.json()
      setProducts(json.data || [])
    } catch (err: any) {
      console.error('Error fetching products:', err)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    fetchProducts()
  }, [fetchOrders, fetchProducts])

  // Filter orders
  const filteredOrders = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return orders

    return orders.filter(order => {
      const hasNotesMatch = order.notes?.toLowerCase().includes(term)
      const hasIdMatch = order.id.toLowerCase().includes(term)
      const hasStatusMatch = order.status.toLowerCase().includes(term)
      const hasProductMatch = order.items?.some(item => 
        item.productos?.description.toLowerCase().includes(term) ||
        item.productos?.model?.toLowerCase().includes(term) ||
        item.productos?.order_code?.toLowerCase().includes(term)
      )
      return hasNotesMatch || hasIdMatch || hasStatusMatch || hasProductMatch
    })
  }, [orders, searchTerm])

  // Paginated orders
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * perPage
    return filteredOrders.slice(start, start + perPage)
  }, [filteredOrders, currentPage, perPage])

  // Total pages
  const totalPages = Math.ceil(filteredOrders.length / perPage)

  // Reset pagination on search
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // Form helpers
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

  // Llenar con Faltante logic
  const handleLlenarFaltante = async () => {
    setIsFaltanteLoading(true)
    setFormError(null)
    try {
      const res = await fetch('/api/facturas/missing-products')
      if (!res.ok) throw new Error('Error al consultar faltantes de facturas')
      const json = await res.json()
      const missingData = (json.data || []) as MissingProductItem[]

      if (missingData.length === 0) {
        setFormError('No se encontraron productos faltantes en facturas pendientes.')
        return
      }

      // Convert missing data to purchase order items
      const newItems = missingData.map(item => ({
        product_id: item.product_id,
        quantity: item.missing
      }))

      setItems(newItems)
    } catch (err: any) {
      console.error(err)
      setFormError(err.message || 'Error al obtener faltantes')
    } finally {
      setIsFaltanteLoading(false)
    }
  }

  // Open Modals
  const handleOpenAdd = () => {
    setSelectedOrder(null)
    setNotes('')
    setStatus('PENDING')
    setItems([{ product_id: '', quantity: 1 }])
    setFormError(null)
    setIsEditModalOpen(true)
  }

  const handleOpenEdit = (order: PurchaseOrder) => {
    setSelectedOrder(order)
    setNotes(order.notes || '')
    setStatus(order.status)
    setItems(
      (order.items || []).map(item => ({
        product_id: item.product_id,
        quantity: item.quantity
      }))
    )
    setFormError(null)
    setIsEditModalOpen(true)
  }

  const handleOpenDelete = (order: PurchaseOrder) => {
    setSelectedOrder(order)
    setIsDeleteModalOpen(true)
  }

  // Save Order
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // Validate items
    const validItems = items.filter(item => item.product_id.trim() !== '')
    if (validItems.length === 0) {
      setFormError('La orden de compra debe contener al menos un producto válido.')
      return
    }

    setIsSaving(true)
    try {
      const url = selectedOrder ? `/api/purchase-orders/${selectedOrder.id}` : '/api/purchase-orders'
      const method = selectedOrder ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          notes,
          items: validItems
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al guardar la orden de compra')

      setIsEditModalOpen(false)
      fetchOrders()
      if (!selectedOrder && json.data) {
        handleDownloadExcel(json.data)
      }
    } catch (err: any) {
      console.error(err)
      setFormError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Download PO Excel
  const handleDownloadExcel = async (order: any) => {
    try {
      const res = await fetch(`/api/purchase-orders/${order.id}/download`)
      if (!res.ok) throw new Error('Error al descargar el archivo Excel')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `PO_${order.numero_orden || order.id}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error al descargar Excel')
    }
  }

  // Delete Order
  const handleDelete = async () => {
    if (!selectedOrder) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/purchase-orders/${selectedOrder.id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Error al eliminar la orden de compra')
      setIsDeleteModalOpen(false)
      fetchOrders()
    } catch (err: any) {
      console.error(err)
      alert(err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  // Status badgify
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Pendiente
          </span>
        )
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Surtida
          </span>
        )
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Parcial
          </span>
        )
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Cancelada
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">
            {status}
          </span>
        )
    }
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <ClipboardList className="text-[#0763a9]" size={28} />
              Órdenes de Compra
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('appName')} / Gestión de abastecimiento de mercancías
            </p>
          </div>
          <div className="flex gap-2">
            <PermissionGuard section="purchase_orders" action="create">
              <button 
                onClick={() => setIsImportModalOpen(true)} 
                className="btn-secondary flex items-center gap-2 text-[#0763a9] border-[#0763a9]"
              >
                <FileSpreadsheet size={18} /> Importar Excel
              </button>
            </PermissionGuard>
            <PermissionGuard section="purchase_orders" action="create">
              <button 
                onClick={handleOpenAdd} 
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={18} /> Nueva Orden
              </button>
            </PermissionGuard>
          </div>
        </header>

        {/* Filters */}
        <div className="card p-4 flex flex-col md:flex-row gap-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por notas, ID de orden o producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="erp-input w-full pl-10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="card p-12 flex justify-center bg-white border border-gray-150 rounded-2xl shadow-sm">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-[#0763a9] rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-red-500 bg-red-50 border border-red-100 rounded-2xl">
            {error}
          </div>
        ) : (
          <div className="card overflow-hidden bg-white border border-gray-150 rounded-2xl shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider"># Orden</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Notas</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Productos</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right w-32">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedOrders.map(order => (
                    <tr key={order.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-4">
                        <span className="font-semibold text-sm text-gray-800">{(order as any).numero_orden || order.id.slice(0, 8)}</span>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="p-4 text-sm text-gray-600 max-w-xs truncate">
                        {order.notes || <span className="text-gray-400 italic">Sin observaciones</span>}
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-gray-700">
                          {(order.items || []).length} {(order.items || []).length === 1 ? 'producto' : 'productos'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDownloadExcel(order)}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Descargar Excel"
                          >
                            <FileSpreadsheet size={16} />
                          </button>
                          <PermissionGuard section="purchase_orders" action="edit">
                            <button
                              onClick={() => handleOpenEdit(order)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar orden"
                            >
                              <Edit2 size={16} />
                            </button>
                          </PermissionGuard>
                          <PermissionGuard section="purchase_orders" action="delete">
                            <button
                              onClick={() => handleOpenDelete(order)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar orden"
                            >
                              <Trash2 size={16} />
                            </button>
                          </PermissionGuard>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-400">
                        No se encontraron órdenes de compra.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredOrders.length > 0 && (
              <div className="p-4 border-t border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
                <div>
                  Mostrando {(currentPage - 1) * perPage + 1} a {Math.min(currentPage * perPage, filteredOrders.length)} de {filteredOrders.length} órdenes
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
                  >
                    Anterior
                  </button>
                  <span className="text-xs">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create / Edit Modal */}
        <Modal
          open={isEditModalOpen}
          onClose={() => !isSaving && !isFaltanteLoading && setIsEditModalOpen(false)}
          title={selectedOrder ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
          maxWidth="800px"
        >
          <form onSubmit={handleSave} className="space-y-5">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-sm rounded-xl flex items-start gap-2 animate-shake">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notas / Observaciones</label>
                <textarea
                  rows={2}
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

            {/* Actions for Populating */}
            {!selectedOrder && (
              <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                <span className="text-xs text-gray-400 italic">
                  Completa los productos o usa la función de autoabastecimiento:
                </span>
                <button
                  type="button"
                  onClick={handleLlenarFaltante}
                  disabled={isFaltanteLoading}
                  className="btn-secondary text-xs flex items-center gap-1.5 bg-blue-50/50 hover:bg-blue-50 text-[#0763a9] border-[#0763a9]/10"
                >
                  {isFaltanteLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <FileCheck size={14} />
                  )}
                  Llenar con Faltante
                </button>
              </div>
            )}

            {/* Items list */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-700">Productos Solicitados</h3>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="text-xs text-[#0763a9] hover:text-blue-700 font-semibold flex items-center gap-1"
                >
                  <PlusCircle size={14} /> Agregar Producto
                </button>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-96 overflow-y-auto bg-gray-50/30">
                {items.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-400 w-6">#{idx + 1}</span>
                    
                    <div className="flex-1 min-w-0">
                      <select
                        required
                        value={item.product_id}
                        onChange={e => handleItemChange(idx, 'product_id', e.target.value)}
                        className="erp-input w-full text-sm py-1.5"
                      >
                        <option value="">Selecciona un producto...</option>
                        {products.map(prod => (
                          <option key={prod.id} value={prod.id}>
                            {prod.description} {prod.model ? `(${prod.model})` : ''} {prod.order_code ? ` - ${prod.order_code}` : ''}
                          </option>
                        ))}
                      </select>
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
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="btn-secondary"
                disabled={isSaving || isFaltanteLoading}
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSaving || isFaltanteLoading}
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Guardar Orden'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Delete Modal */}
        <Modal
          open={isDeleteModalOpen}
          onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
          title="Eliminar Orden de Compra"
        >
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              ¿Estás seguro de que deseas eliminar esta orden de compra? Esta acción no se puede deshacer y eliminará permanentemente la orden y sus productos asociados.
            </p>
            {selectedOrder && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs font-mono text-gray-500">
                <div>ID: {selectedOrder.id}</div>
                <div>Creada el: {new Date(selectedOrder.created_at).toLocaleDateString()}</div>
                <div>Productos: {selectedOrder.items?.length || 0} items</div>
              </div>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="btn-secondary"
                disabled={isDeleting}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="btn-primary bg-red-600 border-red-600 hover:bg-red-700 hover:border-red-700 text-white"
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 size={18} className="animate-spin" /> : t('delete')}
              </button>
            </div>
          </div>
        </Modal>

        {/* Import Modal */}
        <ImportModal 
          open={isImportModalOpen} 
          onClose={() => setIsImportModalOpen(false)} 
          onImportSuccess={() => fetchOrders()} 
        />

      </div>
    </AppShell>
  )
}
