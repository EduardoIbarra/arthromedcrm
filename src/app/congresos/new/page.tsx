'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { 
  ArrowLeft, Save, Upload, Loader2, FileText, X, Plus, Calendar, Users, 
  DollarSign, User, Phone, Mail, LayoutTemplate, HandCoins, AlertCircle,
  Trash2, Edit, Clock, Car, ChevronDown, ChevronUp, Wrench, Shield
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NewCongresoPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [activeTab, setActiveTab] = useState<'general' | 'talleres' | 'staff' | 'itinerary' | 'resumen' | 'hotel' | 'estaciones' | 'contactos' | 'catalogos' | 'gastos'>('general')

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
    enable_workshops: true,
    flyer: '',
    specialty_ids: [] as string[],
    video_urls: [] as string[]
  })

  const [videoInput, setVideoInput] = useState('')

  const [workshops, setWorkshops] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([{ name: '', number: '', email: '' }])

  const [spendingCategories, setSpendingCategories] = useState<{ id: string; name: string }[]>([])
  const [globalBudget, setGlobalBudget] = useState<string>('')
  const [gastosEstimados, setGastosEstimados] = useState<{ category_id: string; amount: string }[]>([])

  const [staffList, setStaffList] = useState<any[]>([])
  const [carList, setCarList] = useState<any[]>([])
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [memberCarAssignments, setMemberCarAssignments] = useState<Record<string, string>>({})
  const [tempMembers, setTempMembers] = useState<any[]>([])

  const [itinerary, setItinerary] = useState<any[]>([])
  const [itineraryForm, setItineraryForm] = useState({
    date: '',
    time: '',
    description: '',
    notes: '',
    involvedMemberIds: [] as string[]
  })
  const [editingItineraryIndex, setEditingItineraryIndex] = useState<number | null>(null)
  
  const [availableCatalogs, setAvailableCatalogs] = useState<any[]>([])
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([])

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
    const fetchSpendingCategories = async () => {
      try {
        const { data } = await supabase.from('catalog_spending_categories').select('id, name').order('name')
        if (data) {
          setSpendingCategories(data)
          setGastosEstimados(data.map((cat: any) => ({ category_id: cat.id, amount: '' })))
        }
      } catch (err) {
        console.error(err)
      }
    }
    const fetchStaff = async () => {
      try {
        const res = await fetch('/api/cirugias/usuarios')
        const json = await res.json()
        setStaffList(json.data || [])
      } catch (err) {
        console.error(err)
      }
    }
    const fetchCars = async () => {
      try {
        const res = await fetch('/api/car-fleet')
        const json = await res.json()
        setCarList(json.data || [])
      } catch (err) {
        console.error(err)
      }
    }
    const fetchAllCatalogs = async () => {
      try {
        const res = await fetch('/api/catalogos')
        const json = await res.json()
        setAvailableCatalogs(json.data || [])
      } catch (err) {
        console.error(err)
      }
    }
    
    fetchSpecialties()
    fetchSpendingCategories()
    fetchStaff()
    fetchCars()
    fetchAllCatalogs()
  }, [])

  // Pre-fill itinerary date when options change
  useEffect(() => {
    const opts = getItineraryDateOptions()
    if (opts.length > 0 && !itineraryForm.date) {
      setItineraryForm(p => ({ ...p, date: opts[3]?.dateStr || opts[0].dateStr }))
    }
  }, [formData.start_date, formData.end_date])

  const addWorkshop = () => {
    setWorkshops([...workshops, { name: '', date_time: '', end_date_time: '', max_people: 20, cost: 0, professor: '' }])
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

  const handleGastoChange = (categoryId: string, amount: string) => {
    setGastosEstimados(prev => prev.map(g => g.category_id === categoryId ? { ...g, amount } : g))
  }

  const addVideoUrl = () => {
    if (!videoInput.trim()) return
    setFormData(prev => ({ ...prev, video_urls: [...prev.video_urls, videoInput.trim()] }))
    setVideoInput('')
  }

  const removeVideoUrl = (index: number) => {
    setFormData(prev => ({ ...prev, video_urls: prev.video_urls.filter((_, i) => i !== index) }))
  }

  // Staff checklist handlers
  const handleToggleMember = (userId: string) => {
    if (memberIds.includes(userId)) {
      setMemberIds(memberIds.filter(id => id !== userId))
      const updated = { ...memberCarAssignments }
      delete updated[userId]
      setMemberCarAssignments(updated)
      setItinerary(itinerary.map(item => ({
        ...item,
        involvedMemberIds: item.involvedMemberIds.filter((id: string) => id !== userId)
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

  const handleAddTempMember = () => {
    const newId = crypto.randomUUID()
    setTempMembers(prev => [
      ...prev,
      {
        id: newId,
        name: '',
        phone: '',
        carId: null
      }
    ])
  }

  const handleRemoveTempMember = (id: string) => {
    setTempMembers(prev => prev.filter(tm => tm.id !== id))
    const updatedAssignments = { ...memberCarAssignments }
    delete updatedAssignments[id]
    setMemberCarAssignments(updatedAssignments)
    setItinerary(itinerary.map(item => ({
      ...item,
      involvedMemberIds: item.involvedMemberIds.filter((mid: string) => mid !== id)
    })))
  }

  const handleUpdateTempMember = (id: string, field: string, value: any) => {
    setTempMembers(prev => prev.map(tm => {
      if (tm.id === id) {
        return { ...tm, [field]: value }
      }
      return tm
    }))
  }

  // Itinerary handlers
  const handleAddOrUpdateItinerary = (e: React.FormEvent) => {
    e.preventDefault()
    if (!itineraryForm.date || !itineraryForm.description) return
    
    const newItem = {
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
        const dtA = `${a.date}T${a.time || '00:00'}`
        const dtB = `${b.date}T${b.time || '00:00'}`
        return dtA.localeCompare(dtB)
      }))
      setEditingItineraryIndex(null)
    } else {
      setItinerary([...itinerary, newItem].sort((a, b) => {
        const dtA = `${a.date}T${a.time || '00:00'}`
        const dtB = `${b.date}T${b.time || '00:00'}`
        return dtA.localeCompare(dtB)
      }))
    }
    
    setItineraryForm({
      date: itineraryForm.date,
      time: '',
      description: '',
      notes: '',
      involvedMemberIds: []
    })
  }

  const handleEditItinerary = (index: number) => {
    const item = itinerary[index]
    setItineraryForm({
      date: item.date,
      time: item.time || '',
      description: item.description,
      notes: item.notes || '',
      involvedMemberIds: item.involvedMemberIds || []
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

  const handleCatalogToggle = (catalogId: string) => {
    setSelectedCatalogIds(prev => 
      prev.includes(catalogId)
        ? prev.filter(id => id !== catalogId)
        : [...prev, catalogId]
    )
  }

  const getItineraryDateOptions = () => {
    if (!formData.start_date) return []
    const start = new Date(formData.start_date)
    const end = formData.end_date ? new Date(formData.end_date) : new Date(formData.start_date)
    
    const options: { dateStr: string; label: string }[] = []
    
    // 3 days before
    for (let i = 3; i >= 1; i--) {
      const d = new Date(start)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      options.push({ dateStr, label: `${i} día(s) antes (${dateStr})` })
    }
    
    // Congress days
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

  const assignedStaff = useMemo(() => {
    const assigned = staffList.filter(s => memberIds.includes(s.id)).map(s => ({
      id: s.id,
      first_name: s.first_name || '',
      last_name: s.last_name || '',
      email: s.email || '',
      phone: s.whatsapp || '',
      whatsapp: s.whatsapp || '',
      position: s.position || 'Staff',
      isTemp: false,
      carId: (memberCarAssignments[s.id] || null) as string | null
    }))

    const temps = tempMembers.map(tm => ({
      id: tm.id,
      first_name: tm.name,
      last_name: '',
      email: '',
      phone: tm.phone || '',
      whatsapp: tm.phone || '',
      position: 'Staff Temporal',
      isTemp: true,
      carId: tm.carId || null
    }))

    return [...assigned, ...temps]
  }, [staffList, memberIds, tempMembers, memberCarAssignments])

  const totalGastos = gastosEstimados.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  const isBudgetExceeded = Boolean(globalBudget && totalGastos > Number(globalBudget))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isBudgetExceeded) {
      setError('El total de gastos estimados supera el presupuesto global.')
      setActiveTab('gastos')
      return
    }

    setIsSaving(true)
    setError(null)
    
    try {
      const payload = {
        ...formData,
        global_budget: globalBudget ? Number(globalBudget) : null,
        workshops,
        contacts: contacts.filter(c => c.name || c.number || c.email),
        gastos_estimados: gastosEstimados.filter(g => g.amount && Number(g.amount) > 0),
        catalog_ids: selectedCatalogIds,
        members: memberIds.map(userId => ({
          userId,
          carId: memberCarAssignments[userId] || null
        })),
        tempStaff: tempMembers.map(tm => ({
          id: tm.id,
          name: tm.name,
          phone: tm.phone || null,
          carId: tm.carId || null
        })),
        itinerary: itinerary.map(item => ({
          date: item.date,
          time: item.time || null,
          description: item.description,
          notes: item.notes || null,
          involvedMemberIds: item.involvedMemberIds
        }))
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
              <p className="text-sm text-gray-500 mt-0.5">Configure los detalles generales y de logística.</p>
            </div>
          </div>
        </header>

        {error && (
          <div className="card p-4 text-red-500 bg-red-50 border-red-100 flex items-center gap-3">
            <X size={20} />
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto no-scrollbar">
          <button
            type="button"
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab('general')}
          >
            <FileText size={16} /> Información General
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'talleres' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab('talleres')}
          >
            <Calendar size={16} /> Talleres
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'staff' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab('staff')}
          >
            <Users size={16} /> Staff ({memberIds.length})
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'itinerary' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab('itinerary')}
          >
            <Calendar size={16} /> Itinerario ({itinerary.length})
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'resumen' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab('resumen')}
          >
            <FileText size={16} /> Resumen Logístico
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'hotel' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab('hotel')}
          >
            <Car size={16} /> Hotel
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'estaciones' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab('estaciones')}
          >
            <Users size={16} /> Estaciones
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'contactos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab('contactos')}
          >
            <Users size={16} /> Contactos
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'catalogos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab('catalogos')}
          >
            <FileText size={16} /> Catálogos
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'gastos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab('gastos')}
          >
            <HandCoins size={16} /> Gastos Estimados
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6 pb-12">
          
          {activeTab === 'general' && (
            <div className="card p-6 md:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
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

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Videos de YouTube
                  </label>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="erp-input flex-1"
                        value={videoInput}
                        onChange={e => setVideoInput(e.target.value)}
                      />
                      <button 
                        type="button" 
                        onClick={addVideoUrl}
                        className="btn-secondary whitespace-nowrap"
                      >
                        <Plus size={16} /> Agregar URL
                      </button>
                    </div>
                    {formData.video_urls.length > 0 && (
                      <div className="space-y-2">
                        {formData.video_urls.map((url, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg">
                            <span className="text-sm text-gray-600 truncate mr-2">{url}</span>
                            <button 
                              type="button" 
                              onClick={() => removeVideoUrl(i)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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
          )}

          {activeTab === 'talleres' && (
            <div className="card p-6 md:p-8 space-y-4 animate-in fade-in zoom-in-95 duration-200">
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

              {workshops.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">No se han agregado talleres.</p>
              ) : (
                <div className="space-y-4">
                  {workshops.map((w, i) => (
                    <div key={i} className="group relative p-4 bg-gray-50 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <button 
                        type="button" 
                        onClick={() => removeWorkshop(i)}
                        className="absolute -top-2 -right-2 p-1.5 bg-white text-red-500 rounded-full shadow-sm border border-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                      
                      <div className="md:col-span-3">
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
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Fecha y Hora Inicio</label>
                        <input
                          required
                          type="datetime-local"
                          className="erp-input w-full bg-white"
                          value={w.date_time}
                          onChange={e => updateWorkshop(i, 'date_time', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Fecha y Hora Fin (Opcional)</label>
                        <input
                          type="datetime-local"
                          className="erp-input w-full bg-white"
                          value={w.end_date_time}
                          onChange={e => updateWorkshop(i, 'end_date_time', e.target.value)}
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
          )}

          {activeTab === 'staff' && (
            <div className="card p-6 space-y-6 bg-white shadow-sm border border-gray-150 rounded-2xl animate-in fade-in duration-200">
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-1">Personal de Staff Asignado</h3>
                <p className="text-xs text-gray-500 mb-4">Selecciona los miembros de tu equipo que participarán u organizarán este congreso.</p>
                
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

                        {/* Car assignment dropdown */}
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
                                  {car.alias || `${car.make} ${car.model} (${car.plate_number})`}
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

              {/* Personal Temporal / Externo */}
              <div className="pt-6 border-t border-gray-150 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Personal Temporal o Externo</h4>
                    <p className="text-xs text-gray-500">Agrega colaboradores adicionales que participarán en este congreso temporalmente.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTempMember}
                    className="btn-secondary self-start sm:self-auto py-1.5 px-3 border-blue-200 text-blue-700 hover:bg-blue-50 text-xs flex items-center gap-1.5 rounded-xl transition-all font-semibold"
                  >
                    <Plus size={14} />
                    Agregar Personal Temporal
                  </button>
                </div>

                {tempMembers.length === 0 ? (
                  <div className="p-5 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400 italic">
                    No hay personal temporal asignado.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tempMembers.map((member) => (
                      <div key={member.id} className="p-4 bg-gray-50/50 rounded-xl border border-gray-150 space-y-3 relative group">
                        <button
                          type="button"
                          onClick={() => handleRemoveTempMember(member.id)}
                          className="absolute top-3 right-3 text-gray-400 hover:text-red-500 p-1 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar personal temporal"
                        >
                          <Trash2 size={14} />
                        </button>
                        
                        <div className="space-y-3 pr-6">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre Completo *</label>
                            <input
                              type="text"
                              value={member.name}
                              onChange={(e) => handleUpdateTempMember(member.id, 'name', e.target.value)}
                              placeholder="Ej. Juan Pérez"
                              className="erp-input w-full py-1.5 px-2.5 text-xs bg-white focus:bg-white"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">WhatsApp (Celular)</label>
                            <input
                              type="tel"
                              value={member.phone}
                              onChange={(e) => handleUpdateTempMember(member.id, 'phone', e.target.value)}
                              placeholder="Ej. 8110000000"
                              className="erp-input w-full py-1.5 px-2.5 text-xs bg-white focus:bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Vehículo Asignado</label>
                            <select
                              value={member.carId || ''}
                              onChange={(e) => handleUpdateTempMember(member.id, 'carId', e.target.value)}
                              className="erp-input w-full py-1.5 px-2 text-xs bg-white focus:bg-white"
                            >
                              <option value="">-- Sin Vehículo --</option>
                              {carList.map((car) => (
                                <option key={car.id} value={car.id}>
                                  {car.alias || `${car.make} ${car.model} (${car.plate_number})`}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'itinerary' && (
            <div className="space-y-6 animate-in fade-in duration-200">
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
                    placeholder="Ej. Registro de médicos y entrega de material"
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
                    <p className="text-xs text-orange-500 italic">Debes asignar miembros al staff del congreso (en la pestaña Staff) para poder seleccionarlos en el itinerario.</p>
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
                            {member.first_name}
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
                  <p className="text-sm text-gray-400 italic text-center py-8">No hay actividades añadidas en el itinerario de este congreso.</p>
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

          {(activeTab === 'resumen' || activeTab === 'hotel' || activeTab === 'estaciones') && (
            <div className="p-6 bg-slate-50 border border-gray-150 rounded-2xl flex flex-col items-center justify-center text-center py-16 space-y-4">
              <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                <Shield size={24} />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h4 className="font-bold text-gray-900">Sección disponible al guardar</h4>
                <p className="text-xs text-gray-500">
                  Para poder gestionar las habitaciones de hotel, las estaciones logísticas, y ver el resumen logístico consolidado, guarde primero el congreso.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'contactos' && (
            <div className="card p-6 md:p-8 space-y-4 animate-in fade-in zoom-in-95 duration-200">
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
          )}

          {activeTab === 'catalogos' && (
            <div className="card p-6 md:p-8 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="text-blue-600" size={20} />
                  Catálogos Asociados
                </h2>
              </div>
              {availableCatalogs.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  No hay catálogos globales creados. Puedes crear catálogos en la sección de "Catálogos" del menú principal.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {availableCatalogs.map(catalog => {
                    const isChecked = selectedCatalogIds.includes(catalog.id)
                    return (
                      <label 
                        key={catalog.id} 
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none
                          ${isChecked 
                            ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-50' 
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                          }
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleCatalogToggle(catalog.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{catalog.name}</p>
                          {catalog.description && (
                            <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{catalog.description}</p>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'gastos' && (
            <div className="card p-6 md:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
                <HandCoins className="text-amber-600" size={20} />
                <h2 className="text-lg font-semibold text-gray-900">Gastos Estimados</h2>
              </div>
              
              <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Presupuesto Global
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="number"
                    step="0.01"
                    className="erp-input w-full pl-9 text-lg font-semibold text-gray-900"
                    placeholder="0.00"
                    value={globalBudget}
                    onChange={e => setGlobalBudget(e.target.value)}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Presupuesto total estimado para este congreso.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-4 border-t border-gray-100">
                {spendingCategories.map(cat => {
                  const gasto = gastosEstimados.find(g => g.category_id === cat.id)
                  return (
                    <div key={cat.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                      <div className="relative w-full sm:w-40">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="erp-input w-full bg-white pl-8 text-sm"
                          value={gasto?.amount || ''}
                          onChange={e => handleGastoChange(cat.id, e.target.value)}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className={`mt-6 p-4 rounded-xl border flex items-center justify-between ${isBudgetExceeded ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                <div className="flex items-center gap-2 font-semibold">
                  Total Estimado
                  {isBudgetExceeded && <AlertCircle size={16} className="text-red-500" />}
                </div>
                <div className="text-xl font-bold">
                  ${totalGastos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </div>
              </div>
              
              {isBudgetExceeded && (
                <p className="text-sm text-red-600 font-medium">
                  El total de categorías (${totalGastos.toLocaleString('es-MX')}) excede el presupuesto global definido (${Number(globalBudget).toLocaleString('es-MX')}).
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-4 pt-6 mt-6">
            <Link href="/congresos" className="btn-secondary bg-white">
              {t('cancel')}
            </Link>
            <button 
              type="submit"
              disabled={isSaving || isBudgetExceeded}
              className={`btn-primary shadow-lg ${isBudgetExceeded ? 'opacity-50 cursor-not-allowed' : 'shadow-blue-200'}`}
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin" /> {t('loading')}
                </div>
              ) : (
                <><Save size={18} /> Guardar Congreso</>
              )}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
