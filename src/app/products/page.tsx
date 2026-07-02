'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Product } from '@/types/database'
import { useI18n } from '@/contexts/I18nContext'
import {
  Search,
  Package,
  ArrowUpDown,
  Edit2,
  Trash2,
  Plus,
  Download,
  X,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import PermissionGuard from '@/components/PermissionGuard'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

// ─── Constants ──────────────────────────────────────────────────────────────

const PRODUCT_LINES = [
  'Plasma',
  'Sistema',
  'Instrumental',
  'Consumibles',
  'Lentes',
  'Otro',
]

const PRODUCT_CATEGORIES = [
  'Plasma > Sistema > Sistema ARS 900*',
  'Plasma > Sistema > Electrodos > UXD 90*',
  'Plasma > Sistema > Electrodos > UXD 70*',
  'Plasma > Sistema > Electrodos > SPINE O UBE*',
  'Plasma > Sistema > Electrodos > UGD*',
  'Plasma > Sistema > Electrodos > UBE NEEDLE*',
  'Plasma > Sistema > Electrodos > CANNON3*',
  'Plasma > Sistema > Electrodos > CANNON*',
  'Plasma > Sistema > Electrodos > SPINE O QFX*',
  'Plasma > Sistema > Electrodos > SPINE FX*',
  'Plasma > Sistema > Electrodos > LUMBA FX*',
  'Plasma > Sistema > Electrodos > CERVA FX*',
  'Plasma > Sistema > Electrodos > TR FORCEPS*',
  'Plasma > Sistema > Electrodos > TB FORCEPS*',
  'Plasma > Sistema > Electrodos > SHAVER & BUR',
  'Sistema > Sistema quirúrgico de potencia RIC 11*',
  'Sistema > Piezas de mano > MMA0* > CHUCK RECTO*',
  'Sistema > Piezas de mano > MMA0* > CHUCK ANGULADO*',
  'Sistema > Piezas de mano > MMB0*',
  'Sistema > Fresas > DGA > Cuchilla',
  'Sistema > Fresas > DGA > Diamante',
  'Sistema > Fresas > DGB > Cuchilla',
  'Sistema > Fresas > DGB > Diamante',
  'Sistema > Consumibles Chucks',
  'Sistema > Instrumental > AX + BX*',
  'Sistema > Instrumental > CX*',
  'Sistema > Lentes > Lente de 0°',
  'Sistema > Lentes > Lente de 30°',
]

type SortField = keyof Pick<Product, 'description' | 'model' | 'order_code' | 'line' | 'sale_price' | 'base_hospital_price' | 'type' | 'subtipo' | 'orden'>

type FormState = {
  description: string
  model: string
  order_code: string
  invoice_concept: string
  generic_description: string
  new_alg_description: string
  measurements: string
  alg_description: string
  sale_price: number | ''
  base_hospital_price: number | ''
  line: string
  type: string
  subtipo: string
  category: string
  specialty_ids: string[]
  image_urls: string[]
}

const EMPTY_FORM: FormState = {
  description: '',
  model: '',
  order_code: '',
  invoice_concept: '',
  generic_description: '',
  new_alg_description: '',
  measurements: '',
  alg_description: '',
  sale_price: '',
  base_hospital_price: '',
  line: '',
  type: 'consumable',
  subtipo: '',
  category: '',
  specialty_ids: [],
  image_urls: [],
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const { t } = useI18n()

  // Data
  const [products, setProducts] = useState<Product[]>([])
  const [specialtiesList, setSpecialtiesList] = useState<{ id: string; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Table state
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('orden')
  const [sortAsc, setSortAsc] = useState(true)
  const [lineFilter, setLineFilter] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [subtipoFilter, setSubtipoFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(20)

  // Modal state
  const [modal, setModal] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/products')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setProducts(json.data as Product[])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetch('/api/catalog/specialties')
      .then(r => r.json())
      .then(j => { if (j.data) setSpecialtiesList(j.data) })
  }, [fetchProducts])

  // ─── Handlers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setFormError(null)
    setSelectedProduct(null)
    setModal('create')
  }

  const openEdit = (product: Product) => {
    setSelectedProduct(product)
    setForm({
      description: product.description,
      model: product.model || '',
      order_code: product.order_code || '',
      invoice_concept: product.invoice_concept || '',
      generic_description: product.generic_description || '',
      new_alg_description: product.new_alg_description || '',
      measurements: product.measurements || '',
      alg_description: product.alg_description || '',
      sale_price: product.sale_price !== null ? product.sale_price : '',
      base_hospital_price: product.base_hospital_price !== null ? product.base_hospital_price : '',
      line: product.line || '',
      type: product.type || 'consumable',
      subtipo: (product as any).subtipo || '',
      category: product.category || '',
      specialty_ids: product.specialty_ids || [],
      image_urls: product.image_urls || [],
    })
    setFormError(null)
    setModal('edit')
  }

  const openDelete = (product: Product) => {
    setSelectedProduct(product)
    setModal('delete')
  }

  const closeModal = () => {
    if (isSaving || isUploading) return
    setModal(null)
    setSelectedProduct(null)
    setFormError(null)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setIsUploading(true)
    setFormError(null)

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
      setForm(prev => ({ ...prev, image_urls: [...prev.image_urls, ...urls] }))
    } catch (err: any) {
      setFormError(err.message || 'Error al subir imágenes')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const removeImage = (index: number) => {
    setForm(prev => {
      const newUrls = [...prev.image_urls]
      newUrls.splice(index, 1)
      return { ...prev, image_urls: newUrls }
    })
  }

  const handleSave = async () => {
    if (!form.description.trim()) {
      setFormError('La descripción es requerida.')
      return
    }
    setIsSaving(true)
    setFormError(null)
    try {
      const isEdit = modal === 'edit' && selectedProduct
      const url = isEdit ? `/api/products/${selectedProduct.id}` : '/api/products'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      setModal(null)
      fetchProducts()
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedProduct) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setModal(null)
      fetchProducts()
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (field === 'image_urls' as any) return // Cannot sort by image
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(true) }
  }

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  // ─── Derived Data ───────────────────────────────────────────────────────

  const uniqueLines = useMemo(() => {
    const lines = new Set<string>()
    products.forEach(p => {
      if (p.line) lines.add(p.line)
    })
    return Array.from(lines).sort()
  }, [products])

  const uniqueTipos = useMemo(() => {
    const tipos = new Set<string>()
    products.forEach(p => {
      if (lineFilter && p.line !== lineFilter) return
      if (p.type) tipos.add(p.type)
    })
    return Array.from(tipos).sort()
  }, [products, lineFilter])

  const uniqueSubtipos = useMemo(() => {
    const subtipos = new Set<string>()
    products.forEach(p => {
      if (lineFilter && p.line !== lineFilter) return
      if (tipoFilter && p.type?.toLowerCase() !== tipoFilter.toLowerCase()) return
      if ((p as any).subtipo) subtipos.add((p as any).subtipo)
    })
    return Array.from(subtipos).sort()
  }, [products, lineFilter, tipoFilter])

  // Reset dependent filters if they are no longer available in the active lists
  useEffect(() => {
    if (tipoFilter && !uniqueTipos.map(t => t.toLowerCase()).includes(tipoFilter.toLowerCase())) {
      setTipoFilter('')
    }
  }, [lineFilter, uniqueTipos, tipoFilter])

  useEffect(() => {
    if (subtipoFilter && !uniqueSubtipos.map(s => s.toLowerCase()).includes(subtipoFilter.toLowerCase())) {
      setSubtipoFilter('')
    }
  }, [lineFilter, tipoFilter, uniqueSubtipos, subtipoFilter])

  const filteredAndSorted = useMemo(() => {
    let result = products
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        (p.description?.toLowerCase() || '').includes(q) ||
        (p.model?.toLowerCase() || '').includes(q) ||
        (p.order_code?.toLowerCase() || '').includes(q) ||
        (p.line?.toLowerCase() || '').includes(q)
      )
    }
    if (lineFilter) {
      result = result.filter(p => p.line === lineFilter)
    }
    if (tipoFilter) {
      result = result.filter(p => p.type?.toLowerCase() === tipoFilter.toLowerCase())
    }
    if (subtipoFilter) {
      result = result.filter(p => (p as any).subtipo?.toLowerCase() === subtipoFilter.toLowerCase())
    }
    return [...result].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (aVal === bVal) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1
      const cmp = aVal < bVal ? -1 : 1
      return sortAsc ? cmp : -cmp
    })
  }, [products, search, lineFilter, tipoFilter, subtipoFilter, sortField, sortAsc])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, lineFilter, tipoFilter, subtipoFilter, perPage])

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * perPage
    return filteredAndSorted.slice(start, start + perPage)
  }, [filteredAndSorted, currentPage, perPage])

  const formatCurrency = (val: number | null) => {
    if (val === null) return '-'
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
  }

  const exportToExcel = () => {
    const headers = [t('description'), t('model'), t('line'), 'Tipo', 'Subtipo', t('salePrice'), t('baseHospitalPrice')]
    const rows = filteredAndSorted.map(p => [
      p.description,
      p.model || '',
      p.line || '',
      p.type || '',
      (p as any).subtipo || '',
      p.sale_price !== null ? p.sale_price : '',
      p.base_hospital_price !== null ? p.base_hospital_price : '',
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `productos_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // ─── Table Column Config ─────────────────────────────────────────────────

  const columns: { key: SortField | 'image_urls'; label: string; sortable?: boolean }[] = [
    { key: 'image_urls', label: 'Imagen', sortable: false },
    { key: 'description', label: t('description'), sortable: true },
    { key: 'model', label: t('model'), sortable: true },
    { key: 'line', label: t('line'), sortable: true },
    { key: 'type', label: 'Tipo', sortable: true },
    { key: 'subtipo', label: 'Subtipo', sortable: true },
    { key: 'sale_price', label: t('salePrice'), sortable: true },
    { key: 'base_hospital_price', label: t('baseHospitalPrice'), sortable: true },
  ]

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">

        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="text-blue-600" size={28} />
              {t('products')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('appName')} / {t('products')}
            </p>
          </div>
          <div className="flex gap-2">
            <PermissionGuard section="products" action="view">
              <button
                onClick={exportToExcel}
                className="btn-secondary text-sm"
                disabled={products.length === 0}
              >
                <Download size={16} /> {t('exportExcel')}
              </button>
            </PermissionGuard>
            <PermissionGuard section="products" action="edit">
              <button
                id="btn-create-product"
                onClick={openCreate}
                className="btn-primary text-sm"
              >
                <Plus size={16} /> Nuevo Producto
              </button>
            </PermissionGuard>
          </div>
        </header>

        {/* Filters */}
        <div className="card p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 bg-white rounded-xl shadow-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              id="product-search"
              type="text"
              placeholder={t('searchProducts')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="erp-input"
              style={{ paddingLeft: '2.5rem' }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto md:min-w-[550px]">
            <div>
              <select
                value={lineFilter}
                onChange={(e) => setLineFilter(e.target.value)}
                className="erp-input w-full"
              >
                <option value="">Todas las líneas</option>
                {uniqueLines.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={tipoFilter}
                onChange={(e) => setTipoFilter(e.target.value)}
                className="erp-input w-full"
              >
                <option value="">Todos los tipos</option>
                {uniqueTipos.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={subtipoFilter}
                onChange={(e) => setSubtipoFilter(e.target.value)}
                className="erp-input w-full"
              >
                <option value="">Todos los subtipos</option>
                {uniqueSubtipos.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="card p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-red-500 bg-red-50 border-red-100">
            {error}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    {columns.map(col => (
                      <th
                        key={col.key}
                        onClick={() => col.sortable !== false ? handleSort(col.key as SortField) : undefined}
                        className={`p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${col.sortable !== false ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          {col.label}
                          {col.sortable !== false && (
                            <ArrowUpDown
                              size={14}
                              className={sortField === col.key ? 'text-blue-600' : 'text-gray-300'}
                            />
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24 text-right">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedProducts.map(product => (
                    <tr key={product.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-4">
                        {product.image_urls && product.image_urls.length > 0 ? (
                          <div className="w-12 h-12 rounded bg-gray-100 border border-gray-200 overflow-hidden relative">
                            <Image src={product.image_urls[0]} alt={product.description} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200">
                            <ImageIcon size={20} />
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-900">{[product.description, product.model].filter(Boolean).join(' - ')}</div>
                        {product.generic_description && (
                          <div className="text-xs text-gray-500 mt-0.5">{product.generic_description}</div>
                        )}
                      </td>
                      <td className="p-4 text-sm text-gray-655 whitespace-nowrap">{product.model || '-'}</td>
                      <td className="p-4 text-sm text-gray-655 whitespace-nowrap">
                        {product.line ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border" style={{
                            backgroundColor: (product as any).line_color ? `${(product as any).line_color}15` : '#F3F4F6',
                            borderColor: (product as any).line_color || '#E5E7EB',
                            color: (product as any).line_color || '#374151'
                          }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: (product as any).line_color || '#9CA3AF' }} />
                            {product.line}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-4 text-sm text-gray-655 whitespace-nowrap">{product.type || '-'}</td>
                      <td className="p-4 text-sm text-gray-655 whitespace-nowrap">{(product as any).subtipo || '-'}</td>
                      <td className="p-4 font-medium text-gray-900 whitespace-nowrap">{formatCurrency(product.sale_price)}</td>
                      <td className="p-4 font-medium text-gray-900 whitespace-nowrap">{formatCurrency(product.base_hospital_price)}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <PermissionGuard section="products" action="edit">
                            <button
                              onClick={() => openEdit(product)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title={t('editProductPrices')}
                            >
                              <Edit2 size={15} />
                            </button>
                          </PermissionGuard>
                          <PermissionGuard section="products" action="edit">
                            <button
                              onClick={() => openDelete(product)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Eliminar producto"
                            >
                              <Trash2 size={15} />
                            </button>
                          </PermissionGuard>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedProducts.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-500">
                        {t('noResults')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span>Mostrar</span>
                <select
                  value={perPage}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                  className="erp-input py-1 px-2 text-sm w-auto min-h-0"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
                <span>por página</span>
              </div>
              
              <div>
                {filteredAndSorted.length > 0 ? (
                  <span>
                    Mostrando {(currentPage - 1) * perPage + 1} a {Math.min(currentPage * perPage, filteredAndSorted.length)} de {filteredAndSorted.length} {t('products').toLowerCase()}
                  </span>
                ) : (
                  <span>0 {t('products').toLowerCase()}</span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredAndSorted.length / perPage), p + 1))}
                  disabled={currentPage === Math.ceil(filteredAndSorted.length / perPage) || filteredAndSorted.length === 0}
                  className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Create / Edit Modal ─────────────────────────────────────────── */}
      <Modal
        open={modal === 'create' || modal === 'edit'}
        onClose={closeModal}
        title={modal === 'create' ? 'Nuevo Producto' : 'Editar Producto'}
        maxWidth="700px"
      >
        <div className="space-y-5">

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción <span className="text-red-500">*</span>
            </label>
            <input
              id="product-description"
              type="text"
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              className="erp-input"
              placeholder="Descripción del producto"
            />
          </div>

          {/* Model + Order Code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <input
                type="text"
                value={form.model}
                onChange={e => setField('model', e.target.value)}
                className="erp-input"
                placeholder="ej. ARS-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código de Pedido</label>
              <input
                type="text"
                value={form.order_code}
                onChange={e => setField('order_code', e.target.value)}
                className="erp-input"
                placeholder="ej. 0001234"
              />
            </div>
          </div>

          {/* Generic description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción Genérica</label>
            <input
              type="text"
              value={form.generic_description}
              onChange={e => setField('generic_description', e.target.value)}
              className="erp-input"
              placeholder="Descripción genérica / complementaria"
            />
          </div>

          {/* Invoice concept + Measurements */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Concepto de Factura</label>
              <input
                type="text"
                value={form.invoice_concept}
                onChange={e => setField('invoice_concept', e.target.value)}
                className="erp-input"
                placeholder="Concepto de factura"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medidas</label>
              <input
                type="text"
                value={form.measurements}
                onChange={e => setField('measurements', e.target.value)}
                className="erp-input"
                placeholder="ej. 10x5cm"
              />
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('salePrice')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.sale_price}
                onChange={e => setField('sale_price', e.target.value === '' ? '' : Number(e.target.value))}
                className="erp-input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('baseHospitalPrice')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.base_hospital_price}
                onChange={e => setField('base_hospital_price', e.target.value === '' ? '' : Number(e.target.value))}
                className="erp-input"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Type + Line + Subtipo */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Línea</label>
              <input
                type="text"
                value={form.line}
                onChange={e => setField('line', e.target.value)}
                className="erp-input"
                placeholder="ej. ENT"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <input
                type="text"
                value={form.type}
                onChange={e => setField('type', e.target.value)}
                className="erp-input"
                placeholder="ej. CONSUMIBLE"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtipo</label>
              <input
                type="text"
                value={form.subtipo}
                onChange={e => setField('subtipo', e.target.value)}
                className="erp-input"
                placeholder="ej. ELECTRODO"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select
              value={form.category}
              onChange={e => setField('category', e.target.value)}
              className="erp-input"
            >
              <option value="">-- Seleccionar --</option>
              {PRODUCT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Specialties */}
          {specialtiesList.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Especialidades</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 max-h-40 overflow-y-auto">
                {specialtiesList.map(spec => (
                  <label key={spec.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white p-1 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={form.specialty_ids.includes(spec.id)}
                      onChange={e => {
                        const ids = e.target.checked
                          ? [...form.specialty_ids, spec.id]
                          : form.specialty_ids.filter(id => id !== spec.id)
                        setField('specialty_ids', ids)
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="truncate">{spec.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Images */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Imágenes del Producto</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-3">
              {form.image_urls.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg border border-gray-200 overflow-hidden group">
                  <Image src={url} alt={`Imagen ${idx + 1}`} fill className="object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 bg-white rounded-full p-0.5 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                    title="Eliminar"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors cursor-pointer bg-gray-50 hover:bg-blue-50/30">
                {isUploading ? (
                  <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload size={20} className="mb-1" />
                    <span className="text-xs font-medium">Subir</span>
                  </>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>
            </div>
          </div>

          {/* Error */}
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={closeModal} className="btn-secondary" disabled={isSaving}>
              {t('cancel')}
            </button>
            <button onClick={handleSave} className="btn-primary" disabled={isSaving}>
              {isSaving ? t('loading') : t('saveChanges')}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Delete Confirm Modal ─────────────────────────────────────────── */}
      <Modal
        open={modal === 'delete'}
        onClose={closeModal}
        title="Eliminar Producto"
        maxWidth="420px"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-medium text-red-800">¿Estás seguro?</p>
              <p className="text-sm text-red-600 mt-0.5">
                Eliminarás permanentemente el producto{' '}
                <strong>"{[selectedProduct?.description, selectedProduct?.model].filter(Boolean).join(' - ')}"</strong>.
                Esta acción no se puede deshacer.
              </p>
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={closeModal} className="btn-secondary" disabled={isSaving}>
              {t('cancel')}
            </button>
            <button
              onClick={handleDelete}
              className="btn-primary"
              disabled={isSaving}
              style={{ background: '#b91c1c' }}
            >
              {isSaving ? t('loading') : 'Eliminar'}
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}
