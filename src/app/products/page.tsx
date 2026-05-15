'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Product } from '@/types/database'
import { useI18n } from '@/contexts/I18nContext'
import { Search, Package, ArrowUpDown, Edit2, Download } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import PermissionGuard from '@/components/PermissionGuard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const PRODUCT_CATEGORIES = [
  "Plasma > Sistema > Sistema ARS 900*",
  "Plasma > Sistema > Electrodos > UXD 90*",
  "Plasma > Sistema > Electrodos > UXD 70*",
  "Plasma > Sistema > Electrodos > SPINE O UBE*",
  "Plasma > Sistema > Electrodos > UGD*",
  "Plasma > Sistema > Electrodos > UBE NEEDLE*",
  "Plasma > Sistema > Electrodos > CANNON3*",
  "Plasma > Sistema > Electrodos > CANNON*",
  "Plasma > Sistema > Electrodos > SPINE O QFX*",
  "Plasma > Sistema > Electrodos > SPINE FX*",
  "Plasma > Sistema > Electrodos > LUMBA FX*",
  "Plasma > Sistema > Electrodos > CERVA FX*",
  "Plasma > Sistema > Electrodos > TR FORCEPS*",
  "Plasma > Sistema > Electrodos > TB FORCEPS*",
  "Plasma > Sistema > Electrodos > SHAVER & BUR",
  "Sistema > Sistema quirúrgico de potencia RIC 11*",
  "Sistema > Piezas de mano > MMA0* > CHUCK RECTO*",
  "Sistema > Piezas de mano > MMA0* > CHUCK ANGULADO*",
  "Sistema > Piezas de mano > MMB0*",
  "Sistema > Fresas > DGA > Cuchilla",
  "Sistema > Fresas > DGA > Diamante",
  "Sistema > Fresas > DGB > Cuchilla",
  "Sistema > Fresas > DGB > Diamante",
  "Sistema > Consumibles Chucks",
  "Sistema > Instrumental > AX + BX*",
  "Sistema > Instrumental > CX*",
  "Sistema > Lentes > Lente de 0°",
  "Sistema > Lentes > Lente de 30°",
]

export default function ProductsPage() {
  const { t } = useI18n()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<keyof Product>('description')
  const [sortAsc, setSortAsc] = useState(true)

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [specialtiesList, setSpecialtiesList] = useState<{ id: string, name: string }[]>([])
  const [editForm, setEditForm] = useState<{ 
    id: string, 
    sale_price: number | '', 
    base_hospital_price: number | '',
    type: string,
    category: string,
    specialty_ids: string[]
  }>({
    id: '', 
    sale_price: '', 
    base_hospital_price: '',
    type: 'consumable',
    category: '',
    specialty_ids: []
  })

  const fetchProducts = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('description')
        
      if (error) throw error
      setProducts(data as Product[])
    } catch (err: any) {
      console.error('Error fetching products:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchSpecialties()
  }, [])

  const fetchSpecialties = async () => {
    const { data } = await supabase.from('catalog_specialties').select('*').order('name')
    if (data) setSpecialtiesList(data)
  }

  const handleOpenEdit = (product: Product) => {
    setEditForm({
      id: product.id,
      sale_price: product.sale_price !== null ? product.sale_price : '',
      base_hospital_price: product.base_hospital_price !== null ? product.base_hospital_price : '',
      type: product.type || 'consumable',
      category: product.category || '',
      specialty_ids: product.specialty_ids || []
    })
    setIsEditModalOpen(true)
  }

  const handleSavePrices = async () => {
    if (!editForm.id) return
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('products')
        .update({
          sale_price: editForm.sale_price === '' ? null : Number(editForm.sale_price),
          base_hospital_price: editForm.base_hospital_price === '' ? null : Number(editForm.base_hospital_price),
          type: editForm.type,
          category: editForm.category,
          specialty_ids: editForm.specialty_ids,
          updated_at: new Date().toISOString()
        })
        .eq('id', editForm.id)
        
      if (error) throw error
      setIsEditModalOpen(false)
      fetchProducts()
    } catch (err: any) {
      console.error('Error updating prices:', err)
      alert(t('error') + ': ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredAndSorted = useMemo(() => {
    let result = products

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p => 
        (p.description?.toLowerCase() || '').includes(q) ||
        (p.model?.toLowerCase() || '').includes(q) ||
        (p.order_code?.toLowerCase() || '').includes(q)
      )
    }

    result = [...result].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (aVal === bVal) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1
      
      const comparison = aVal < bVal ? -1 : 1
      return sortAsc ? comparison : -comparison
    })

    return result
  }, [products, search, sortField, sortAsc])

  const exportToExcel = () => {
    const headers = [t('description'), t('model'), t('orderCode'), t('line'), t('salePrice'), t('baseHospitalPrice')]
    const rows = filteredAndSorted.map(p => [
      p.description,
      p.model || '',
      p.order_code || '',
      p.line || '',
      p.sale_price !== null ? p.sale_price : '',
      p.base_hospital_price !== null ? p.base_hospital_price : ''
    ])
    
    // Convert to CSV
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
      
    // Add BOM for Excel UTF-8 support
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `productos_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const handleSort = (field: keyof Product) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const formatCurrency = (val: number | null) => {
    if (val === null) return '-'
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">
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
        <PermissionGuard section="products" action="view">
          <button 
            onClick={exportToExcel} 
            className="btn-secondary text-sm"
            disabled={products.length === 0}
          >
            <Download size={16} /> {t('exportExcel')}
          </button>
        </PermissionGuard>
      </header>

      <div className="card p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder={t('searchProducts')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="erp-input pl-10"
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="card p-12 flex justify-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
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
                  {[
                    { key: 'description', label: t('description') },
                    { key: 'model', label: t('model') },
                    { key: 'order_code', label: t('orderCode') },
                    { key: 'line', label: t('line') },
                    { key: 'sale_price', label: t('salePrice') },
                    { key: 'base_hospital_price', label: t('baseHospitalPrice') },
                  ].map((col) => (
                    <th 
                      key={col.key}
                      onClick={() => handleSort(col.key as keyof Product)}
                      className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        {col.label}
                        <ArrowUpDown size={14} className={sortField === col.key ? 'text-blue-600' : 'text-gray-300'} />
                      </div>
                    </th>
                  ))}
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap w-16">
                    {t('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAndSorted.map(product => (
                  <tr key={product.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{product.description}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{product.generic_description}</div>
                    </td>
                    <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{product.model || '-'}</td>
                    <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{product.order_code || '-'}</td>
                    <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{product.line || '-'}</td>
                    <td className="p-4 font-medium text-gray-900 whitespace-nowrap">{formatCurrency(product.sale_price)}</td>
                    <td className="p-4 font-medium text-gray-900 whitespace-nowrap">{formatCurrency(product.base_hospital_price)}</td>
                    <td className="p-4">
                      <PermissionGuard section="products" action="edit">
                        <button
                          onClick={() => handleOpenEdit(product)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title={t('editProductPrices')}
                        >
                          <Edit2 size={16} />
                        </button>
                      </PermissionGuard>
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
          </div>
        </div>
      )}

      {/* Edit Prices Modal */}
      <Modal 
        open={isEditModalOpen} 
        onClose={() => !isSaving && setIsEditModalOpen(false)}
        title={t('editProductPrices')}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 mb-4">{products.find(p => p.id === editForm.id)?.description}</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('salePrice')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editForm.sale_price}
                onChange={(e) => setEditForm({ ...editForm, sale_price: e.target.value === '' ? '' : Number(e.target.value) })}
                className="erp-input w-full"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('baseHospitalPrice')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editForm.base_hospital_price}
                onChange={(e) => setEditForm({ ...editForm, base_hospital_price: e.target.value === '' ? '' : Number(e.target.value) })}
                className="erp-input w-full"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Producto
              </label>
              <select
                value={editForm.type}
                onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                className="erp-input w-full"
              >
                <option value="equipment">Equipo</option>
                <option value="consumable">Consumible</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoría
              </label>
              <select
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                className="erp-input w-full"
              >
                <option value="">-- Seleccionar --</option>
                {PRODUCT_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Especialidades
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 max-h-48 overflow-y-auto">
              {specialtiesList.map(spec => (
                <label key={spec.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white p-1 rounded transition-colors">
                  <input
                    type="checkbox"
                    checked={editForm.specialty_ids.includes(spec.id)}
                    onChange={(e) => {
                      const ids = e.target.checked 
                        ? [...editForm.specialty_ids, spec.id]
                        : editForm.specialty_ids.filter(id => id !== spec.id)
                      setEditForm({ ...editForm, specialty_ids: ids })
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="truncate">{spec.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button 
              onClick={() => setIsEditModalOpen(false)} 
              className="btn-secondary"
              disabled={isSaving}
            >
              {t('cancel')}
            </button>
            <button 
              onClick={handleSavePrices} 
              className="btn-primary"
              disabled={isSaving}
            >
              {isSaving ? t('loading') : t('saveChanges')}
            </button>
          </div>
        </div>
      </Modal>

    </div>
    </AppShell>
  )
}
