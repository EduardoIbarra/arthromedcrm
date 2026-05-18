'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { 
  ArrowLeft, Save, QrCode, Upload, Loader2, FileText, X, 
  Calendar, MapPin, AlignLeft, Image as ImageIcon, Trash2, 
  Globe, File, Download, Paperclip, Plus, Users, User, DollarSign, Phone, Mail
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function EditCongresoPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [availableSpecialties, setAvailableSpecialties] = useState<{ id: string; name: string }[]>([])
  const [customSpecialty, setCustomSpecialty] = useState('')
  const [showCustomSpecialty, setShowCustomSpecialty] = useState(false)
  const [files, setFiles] = useState<any[]>([])
  const [isUploadingFile, setIsUploadingFile] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    location: '',
    description: '',
    terms_doctor: '',
    terms_distributor: '',
    enable_workshops: true,
    flyer: '',
    specialty_ids: [] as string[]
  })

  const [workshops, setWorkshops] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])

  const supabase = createClient()

  useEffect(() => {
    const fetchSpecialties = async () => {
      try {
        const { data } = await supabase.from('catalog_specialties').select('id, name').order('name')
        if (data) {
          setAvailableSpecialties(data)
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
          start_date: data.start_date ? new Date(data.start_date).toISOString().split('T')[0] : '',
          end_date: data.end_date ? new Date(data.end_date).toISOString().split('T')[0] : '',
          location: data.location,
          description: data.description || '',
          terms_doctor: data.terms_doctor || '',
          terms_distributor: data.terms_distributor || '',
          enable_workshops: data.enable_workshops !== false,
          flyer: data.flyer || '',
          specialty_ids: data.specialty_ids || []
        })
        setWorkshops(data.workshops || [])
        setContacts(data.contacts || [])
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

  const addWorkshop = () => {
    setWorkshops([...workshops, { name: '', date_time: '', max_people: 20, cost: 0, professor: '' }])
  }

  const removeWorkshop = (index: number) => {
    setWorkshops(workshops.filter((_, i) => i !== index))
  }

  const updateWorkshop = (index: number, field: string, value: any) => {
    const newWorkshops = [...workshops]
    newWorkshops[index][field] = value
    setWorkshops(newWorkshops)
  }

  const addContact = () => {
    setContacts([...contacts, { name: '', number: '', email: '' }])
  }

  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index))
  }

  const updateContact = (index: number, field: string, value: any) => {
    const newContacts = [...contacts]
    newContacts[index][field] = value
    setContacts(newContacts)
  }

  const handleSpecialtyToggle = (id: string) => {
    setFormData(prev => {
      const ids = prev.specialty_ids.includes(id)
        ? prev.specialty_ids.filter(i => i !== id)
        : [...prev.specialty_ids, id]
      return { ...prev, specialty_ids: ids }
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    
    try {
      const payload = {
        ...formData,
        workshops,
        contacts: contacts.filter(c => c.name || c.number || c.email)
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
      
      router.push(`/congresos/${id}/view`)
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
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const { data, error: uploadError } = await supabase.storage.from('documents').upload(`congresos/${id}/${fileName}`, file)
      if (uploadError) throw uploadError
      
      const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(data.path)
      
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
      
      if (res.ok) fetchFiles()
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

  if (isLoading) return (
    <AppShell>
      <div className="p-8 flex justify-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/congresos/${id}/view`} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                {t('editCongress')}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link 
              href={`/congresos/${id}/landing`} 
              target="_blank"
              className="btn-secondary bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            >
              <Globe size={18} /> Ver Landing
            </Link>
            <Link 
              href={`/qr?congressId=${id}`} 
              className="btn-secondary bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <QrCode size={18} /> {t('generateQr')}
            </Link>
          </div>
        </header>

        {error && (
          <div className="card p-4 text-red-500 bg-red-50 border-red-100 flex items-center gap-3">
            <X size={20} />
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="card p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('name')} *</label>
                <input required type="text" className="erp-input w-full" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('startDate')} *</label>
                <input required type="date" className="erp-input w-full" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('endDate')} *</label>
                <input required type="date" className="erp-input w-full" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('location')} *</label>
                <input required type="text" className="erp-input w-full" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('description')}</label>
                <textarea rows={3} className="erp-input w-full" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Términos y Condiciones para Médicos</label>
                <textarea rows={3} className="erp-input w-full" placeholder="Ingrese los términos y condiciones específicos para el registro de médicos..." value={formData.terms_doctor} onChange={e => setFormData({ ...formData, terms_doctor: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Términos y Condiciones para Distribuidores</label>
                <textarea rows={3} className="erp-input w-full" placeholder="Ingrese los términos y condiciones específicos para el registro de distribuidores..." value={formData.terms_distributor} onChange={e => setFormData({ ...formData, terms_distributor: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Especialidades *</label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 max-h-40 overflow-y-auto">
                  {availableSpecialties.map(spec => (
                    <label key={spec.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white p-1 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.specialty_ids.includes(spec.id)}
                        onChange={() => handleSpecialtyToggle(spec.id)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="truncate">{spec.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('flyer')}</label>
                <div className="space-y-2">
                  {formData.flyer && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-100 rounded-xl">
                      <a href={formData.flyer} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex-1 truncate flex items-center gap-1">
                        <FileText size={16} /> Ver flyer
                      </a>
                      <button type="button" onClick={() => setFormData(p => ({ ...p, flyer: '' }))} className="text-red-500 p-1"><X size={16} /></button>
                    </div>
                  )}
                  <label className="btn-secondary w-full justify-center cursor-pointer text-sm">
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    Subir Flyer
                    <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Workshops */}
          <div className="card p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar className="text-purple-600" size={20} /> Talleres</h2>
              <button type="button" onClick={addWorkshop} className="btn-secondary py-1.5 px-3 text-sm"><Plus size={16} /> Agregar Taller</button>
            </div>

            <div className="flex items-center gap-3 p-4 bg-purple-50/50 rounded-2xl border border-purple-100 mb-2">
              <input
                type="checkbox"
                id="enable_workshops"
                checked={formData.enable_workshops}
                onChange={e => setFormData({ ...formData, enable_workshops: e.target.checked })}
                className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 w-5 h-5 cursor-pointer"
              />
              <label htmlFor="enable_workshops" className="text-sm font-semibold text-purple-900 cursor-pointer select-none">
                Habilitar inscripciones a talleres desde la Landing Page
                <span className="block text-xs font-normal text-purple-700 mt-0.5">Si se desmarca, los talleres se mostrarán en la Landing Page con fines informativos, pero los usuarios no podrán inscribirse.</span>
              </label>
            </div>
            <div className="space-y-4">
              {workshops.map((w, i) => (
                <div key={i} className="group relative p-4 bg-gray-50 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button type="button" onClick={() => removeWorkshop(i)} className="absolute -top-2 -right-2 p-1 bg-white text-red-500 rounded-full border border-red-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nombre</label>
                    <input required type="text" className="erp-input w-full bg-white" value={w.name} onChange={e => updateWorkshop(i, 'name', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Profesor</label>
                    <input required type="text" className="erp-input w-full bg-white" value={w.professor} onChange={e => updateWorkshop(i, 'professor', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Fecha y Hora</label>
                    <input required type="datetime-local" className="erp-input w-full bg-white" value={w.date_time ? new Date(w.date_time).toISOString().slice(0, 16) : ''} onChange={e => updateWorkshop(i, 'date_time', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cupo</label>
                    <input required type="number" className="erp-input w-full bg-white" value={w.max_people} onChange={e => updateWorkshop(i, 'max_people', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Costo</label>
                    <input required type="number" step="0.01" className="erp-input w-full bg-white" value={w.cost} onChange={e => updateWorkshop(i, 'cost', e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contacts */}
          <div className="card p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Users className="text-green-600" size={20} /> Contactos</h2>
              <button type="button" onClick={addContact} className="btn-secondary py-1.5 px-3 text-sm"><Plus size={16} /> Agregar Contacto</button>
            </div>
            <div className="space-y-4">
              {contacts.map((c, i) => (
                <div key={i} className="group relative p-4 bg-gray-50 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button type="button" onClick={() => removeContact(i)} className="absolute -top-2 -right-2 p-1 bg-white text-red-500 rounded-full border border-red-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nombre</label>
                    <input required type="text" className="erp-input w-full bg-white" value={c.name} onChange={e => updateContact(i, 'name', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Teléfono</label>
                    <input type="text" className="erp-input w-full bg-white" value={c.number || ''} onChange={e => updateContact(i, 'number', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Email</label>
                    <input type="email" className="erp-input w-full bg-white" value={c.email || ''} onChange={e => updateContact(i, 'email', e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6">
            <Link href="/congresos" className="btn-secondary bg-white">{t('cancel')}</Link>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> Guardar Cambios</>}
            </button>
          </div>
        </form>

        <hr className="my-10 border-gray-100" />

        {/* Files Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2"><Paperclip size={24} className="text-blue-600" /> {t('files')}</h2>
            <label className="btn-secondary cursor-pointer">
              {isUploadingFile ? <Loader2 size={18} className="animate-spin" /> : <><Upload size={18} /> {t('addFile')}</>}
              <input type="file" className="hidden" onChange={handleGeneralFileUpload} disabled={isUploadingFile} />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map(file => (
              <div key={file.id} className="card p-4 flex items-center gap-4 group hover:border-blue-200 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600"><File size={20} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{new Date(file.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-blue-600"><Download size={16} /></a>
                  <button onClick={() => handleDeleteFile(file.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
