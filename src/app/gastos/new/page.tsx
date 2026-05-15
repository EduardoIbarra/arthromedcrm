'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { ArrowLeft, Save, Receipt, Upload, X, FileText, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NewGastoPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [congresos, setCongresos] = useState<{ id: string; name: string }[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [uploading, setUploading] = useState<string | null>(null) // 'invoice' | 'general' | null

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: 0,
    iva_percent: 16,
    iva: 0,
    total: 0,
    comments: '',
    card: '',
    congress_id: '',
    category_id: '',
    is_billable: false,
    is_billed: false,
    folio_fiscal: '',
    invoice_url: '',
    expense_date: new Date().toISOString().split('T')[0]
  })

  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([])

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch congresses
        const congRes = await fetch('/api/congresos')
        if (congRes.ok) {
          const { data } = await congRes.json()
          setCongresos(data)
        }

        // Fetch categories
        const { data: catData } = await supabase.from('catalog_spending_categories').select('id, name').order('name')
        if (catData) setCategories(catData)
      } catch (err) {
        console.error(err)
      }
    }
    fetchData()
  }, [])

  // Auto-calculate total
  useEffect(() => {
    const amount = Number(formData.amount) || 0
    const ivaPercent = Number(formData.iva_percent) || 0
    const ivaAmount = amount * (ivaPercent / 100)
    setFormData(prev => ({ ...prev, iva: ivaAmount, total: amount + ivaAmount }))
  }, [formData.amount, formData.iva_percent])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'general') => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(type)
    try {
      const ext = file.name.split('.').pop() || 'pdf'
      const timestamp = Date.now()
      const fileName = `${type}_${timestamp}.${ext}`
      const { data, error: uploadError } = await supabase.storage.from('documents').upload(`gastos/${fileName}`, file)
      if (uploadError) throw uploadError
      
      const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(data.path)
      const url = publicUrlData.publicUrl

      if (type === 'invoice') {
        setFormData(p => ({ ...p, invoice_url: url }))
      } else {
        setAttachments(p => [...p, { name: file.name, url }])
      }
    } catch (err: any) {
      console.error(err)
      setError('Error al subir el archivo: ' + err.message)
    } finally {
      setUploading(null)
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    
    try {
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          congress_id: formData.congress_id || null,
          category_id: formData.category_id || null,
          attachments // Send attachments list
        })
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to create')
      }
      
      router.push('/gastos')
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
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
              {t('newGasto')}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('expenseDate')} *
              </label>
              <input
                required
                type="date"
                className="erp-input w-full"
                value={formData.expense_date}
                onChange={e => setFormData({ ...formData, expense_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('name')} *
              </label>
              <input
                required
                type="text"
                className="erp-input w-full"
                placeholder="Ej. Renta de equipo, Cofee break, etc."
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
                {t('card')}
              </label>
              <input
                type="text"
                className="erp-input w-full"
                placeholder="Ej. Tarjeta 8841, Efectivo, etc."
                value={formData.card}
                onChange={e => setFormData({ ...formData, card: e.target.value })}
              />
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

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  checked={formData.is_billable}
                  onChange={e => setFormData({ ...formData, is_billable: e.target.checked })}
                />
                <span className="text-sm font-medium text-gray-700">{t('billable')}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  checked={formData.is_billed}
                  onChange={e => setFormData({ ...formData, is_billed: e.target.checked })}
                />
                <span className="text-sm font-medium text-gray-700">{t('billed')}</span>
              </label>
            </div>

            {/* Billing Details (Conditional) */}
            {formData.is_billed && (
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 animate-slide-down">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('fiscalFolio')}
                  </label>
                  <input
                    type="text"
                    className="erp-input w-full bg-white"
                    placeholder={t('fiscalFolioPlaceholder') as string}
                    value={formData.folio_fiscal}
                    onChange={e => setFormData({ ...formData, folio_fiscal: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('invoiceFile')}
                  </label>
                  <div className="space-y-2">
                    {formData.invoice_url && (
                      <div className="flex items-center gap-2">
                        <a href={formData.invoice_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate">
                          <FileText size={16} /> {t('viewInvoice')}
                        </a>
                        <button type="button" onClick={() => setFormData(p => ({ ...p, invoice_url: '' }))} className="text-red-500 hover:text-red-700 p-1 rounded transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    <label className="btn-secondary w-full justify-center cursor-pointer text-sm bg-white">
                      {uploading === 'invoice' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {uploading === 'invoice' ? t('uploading') : (formData.invoice_url ? t('replace') : t('uploadInvoice'))}
                      <input type="file" accept=".pdf,.xml,image/*" className="hidden" onChange={e => handleFileUpload(e, 'invoice')} disabled={!!uploading} />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* General Attachments */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('attachmentsDetails')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <a href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate text-blue-600 hover:underline">
                      <FileText size={18} className="text-gray-400" />
                      <span className="text-sm truncate">{att.name}</span>
                    </a>
                    <button type="button" onClick={() => removeAttachment(idx)} className="text-gray-400 hover:text-red-500 p-1">
                      <X size={16} />
                    </button>
                  </div>
                ))}
                
                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group">
                  {uploading === 'general' ? <Loader2 size={20} className="animate-spin text-blue-600" /> : <Upload size={20} className="text-gray-400 group-hover:text-blue-600" />}
                  <span className="text-sm font-medium text-gray-500 group-hover:text-blue-600">
                    {uploading === 'general' ? t('uploading') : t('attachFile')}
                  </span>
                  <input type="file" multiple className="hidden" onChange={e => handleFileUpload(e, 'general')} disabled={!!uploading} />
                </label>
              </div>
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
