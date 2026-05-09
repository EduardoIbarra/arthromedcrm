'use client'

import { useEffect, useState, useMemo, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Hospital, Product, HospitalPrice } from '@/types/database'
import { useI18n } from '@/contexts/I18nContext'
import { Building, ArrowLeft, Search, ArrowUpDown, AlertCircle, Edit2, Download } from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

type PriceRow = Product & {
  hospital_price: number | null
  price_id: string | null
  pending: boolean
}

export default function HospitalPricesPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { t } = useI18n()
  
  const [hospital, setHospital] = useState<Hospital | null>(null)
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<keyof PriceRow>('description')
  const [sortAsc, setSortAsc] = useState(true)

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState<{ product_id: string, description: string, price_id: string | null, price: number | '', pending: boolean }>({
    product_id: '', description: '', price_id: null, price: '', pending: false
  })

  const fetchProperData = async () => {
    try {
      setIsLoading(true)
      const { data: hData, error: hErr } = await supabase
        .from('hospitals')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()
        
      if (hErr) throw hErr
      setHospital(hData as Hospital)

      // Fetch products
      const { data: productsData, error: pErr } = await supabase
        .from('products')
        .select('*')
        
      if (pErr) throw pErr

      // Fetch prices for this hospital
      const { data: pricesData, error: hpErr } = await supabase
        .from('hospital_prices')
        .select('*')
        .eq('hospital_id', resolvedParams.id)

      if (hpErr) throw hpErr

      const priceMap = new Map<string, HospitalPrice>()
      pricesData.forEach((hp: any) => {
        priceMap.set(hp.product_id, hp as HospitalPrice)
      })

      const combined: PriceRow[] = productsData.map((p: any) => {
        const hp = priceMap.get(p.id)
        return {
          ...p,
          hospital_price: hp ? hp.price : null,
          price_id: hp ? hp.id : null,
          pending: hp ? hp.pending : false
        }
      })

      setPrices(combined)

    } catch (err: any) {
      console.error('Error fetching data:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProperData()
  }, [resolvedParams.id])

  const handleOpenEdit = (item: PriceRow) => {
    setEditForm({
      product_id: item.id,
      description: item.description,
      price_id: item.price_id,
      price: item.hospital_price !== null ? item.hospital_price : '',
      pending: item.pending
    })
    setIsEditModalOpen(true)
  }

  const handleSavePrice = async () => {
    if (!editForm.product_id) return
    setIsSaving(true)
    try {
      if (editForm.price === '') {
        // Delete custom price
        if (editForm.price_id) {
          const { error } = await supabase
            .from('hospital_prices')
            .delete()
            .eq('id', editForm.price_id)
          if (error) throw error
        }
      } else {
        // Upsert custom price
        const payload = {
          product_id: editForm.product_id,
          hospital_id: resolvedParams.id,
          price: Number(editForm.price),
          pending: editForm.pending
        }
        
        if (editForm.price_id) {
          const { error } = await supabase
            .from('hospital_prices')
            .update(payload)
            .eq('id', editForm.price_id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('hospital_prices')
            .insert(payload)
          if (error) throw error
        }
      }
      
      setIsEditModalOpen(false)
      fetchProperData()
    } catch (err: any) {
      console.error('Error saving specific price:', err)
      alert(t('error') + ': ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredAndSorted = useMemo(() => {
    let result = prices

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
  }, [prices, search, sortField, sortAsc])

  const exportToExcel = () => {
    const headers = [t('description'), t('model'), t('orderCode'), t('baseHospitalPrice'), t('price'), t('pending')]
    const rows = filteredAndSorted.map(p => [
      p.description,
      p.model || '',
      p.order_code || '',
      p.base_hospital_price !== null ? p.base_hospital_price : '',
      p.hospital_price !== null ? p.hospital_price : '',
      p.pending ? 'Sí' : 'No'
    ])
    
    // Convert to CSV
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
      
    // Add BOM for Excel UTF-8 support
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const hospitalName = hospital ? hospital.name.replace(/\s+/g, '_').toLowerCase() : 'hospital'
    a.download = `precios_${hospitalName}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const handleSort = (field: keyof PriceRow) => {
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
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/hospitals"
          className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Building className="text-blue-600" size={28} />
            {hospital ? hospital.name : t('loading')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('hospitals')} / {t('hospitalPrices')}
          </p>
        </div>
        <button 
          onClick={exportToExcel} 
          className="btn-secondary text-sm ml-auto"
          disabled={prices.length === 0}
        >
          <Download size={16} /> {t('exportExcel')}
        </button>
      </div>

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
                    { key: 'base_hospital_price', label: t('baseHospitalPrice') },
                    { key: 'hospital_price', label: t('price') },
                    { key: 'pending', label: t('pending') },
                  ].map((col) => (
                    <th 
                      key={col.key}
                      onClick={() => handleSort(col.key as keyof PriceRow)}
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
                {filteredAndSorted.map(item => (
                  <tr key={item.id} className={`transition-colors ${item.pending ? 'bg-amber-50/40 hover:bg-amber-50/80' : 'hover:bg-blue-50/30'}`}>
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{item.description}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.generic_description}</div>
                    </td>
                    <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{item.model || '-'}</td>
                    <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{item.order_code || '-'}</td>
                    <td className="p-4 font-medium text-gray-500 whitespace-nowrap">{formatCurrency(item.base_hospital_price)}</td>
                    <td className="p-4 font-bold text-gray-900 whitespace-nowrap">
                      {formatCurrency(item.hospital_price)}
                    </td>
                    <td className="p-4">
                      {item.pending ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          <AlertCircle size={14} />
                          {t('pending')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                          -
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title={t('editSpecificPrice')}
                      >
                        <Edit2 size={16} />
                      </button>
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

      {/* Edit Specific Price Modal */}
      <Modal 
        open={isEditModalOpen} 
        onClose={() => !isSaving && setIsEditModalOpen(false)}
        title={t('editSpecificPrice')}
      >
        <div className="space-y-5">
          <p className="text-sm font-medium text-gray-900">{editForm.description}</p>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('price')}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={editForm.price}
              onChange={(e) => setEditForm({ ...editForm, price: e.target.value === '' ? '' : Number(e.target.value) })}
              className="erp-input w-full"
              placeholder="Dejar en blanco para eliminar el precio específico..."
            />
            <p className="text-xs text-gray-500 mt-1">Si dejas este campo en blanco, se eliminará el precio personalizado y se usará el precio base.</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={editForm.pending}
              onChange={(e) => setEditForm({ ...editForm, pending: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">{t('pending')}</span>
          </label>

          <div className="flex justify-end gap-3 mt-6">
            <button 
              onClick={() => setIsEditModalOpen(false)} 
              className="btn-secondary"
              disabled={isSaving}
            >
              {t('cancel')}
            </button>
            <button 
              onClick={handleSavePrice} 
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
