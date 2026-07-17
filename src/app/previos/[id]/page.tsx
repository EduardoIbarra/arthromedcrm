'use client'

import { useEffect, useState, Suspense } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { ChevronLeft, FileText, Download, Calendar, User, FileDown, Upload, X, Loader2, Trash2, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Modal from '@/components/Modal'

const CARD = { background: '#ffffff', border: '1px solid #d4e0ec' }

export default function PrevioDetailPage() {
  const { t } = useI18n()
  const params = useParams()
  const router = useRouter()
  const [previo, setPrevio] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // ── Edit product modal state ──
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [productLoading, setProductLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savingProduct, setSavingProduct] = useState(false)
  const [productError, setProductError] = useState<string | null>(null)

  async function openEditProduct(productId: string) {
    setEditingProductId(productId)
    setProductLoading(true)
    setProductError(null)
    setShowProductModal(true)
    try {
      const res = await fetch(`/api/products/${productId}`)
      const json = await res.json()
      if (res.ok) {
        setEditingProduct(json.data)
      } else {
        setProductError(json.error || 'Error al cargar el producto')
      }
    } catch (e: any) {
      setProductError(e.message || 'Error de red')
    } finally {
      setProductLoading(false)
    }
  }

  async function handleProductFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    setProductError(null)
    
    const { supabase } = await import('@/lib/supabase')

    try {
      const urls: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const ext = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
        const filePath = `products/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('product_images')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('product_images').getPublicUrl(filePath)
        urls.push(data.publicUrl)
      }
      setEditingProduct((prev: any) => ({
        ...prev,
        image_urls: [...(prev.image_urls || []), ...urls]
      }))
    } catch (err: any) {
      setProductError(err.message || 'Error al subir imágenes')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function removeProductImage(index: number) {
    setEditingProduct((prev: any) => {
      const urls = [...(prev.image_urls || [])]
      urls.splice(index, 1)
      return { ...prev, image_urls: urls }
    })
  }

  async function saveProductChanges() {
    if (!editingProduct) return
    setSavingProduct(true)
    setProductError(null)
    try {
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingProduct,
          description: editingProduct.nombre
        })
      })
      const json = await res.json()
      if (res.ok) {
        setShowProductModal(false)
        setEditingProduct(null)
        // Refresh details
        if (params.id) {
          const resPrevio = await fetch(`/api/previos/${params.id}`)
          if (resPrevio.ok) {
            const jsonPrevio = await resPrevio.json()
            setPrevio(jsonPrevio.data)
          }
        }
      } else {
        setProductError(json.error || 'Error al guardar cambios')
      }
    } catch (e: any) {
      setProductError(e.message || 'Error de red')
    } finally {
      setSavingProduct(false)
    }
  }

  useEffect(() => {
    async function fetchPrevio() {
      if (!params.id) return
      try {
        const res = await fetch(`/api/previos/${params.id}`)
        if (res.ok) {
          const json = await res.json()
          setPrevio(json.data)
        } else {
          router.push('/previos')
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchPrevio()
  }, [params.id, router])

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-5xl mx-auto py-16 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0763a9', borderTopColor: 'transparent' }} />
        </div>
      </AppShell>
    )
  }

  if (!previo) return null

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link href="/previos" className="btn-ghost text-sm mb-4 inline-flex items-center gap-1">
            <ChevronLeft size={16} /> Volver a Previos
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold font-mono" style={{ color: '#37383a' }}>
                  {previo.folio}
                </h1>
                <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50" style={{ color: '#0763a9' }}>
                  Previo
                </span>
              </div>
              <p className="text-sm" style={{ color: '#8a8b8d' }}>
                ID: {previo.id}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <a 
                href={`/api/previos/${previo.id}/pdf`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-secondary flex items-center gap-2"
              >
                <FileDown size={16} /> Descargar PDF
              </a>

              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/previos/${previo.id}/to-cotizacion`, { method: 'POST' })
                    const data = await res.json()
                    if (res.ok && data.success) {
                      alert(`Convertido con éxito: Cotización ${data.numero}`)
                      router.push(`/cotizaciones/${data.cotizacion_id}`)
                    } else {
                      alert(data.error || 'Error al convertir previo')
                    }
                  } catch (e: any) {
                    alert(e.message || 'Error de red')
                  }
                }}
                className="btn-primary flex items-center gap-2"
              >
                Convertir a Cotización (Alegra)
              </button>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl" style={CARD}>
            <div className="flex items-center gap-2 mb-3" style={{ color: '#5a5b5d' }}>
              <User size={16} />
              <h3 className="text-sm font-semibold">Cliente</h3>
            </div>
            <p className="text-base font-medium" style={{ color: '#37383a' }}>
              {previo.cliente_nombre || 'No especificado'}
            </p>
          </div>

          <div className="p-4 rounded-xl" style={CARD}>
            <div className="flex items-center gap-2 mb-3" style={{ color: '#5a5b5d' }}>
              <Calendar size={16} />
              <h3 className="text-sm font-semibold">Fecha</h3>
            </div>
            <p className="text-base font-medium" style={{ color: '#37383a' }}>
              {new Date(previo.fecha).toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-xl" style={CARD}>
            <div className="flex items-center gap-2 mb-3" style={{ color: '#5a5b5d' }}>
              <FileText size={16} />
              <h3 className="text-sm font-semibold">Totales</h3>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span style={{ color: '#8a8b8d' }}>Subtotal:</span>
                <span className="font-mono font-medium" style={{ color: '#37383a' }}>
                  ${previo.total_sin_descuento?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              {previo.descuento_total_monto > 0 && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#8a8b8d' }}>Descuento:</span>
                  <span className="font-mono font-medium text-red-600">
                    -${previo.descuento_total_monto?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-1 mt-1 border-t border-gray-100">
                <span style={{ color: '#37383a' }}>Total:</span>
                <span className="font-mono" style={{ color: '#0763a9' }}>
                  ${previo.total_con_descuento?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detalle Previo List */}
        <div className="rounded-xl overflow-hidden bg-white" style={CARD}>
          <div className="px-5 py-4 border-b" style={{ borderColor: '#e8f1f9' }}>
            <h2 className="text-lg font-semibold" style={{ color: '#37383a' }}>Detalle de Productos</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #e8f1f9', background: '#fafbfc' }}>
                  <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#8a8b8d' }}>Descripción</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#8a8b8d' }}>Cant.</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#8a8b8d' }}>Precio Unit.</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#8a8b8d' }}>Descuento</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#8a8b8d' }}>IVA</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#8a8b8d' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {previo.detalle_previo?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: '#8a8b8d' }}>
                      No hay productos registrados en este previo.
                    </td>
                  </tr>
                ) : (
                  previo.detalle_previo?.map((item: any, i: number) => (
                    <tr key={item.id || i} style={{ borderBottom: '1px solid #f0f5fa' }}>
                      <td className="px-5 py-3 text-sm font-medium" style={{ color: '#37383a' }}>
                        <div className="flex items-center gap-2">
                          <span>{item.descripcion || 'Producto sin descripción'}</span>
                          {item.producto_id && (
                            <button
                              type="button"
                              onClick={() => openEditProduct(item.producto_id)}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-[#c5d9ee] hover:bg-blue-50 text-blue-600 transition-colors shrink-0"
                            >
                              Editar Imagen
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-right" style={{ color: '#5a5b5d' }}>
                        {item.cantidad}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono" style={{ color: '#5a5b5d' }}>
                        ${item.precio_unitario?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono text-red-600">
                        {item.descuento_monto > 0 ? `-$${item.descuento_monto.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono" style={{ color: '#5a5b5d' }}>
                        ${item.iva_monto?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        {item.iva_porcentaje ? <span className="text-xs text-gray-400 ml-1">({item.iva_porcentaje}%)</span> : null}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono font-semibold" style={{ color: '#0763a9' }}>
                        ${item.subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Product Modal */}
      <Modal
        open={showProductModal}
        onClose={() => !savingProduct && !uploading && setShowProductModal(false)}
        title="Editar Producto"
        maxWidth="500px"
      >
        {productLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-blue-600" />
          </div>
        ) : productError && !editingProduct ? (
          <div className="text-center py-8 text-red-600 space-y-2">
            <p>{productError}</p>
            <button onClick={() => setShowProductModal(false)} className="btn-secondary">Cerrar</button>
          </div>
        ) : editingProduct ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Nombre del Producto</label>
              <p className="text-sm font-medium text-gray-700">{editingProduct.nombre}</p>
            </div>

            {/* Images list */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Imágenes</label>
              <div className="grid grid-cols-3 gap-2">
                {editingProduct.image_urls?.map((url: string, idx: number) => (
                  <div key={idx} className="relative aspect-square rounded-lg border overflow-hidden bg-gray-50 group">
                    <img src={url} alt={`img-${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeProductImage(idx)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                      title="Eliminar imagen"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                {/* Upload box */}
                <label className="relative aspect-square border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-blue-50/50">
                  {uploading ? (
                    <Loader2 size={20} className="animate-spin text-blue-600" />
                  ) : (
                    <>
                      <Upload size={20} className="text-gray-400" />
                      <span className="text-[10px] font-medium text-gray-500 mt-1">Subir Foto</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploading}
                    onChange={handleProductFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {productError && (
              <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg">
                {productError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                disabled={savingProduct || uploading}
                className="btn-secondary text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveProductChanges}
                disabled={savingProduct || uploading}
                className="btn-primary text-sm flex items-center gap-1"
              >
                {savingProduct && <Loader2 size={14} className="animate-spin" />}
                Guardar Cambios
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </AppShell>
  )
}
