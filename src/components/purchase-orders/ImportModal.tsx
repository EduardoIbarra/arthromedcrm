import React, { useState, useEffect } from 'react'
import Modal from '@/components/Modal'
import { Loader2, UploadCloud, AlertCircle, CheckCircle2, FileSpreadsheet, Trash2 } from 'lucide-react'
import { Product } from '@/types/database'
import SearchableSelect from '@/components/SearchableSelect'

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onImportSuccess: () => void
}

interface ProcessedItem {
  originalDescription: string
  quantity: number
  matchedProducts: Product[]
  status: 'matched' | 'ambiguous' | 'unmatched'
}

interface ImportData {
  purchaseNumber: string
  items: ProcessedItem[]
}

export default function ImportModal({ open, onClose, onImportSuccess }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importData, setImportData] = useState<ImportData | null>(null)
  
  const [resolvedItems, setResolvedItems] = useState<{ [index: number]: string }>({})
  const [isCreating, setIsCreating] = useState(false)

  // Fetch all products for manual selection dropdown
  const [allProducts, setAllProducts] = useState<Product[]>([])

  useEffect(() => {
    if (open) {
      fetch('/api/products')
        .then(res => res.json())
        .then(json => setAllProducts(json.data || []))
        .catch(err => console.error('Error fetching products:', err))
    } else {
      // Reset state on close
      setFile(null)
      setImportData(null)
      setResolvedItems({})
      setError(null)
    }
  }, [open])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/purchase-orders/import', {
        method: 'POST',
        body: formData
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al procesar el archivo')

      const data: ImportData = json.data
      setImportData(data)

      // Auto-resolve items with exactly one match
      const initialResolved: { [index: number]: string } = {}
      data.items.forEach((item, index) => {
        if (item.status === 'matched' && item.matchedProducts.length === 1) {
          initialResolved[index] = item.matchedProducts[0].id
        }
      })
      setResolvedItems(initialResolved)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleResolveChange = (index: number, productId: string) => {
    setResolvedItems(prev => ({
      ...prev,
      [index]: productId
    }))
  }

  const handleRemoveItem = (index: number) => {
    if (!importData) return
    const newItems = [...importData.items]
    newItems.splice(index, 1)
    
    // Also re-map resolved items
    const newResolved: { [i: number]: string } = {}
    newItems.forEach((_, newIdx) => {
      const oldIdx = newIdx >= index ? newIdx + 1 : newIdx
      if (resolvedItems[oldIdx]) {
        newResolved[newIdx] = resolvedItems[oldIdx]
      }
    })
    
    setImportData({
      ...importData,
      items: newItems
    })
    setResolvedItems(newResolved)
  }

  const handleCreateOrder = async () => {
    if (!importData) return
    
    // Gather all valid resolved items
    const itemsToCreate = importData.items.map((item, index) => {
      const resolvedId = resolvedItems[index]
      if (resolvedId) {
        return {
          product_id: resolvedId,
          quantity: item.quantity
        }
      }
      return null
    }).filter(Boolean)

    if (itemsToCreate.length === 0) {
      setError('Debes seleccionar al menos un producto válido para crear la orden.')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PENDING',
          notes: importData.purchaseNumber
            ? `Importado de Excel (INVOICE NO. ${importData.purchaseNumber})`
            : 'Importado de Excel',
          // Exact invoice number from Excel becomes the PO number
          numero_orden: importData.purchaseNumber?.trim() || undefined,
          items: itemsToCreate
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al crear la orden de compra')

      onImportSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Modal open={open} onClose={() => !isUploading && !isCreating && onClose()} title="Importar Orden de Compra" maxWidth="900px">
      <div className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!importData ? (
          // Upload Step
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-gray-50/50">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Selecciona un archivo Excel</h3>
              <p className="text-sm text-gray-500 max-w-sm mb-6">
                Sube el archivo de la orden de compra (XLS, XLSX). El sistema extraerá los productos y buscará coincidencias.
              </p>
              
              <label className="btn-primary cursor-pointer flex items-center gap-2 relative">
                {isUploading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <UploadCloud size={18} />
                )}
                <span>{file ? file.name : 'Elegir archivo...'}</span>
                <input 
                  type="file" 
                  accept=".xls,.xlsx" 
                  className="hidden" 
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
              <button type="button" onClick={onClose} className="btn-secondary" disabled={isUploading}>
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleUpload} 
                className="btn-primary" 
                disabled={!file || isUploading}
              >
                {isUploading ? 'Procesando...' : 'Analizar Archivo'}
              </button>
            </div>
          </div>
        ) : (
          // Review & Resolve Step
          <div className="space-y-5">
            <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-xl border border-blue-100">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Número de Orden: {importData.purchaseNumber || 'No detectado'}</h3>
                <p className="text-sm text-gray-600">Revisa los productos extraídos y resuelve las coincidencias ambiguas antes de continuar.</p>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-3 text-xs font-bold text-gray-500 uppercase">Descripción Original</th>
                    <th className="p-3 text-xs font-bold text-gray-500 uppercase text-center w-24">Cantidad</th>
                    <th className="p-3 text-xs font-bold text-gray-500 uppercase w-1/2">Producto Asignado</th>
                    <th className="p-3 text-xs font-bold text-gray-500 uppercase w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {importData.items.map((item, idx) => {
                    const isMatched = !!resolvedItems[idx]
                    const hasAmbiguity = item.status === 'ambiguous' && !isMatched

                    return (
                      <tr key={idx} className={`hover:bg-gray-50/50 transition-colors ${hasAmbiguity ? 'bg-amber-50/30' : ''}`}>
                        <td className="p-3 text-sm text-gray-800">
                          <div className="line-clamp-2" title={item.originalDescription}>
                            {item.originalDescription}
                          </div>
                        </td>
                        <td className="p-3 text-sm text-gray-800 text-center font-semibold">
                          {item.quantity}
                        </td>
                        <td className="p-3">
                          {item.status === 'matched' && item.matchedProducts.length === 1 && !resolvedItems[idx] ? (
                            // Auto matched (should be handled by useEffect but just in case)
                            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                              <CheckCircle2 size={16} />
                              <span className="truncate">{item.matchedProducts[0].nombre_lista || item.matchedProducts[0].description} ({item.matchedProducts[0].model})</span>
                            </div>
                          ) : (
                            (() => {
                              const matchedIds = item.status === 'ambiguous' ? new Set(item.matchedProducts.map((mp: any) => mp.id)) : new Set()
                              const options = [
                                ...(item.status === 'ambiguous'
                                  ? item.matchedProducts.map((p: any) => ({
                                      value: p.id,
                                      label: `⭐ ${p.nombre_lista || p.description} ${p.model ? `(${p.model})` : ''}`
                                    }))
                                  : []),
                                ...allProducts
                                    .filter((p: any) => !matchedIds.has(p.id))
                                    .map((p: any) => ({
                                      value: p.id,
                                      label: `${p.nombre_lista || p.description} ${p.model ? `(${p.model})` : ''}`
                                    }))
                              ]
                              return (
                                <SearchableSelect
                                  options={options}
                                  value={resolvedItems[idx] || ''}
                                  onChange={(val) => handleResolveChange(idx, val)}
                                  placeholder="-- Selecciona un producto --"
                                  className={`${hasAmbiguity ? 'border-amber-300 bg-amber-50' : ''} ${isMatched ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : ''}`}
                                />
                              )
                            })()
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button 
                            type="button" 
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Descartar línea"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {importData.items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">
                        No se encontraron productos en el archivo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => { setImportData(null); setFile(null); }} 
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                disabled={isCreating}
              >
                &larr; Volver a subir
              </button>
              
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="btn-secondary" disabled={isCreating}>
                  Cancelar
                </button>
                <button 
                  type="button" 
                  onClick={handleCreateOrder} 
                  className="btn-primary" 
                  disabled={isCreating || Object.keys(resolvedItems).length === 0}
                >
                  {isCreating ? <Loader2 size={18} className="animate-spin" /> : 'Crear Orden'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
