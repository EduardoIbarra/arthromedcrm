'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { 
  ArrowLeft, Save, QrCode, Upload, Loader2, FileText, X, 
  Calendar, MapPin, AlignLeft, Image as ImageIcon, Trash2, 
  Globe, File, Download, Paperclip 
} from 'lucide-react'
import Link from 'next/link'

export default function EditCongresoPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [specialties, setSpecialties] = useState<{ id: string; name: string }[]>([])
  const [customSpecialty, setCustomSpecialty] = useState('')
  const [files, setFiles] = useState<any[]>([])
  const [isUploadingFile, setIsUploadingFile] = useState(false)

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
        const { createClient } = await import('@supabase/supabase-js')
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        const supabase = createClient(supabaseUrl, supabaseAnonKey)
        
        const { data } = await supabase.from('catalog_specialties').select('id, name').order('name')
        if (data) {
          setSpecialties(data)
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchSpecialties()
  }, [])

  const fetchFiles = async () => {
    try {
      const res = await fetch(`/api/congresos/${id}/files`)
      if (res.ok) {
        const { data } = await res.json()
        setFiles(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    const fetchCongreso = async () => {
      try {
        const res = await fetch(`/api/congresos/${id}`)
        if (!res.ok) throw new Error('Failed to load')
        const { data } = await res.json()
        setFormData({
          name: data.name,
          start_date: data.start_date,
          end_date: data.end_date,
          location: data.location,
          description: data.description || '',
          flyer: data.flyer || '',
          specialty_id: data.specialty_id || ''
        })
        fetchFiles()
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCongreso()
  }, [id])

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm(t('deleteFileDesc'))) return
    try {
      const res = await fetch(`/api/congresos/${id}/files/${fileId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchFiles()
      }
    } catch (err) {
      console.error(err)
    }
  }

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
      const res = await fetch(`/api/congresos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to update')
      }
      
      router.push('/congresos')
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleGeneralFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingFile(true)
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const supabase = createClient(supabaseUrl, supabaseAnonKey)

      const ext = file.name.split('.').pop() || ''
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const { data, error: uploadError } = await supabase.storage.from('documents').upload(`congresos/${id}/${fileName}`, file)
      if (uploadError) throw uploadError
      
      const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(data.path)
      
      // Save metadata
      const res = await fetch(`/api/congresos/${id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          url: publicUrlData.publicUrl,
          file_type: file.type,
          size_bytes: file.size
        })
      })
      
      if (res.ok) {
        fetchFiles()
      }
    } catch (err: any) {
      console.error(err)
      setError('Error al subir el archivo: ' + err.message)
    } finally {
      setIsUploadingFile(false)
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
      const fileName = `flyer_${id}_${Date.now()}.${ext}`
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
                {t('editCongress')}
              </h1>
            </div>
          </div>
          <Link 
            href={`/qr?congressId=${id}`} 
            className="btn-secondary bg-white text-blue-600 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <QrCode size={18} /> {t('generateQr')}
          </Link>
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

        <hr className="my-10 border-gray-100" />

        {/* Files Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Paperclip size={24} className="text-blue-600" />
              {t('files')}
            </h2>
            <label className="btn-secondary cursor-pointer">
              {isUploadingFile ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Upload size={18} />
                  {t('addFile')}
                </>
              )}
              <input
                type="file"
                className="hidden"
                onChange={handleGeneralFileUpload}
                disabled={isUploadingFile}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map(file => (
              <div key={file.id} className="card p-4 flex items-center gap-4 group hover:border-blue-200 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <File size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(file.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a 
                    href={file.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    <Download size={16} />
                  </a>
                  <button 
                    onClick={() => handleDeleteFile(file.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {files.length === 0 && (
              <div className="col-span-full py-8 text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                {t('noFiles')}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
