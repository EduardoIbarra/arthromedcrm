'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { ArrowLeft, Save, Upload, Loader2, FileText, X, Plus, Calendar, Users, DollarSign, User, Phone, Mail } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NewCongresoPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableSpecialties, setAvailableSpecialties] = useState<{ id: string; name: string }[]>([])
  const [customSpecialty, setCustomSpecialty] = useState('')
  const [showCustomSpecialty, setShowCustomSpecialty] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    location: '',
    description: '',
    terms_doctor: '',
    terms_distributor: '',
    flyer: '',
    specialty_ids: [] as string[]
  })

  const [workshops, setWorkshops] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([{ name: '', number: '', email: '' }])

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

  const handleCreateCustomSpecialty = async () => {
    if (!customSpecialty.trim()) return
    try {
      const res = await fetch('/api/catalog/specialties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: customSpecialty.trim() })
      })
      if (!res.ok) throw new Error('Failed to create specialty')
      const { data } = await res.json()
      setAvailableSpecialties(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setFormData(prev => ({ ...prev, specialty_ids: [...prev.specialty_ids, data.id] }))
      setCustomSpecialty('')
      setShowCustomSpecialty(false)
    } catch (err: any) {
      setError(err.message)
    }
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
      <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/congresos"
              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
            >
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('newCongress')}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Configure los detalles generales, talleres y contactos.</p>
            </div>
          </div>
        </header>

        {error && (
          <div className="card p-4 text-red-500 bg-red-50 border-red-100 flex items-center gap-3">
            <X size={20} />
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6 pb-12">
          {/* General Info */}
          <div className="card p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
              <FileText className="text-blue-600" size={20} />
              <h2 className="text-lg font-semibold text-gray-900">Información General</h2>
            </div>
            
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

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Términos y Condiciones para Médicos
                </label>
                <textarea
                  rows={3}
                  className="erp-input w-full"
                  placeholder="Ingrese los términos y condiciones específicos para el registro de médicos..."
                  value={formData.terms_doctor}
                  onChange={e => setFormData({ ...formData, terms_doctor: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Términos y Condiciones para Distribuidores
                </label>
                <textarea
                  rows={3}
                  className="erp-input w-full"
                  placeholder="Ingrese los términos y condiciones específicos para el registro de distribuidores..."
                  value={formData.terms_distributor}
                  onChange={e => setFormData({ ...formData, terms_distributor: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('flyer')}
                </label>
                <div className="space-y-2">
                  {formData.flyer && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-100 rounded-xl">
                      <a href={formData.flyer} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate flex-1">
                        <FileText size={16} /> Ver flyer
                      </a>
                      <button type="button" onClick={() => setFormData(p => ({ ...p, flyer: '' }))} className="text-red-500 hover:text-red-700 p-1 rounded transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  <label className="btn-secondary w-full justify-center cursor-pointer text-sm py-3 border-dashed border-2">
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {uploading ? 'Subiendo...' : (formData.flyer ? 'Reemplazar Flyer' : 'Subir Imagen o PDF')}
                    <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Especialidades *
                </label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 max-h-40 overflow-y-auto">
                  {availableSpecialties.map(spec => (
                    <label key={spec.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white p-1 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.specialty_ids.includes(spec.id)}
                        onChange={() => handleSpecialtyToggle(spec.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="truncate">{spec.name}</span>
                    </label>
                  ))}
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowCustomSpecialty(!showCustomSpecialty)}
                  className="mt-2 text-xs text-blue-600 font-medium hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> {showCustomSpecialty ? 'Cancelar' : 'Agregar especialidad personalizada'}
                </button>
                
                {showCustomSpecialty && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Nombre..."
                      className="erp-input w-full text-sm"
                      value={customSpecialty}
                      onChange={e => setCustomSpecialty(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={handleCreateCustomSpecialty}
                      className="btn-primary py-1 px-3 text-sm"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Workshops Section */}
          <div className="card p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="text-purple-600" size={20} />
                <h2 className="text-lg font-semibold text-gray-900">Talleres (Workshops)</h2>
              </div>
              <button 
                type="button" 
                onClick={addWorkshop}
                className="btn-secondary py-1.5 px-3 text-sm bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100"
              >
                <Plus size={16} /> Agregar Taller
              </button>
            </div>

            {workshops.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">No se han agregado talleres.</p>
            ) : (
              <div className="space-y-4">
                {workshops.map((w, i) => (
                  <div key={i} className="group relative p-4 bg-gray-50 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button 
                      type="button" 
                      onClick={() => removeWorkshop(i)}
                      className="absolute -top-2 -right-2 p-1.5 bg-white text-red-500 rounded-full shadow-sm border border-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                    
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nombre del Taller</label>
                      <input
                        required
                        type="text"
                        className="erp-input w-full bg-white"
                        placeholder="Ej: Artroscopia de Hombro Avanzada"
                        value={w.name}
                        onChange={e => updateWorkshop(i, 'name', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Profesor</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          required
                          type="text"
                          className="erp-input w-full bg-white pl-9"
                          placeholder="Dr. Nombre Apellido"
                          value={w.professor}
                          onChange={e => updateWorkshop(i, 'professor', e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Fecha y Hora</label>
                      <input
                        required
                        type="datetime-local"
                        className="erp-input w-full bg-white"
                        value={w.date_time}
                        onChange={e => updateWorkshop(i, 'date_time', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Capacidad Máxima</label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          required
                          type="number"
                          className="erp-input w-full bg-white pl-9"
                          value={w.max_people}
                          onChange={e => updateWorkshop(i, 'max_people', e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Costo (0 si es gratis)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          required
                          type="number"
                          step="0.01"
                          className="erp-input w-full bg-white pl-9"
                          value={w.cost}
                          onChange={e => updateWorkshop(i, 'cost', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contacts Section */}
          <div className="card p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-2">
              <div className="flex items-center gap-2">
                <Users className="text-green-600" size={20} />
                <h2 className="text-lg font-semibold text-gray-900">Contactos del Congreso</h2>
              </div>
              <button 
                type="button" 
                onClick={addContact}
                className="btn-secondary py-1.5 px-3 text-sm bg-green-50 text-green-700 border-green-100 hover:bg-green-100"
              >
                <Plus size={16} /> Agregar Contacto
              </button>
            </div>

            <div className="space-y-4">
              {contacts.map((c, i) => (
                <div key={i} className="group relative p-4 bg-gray-50 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {contacts.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeContact(i)}
                      className="absolute -top-2 -right-2 p-1.5 bg-white text-red-500 rounded-full shadow-sm border border-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nombre</label>
                    <input
                      required
                      type="text"
                      className="erp-input w-full bg-white"
                      placeholder="Ej: Ventas Arthromed"
                      value={c.name}
                      onChange={e => updateContact(i, 'name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Teléfono / WhatsApp</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <input
                        type="text"
                        className="erp-input w-full bg-white pl-9"
                        placeholder="55 1234 5678"
                        value={c.number}
                        onChange={e => updateContact(i, 'number', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <input
                        type="email"
                        className="erp-input w-full bg-white pl-9"
                        placeholder="contacto@empresa.com"
                        value={c.email}
                        onChange={e => updateContact(i, 'email', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6 mt-6">
            <Link href="/congresos" className="btn-secondary bg-white">
              {t('cancel')}
            </Link>
            <button 
              type="submit"
              disabled={isSaving}
              className="btn-primary shadow-lg shadow-blue-200"
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin" /> {t('loading')}
                </div>
              ) : (
                <><Save size={18} /> Guardar Congreso y Publicar Landing</>
              )}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
