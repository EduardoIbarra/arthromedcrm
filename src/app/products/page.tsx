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
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import PermissionGuard from '@/components/PermissionGuard'

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

type SortField = keyof Pick<Product, 'description' | 'model' | 'order_code' | 'line' | 'sale_price' | 'base_hospital_price'>

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
  category: string
  specialty_ids: string[]
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
  category: '',
  specialty_ids: [],
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
  const [sortField, setSortField] = useState<SortField>('description')
  const [sortAsc, setSortAsc] = useState(true)

  // Modal state
  const [modal, setModal] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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
      category: product.category || '',
      specialty_ids: product.specialty_ids || [],
    })
    setFormError(null)
    setModal('edit')
  }

  const openDelete = (product: Product) => {
    setSelectedProduct(product)
    setModal('delete')
  }

  const closeModal = () => {
    if (isSaving) return
    setModal(null)
    setSelectedProduct(null)
    setFormError(null)
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
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(true) }
  }

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  // ─── Derived Data ───────────────────────────────────────────────────────

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
    return [...result].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (aVal === bVal) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1
      const cmp = aVal < bVal ? -1 : 1
      return sortAsc ? cmp : -cmp
    })
  }, [products, search, sortField, sortAsc])

  const formatCurrency = (val: number | null) => {
    if (val === null) return '-'
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
  }

  const exportToExcel = () => {
    const headers = [t('description'), t('model'), t('orderCode'), t('line'), t('salePrice'), t('baseHospitalPrice')]
    const rows = filteredAndSorted.map(p => [
      p.description,
      p.model || '',
      p.order_code || '',
      p.line || '',
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

  const columns: { key: SortField; label: string }[] = [
    { key: 'description', label: t('description') },
    { key: 'model', label: t('model') },
    { key: 'order_code', label: t('orderCode') },
    { key: 'line', label: t('line') },
    { key: 'sale_price', label: t('salePrice') },
    { key: 'base_hospital_price', label: t('baseHospitalPrice') },
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

        {/* Search */}
        <div className="card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
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
                        onClick={() => handleSort(col.key)}
                        className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                      >
                        <div className="flex items-center gap-2">
                          {col.label}
                          <ArrowUpDown
                            size={14}
                            className={sortField === col.key ? 'text-blue-600' : 'text-gray-300'}
                          />
                        </div>
                      </th>
                    ))}
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24 text-right">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAndSorted.map(product => (
                    <tr key={product.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-gray-900">{product.description}</div>
                        {product.generic_description && (
                          <div className="text-xs text-gray-500 mt-0.5">{product.generic_description}</div>
                        )}
                      </td>
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{product.model || '-'}</td>
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{product.order_code || '-'}</td>
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{product.line || '-'}</td>
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
                  {filteredAndSorted.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">
                        {t('noResults')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50/30 text-xs text-gray-500 text-right">
              {filteredAndSorted.length} {t('products').toLowerCase()}
              {search && ` de ${products.length} total`}
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

          {/* Type + Line */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={form.type}
                onChange={e => setField('type', e.target.value)}
                className="erp-input"
              >
                <option value="equipment">Equipo</option>
                <option value="consumable">Consumible</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Línea</label>
              <select
                value={form.line}
                onChange={e => setField('line', e.target.value)}
                className="erp-input"
              >
                <option value="">-- Seleccionar --</option>
                {PRODUCT_LINES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
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
                <strong>"{selectedProduct?.description}"</strong>.
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
