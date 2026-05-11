'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { ArrowLeft, Save, Receipt } from 'lucide-react'
import Link from 'next/link'

export default function EditGastoPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [congresos, setCongresos] = useState<{ id: string; name: string }[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: 0,
    iva_percent: 16,
    iva: 0,
    total: 0,
    comments: '',
    congress_id: '',
    category_id: ''
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const { createClient } = await import('@supabase/supabase-js')
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        const supabase = createClient(supabaseUrl, supabaseAnonKey)

        // Fetch congresses
        const congRes = await fetch('/api/congresos')
        if (congRes.ok) {
          const { data } = await congRes.json()
          setCongresos(data)
        }

        // Fetch categories
        const { data: catData } = await supabase.from('catalog_spending_categories').select('id, name').order('name')
        if (catData) setCategories(catData)

        // Fetch gasto
        const res = await fetch(`/api/gastos/${id}`)
        if (!res.ok) throw new Error('Failed to load gasto')
        const { data } = await res.json()
        setFormData({
          name: data.name,
          description: data.description || '',
          amount: data.amount,
          iva_percent: data.iva_percent || 0,
          iva: data.iva,
          total: data.total,
          comments: data.comments || '',
          congress_id: data.congress_id || '',
          category_id: data.category_id || ''
        })
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [id])

  // Auto-calculate total
  useEffect(() => {
    const amount = Number(formData.amount) || 0
    const ivaPercent = Number(formData.iva_percent) || 0
    const ivaAmount = amount * (ivaPercent / 100)
    setFormData(prev => ({ ...prev, iva: ivaAmount, total: amount + ivaAmount }))
  }, [formData.amount, formData.iva_percent])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    
    try {
      const res = await fetch(`/api/gastos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          congress_id: formData.congress_id || null
        })
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to update')
      }
      
      router.push('/gastos')
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 flex justify-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in space-y-6">
        <header className="flex items-center gap-4">
          <Link 
            href="/gastos"
            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Receipt className="text-blue-600" size={28} />
              {t('editGasto')}
            </h1>
          </div>
        </header>

        {error && (
          <div className="card p-4 text-red-500 bg-red-50 border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="card p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('name')} *
              </label>
              <input
                required
                type="text"
                className="erp-input w-full"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('description')}
              </label>
              <textarea
                rows={2}
                className="erp-input w-full"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('amount')} (Subtotal) *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 select-none">$</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  className="erp-input w-full !pl-10"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('iva')} (%) *
              </label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 select-none">%</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  className="erp-input w-full !pr-10"
                  value={formData.iva_percent}
                  onChange={e => setFormData({ ...formData, iva_percent: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('total')}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 select-none">$</span>
                <input
                  disabled
                  type="number"
                  className="erp-input w-full !pl-10 bg-gray-50 font-bold text-blue-600"
                  value={formData.total}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('category')} *
              </label>
              <select
                required
                className="erp-input w-full"
                value={formData.category_id}
                onChange={e => setFormData({ ...formData, category_id: e.target.value })}
              >
                <option value="">-- {t('all')} --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('congresos')} (Opcional)
              </label>
              <select
                className="erp-input w-full"
                value={formData.congress_id}
                onChange={e => setFormData({ ...formData, congress_id: e.target.value })}
              >
                <option value="">-- {t('selectCongress')} --</option>
                {congresos.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('comments')}
              </label>
              <textarea
                rows={3}
                className="erp-input w-full"
                value={formData.comments}
                onChange={e => setFormData({ ...formData, comments: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6 mt-6 border-t border-gray-100">
            <Link href="/gastos" className="btn-secondary">
              {t('cancel')}
            </Link>
            <button 
              type="submit"
              disabled={isSaving}
              className="btn-primary"
            >
              {isSaving ? (
                t('loading')
              ) : (
                <><Save size={18} /> {t('saveChanges')}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
