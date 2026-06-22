'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, BookOpen, Upload, FileText, X, Sparkles, User, Calendar, Clock, Plus, Trash2, Edit } from 'lucide-react'
import AppShell from '@/components/AppShell'
import DoctorSelector from '@/components/DoctorSelector'
import { createClient } from '@/lib/supabase/client'
import FlyerBuilder from './FlyerBuilder'
import { Doctor } from '@/types/database'

interface TallerFormProps {
  tallerId: string | null
}

interface ItineraryItem {
  id?: string
  date: string
  time: string
  description: string
  notes: string
  involvedMemberIds: string[]
}

export default function TallerForm({ tallerId }: TallerFormProps) {
  const router = useRouter()
  const isNew = tallerId === null
  const [isLoading, setIsLoading] = useState(!isNew)
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [congresos, setCongresos] = useState<{id: string, name: string}[]>([])

  const [activeTab, setActiveTab] = useState<'general' | 'staff' | 'itinerary'>('general')

  const [formData, setFormData] = useState({
    name: '',
    date_time: '',
    end_date_time: '',
    max_people: 20,
    cost: '',
    congress_id: '',
    description: '',
    flyer: ''
  })
  
  const [doctorIds, setDoctorIds] = useState<string[]>([])
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([])
  const [isFlyerBuilderOpen, setIsFlyerBuilderOpen] = useState(false)

  // Staff and Itinerary states
  const [staffList, setStaffList] = useState<any[]>([])
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([])

  // Itinerary temporary form state
  const [itineraryForm, setItineraryForm] = useState({
    date: '',
    time: '',
    description: '',
    notes: '',
    involvedMemberIds: [] as string[]
  })
  const [editingItineraryIndex, setEditingItineraryIndex] = useState<number | null>(null)

  const supabase = createClient()

  useEffect(() => {
    // Fetch congresos
    fetch('/api/congresos')
      .then(r => r.json())
      .then(({ data }) => setCongresos(data || []))

    // Fetch doctors
    fetch('/api/doctors')
      .then(r => r.json())
      .then(({ data }) => setAllDoctors(data || []))

    // Fetch system users for staff selection
    fetch('/api/cirugias/usuarios')
      .then(r => r.json())
      .then(({ data }) => setStaffList(data || []))

    if (!isNew && tallerId) {
      fetch(`/api/workshops/${tallerId}`)
        .then(r => r.json())
        .then(({ data }) => {
          if (data) {
            const d = new Date(data.date_time)
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
            let end_date_time_val = ''
            if (data.end_date_time) {
              const dEnd = new Date(data.end_date_time)
              dEnd.setMinutes(dEnd.getMinutes() - dEnd.getTimezoneOffset())
              end_date_time_val = dEnd.toISOString().slice(0, 16)
            }
            setFormData({
              name: data.name,
              date_time: d.toISOString().slice(0, 16),
              end_date_time: end_date_time_val,
              max_people: data.max_people,
              cost: data.cost !== null ? String(data.cost) : '',
              congress_id: data.congress_id || '',
              description: data.description || '',
              flyer: data.flyer || ''
            })
            if (data.congress_workshop_doctors) {
              setDoctorIds(data.congress_workshop_doctors.map((d: any) => d.doctor_id))
            }
            if (data.congress_workshop_members) {
              setMemberIds(data.congress_workshop_members.map((m: any) => m.user_id))
            }
            if (data.workshop_itinerarios) {
              setItinerary(data.workshop_itinerarios.map((it: any) => ({
                id: it.id,
                date: it.date.split('T')[0],
                time: it.time || '',
                description: it.description,
                notes: it.notes || '',
                involvedMemberIds: it.involved_members.map((im: any) => im.user_id)
              })))
            }
          }
          setIsLoading(false)
        })
    }
  }, [isNew, tallerId])

  // Get dynamic dates before/during/after the workshop
  const getItineraryDateOptions = () => {
    if (!formData.date_time) return []
    const start = new Date(formData.date_time)
    const end = formData.end_date_time ? new Date(formData.end_date_time) : new Date(formData.date_time)
    
    const options: { dateStr: string; label: string }[] = []
    
    // 3 days before
    for (let i = 3; i >= 1; i--) {
      const d = new Date(start)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      options.push({ dateStr, label: `${i} día(s) antes (${dateStr})` })
    }
    
    // Workshop days
    let current = new Date(start)
    let dayNum = 1
    while (current < end || current.toDateString() === end.toDateString()) {
      const dateStr = current.toISOString().split('T')[0]
      options.push({ dateStr, label: `Día ${dayNum} (${dateStr})` })
      current.setDate(current.getDate() + 1)
      dayNum++
      if (dayNum > 20) break // safety break
    }
    
    // 3 days after
    for (let i = 1; i <= 3; i++) {
      const d = new Date(end)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      options.push({ dateStr, label: `${i} día(s) después (${dateStr})` })
    }
    
    return options
  }

  // Pre-fill itinerary date when options change
  useEffect(() => {
    const opts = getItineraryDateOptions()
    if (opts.length > 0 && !itineraryForm.date) {
      setItineraryForm(p => ({ ...p, date: opts[3]?.dateStr || opts[0].dateStr }))
    }
  }, [formData.date_time, formData.end_date_time])

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
        end_date_time: formData.end_date_time ? new Date(formData.end_date_time).toISOString() : null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        congress_id: formData.congress_id || null,
        doctorIds,
        memberIds,
        itinerary
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

  // Staff checklist handlers
  const handleToggleMember = (userId: string) => {
    if (memberIds.includes(userId)) {
      setMemberIds(memberIds.filter(id => id !== userId))
      // Also clean up itinerary items involving this member
      setItinerary(itinerary.map(item => ({
        ...item,
        involvedMemberIds: item.involvedMemberIds.filter(id => id !== userId)
      })))
    } else {
      setMemberIds([...memberIds, userId])
    }
  }

  // Itinerary handlers
  const handleAddOrUpdateItinerary = (e: React.FormEvent) => {
    e.preventDefault()
    if (!itineraryForm.date || !itineraryForm.description) return

    const newItem: ItineraryItem = {
      date: itineraryForm.date,
      time: itineraryForm.time,
      description: itineraryForm.description,
      notes: itineraryForm.notes,
      involvedMemberIds: itineraryForm.involvedMemberIds
    }

    if (editingItineraryIndex !== null) {
      const updated = [...itinerary]
      updated[editingItineraryIndex] = newItem
      setItinerary(updated.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.time.localeCompare(b.time)
      }))
      setEditingItineraryIndex(null)
    } else {
      setItinerary([...itinerary, newItem].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.time.localeCompare(b.time)
      }))
    }

    // Reset itinerary form (keep the date for easier continuous entries)
    setItineraryForm(p => ({
      ...p,
      time: '',
      description: '',
      notes: '',
      involvedMemberIds: []
    }))
  }

  const handleEditItinerary = (index: number) => {
    const item = itinerary[index]
    setItineraryForm({
      date: item.date,
      time: item.time,
      description: item.description,
      notes: item.notes,
      involvedMemberIds: item.involvedMemberIds
    })
    setEditingItineraryIndex(index)
  }

  const handleDeleteItinerary = (index: number) => {
    setItinerary(itinerary.filter((_, idx) => idx !== index))
    if (editingItineraryIndex === index) {
      setEditingItineraryIndex(null)
    }
  }

  const toggleInvolvedMember = (userId: string) => {
    const current = itineraryForm.involvedMemberIds
    if (current.includes(userId)) {
      setItineraryForm({ ...itineraryForm, involvedMemberIds: current.filter(id => id !== userId) })
    } else {
      setItineraryForm({ ...itineraryForm, involvedMemberIds: [...current, userId] })
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
      </AppShell>
    )
  }

  const assignedStaff = staffList.filter(s => memberIds.includes(s.id))

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in space-y-6">
        <header className="flex items-center gap-4">
          <Link href="/talleres" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen size={24} className="text-blue-600" />
              {isNew ? 'Nuevo Taller' : 'Editar Taller'}
            </h1>
          </div>
        </header>

        {/* Form Tabs */}
        <div className="flex border-b border-gray-200 gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2
              ${activeTab === 'general'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }
            `}
          >
            Datos Generales
          </button>
          <button
            type="button"
            onClick={() => {
              if (!formData.date_time) {
                alert('Por favor ingresa la fecha y hora de inicio primero.')
                return
              }
              setActiveTab('staff')
            }}
            className={`py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2
              ${activeTab === 'staff'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }
            `}
          >
            Miembros del Staff ({memberIds.length})
          </button>
          <button
            type="button"
            onClick={() => {
              if (!formData.date_time) {
                alert('Por favor ingresa la fecha y hora de inicio primero.')
                return
              }
              setActiveTab('itinerary')
            }}
            className={`py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2
              ${activeTab === 'itinerary'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }
            `}
          >
            Itinerario ({itinerary.length})
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* TAB 1: GENERAL DATA */}
          {activeTab === 'general' && (
            <div className="card p-6 space-y-6 bg-white shadow-sm border border-gray-150 rounded-2xl">
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
                    <label className="block text-sm font-bold text-gray-700 mb-1">Fecha y Hora Inicio *</label>
                    <input required type="datetime-local" className="erp-input w-full" value={formData.date_time} onChange={e => setFormData({ ...formData, date_time: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Fecha y Hora Fin (Opcional)</label>
                    <input type="datetime-local" className="erp-input w-full" value={formData.end_date_time} onChange={e => setFormData({ ...formData, end_date_time: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Cupo Máximo *</label>
                    <input required type="number" min="1" className="erp-input w-full" value={formData.max_people} onChange={e => setFormData({ ...formData, max_people: parseInt(e.target.value) })} />
                  </div>
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
            </div>
          )}

          {/* TAB 2: STAFF MEMBERS */}
          {activeTab === 'staff' && (
            <div className="card p-6 space-y-6 bg-white shadow-sm border border-gray-150 rounded-2xl">
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-1">Personal de Staff Asignado</h3>
                <p className="text-xs text-gray-500 mb-4">Selecciona los miembros de tu equipo que participarán u organizarán este taller.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-100">
                  {staffList.map((user) => {
                    const isChecked = memberIds.includes(user.id)
                    return (
                      <label 
                        key={user.id} 
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:bg-white
                          ${isChecked 
                            ? 'bg-blue-50/50 border-blue-200 shadow-sm' 
                            : 'bg-white/80 border-gray-100'
                          }
                        `}
                      >
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => handleToggleMember(user.id)}
                          className="mt-1 rounded text-blue-600 border-gray-300 focus:ring-blue-500" 
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {user.first_name || user.last_name 
                              ? `${user.first_name || ''} ${user.last_name || ''}`.trim() 
                              : user.email}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                          {user.position && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-bold rounded">
                              {user.position}
                            </span>
                          )}
                        </div>
                      </label>
                    )
                  })}
                  {staffList.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-400 italic">No hay usuarios en el sistema.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ITINERARY */}
          {activeTab === 'itinerary' && (
            <div className="space-y-6">
              
              {/* Add/Edit Activity Form */}
              <div className="card p-6 bg-white shadow-sm border border-gray-150 rounded-2xl">
                <h3 className="text-base font-bold text-gray-900 mb-4">
                  {editingItineraryIndex !== null ? 'Editar Actividad' : 'Agregar Actividad al Itinerario'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Fecha de la Actividad *</label>
                    <select 
                      className="erp-input w-full"
                      value={itineraryForm.date}
                      onChange={e => setItineraryForm({ ...itineraryForm, date: e.target.value })}
                    >
                      <option value="">-- Selecciona un día --</option>
                      {getItineraryDateOptions().map(opt => (
                        <option key={opt.dateStr} value={opt.dateStr}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Hora (Opcional)</label>
                    <input 
                      type="time" 
                      className="erp-input w-full"
                      value={itineraryForm.time}
                      onChange={e => setItineraryForm({ ...itineraryForm, time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Descripción / Actividad *</label>
                  <input 
                    type="text" 
                    placeholder="Ej. Preparación del equipo e instrumental"
                    className="erp-input w-full"
                    value={itineraryForm.description}
                    onChange={e => setItineraryForm({ ...itineraryForm, description: e.target.value })}
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Notas Adicionales (Opcional)</label>
                  <textarea 
                    rows={2}
                    placeholder="Lugar específico, indicaciones, etc."
                    className="erp-input w-full"
                    value={itineraryForm.notes}
                    onChange={e => setItineraryForm({ ...itineraryForm, notes: e.target.value })}
                  />
                </div>

                {/* Involved Staff Selector */}
                <div className="mt-4">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Miembros Involucrados</label>
                  {assignedStaff.length === 0 ? (
                    <p className="text-xs text-orange-500 italic">Debes asignar miembros al staff del taller (en la pestaña Staff) para poder seleccionarlos en el itinerario.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-150">
                      {assignedStaff.map(member => {
                        const isChecked = itineraryForm.involvedMemberIds.includes(member.id)
                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => toggleInvolvedMember(member.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5
                              ${isChecked 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                              }
                            `}
                          >
                            <User size={12} />
                            {member.first_name || member.last_name 
                              ? `${member.first_name || ''} ${member.last_name || ''}`.trim() 
                              : member.email}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-6">
                  {editingItineraryIndex !== null && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingItineraryIndex(null)
                        setItineraryForm({ date: '', time: '', description: '', notes: '', involvedMemberIds: [] })
                      }}
                      className="btn-secondary"
                    >
                      Cancelar Edición
                    </button>
                  )}
                  <button 
                    type="button" 
                    onClick={handleAddOrUpdateItinerary}
                    disabled={!itineraryForm.date || !itineraryForm.description}
                    className="btn-primary"
                  >
                    {editingItineraryIndex !== null ? 'Guardar Cambios de Actividad' : 'Agregar Actividad'}
                  </button>
                </div>
              </div>

              {/* Timeline Display */}
              <div className="card p-6 bg-white shadow-sm border border-gray-150 rounded-2xl space-y-4">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Calendar size={18} className="text-blue-500" /> Timeline del Itinerario
                </h3>

                {itinerary.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-8">No hay actividades añadidas en el itinerario de este taller.</p>
                ) : (
                  <div className="relative pl-6 border-l-2 border-blue-100 space-y-4 py-2">
                    {itinerary.map((item, idx) => {
                      const involved = staffList.filter(s => item.involvedMemberIds.includes(s.id))
                      return (
                        <div key={idx} className="relative group">
                          {/* Dot indicator */}
                          <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-blue-600 bg-white group-hover:scale-125 transition-transform" />
                          
                          <div className="flex items-start justify-between gap-4 p-4 border border-gray-100 rounded-xl hover:border-blue-200 transition-colors">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                  <Calendar size={11} /> {item.date}
                                </span>
                                {item.time && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-650 bg-gray-50 px-2 py-0.5 rounded">
                                    <Clock size={11} /> {item.time} hs
                                  </span>
                                )}
                              </div>
                              
                              <h4 className="font-bold text-gray-900 text-sm">{item.description}</h4>
                              {item.notes && <p className="text-xs text-gray-500 whitespace-pre-wrap">{item.notes}</p>}
                              
                              {involved.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {involved.map(inv => (
                                    <span key={inv.id} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                                      <User size={10} /> {inv.first_name || inv.email}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleEditItinerary(idx)}
                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Editar"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItinerary(idx)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Eliminar"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button 
              type="submit" 
              disabled={isSaving || doctorIds.length === 0 || uploading} 
              className="btn-primary flex items-center gap-2 px-6 py-2.5 font-semibold text-sm"
            >
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
        workshopEndDate={formData.end_date_time}
        workshopCost={formData.cost}
        congressName={congresos.find(c => c.id === formData.congress_id)?.name || ''}
        selectedDoctors={allDoctors.filter(d => doctorIds.includes(d.id))}
        onSave={(url) => setFormData(p => ({ ...p, flyer: url }))}
      />
    </AppShell>
  )
}
