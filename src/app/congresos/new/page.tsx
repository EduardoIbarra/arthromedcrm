'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { ArrowLeft, Save, Upload, Loader2, FileText, X } from 'lucide-react'
import Link from 'next/link'

export default function NewCongresoPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [specialties, setSpecialties] = useState<{ id: string; name: string }[]>([])
  const [customSpecialty, setCustomSpecialty] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    location: '',
    description: '',
    flyer: '',
    specialty_id: ''
  })

  useEffect(() => {
    // Fetch specialties
    const fetchSpecialties = async () => {
      try {
        // use supabase directly or create an api endpoint? 
        // We already have GET /api/catalog/specialties which returns an array of objects
        // wait, /api/catalog/specialties only returns {name}, let's check its output.
        // Actually I'll use supabase directly since it's a client component.
        const { createClient } = await import('@supabase/supabase-js')
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        const supabase = createClient(supabaseUrl, supabaseAnonKey)
        
        const { data, error } = await supabase.from('catalog_specialties').select('id, name').order('name')
        if (data) {
          setSpecialties(data)
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchSpecialties()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    
    try {
      let finalSpecialtyId = formData.specialty_id

      if (formData.specialty_id === 'new') {
        if (!customSpecialty.trim()) {
          throw new Error('Debe especificar el nombre de la nueva especialidad.')
        }
        const spRes = await fetch('/api/catalog/specialties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: customSpecialty.trim() })
        })
        if (!spRes.ok) {
          const spJson = await spRes.json()
          throw new Error(spJson.error || 'Failed to create specialty')
        }
        const spData = await spRes.json()
        finalSpecialtyId = spData.data.id
      }

      const payload = {
        ...formData,
        specialty_id: finalSpecialtyId || null
      }
      const res = await fetch('/api/congresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to save')
      }
      
      router.push('/congresos')
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const supabase = createClient(supabaseUrl, supabaseAnonKey)

      const ext = file.name.split('.').pop() || 'pdf'
      const fileName = `flyer_${Date.now()}.${ext}`
      const { data, error: uploadError } = await supabase.storage.from('documents').upload(`congresos/${fileName}`, file)
      if (uploadError) throw uploadError
      
      const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(data.path)
      setFormData(p => ({ ...p, flyer: publicUrlData.publicUrl }))
    } catch (err: any) {
      console.error(err)
      setError('Error al subir el archivo: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/congresos"
              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
            >
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                {t('newCongress')}
              </h1>
            </div>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('startDate')} *
              </label>
              <input
                required
                type="date"
                className="erp-input w-full"
                value={formData.start_date}
                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('endDate')} *
              </label>
              <input
                required
                type="date"
                className="erp-input w-full"
                value={formData.end_date}
                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('location')} *
              </label>
              <input
                required
                type="text"
                className="erp-input w-full"
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('description')}
              </label>
              <textarea
                rows={3}
                className="erp-input w-full"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('specialty')}
              </label>
              <select
                className="erp-input w-full"
                value={formData.specialty_id}
                onChange={e => setFormData({ ...formData, specialty_id: e.target.value })}
              >
                <option value="">-- Seleccionar --</option>
                {specialties.map(sp => (
                  <option key={sp.id} value={sp.id}>{sp.name}</option>
                ))}
                <option value="new" className="font-semibold text-blue-600">+ Crear nueva especialidad</option>
              </select>
              
              {formData.specialty_id === 'new' && (
                <div className="mt-2">
                  <input
                    type="text"
                    required
                    placeholder="Nombre de la especialidad..."
                    className="erp-input w-full border-blue-400 focus:ring-blue-100"
                    value={customSpecialty}
                    onChange={e => setCustomSpecialty(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('flyer')}
              </label>
              <div className="space-y-2">
                {formData.flyer && (
                  <div className="flex items-center gap-2">
                    <a href={formData.flyer} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate">
                      <FileText size={16} /> Ver archivo adjunto
                    </a>
                    <button type="button" onClick={() => setFormData(p => ({ ...p, flyer: '' }))} className="text-red-500 hover:text-red-700 p-1 rounded transition-colors" title="Eliminar archivo">
                      <X size={16} />
                    </button>
                  </div>
                )}
                <label className="btn-secondary w-full justify-center cursor-pointer text-sm">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploading ? 'Subiendo...' : (formData.flyer ? 'Reemplazar Archivo' : 'Subir Imagen o PDF')}
                  <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
              </div>
            </div>

          </div>

          <div className="flex justify-end gap-4 pt-6 mt-6 border-t border-gray-100">
            <Link href="/congresos" className="btn-secondary">
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
