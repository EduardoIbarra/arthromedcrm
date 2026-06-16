'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, BookOpen, Upload, FileText, X, Sparkles } from 'lucide-react'
import AppShell from '@/components/AppShell'
import DoctorSelector from '@/components/DoctorSelector'
import { createClient } from '@/lib/supabase/client'
import FlyerBuilder from './FlyerBuilder'
import { Doctor } from '@/types/database'

interface TallerFormProps {
  tallerId: string | null
}

export default function TallerForm({ tallerId }: TallerFormProps) {
  const router = useRouter()
  const isNew = tallerId === null
  const [isLoading, setIsLoading] = useState(!isNew)
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [congresos, setCongresos] = useState<{id: string, name: string}[]>([])

  const [formData, setFormData] = useState({
    name: '',
    date_time: '',
    max_people: 20,
    cost: '',
    congress_id: '',
    description: '',
    flyer: ''
  })
  const [doctorIds, setDoctorIds] = useState<string[]>([])
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([])
  const [isFlyerBuilderOpen, setIsFlyerBuilderOpen] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    // Fetch congresos for optional linking
    fetch('/api/congresos')
      .then(r => r.json())
      .then(({ data }) => setCongresos(data || []))

    // Fetch all doctors for flyer builder mapping
    fetch('/api/doctors')
      .then(r => r.json())
      .then(({ data }) => setAllDoctors(data || []))

    if (!isNew && tallerId) {
      fetch(`/api/workshops/${tallerId}`)
        .then(r => r.json())
        .then(({ data }) => {
          if (data) {
            const d = new Date(data.date_time)
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
            setFormData({
              name: data.name,
              date_time: d.toISOString().slice(0, 16),
              max_people: data.max_people,
              cost: data.cost !== null ? String(data.cost) : '',
              congress_id: data.congress_id || '',
              description: data.description || '',
              flyer: data.flyer || ''
            })
            if (data.congress_workshop_doctors) {
              setDoctorIds(data.congress_workshop_doctors.map((d: any) => d.doctor_id))
            }
          }
          setIsLoading(false)
        })
    }
  }, [isNew, tallerId])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'pdf'
      const fileName = `workshop_flyer_${Date.now()}.${ext}`
      const { data, error: uploadError } = await supabase.storage.from('documents').upload(`talleres/${fileName}`, file)
      if (uploadError) throw uploadError
      
      const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(data.path)
      setFormData(p => ({ ...p, flyer: publicUrlData.publicUrl }))
    } catch (err: any) {
      console.error(err)
      alert('Error al subir el archivo: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const url = isNew ? '/api/workshops' : `/api/workshops/${tallerId}`
      const method = isNew ? 'POST' : 'PATCH'
      
      const payload = {
        ...formData,
        date_time: new Date(formData.date_time).toISOString(),
        cost: formData.cost ? parseFloat(formData.cost) : null,
        congress_id: formData.congress_id || null,
        doctorIds
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        router.push('/talleres')
      } else {
        const err = await res.json()
        alert('Error: ' + err.error)
      }
    } catch (err) {
      console.error(err)
      alert('Error guardando taller')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-3xl mx-auto animate-fade-in space-y-6">
        <header className="flex items-center gap-4">
          <Link href="/talleres" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen size={24} className="text-blue-600" />
              {isNew ? 'Nuevo Taller' : 'Editar Taller'}
            </h1>
          </div>
        </header>

        <form onSubmit={handleSave} className="card p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Nombre del Taller *</label>
              <input required type="text" className="erp-input w-full" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Descripción (Opcional)</label>
              <textarea rows={3} className="erp-input w-full" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Escribe los detalles o temas que cubrirá este taller..." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Fecha y Hora *</label>
                <input required type="datetime-local" className="erp-input w-full" value={formData.date_time} onChange={e => setFormData({ ...formData, date_time: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Cupo Máximo *</label>
                <input required type="number" min="1" className="erp-input w-full" value={formData.max_people} onChange={e => setFormData({ ...formData, max_people: parseInt(e.target.value) })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Costo (Opcional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" step="0.01" min="0" className="erp-input w-full pl-7" value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Vincular a Congreso (Opcional)</label>
                <select className="erp-input w-full" value={formData.congress_id} onChange={e => setFormData({ ...formData, congress_id: e.target.value })}>
                  <option value="">-- Independiente --</option>
                  {congresos.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Volante / Flyer (Opcional)</label>
              <div className="space-y-2">
                {formData.flyer && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-100 rounded-xl">
                    <a href={formData.flyer} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate flex-1 font-semibold">
                      <FileText size={16} /> Ver flyer actual o generado
                    </a>
                    <button type="button" onClick={() => setFormData(p => ({ ...p, flyer: '' }))} className="text-red-500 hover:text-red-700 p-1 rounded transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="btn-secondary w-full justify-center cursor-pointer text-sm py-3 border-dashed border-2">
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {uploading ? 'Subiendo...' : (formData.flyer ? 'Reemplazar Flyer' : 'Subir Imagen o PDF')}
                    <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (doctorIds.length === 0) {
                        alert('Selecciona al menos un doctor antes de abrir el diseñador de flyers.')
                        return
                      }
                      setIsFlyerBuilderOpen(true)
                    }}
                    className="btn-secondary w-full justify-center text-sm py-3 border-blue-200 text-blue-600 hover:bg-blue-50/50 flex items-center gap-2"
                  >
                    <Sparkles size={16} />
                    Generar Flyer desde Cero
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Doctores / Docentes *</label>
              <DoctorSelector selectedIds={doctorIds} onChange={setDoctorIds} multiple={true} />
              {doctorIds.length === 0 && <p className="text-xs text-orange-500 mt-1">Debes seleccionar al menos un doctor.</p>}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button type="submit" disabled={isSaving || doctorIds.length === 0 || uploading} className="btn-primary flex items-center gap-2">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSaving ? 'Guardando...' : 'Guardar Taller'}
            </button>
          </div>
        </form>
      </div>
      <FlyerBuilder
        isOpen={isFlyerBuilderOpen}
        onClose={() => setIsFlyerBuilderOpen(false)}
        tallerId={tallerId}
        workshopName={formData.name}
        workshopDate={formData.date_time}
        workshopCost={formData.cost}
        congressName={congresos.find(c => c.id === formData.congress_id)?.name || ''}
        selectedDoctors={allDoctors.filter(d => doctorIds.includes(d.id))}
        onSave={(url) => setFormData(p => ({ ...p, flyer: url }))}
      />
    </AppShell>
  )
}
