'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, BookOpen, Upload, FileText, X, Sparkles, User, Calendar, Clock, Plus, Trash2, Edit, Car, ChevronDown, ChevronUp } from 'lucide-react'
import AppShell from '@/components/AppShell'
import DoctorSelector from '@/components/DoctorSelector'
import { createClient } from '@/lib/supabase/client'
import FlyerBuilder from './FlyerBuilder'
import { Doctor, CarFleet } from '@/types/database'

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

  const [activeTab, setActiveTab] = useState<'general' | 'staff' | 'itinerary' | 'resumen'>('general')
  const [isNotifyingAll, setIsNotifyingAll] = useState(false)
  const [isNotifying, setIsNotifying] = useState<Record<string, boolean>>({})
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({})

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
  const [carList, setCarList] = useState<CarFleet[]>([])
  const [memberCarAssignments, setMemberCarAssignments] = useState<Record<string, string>>({})
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

    // Fetch car fleet for assignments
    fetch('/api/car-fleet')
      .then(r => r.json())
      .then(({ data }) => setCarList(data || []))

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
              const assignments: Record<string, string> = {}
              data.congress_workshop_members.forEach((m: any) => {
                if (m.car_id) {
                  assignments[m.user_id] = m.car_id
                }
              })
              setMemberCarAssignments(assignments)
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
        members: memberIds.map(userId => ({
          userId,
          carId: memberCarAssignments[userId] || null
        })),
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
      // Clean up car assignment
      const updated = { ...memberCarAssignments }
      delete updated[userId]
      setMemberCarAssignments(updated)
      // Also clean up itinerary items involving this member
      setItinerary(itinerary.map(item => ({
        ...item,
        involvedMemberIds: item.involvedMemberIds.filter(id => id !== userId)
      })))
    } else {
      setMemberIds([...memberIds, userId])
    }
  }

  const handleAssignCar = (userId: string, carId: string) => {
    setMemberCarAssignments(prev => {
      const next = { ...prev }
      if (carId) {
        next[userId] = carId
      } else {
        delete next[userId]
      }
      return next
    })
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

  const formatFriendlyDate = (dateStr: string) => {
    if (!dateStr) return ''
    try {
      const [year, month, day] = dateStr.split('-').map(Number)
      const d = new Date(year, month - 1, day)
      return new Intl.DateTimeFormat('es-MX', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      }).format(d)
    } catch (e) {
      return dateStr
    }
  }

  const toggleExpandTasks = (userId: string) => {
    setExpandedTasks(prev => ({ ...prev, [userId]: !prev[userId] }))
  }

  const handleNotifyUser = async (userId: string) => {
    setIsNotifying(prev => ({ ...prev, [userId]: true }))
    try {
      const res = await fetch(`/api/workshops/${tallerId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      const result = await res.json()
      if (res.ok && result.success) {
        if (result.errors && result.errors.length > 0) {
          alert(result.errors.join('\n'))
        } else {
          alert('Notificación enviada por WhatsApp exitosamente.')
        }
      } else {
        alert('Error al enviar notificación: ' + (result.error || 'Error desconocido'))
      }
    } catch (err: any) {
      console.error(err)
      alert('Error de red al enviar notificación.')
    } finally {
      setIsNotifying(prev => ({ ...prev, [userId]: false }))
    }
  }

  const handleNotifyAll = async () => {
    if (!confirm('¿Estás seguro de que deseas notificar a todo el staff de este taller vía WhatsApp?')) return
    setIsNotifyingAll(true)
    try {
      const res = await fetch(`/api/workshops/${tallerId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const result = await res.json()
      if (res.ok && result.success) {
        if (result.errors && result.errors.length > 0) {
          alert(`Notificaciones enviadas. Se enviaron ${result.notificationsSent} mensajes. Hubo los siguientes errores:\n` + result.errors.join('\n'))
        } else {
          alert(`Se enviaron notificaciones a todo el staff (${result.notificationsSent} mensajes) exitosamente.`)
        }
      } else {
        alert('Error al enviar notificaciones: ' + (result.error || 'Error desconocido'))
      }
    } catch (err: any) {
      console.error(err)
      alert('Error de red al enviar notificaciones.')
    } finally {
      setIsNotifyingAll(false)
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
          {!isNew && (
            <button
              type="button"
              onClick={() => {
                if (!formData.date_time) {
                  alert('Por favor ingresa la fecha y hora de inicio primero.')
                  return
                }
                setActiveTab('resumen')
              }}
              className={`py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2
                ${activeTab === 'resumen'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                }
              `}
            >
              Resumen
            </button>
          )}
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
                      <div 
                        key={user.id} 
                        className={`flex flex-col justify-between p-3 rounded-xl border transition-all hover:bg-white
                          ${isChecked 
                            ? 'bg-blue-50/50 border-blue-200 shadow-sm' 
                            : 'bg-white/80 border-gray-100'
                          }
                        `}
                      >
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => handleToggleMember(user.id)}
                            className="mt-1 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer" 
                          />
                          <div className="min-w-0 flex-1">
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
                        </div>

                        {/* Car assignment dropdown (only show if selected/checked) */}
                        {isChecked && (
                          <div className="mt-3 pt-3 border-t border-blue-100/50">
                            <label className="block text-[10px] font-bold text-gray-500 mb-1">
                              Vehículo Asignado
                            </label>
                            <select
                              value={memberCarAssignments[user.id] || ''}
                              onChange={(e) => handleAssignCar(user.id, e.target.value)}
                              className="erp-input w-full py-1.5 px-2 text-xs bg-white/70 focus:bg-white"
                            >
                              <option value="">-- Sin Vehículo --</option>
                              {carList.map((car) => (
                                <option key={car.id} value={car.id}>
                                  {car.make} {car.model} ({car.plate_number})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
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

          {/* TAB 4: RESUMEN */}
          {activeTab === 'resumen' && (
            <div className="space-y-6">
              {/* Notice to Save Changes */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <span className="text-amber-500 mt-0.5">⚠️</span>
                <div>
                  <h4 className="text-sm font-bold text-amber-800">Nota de Logística</h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Guarda los cambios del taller antes de enviar notificaciones para asegurar que el staff reciba la información actualizada.
                  </p>
                </div>
              </div>

              <div className="card p-6 bg-white shadow-sm border border-gray-150 rounded-2xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">Resumen del Staff y Asignaciones</h3>
                    <p className="text-xs text-gray-500">Revisa la logística de traslado y actividades del staff para este taller, y envíales sus notificaciones.</p>
                  </div>
                  
                  {/* Button to notify everyone */}
                  <button
                    type="button"
                    onClick={handleNotifyAll}
                    disabled={isNotifyingAll || assignedStaff.length === 0}
                    className="btn-primary bg-green-600 hover:bg-green-700 border-green-600 flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isNotifyingAll ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.49-3.232c1.648.978 3.256 1.488 4.982 1.489 5.433.003 9.85-4.387 9.853-9.782.002-2.614-1.011-5.071-2.853-6.914C16.638 3.718 14.186 2.7 11.579 2.7c-5.437 0-9.856 4.39-9.859 9.783-.001 1.832.483 3.619 1.401 5.2l-.188.685-.688 2.508 2.57-.674.632-.164zm10.74-4.821c-.244-.122-1.442-.712-1.666-.793-.223-.081-.385-.122-.547.122-.162.244-.63.793-.772.955-.143.162-.285.183-.529.061-.244-.122-1.029-.379-1.96-1.21-.724-.646-1.213-1.444-1.355-1.687-.143-.244-.015-.376.107-.497.11-.11.244-.285.366-.427.122-.142.162-.244.244-.407.081-.162.041-.305-.02-.427-.061-.122-.547-1.32-.75-1.81-.197-.474-.397-.41-.547-.417-.142-.007-.305-.009-.467-.009-.162 0-.427.061-.65.305-.223.244-.853.834-.853 2.035 0 1.2.873 2.36 1.001 2.475.127.115 1.705 2.612 4.14 3.655.58.248 1.03.396 1.38.508.583.185 1.114.159 1.533.096.467-.069 1.442-.589 1.646-1.159.203-.57.203-1.057.142-1.159-.06-.101-.223-.162-.467-.284z" />
                      </svg>
                    )}
                    {isNotifyingAll ? 'Notificando...' : 'Notificar a todo el Staff'}
                  </button>
                </div>

                {assignedStaff.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 border border-dashed border-gray-200 rounded-2xl space-y-2">
                    <User size={36} className="text-gray-400 mx-auto" />
                    <p className="text-sm font-semibold text-gray-600">No hay personal de staff asignado.</p>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">Dirígete a la pestaña "Miembros del Staff" para asignar al equipo que participará en este taller.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assignedStaff.map(member => {
                      const carId = memberCarAssignments[member.id]
                      const car = carList.find(c => c.id === carId)
                      
                      // Filter user tasks
                      const userTasks = itinerary.filter(item => item.involvedMemberIds.includes(member.id))
                      const isExpanded = !!expandedTasks[member.id]
                      
                      return (
                        <div 
                          key={member.id}
                          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl border border-gray-150 hover:border-blue-200 hover:shadow-md transition-all duration-300 bg-white"
                        >
                          {/* User info */}
                          <div className="flex items-center gap-3.5 min-w-[250px]">
                            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                              {member.first_name ? member.first_name[0].toUpperCase() : member.email[0].toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-bold text-gray-900 leading-tight truncate">
                                {member.first_name || member.last_name 
                                  ? `${member.first_name || ''} ${member.last_name || ''}`.trim() 
                                  : member.email}
                              </h4>
                              <p className="text-xs text-gray-400 truncate">{member.email}</p>
                              {member.position && (
                                <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-100">
                                  {member.position}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Vehicle info */}
                          <div className="flex items-center gap-2 min-w-[200px]">
                            <div className="p-2 bg-gray-50 border border-gray-100 rounded-xl text-gray-600">
                              <Car size={18} />
                            </div>
                            <div>
                              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vehículo de Traslado</span>
                              <span className={`text-xs font-semibold ${car ? 'text-gray-900' : 'text-gray-500 italic'}`}>
                                {car ? `${car.make} ${car.model} (${car.plate_number})` : 'Sin vehículo asignado'}
                              </span>
                            </div>
                          </div>

                          {/* Collapsible Tasks involved */}
                          <div className="flex-1 min-w-[200px]">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Actividades</span>
                                <span className="text-xs font-semibold text-gray-800">
                                  {userTasks.length} {userTasks.length === 1 ? 'actividad' : 'actividades'}
                                </span>
                              </div>
                              {userTasks.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpandTasks(member.id)}
                                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                                >
                                  {isExpanded ? 'Ocultar' : 'Ver tareas'}
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                              )}
                            </div>
                            
                            {/* Collapsed tasks list */}
                            {isExpanded && userTasks.length > 0 && (
                              <div className="mt-3 p-3 bg-gray-50 border border-gray-150 rounded-xl space-y-2 max-h-48 overflow-y-auto">
                                {userTasks.map((t, idx) => (
                                  <div key={idx} className="text-xs space-y-0.5 border-b border-gray-100 last:border-0 pb-1.5 last:pb-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                                        {formatFriendlyDate(t.date)}
                                      </span>
                                      {t.time && (
                                        <span className="font-semibold text-gray-650 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                                          {t.time} hs
                                        </span>
                                      )}
                                    </div>
                                    <p className="font-semibold text-gray-800">{t.description}</p>
                                    {t.notes && <p className="text-[10px] text-gray-500">{t.notes}</p>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Individual Action Button */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleNotifyUser(member.id)}
                              disabled={isNotifying[member.id]}
                              className="w-full lg:w-auto btn-secondary border-green-200 text-green-700 hover:bg-green-50 flex items-center gap-2 text-xs py-2 px-3.5 rounded-xl transition-all"
                            >
                              {isNotifying[member.id] ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : (
                                <svg className="w-3.5 h-3.5 fill-current text-green-600" viewBox="0 0 24 24">
                                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.49-3.232c1.648.978 3.256 1.488 4.982 1.489 5.433.003 9.85-4.387 9.853-9.782.002-2.614-1.011-5.071-2.853-6.914C16.638 3.718 14.186 2.7 11.579 2.7c-5.437 0-9.856 4.39-9.859 9.783-.001 1.832.483 3.619 1.401 5.2l-.188.685-.688 2.508 2.57-.674.632-.164zm10.74-4.821c-.244-.122-1.442-.712-1.666-.793-.223-.081-.385-.122-.547.122-.162.244-.63.793-.772.955-.143.162-.285.183-.529.061-.244-.122-1.029-.379-1.96-1.21-.724-.646-1.213-1.444-1.355-1.687-.143-.244-.015-.376.107-.497.11-.11.244-.285.366-.427.122-.142.162-.244.244-.407.081-.162.041-.305-.02-.427-.061-.122-.547-1.32-.75-1.81-.197-.474-.397-.41-.547-.417-.142-.007-.305-.009-.467-.009-.162 0-.427.061-.65.305-.223.244-.853.834-.853 2.035 0 1.2.873 2.36 1.001 2.475.127.115 1.705 2.612 4.14 3.655.58.248 1.03.396 1.38.508.583.185 1.114.159 1.533.096.467-.069 1.442-.589 1.646-1.159.203-.57.203-1.057.142-1.159-.06-.101-.223-.162-.467-.284z"/>
                                </svg>
                              )}
                              {isNotifying[member.id] ? 'Enviando...' : 'Notificar'}
                            </button>
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
