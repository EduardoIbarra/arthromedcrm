'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Loader2, User, Search, LayoutGrid, List, X, Upload } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { Doctor } from '@/types/database'
import ImageCropper from '@/components/ImageCropper'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/contexts/I18nContext'

export default function DoctorsPage() {
  const { t } = useI18n()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [specialtiesList, setSpecialtiesList] = useState<{ id: string; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [croppedAvatar, setCroppedAvatar] = useState<Blob | null>(null)
  const [croppedAvatarUrl, setCroppedAvatarUrl] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    specialty_ids: [] as string[],
    country: 'Mexico',
    avatar_url: '',
    phone: '',
    email: '',
    notes: ''
  })

  const fetchDoctors = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/doctors')
      if (res.ok) {
        const { data } = await res.json()
        setDoctors(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDoctors()
    fetch('/api/catalog/specialties')
      .then(r => r.json())
      .then(j => { if (j.data) setSpecialtiesList(j.data) })
  }, [])

  const filteredDoctors = doctors.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (d.specialty_ids && d.specialty_ids.some(id => specialtiesList.find(s => s.id === id)?.name.toLowerCase().includes(searchQuery.toLowerCase())))
  )

  const openNew = () => {
    setFormData({ name: '', specialty_ids: [], country: 'Mexico', avatar_url: '', phone: '', email: '', notes: '' })
    setIsEditing(false)
    setSelectedId(null)
    setCroppedAvatar(null)
    setCroppedAvatarUrl(null)
    setIsModalOpen(true)
  }

  const openEdit = (doc: Doctor) => {
    setFormData({
      name: doc.name,
      specialty_ids: doc.specialty_ids || [],
      country: doc.country || 'Mexico',
      avatar_url: doc.avatar_url || '',
      phone: doc.phone || '',
      email: doc.email || '',
      notes: doc.notes || ''
    })
    setIsEditing(true)
    setSelectedId(doc.id)
    setCroppedAvatar(null)
    setCroppedAvatarUrl(doc.avatar_url || null)
    setIsModalOpen(true)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        setImageToCrop(reader.result?.toString() || null)
        setCropModalOpen(true)
      })
      reader.readAsDataURL(e.target.files[0])
      e.target.value = ''
    }
  }

  const handleCropComplete = (blob: Blob) => {
    setCroppedAvatar(blob)
    setCroppedAvatarUrl(URL.createObjectURL(blob))
    setCropModalOpen(false)
    setImageToCrop(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este doctor?')) return
    try {
      const res = await fetch(`/api/doctors/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDoctors(doctors.filter(d => d.id !== id))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) return
    setIsSaving(true)
    try {
      let finalAvatarUrl = formData.avatar_url

      if (croppedAvatar) {
        const supabase = createClient()
        const fileName = `${Date.now()}_avatar.jpeg`
        const { data, error } = await supabase.storage.from('documents').upload(`doctors/${fileName}`, croppedAvatar, {
          contentType: 'image/jpeg',
          upsert: false
        })
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(data.path)
          finalAvatarUrl = urlData.publicUrl
        }
      }

      const url = isEditing ? `/api/doctors/${selectedId}` : '/api/doctors'
      const method = isEditing ? 'PATCH' : 'POST'
      const payload = { ...formData, avatar_url: finalAvatarUrl }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setIsModalOpen(false)
        fetchDoctors()
      }
    } catch (err) {
      console.error(err)
      alert('Error al guardar doctor')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <User className="text-blue-600" size={28} />
              Directorio de Doctores
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('appName')} / Doctores
            </p>
          </div>
          <button onClick={openNew} className="btn-primary">
            <Plus size={18} /> Añadir Doctor
          </button>
        </header>

        <div className="card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
            <Search size={20} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nombre o especialidad..."
              className="w-full bg-transparent border-none focus:outline-none text-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Vista de Tarjetas"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Vista de Tabla"
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDoctors.map(doc => (
              <div key={doc.id} className="card p-5 hover:border-blue-200 transition-colors group">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    {doc.avatar_url ? (
                      <img src={doc.avatar_url} alt={doc.name} className="w-16 h-16 rounded-full object-cover border border-gray-200" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl border border-blue-200">
                        {doc.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{doc.name}</h3>
                      <div className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                        <span>{doc.country || 'Mexico'}</span>
                      </div>
                      <p className="text-sm text-blue-600 font-medium mb-2">
                        {doc.specialty_ids && doc.specialty_ids.length > 0
                          ? doc.specialty_ids.map(id => specialtiesList.find(s => s.id === id)?.name || id).join(', ')
                          : 'Sin especialidad'}
                      </p>
                      {doc.phone && <p className="text-sm text-gray-600">📞 {doc.phone}</p>}
                      {doc.email && <p className="text-sm text-gray-600">✉️ {doc.email}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(doc)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"><Edit size={16} /></button>
                    <button onClick={() => handleDelete(doc.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            ))}
            {filteredDoctors.length === 0 && (
              <div className="col-span-full text-center p-12 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                No se encontraron doctores.
              </div>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Especialidades</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contacto</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDoctors.map(doc => (
                    <tr key={doc.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="p-4 font-medium text-gray-900">
                        <div className="flex items-center gap-3">
                          {doc.avatar_url ? (
                            <img src={doc.avatar_url} alt={doc.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border border-blue-200">
                              {doc.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div>{doc.name}</div>
                            <div className="text-xs text-gray-500 font-normal">{doc.country || 'Mexico'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-blue-600 font-medium">
                        {doc.specialty_ids && doc.specialty_ids.length > 0
                          ? doc.specialty_ids.map(id => specialtiesList.find(s => s.id === id)?.name || id).join(', ')
                          : <span className="text-gray-400">Sin especialidad</span>}
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {doc.phone && <div>📞 {doc.phone}</div>}
                        {doc.email && <div>✉️ {doc.email}</div>}
                        {!doc.phone && !doc.email && <span className="text-gray-400">-</span>}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(doc)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"><Edit size={16} /></button>
                          <button onClick={() => handleDelete(doc.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredDoctors.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">
                        No se encontraron doctores.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? 'Editar Doctor' : 'Crear Nuevo Doctor'}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex flex-col items-center mb-4">
              <label className="text-sm font-bold text-gray-700 mb-2 w-full text-left">Foto de Perfil (Opcional)</label>
              <div className="relative group">
                {croppedAvatarUrl ? (
                  <div className="relative w-24 h-24 rounded-full overflow-hidden border border-gray-200">
                    <img src={croppedAvatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => { setCroppedAvatar(null); setCroppedAvatarUrl(null); setFormData({ ...formData, avatar_url: '' }) }} className="text-white hover:text-red-300">
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="w-24 h-24 rounded-full bg-gray-100 border border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors">
                    <Upload size={20} className="text-gray-400 mb-1" />
                    <span className="text-[10px] text-gray-500">Subir</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Completo *</label>
              <input required type="text" className="erp-input w-full" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            {specialtiesList.length > 0 && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Especialidades (Opcional)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 max-h-40 overflow-y-auto">
                  {specialtiesList.map(spec => (
                    <label key={spec.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white p-1 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.specialty_ids.includes(spec.id)}
                        onChange={e => {
                          const ids = e.target.checked
                            ? [...formData.specialty_ids, spec.id]
                            : formData.specialty_ids.filter(id => id !== spec.id)
                          setFormData({ ...formData, specialty_ids: ids })
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="truncate">{spec.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">País</label>
                <select className="erp-input w-full" value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })}>
                  <option value="Mexico">México</option>
                  <option value="Colombia">Colombia</option>
                  <option value="Argentina">Argentina</option>
                  <option value="España">España</option>
                  <option value="Estados Unidos">Estados Unidos</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Teléfono (Opcional)</label>
                <input type="tel" className="erp-input w-full" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Email (Opcional)</label>
              <input type="email" className="erp-input w-full" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Notas (Opcional)</label>
              <textarea rows={2} className="erp-input w-full" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary px-4">Cancelar</button>
              <button type="submit" disabled={isSaving} className="btn-primary">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : (isEditing ? 'Guardar Cambios' : 'Crear Doctor')}
              </button>
            </div>
          </form>
        </Modal>

        {imageToCrop && (
          <ImageCropper
            open={cropModalOpen}
            image={imageToCrop}
            onClose={() => { setCropModalOpen(false); setImageToCrop(null) }}
            onCropComplete={handleCropComplete}
          />
        )}
      </div>
    </AppShell>
  )
}
