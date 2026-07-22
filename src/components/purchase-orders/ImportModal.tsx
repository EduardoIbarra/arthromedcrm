import React, { useState, useEffect } from 'react'
import Modal from '@/components/Modal'
import { Loader2, UploadCloud, AlertCircle, CheckCircle2, FileSpreadsheet, Trash2, Layers } from 'lucide-react'
import { Product } from '@/types/database'
import SearchableSelect from '@/components/SearchableSelect'

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onImportSuccess: () => void
  isPreOrder?: boolean
}

interface ProcessedItem {
  originalDescription: string
  quantity: number
  matchedProducts: Product[]
  status: 'matched' | 'ambiguous' | 'unmatched'
}

interface FileImportResult {
  fileName: string
  purchaseNumber: string
  items: ProcessedItem[]
  resolvedItems: { [index: number]: string }
}

export default function ImportModal({ open, onClose, onImportSuccess, isPreOrder = true }: ImportModalProps) {
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [fileResults, setFileResults] = useState<FileImportResult[]>([])
  const [activeFileIdx, setActiveFileIdx] = useState<number>(0)
  const [isCreating, setIsCreating] = useState(false)

  const [allProducts, setAllProducts] = useState<Product[]>([])

  useEffect(() => {
    if (open) {
      fetch('/api/products')
        .then(res => res.json())
        .then(json => setAllProducts(json.data || []))
        .catch(err => console.error('Error fetching products:', err))
    } else {
      setFiles([])
      setFileResults([])
      setActiveFileIdx(0)
      setError(null)
    }
  }, [open])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setIsUploading(true)
    setError(null)
    const results: FileImportResult[] = []

    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/purchase-orders/import', {
          method: 'POST',
          body: formData
        })

        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || `Error al procesar el archivo ${file.name}`)
        }

        const data = json.data
        const initialResolved: { [index: number]: string } = {}
        
        data.items.forEach((item: ProcessedItem, index: number) => {
          if (item.status === 'matched' && item.matchedProducts.length === 1) {
            initialResolved[index] = item.matchedProducts[0].id
          } else if (item.matchedProducts.length > 0) {
            initialResolved[index] = item.matchedProducts[0].id
          }
        })

        results.push({
          fileName: file.name,
          purchaseNumber: data.purchaseNumber || '',
          items: data.items || [],
          resolvedItems: initialResolved
        })
      }

      setFileResults(results)
      setActiveFileIdx(0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleResolveChange = (fileIdx: number, itemIdx: number, productId: string) => {
    setFileResults(prev => {
      const copy = [...prev]
      copy[fileIdx] = {
        ...copy[fileIdx],
        resolvedItems: {
          ...copy[fileIdx].resolvedItems,
          [itemIdx]: productId
        }
      }
      return copy
    })
  }

  const handleRemoveItem = (fileIdx: number, itemIdx: number) => {
    setFileResults(prev => {
      const copy = [...prev]
      const fileData = copy[fileIdx]
      const newItems = [...fileData.items]
      newItems.splice(itemIdx, 1)

      const newResolved: { [i: number]: string } = {}
      newItems.forEach((_, newIdx) => {
        const oldIdx = newIdx >= itemIdx ? newIdx + 1 : newIdx
        if (fileData.resolvedItems[oldIdx]) {
          newResolved[newIdx] = fileData.resolvedItems[oldIdx]
        }
      })

      copy[fileIdx] = {
        ...fileData,
        items: newItems,
        resolvedItems: newResolved
      }
      return copy
    })
  }

  const handleCreateOrders = async () => {
    if (fileResults.length === 0) return

    setIsCreating(true)
    setError(null)

    try {
      for (const fResult of fileResults) {
        const itemsToCreate = fResult.items.map((item, index) => {
          const resolvedId = fResult.resolvedItems[index]
          if (resolvedId) {
            return {
              product_id: resolvedId,
              quantity: item.quantity
            }
          }
          return null
        }).filter(Boolean)

        if (itemsToCreate.length === 0) continue

        const res = await fetch('/api/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'PENDING',
            notes: fResult.purchaseNumber
              ? `Importado de Excel (${fResult.purchaseNumber})`
              : `Importado de ${fResult.fileName}`,
            numero_orden: fResult.purchaseNumber?.trim() || undefined,
            es_pre_orden: isPreOrder,
            items: itemsToCreate
          })
        })

        const json = await res.json()
        if (!res.ok) throw new Error(json.error || `Error al crear orden para ${fResult.fileName}`)
      }

      onImportSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsCreating(false)
    }
  }

  const activeResult = fileResults[activeFileIdx]

  return (
    <Modal
      open={open}
      onClose={() => !isUploading && !isCreating && onClose()}
      title={isPreOrder ? "Importación Masiva de Pre Órdenes de Compra" : "Importar Órdenes de Compra"}
      maxWidth="950px"
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {fileResults.length === 0 ? (
          // Upload Step (Supports multiple files)
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-gray-50/50">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                <Layers size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Selecciona uno o varios archivos Excel</h3>
              <p className="text-sm text-gray-500 max-w-md mb-6">
                Puedes seleccionar múltiples archivos (.xlsx, .xls) a la vez para importación masiva de pre-órdenes.
              </p>
              
              <label className="btn-primary cursor-pointer flex items-center gap-2 relative">
                {isUploading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <UploadCloud size={18} />
                )}
                <span>
                  {files.length === 0
                    ? 'Elegir archivos Excel...'
                    : `${files.length} archivo(s) seleccionado(s)`}
                </span>
                <input 
                  type="file" 
                  accept=".xls,.xlsx" 
                  multiple
                  className="hidden" 
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
              </label>

              {files.length > 0 && (
                <div className="mt-4 text-xs text-gray-600 flex flex-wrap gap-2 justify-center max-h-24 overflow-y-auto">
                  {files.map((f, i) => (
                    <span key={i} className="bg-white border border-gray-200 px-2 py-1 rounded-md shadow-xs">
                      📄 {f.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
              <button type="button" onClick={onClose} className="btn-secondary" disabled={isUploading}>
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleUpload} 
                className="btn-primary" 
                disabled={files.length === 0 || isUploading}
              >
                {isUploading ? 'Procesando...' : `Analizar ${files.length > 1 ? `${files.length} Archivos` : 'Archivo'}`}
              </button>
            </div>
          </div>
        ) : (
          // Review & Resolve Step
          <div className="space-y-5">
            {/* File Tabs */}
            {fileResults.length > 1 && (
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
                {fileResults.map((res, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveFileIdx(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeFileIdx === idx
                        ? 'bg-[#0763a9] text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    📄 {res.purchaseNumber || res.fileName} ({res.items.length})
                  </button>
                ))}
              </div>
            )}

            {activeResult && (
              <>
                <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">
                      Orden / Archivo: {activeResult.purchaseNumber || activeResult.fileName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Revisa y confirma la asignación de productos. Los productos sugeridos (guesses) aparecen arriba marcados con estrella ⭐.
                    </p>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="p-3 text-xs font-bold text-gray-500 uppercase">Descripción Original</th>
                          <th className="p-3 text-xs font-bold text-gray-500 uppercase text-center w-24">Cantidad</th>
                          <th className="p-3 text-xs font-bold text-gray-500 uppercase w-1/2">Producto Asignado</th>
                          <th className="p-3 text-xs font-bold text-gray-500 uppercase w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {activeResult.items.map((item, itemIdx) => {
                          const resolvedId = activeResult.resolvedItems[itemIdx]
                          const isMatched = !!resolvedId

                          // Find resolved product to extract line_color
                          const selectedProduct = resolvedId
                            ? (item.matchedProducts.find(p => p.id === resolvedId) || allProducts.find(p => p.id === resolvedId))
                            : null
                          const lineColor = selectedProduct?.line_color

                          // Build dropdown options: Guesses at top (starred ⭐), then all other DB products
                          const guessSet = new Set(item.matchedProducts.map(mp => mp.id))
                          const guessOptions = item.matchedProducts.map(p => ({
                            value: p.id,
                            label: `⭐ ${p.nombre_lista || (p as any).nombre || p.description} ${p.model ? `(${p.model})` : ''} ${(p as any).alegra_id ? '[Alegra ID]' : ''}`
                          }))

                          const otherOptions = allProducts
                            .filter(p => !guessSet.has(p.id))
                            .sort((a: any, b: any) => {
                              const aAlg = a.alegra_id ? 1 : 0
                              const bAlg = b.alegra_id ? 1 : 0
                              if (bAlg !== aAlg) return bAlg - aAlg

                              const aLista = a.nombre_lista ? 1 : 0
                              const bLista = b.nombre_lista ? 1 : 0
                              if (bLista !== aLista) return bLista - aLista

                              const aName = a.nombre_lista || a.nombre || a.description || ''
                              const bName = b.nombre_lista || b.nombre || b.description || ''
                              return aName.localeCompare(bName, 'es')
                            })
                            .map(p => ({
                              value: p.id,
                              label: `${p.nombre_lista || (p as any).nombre || p.description} ${p.model ? `(${p.model})` : ''}`
                            }))

                          const selectOptions = [...guessOptions, ...otherOptions]

                          const rowStyle = lineColor
                            ? { backgroundColor: `${lineColor}18` }
                            : undefined

                          return (
                            <tr
                              key={itemIdx}
                              style={rowStyle}
                              className="hover:brightness-95 transition-all border-b border-gray-100"
                            >
                              <td className="p-3 text-sm text-gray-800">
                                <div className="line-clamp-2" title={item.originalDescription}>
                                  {item.originalDescription}
                                </div>
                              </td>
                              <td className="p-3 text-sm text-gray-800 text-center font-semibold">
                                {item.quantity}
                              </td>
                              <td className="p-3">
                                <SearchableSelect
                                  options={selectOptions}
                                  value={resolvedId || ''}
                                  onChange={(val) => handleResolveChange(activeFileIdx, itemIdx, val)}
                                  placeholder="-- Selecciona un producto --"
                                  className={isMatched ? 'border-emerald-200 bg-white/80 text-emerald-800' : 'border-amber-300 bg-amber-50'}
                                />
                              </td>
                              <td className="p-3 text-center">
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoveItem(activeFileIdx, itemIdx)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Descartar línea"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                        {activeResult.items.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-gray-500">
                              No se encontraron productos en este archivo.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => { setFileResults([]); setFiles([]); }} 
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
                  onClick={handleCreateOrders} 
                  className="btn-primary" 
                  disabled={isCreating || fileResults.every(r => Object.keys(r.resolvedItems).length === 0)}
                >
                  {isCreating ? <Loader2 size={18} className="animate-spin" /> : `Crear ${fileResults.length > 1 ? `${fileResults.length} Pre Órdenes` : 'Pre Orden'}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
