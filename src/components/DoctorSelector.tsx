'use client'

import { useState, useEffect } from 'react'
import { Plus, Check, ChevronsUpDown, Loader2, X, Upload } from 'lucide-react'
import Modal from '@/components/Modal'
import { Doctor } from '@/types/database'
import ImageCropper from '@/components/ImageCropper'
import { createClient } from '@/lib/supabase/client'

interface DoctorSelectorProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  multiple?: boolean
}

export default function DoctorSelector({ selectedIds, onChange, multiple = false }: DoctorSelectorProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [specialtiesList, setSpecialtiesList] = useState<{ id: string; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [croppedAvatar, setCroppedAvatar] = useState<Blob | null>(null)
  const [croppedAvatarUrl, setCroppedAvatarUrl] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    specialty_ids: [] as string[],
    country: 'Mexico',
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!formData.name) return
    setIsSaving(true)
    try {
      let avatar_url: string | undefined = undefined

      if (croppedAvatar) {
        const supabase = createClient()
        const fileName = `${Date.now()}_avatar.jpeg`
        const { data, error } = await supabase.storage.from('documents').upload(`doctors/${fileName}`, croppedAvatar, {
          contentType: 'image/jpeg',
          upsert: false
        })
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(data.path)
          avatar_url = urlData.publicUrl
        }
      }

      const res = await fetch('/api/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, avatar_url })
      })
      if (res.ok) {
        const { data } = await res.json()
        setDoctors(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
        if (multiple) {
          onChange([...selectedIds, data.id])
        } else {
          onChange([data.id])
        }
        setIsModalOpen(false)
        setFormData({ name: '', specialty_ids: [], country: 'Mexico', phone: '', email: '', notes: '' })
        setCroppedAvatar(null)
        setCroppedAvatarUrl(null)
      }
    } catch (err) {
      console.error(err)
      alert('Error creando doctor')
    } finally {
      setIsSaving(false)
    }
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

  const toggleSelection = (id: string) => {
    if (multiple) {
      if (selectedIds.includes(id)) {
        onChange(selectedIds.filter(val => val !== id))
      } else {
        onChange([...selectedIds, id])
      }
    } else {
      onChange([id])
      setIsOpen(false)
    }
  }

  const selectedDoctors = doctors.filter(d => selectedIds.includes(d.id))

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedDoctors.map(doc => (
          <div key={doc.id} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-sm border border-blue-200">
            <span>{doc.name}</span>
            <button 
              type="button" 
              onClick={() => toggleSelection(doc.id)} 
              className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="erp-input w-full flex items-center justify-between bg-white text-left text-sm"
        >
          <span className="text-gray-500">
            {isLoading ? 'Cargando doctores...' : 'Seleccionar doctor...'}
          </span>
          <ChevronsUpDown size={16} className="text-gray-400" />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(true)
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 border-b border-gray-100 font-semibold sticky top-0 bg-white"
            >
              <Plus size={16} /> Crear nuevo doctor
            </button>
            {doctors.map(doc => (
              <button
                key={doc.id}
                type="button"
                onClick={() => toggleSelection(doc.id)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
              >
                <span>
                  {doc.name}
                  {doc.specialty_ids && doc.specialty_ids.length > 0 && <span className="text-gray-400 text-xs ml-2">({doc.specialty_ids.length} especialidades)</span>}
                </span>
                {selectedIds.includes(doc.id) && <Check size={16} className="text-blue-600" />}
              </button>
            ))}
            {doctors.length === 0 && !isLoading && (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">No hay doctores registrados.</div>
            )}
          </div>
        )}
      </div>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Nuevo Doctor">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex flex-col items-center mb-4">
            <label className="text-sm font-bold text-gray-700 mb-2 w-full text-left">Foto de Perfil (Opcional)</label>
            <div className="relative group">
              {croppedAvatarUrl ? (
                <div className="relative w-24 h-24 rounded-full overflow-hidden border border-gray-200">
                  <img src={croppedAvatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => { setCroppedAvatar(null); setCroppedAvatarUrl(null) }} className="text-white hover:text-red-300">
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
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Guardar Doctor'}
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
  )
}
