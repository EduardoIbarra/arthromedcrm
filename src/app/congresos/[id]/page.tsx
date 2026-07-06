'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { 
  ArrowLeft, Save, QrCode, Upload, Loader2, FileText, X, 
  Calendar, MapPin, AlignLeft, Image as ImageIcon, Trash2, 
  Globe, File, Download, Paperclip, Plus, Users, User, DollarSign, Phone, Mail, HandCoins, AlertCircle,
  Wrench, Boxes, BedDouble, Hotel, Clock, Edit, Car, ChevronDown, ChevronUp, Sparkles, BookOpen, ClipboardList
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import DoctorSelector from '@/components/DoctorSelector'
import Modal from '@/components/Modal'
import { CarFleet } from '@/types/database'

export default function EditCongresoPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [activeTab, setActiveTab] = useState<'general' | 'talleres' | 'contactos' | 'catalogos' | 'gastos' | 'staff' | 'itinerary' | 'resumen' | 'hotel' | 'estaciones' | 'pendientes'>('general')

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
    specialty_ids: [] as string[],
    video_urls: [] as string[]
  })

  const [videoInput, setVideoInput] = useState('')

  const [workshops, setWorkshops] = useState<any[]>([])
  const [independentWorkshops, setIndependentWorkshops] = useState<any[]>([])
  const [isAddExistingModalOpen, setIsAddExistingModalOpen] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])
  
  const [availableCatalogs, setAvailableCatalogs] = useState<any[]>([])
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([])

  const [spendingCategories, setSpendingCategories] = useState<{ id: string; name: string }[]>([])
  const [globalBudget, setGlobalBudget] = useState<string>('')
  const [gastosEstimados, setGastosEstimados] = useState<{ category_id: string; amount: string }[]>([])

  // New Congresos Logistics States
  const [hotelRooms, setHotelRooms] = useState<any[]>([])
  const [hotelLoading, setHotelLoading] = useState(false)
  const [hotelSaving, setHotelSaving] = useState<Record<string, boolean>>({})
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [showAddRoom, setShowAddRoom] = useState(false)
  const [newRoomForm, setNewRoomForm] = useState({ room_number: '', room_type: 'Doble', capacity: 2, notes: '' })
  const [assigningRoomId, setAssigningRoomId] = useState<string | null>(null)
  const [guestForm, setGuestForm] = useState({ guest_name: '', guest_phone: '' })
  const [showGuestForm, setShowGuestForm] = useState(false)

  const [stations, setStations] = useState<any[]>([])
  const [stationsLoading, setStationsLoading] = useState(false)
  const [stationsSaving, setStationsSaving] = useState<Record<string, boolean>>({})
  const [showAddStation, setShowAddStation] = useState(false)
  const [newStationName, setNewStationName] = useState('')
  const [catalogProducts, setCatalogProducts] = useState<any[]>([])
  const [stationSearchQuery, setStationSearchQuery] = useState<Record<string, string>>({})
  const [editingStationNameId, setEditingStationNameId] = useState<string | null>(null)
  const [tempStationName, setTempStationName] = useState('')

  // New Congresos Pendientes States
  const [pendientes, setPendientes] = useState<any[]>([])
  const [pendientesLoading, setPendientesLoading] = useState(false)
  const [pendientesSaving, setPendientesSaving] = useState<Record<string, boolean>>({})
  const [newPendienteForm, setNewPendienteForm] = useState({ name: '', description: '', amount: '', responsable_id: '' })
  const [showAddPendiente, setShowAddPendiente] = useState(false)

  const [staffList, setStaffList] = useState<any[]>([])
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [tempMembers, setTempMembers] = useState<any[]>([])
  const [carList, setCarList] = useState<CarFleet[]>([])
  const [memberCarAssignments, setMemberCarAssignments] = useState<Record<string, string>>({})
  const [itinerary, setItinerary] = useState<any[]>([])
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({})
  const [groupByVehicle, setGroupByVehicle] = useState(false)
  const [isNotifyingAll, setIsNotifyingAll] = useState(false)
  const [isNotifying, setIsNotifying] = useState<Record<string, boolean>>({})

  const [itineraryForm, setItineraryForm] = useState({
    date: '',
    time: '',
    description: '',
    notes: '',
    involvedMemberIds: [] as string[]
  })
  const [editingItineraryIndex, setEditingItineraryIndex] = useState<number | null>(null)

  const supabase = createClient()

  const fetchHotelRooms = useCallback(async () => {
    if (!id) return
    setHotelLoading(true)
    try {
      const res = await fetch(`/api/congresos/${id}/hotel-rooms`)
      const { data } = await res.json()
      setHotelRooms(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setHotelLoading(false)
    }
  }, [id])

  const fetchStations = useCallback(async () => {
    if (!id) return
    setStationsLoading(true)
    try {
      const res = await fetch(`/api/congresos/${id}/stations`)
      const { data } = await res.json()
      setStations(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setStationsLoading(false)
    }
  }, [id])

  const fetchPendientes = useCallback(async () => {
    if (!id) return
    setPendientesLoading(true)
    try {
      const res = await fetch(`/api/congresos/${id}/pendientes`)
      const { data } = await res.json()
      setPendientes(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setPendientesLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) {
      fetchHotelRooms()
      fetchStations()
      fetchPendientes()
    }
  }, [id])

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
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchSpecialties()
    fetchSpendingCategories()

    // Fetch system users for staff selection
    fetch('/api/cirugias/usuarios')
      .then(r => r.json())
      .then(({ data }) => setStaffList(data || []))

    // Fetch car fleet for assignments
    fetch('/api/car-fleet')
      .then(r => r.json())
      .then(({ data }) => setCarList(data || []))

    // Fetch catalog products
    fetch('/api/products')
      .then(r => r.json())
      .then(({ data }) => setCatalogProducts(data || []))
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
          specialty_ids: data.specialty_ids || [],
          video_urls: data.video_urls || []
        })
        setWorkshops((data.workshops || []).map((w: any) => ({
          ...w,
          doctorIds: w.doctors ? w.doctors.map((d: any) => d.doctor_id) : []
        })))
        setContacts(data.contacts || [])
        setGlobalBudget(data.global_budget ? data.global_budget.toString() : '')
        
        if (data.gastos_estimados && data.gastos_estimados.length > 0) {
          setGastosEstimados(data.gastos_estimados.map((ge: any) => ({
            category_id: ge.category_id,
            amount: ge.amount.toString()
          })))
        }
        
        const linkedCatalogIds = data.congress_catalogos?.map((cc: any) => cc.catalog_id) || []
        setSelectedCatalogIds(linkedCatalogIds)

        // Load congreso members, temp staff, and itineraries
        if (data.congreso_members) {
          setMemberIds(data.congreso_members.map((m: any) => m.user_id))
          const assignments: Record<string, string> = {}
          data.congreso_members.forEach((m: any) => {
            if (m.car_id) {
              assignments[m.user_id] = m.car_id
            }
          })
          setMemberCarAssignments(assignments)
        }
        if (data.congreso_temp_staff) {
          setTempMembers(data.congreso_temp_staff.map((tm: any) => ({
            id: tm.id,
            name: tm.name,
            phone: tm.phone || '',
            carId: tm.car_id || null
          })))
        }
        if (data.congreso_itinerarios) {
          setItinerary(data.congreso_itinerarios.map((it: any) => ({
            id: it.id,
            date: it.date.split('T')[0],
            time: it.time || '',
            description: it.activity, // activity in DB!
            notes: it.notes || '',
            involvedMemberIds: it.involved_members.map((im: any) => im.user_id || im.temp_member_id)
          })))
        }
        
        fetchFiles()
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCongreso()
  }, [id])

  useEffect(() => {
    const fetchAllCatalogs = async () => {
      try {
        const res = await fetch('/api/catalogos')
        if (res.ok) {
          const { data } = await res.json()
          setAvailableCatalogs(data)
        }
      } catch (err) {
        console.error('Error loading catalogs:', err)
      }
    }
    const fetchIndependentWorkshops = async () => {
      try {
        const res = await fetch('/api/workshops')
        if (res.ok) {
          const { data } = await res.json()
          setIndependentWorkshops(data.filter((w: any) => !w.congress_id))
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchAllCatalogs()
    fetchIndependentWorkshops()
  }, [])

  const handleCatalogToggle = (catalogId: string) => {
    setSelectedCatalogIds(prev => 
      prev.includes(catalogId)
        ? prev.filter(id => id !== catalogId)
        : [...prev, catalogId]
    )
  }

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
    setWorkshops([...workshops, { name: '', date_time: '', end_date_time: '', max_people: 20, cost: 0, professor: 'N/A', doctorIds: [] }])
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

  const handleGastoChange = (categoryId: string, amount: string) => {
    setGastosEstimados(prev => {
      const existing = prev.find(g => g.category_id === categoryId)
      if (existing) {
        return prev.map(g => g.category_id === categoryId ? { ...g, amount } : g)
      } else {
        return [...prev, { category_id: categoryId, amount }]
      }
    })
  }

  const addVideoUrl = () => {
    if (!videoInput.trim()) return
    setFormData(prev => ({ ...prev, video_urls: [...prev.video_urls, videoInput.trim()] }))
    setVideoInput('')
  }

  const removeVideoUrl = (index: number) => {
    setFormData(prev => ({ ...prev, video_urls: prev.video_urls.filter((_, i) => i !== index) }))
  }

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
        catalog_ids: selectedCatalogIds,
        gastos_estimados: gastosEstimados.filter(g => g.amount && Number(g.amount) > 0),
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
          id: item.id,
          date: item.date,
          time: item.time,
          description: item.description,
          notes: item.notes,
          involvedMemberIds: item.involvedMemberIds
        }))
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

  // Logistics Helpers
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
      email: 'Personal Temporal',
      phone: tm.phone || '',
      whatsapp: tm.phone || '',
      position: 'Staff Temporal',
      isTemp: true,
      carId: (tm.carId || null) as string | null
    }))
    
    return [...assigned, ...temps]
  }, [staffList, memberIds, tempMembers, memberCarAssignments])

  const unassignedHotelStaff = useMemo(() => {
    return assignedStaff.filter(staff => {
      return !hotelRooms.some(room => 
        room.congreso_hotel_occupants.some((occ: any) => 
          staff.isTemp 
            ? occ.guest_name === staff.first_name 
            : occ.user_id === staff.id
        )
      )
    })
  }, [assignedStaff, hotelRooms])

  // Drag and Drop Helpers
  const handleDragStartVehicle = (e: React.DragEvent, memberId: string, isTemp: boolean) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'vehicle-staff', memberId, isTemp }))
  }

  const handleDropVehicle = (e: React.DragEvent, carId: string | null) => {
    e.preventDefault()
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))
      if (data.type === 'vehicle-staff') {
        const { memberId, isTemp } = data
        if (isTemp) {
          handleUpdateTempMember(memberId, 'carId', carId || null)
        } else {
          handleAssignCar(memberId, carId || '')
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDragStartHotel = (e: React.DragEvent, staffId: string, isTemp: boolean, sourceRoomId?: string, occupantId?: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ 
      type: 'hotel-staff', 
      staffId, 
      isTemp, 
      sourceRoomId, 
      occupantId 
    }))
  }

  const handleDropRoom = async (e: React.DragEvent, targetRoomId: string) => {
    e.preventDefault()
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))
      if (data.type === 'hotel-staff') {
        const { staffId, isTemp, sourceRoomId, occupantId } = data
        
        if (sourceRoomId === targetRoomId) return
        
        const targetRoom = hotelRooms.find(r => r.id === targetRoomId)
        if (!targetRoom) return
        
        const staff = assignedStaff.find(s => s.id === staffId)
        if (!staff) return
        
        let newOccupants = [...targetRoom.congreso_hotel_occupants.map((o: any) => ({
          user_id: o.user_id,
          guest_name: o.guest_name,
          guest_phone: o.guest_phone
        }))]
        
        if (isTemp) {
          newOccupants.push({ guest_name: staff.first_name, guest_phone: staff.phone || null, user_id: null })
        } else {
          newOccupants.push({ user_id: staffId, guest_name: null, guest_phone: null })
        }
        
        await handleUpdateOccupants(targetRoomId, newOccupants)
        
        if (sourceRoomId && occupantId) {
          const sourceRoom = hotelRooms.find(r => r.id === sourceRoomId)
          if (sourceRoom) {
            const cleanSourceOccupants = sourceRoom.congreso_hotel_occupants
              .filter((o: any) => o.id !== occupantId)
              .map((o: any) => ({
                user_id: o.user_id,
                guest_name: o.guest_name,
                guest_phone: o.guest_phone
              }))
            await handleUpdateOccupants(sourceRoomId, cleanSourceOccupants)
          }
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDropUnassignedHotel = async (e: React.DragEvent) => {
    e.preventDefault()
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))
      if (data.type === 'hotel-staff' && data.sourceRoomId && data.occupantId) {
        await handleRemoveOccupant(data.sourceRoomId, data.occupantId)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Stations handlers
  const handleCreateStation = async () => {
    if (!newStationName.trim()) return
    setStationsSaving(p => ({ ...p, new: true }))
    try {
      const res = await fetch(`/api/congresos/${id}/stations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStationName.trim() })
      })
      if (res.ok) {
        setNewStationName('')
        setShowAddStation(false)
        await fetchStations()
      } else {
        const e = await res.json()
        alert('Error: ' + e.error)
      }
    } finally {
      setStationsSaving(p => ({ ...p, new: false }))
    }
  }

  const handleDeleteStation = async (stationId: string) => {
    if (!confirm('¿Eliminar esta estación y todos sus productos?')) return
    setStationsSaving(p => ({ ...p, [stationId]: true }))
    try {
      await fetch(`/api/congresos/${id}/stations/${stationId}`, { method: 'DELETE' })
      await fetchStations()
    } finally {
      setStationsSaving(p => ({ ...p, [stationId]: false }))
    }
  }

  const handleRenameStation = async (stationId: string) => {
    if (!tempStationName.trim()) return
    setStationsSaving(p => ({ ...p, [stationId]: true }))
    try {
      const res = await fetch(`/api/congresos/${id}/stations/${stationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tempStationName.trim() })
      })
      if (res.ok) {
        setEditingStationNameId(null)
        setTempStationName('')
        await fetchStations()
      }
    } finally {
      setStationsSaving(p => ({ ...p, [stationId]: false }))
    }
  }

  const handleUpdateStationProducts = async (stationId: string, products: { product_id: string, cantidad: number }[]) => {
    setStationsSaving(p => ({ ...p, [stationId]: true }))
    try {
      const res = await fetch(`/api/congresos/${id}/stations/${stationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products })
      })
      if (res.ok) {
        await fetchStations()
      }
    } finally {
      setStationsSaving(p => ({ ...p, [stationId]: false }))
    }
  }

  const handleAddProductToStation = async (stationId: string, productId: string) => {
    const station = stations.find(s => s.id === stationId)
    if (!station) return
    const existing = station.congreso_station_products.find((p: any) => p.product_id === productId)
    let updatedProducts: { product_id: string; cantidad: number }[] = []
    if (existing) {
      updatedProducts = station.congreso_station_products.map((p: any) => ({
        product_id: p.product_id,
        cantidad: p.product_id === productId ? p.cantidad + 1 : p.cantidad
      }))
    } else {
      updatedProducts = [
        ...station.congreso_station_products.map((p: any) => ({ product_id: p.product_id, cantidad: p.cantidad })),
        { product_id: productId, cantidad: 1 }
      ]
    }
    await handleUpdateStationProducts(stationId, updatedProducts)
    setStationSearchQuery(p => ({ ...p, [stationId]: '' }))
  }

  const handleRemoveProductFromStation = async (stationId: string, productId: string) => {
    const station = stations.find(s => s.id === stationId)
    if (!station) return
    const updatedProducts = station.congreso_station_products
      .filter((p: any) => p.product_id !== productId)
      .map((p: any) => ({ product_id: p.product_id, cantidad: p.cantidad }))
    await handleUpdateStationProducts(stationId, updatedProducts)
  }

  const handleUpdateProductQty = async (stationId: string, productId: string, cantidad: number) => {
    if (cantidad < 1) return
    const station = stations.find(s => s.id === stationId)
    if (!station) return
    const updatedProducts = station.congreso_station_products.map((p: any) => ({
      product_id: p.product_id,
      cantidad: p.product_id === productId ? cantidad : p.cantidad
    }))
    await handleUpdateStationProducts(stationId, updatedProducts)
  }

  // Hotel rooms handlers
  const handleCreateRoom = async () => {
    if (!newRoomForm.room_number.trim()) return
    setHotelSaving(p => ({ ...p, new: true }))
    try {
      const res = await fetch(`/api/congresos/${id}/hotel-rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoomForm)
      })
      if (res.ok) {
        setNewRoomForm({ room_number: '', room_type: 'Doble', capacity: 2, notes: '' })
        setShowAddRoom(false)
        await fetchHotelRooms()
      } else {
        const e = await res.json()
        alert('Error: ' + e.error)
      }
    } finally {
      setHotelSaving(p => ({ ...p, new: false }))
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('¿Eliminar esta habitación y todos sus ocupantes?')) return
    setHotelSaving(p => ({ ...p, [roomId]: true }))
    try {
      await fetch(`/api/congresos/${id}/hotel-rooms/${roomId}`, { method: 'DELETE' })
      await fetchHotelRooms()
    } finally {
      setHotelSaving(p => ({ ...p, [roomId]: false }))
    }
  }

  const handleUpdateOccupants = async (roomId: string, occupants: any[]) => {
    setHotelSaving(p => ({ ...p, [roomId]: true }))
    try {
      const res = await fetch(`/api/congresos/${id}/hotel-rooms/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occupants })
      })
      if (res.ok) {
        await fetchHotelRooms()
      }
    } finally {
      setHotelSaving(p => ({ ...p, [roomId]: false }))
    }
  }

  const handleAddStaffToRoom = async (roomId: string, staffId: string) => {
    const room = hotelRooms.find(r => r.id === roomId)
    if (!room) return
    const staff = assignedStaff.find(s => s.id === staffId)
    if (!staff) return

    if (staff.isTemp) {
      const alreadyIn = room.congreso_hotel_occupants.some((o: any) => o.guest_name === staff.first_name)
      if (alreadyIn) return
      const newOccupants = [
        ...room.congreso_hotel_occupants.map((o: any) => ({ user_id: o.user_id, guest_name: o.guest_name, guest_phone: o.guest_phone })),
        { guest_name: staff.first_name, guest_phone: staff.phone || null, user_id: null }
      ]
      await handleUpdateOccupants(roomId, newOccupants)
    } else {
      const alreadyIn = room.congreso_hotel_occupants.some((o: any) => o.user_id === staffId)
      if (alreadyIn) return
      const newOccupants = [
        ...room.congreso_hotel_occupants.map((o: any) => ({ user_id: o.user_id, guest_name: o.guest_name, guest_phone: o.guest_phone })),
        { user_id: staffId, guest_name: null, guest_phone: null }
      ]
      await handleUpdateOccupants(roomId, newOccupants)
    }
  }

  const handleAddGuestToRoom = async (roomId: string) => {
    if (!guestForm.guest_name.trim()) return
    const room = hotelRooms.find(r => r.id === roomId)
    if (!room) return
    const newOccupants = [
      ...room.congreso_hotel_occupants.map((o: any) => ({ user_id: o.user_id, guest_name: o.guest_name, guest_phone: o.guest_phone })),
      { guest_name: guestForm.guest_name.trim(), guest_phone: guestForm.guest_phone.trim() || null }
    ]
    await handleUpdateOccupants(roomId, newOccupants)
    setGuestForm({ guest_name: '', guest_phone: '' })
    setShowGuestForm(false)
  }

  const handleRemoveOccupant = async (roomId: string, occupantId: string) => {
    const room = hotelRooms.find(r => r.id === roomId)
    if (!room) return
    const newOccupants = room.congreso_hotel_occupants
      .filter((o: any) => o.id !== occupantId)
      .map((o: any) => ({ user_id: o.user_id, guest_name: o.guest_name, guest_phone: o.guest_phone }))
    await handleUpdateOccupants(roomId, newOccupants)
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

  // Pre-fill itinerary date when options change
  useEffect(() => {
    const opts = getItineraryDateOptions()
    if (opts.length > 0 && !itineraryForm.date) {
      setItineraryForm(p => ({ ...p, date: opts[3]?.dateStr || opts[0].dateStr }))
    }
  }, [formData.start_date, formData.end_date])

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

    const newItem: any = {
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

  // Pendientes Handlers
  const handleCreatePendiente = async () => {
    if (!newPendienteForm.name.trim()) return
    setPendientesSaving(p => ({ ...p, new: true }))
    try {
      const res = await fetch(`/api/congresos/${id}/pendientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPendienteForm)
      })
      if (res.ok) {
        setNewPendienteForm({ name: '', description: '', amount: '', responsable_id: '' })
        setShowAddPendiente(false)
        await fetchPendientes()
      } else {
        const e = await res.json()
        alert('Error: ' + e.error)
      }
    } finally {
      setPendientesSaving(p => ({ ...p, new: false }))
    }
  }

  const handleTogglePendiente = async (pendienteId: string, completed: boolean) => {
    setPendientesSaving(p => ({ ...p, [pendienteId]: true }))
    try {
      const res = await fetch(`/api/congresos/${id}/pendientes/${pendienteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed })
      })
      if (res.ok) {
        await fetchPendientes()
      }
    } finally {
      setPendientesSaving(p => ({ ...p, [pendienteId]: false }))
    }
  }

  const handleUpdateComments = async (pendienteId: string, comments: string) => {
    setPendientesSaving(p => ({ ...p, [pendienteId]: true }))
    try {
      const res = await fetch(`/api/congresos/${id}/pendientes/${pendienteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments })
      })
      if (res.ok) {
        await fetchPendientes()
      }
    } finally {
      setPendientesSaving(p => ({ ...p, [pendienteId]: false }))
    }
  }

  const handleUpdateResponsable = async (pendienteId: string, responsable_id: string) => {
    setPendientesSaving(p => ({ ...p, [pendienteId]: true }))
    try {
      const res = await fetch(`/api/congresos/${id}/pendientes/${pendienteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responsable_id })
      })
      if (res.ok) {
        await fetchPendientes()
      }
    } finally {
      setPendientesSaving(p => ({ ...p, [pendienteId]: false }))
    }
  }

  const handleDeletePendiente = async (pendienteId: string) => {
    if (!confirm('¿Eliminar este pendiente?')) return
    setPendientesSaving(p => ({ ...p, [pendienteId]: true }))
    try {
      await fetch(`/api/congresos/${id}/pendientes/${pendienteId}`, { method: 'DELETE' })
      await fetchPendientes()
    } finally {
      setPendientesSaving(p => ({ ...p, [pendienteId]: false }))
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
      const res = await fetch(`/api/congresos/${id}/notify`, {
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
    if (!confirm('¿Estás seguro de que deseas notificar a todo el staff de este congreso vía WhatsApp?')) return
    setIsNotifyingAll(true)
    try {
      const res = await fetch(`/api/congresos/${id}/notify`, {
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
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'pendientes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab('pendientes')}
          >
            <ClipboardList size={16} /> Pendientes ({pendientes.length})
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
            onClick={() => {
              if (!formData.start_date) {
                alert('Por favor ingresa la fecha de inicio primero.')
                return
              }
              setActiveTab('staff')
            }}
          >
            <Users size={16} /> Miembros del Staff ({memberIds.length})
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'itinerary' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => {
              if (!formData.start_date) {
                alert('Por favor ingresa la fecha de inicio primero.')
                return
              }
              setActiveTab('itinerary')
            }}
          >
            <Calendar size={16} /> Itinerario ({itinerary.length})
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'resumen' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => {
              if (!formData.start_date) {
                alert('Por favor ingresa la fecha de inicio primero.')
                return
              }
              setActiveTab('resumen')
            }}
          >
            <FileText size={16} /> Resumen Staff
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'hotel' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => {
              if (!formData.start_date) {
                alert('Por favor ingresa la fecha de inicio primero.')
                return
              }
              setActiveTab('hotel')
            }}
          >
            <Hotel size={16} /> Habitaciones ({hotelRooms.length})
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'estaciones' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => {
              if (!formData.start_date) {
                alert('Por favor ingresa la fecha de inicio primero.')
                return
              }
              setActiveTab('estaciones')
            }}
          >
            <Boxes size={16} /> Estaciones ({stations.length})
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
            <FileText size={16} /> Catálogos Asociados
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'gastos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActiveTab('gastos')}
          >
            <HandCoins size={16} /> Gastos Estimados
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          
          {activeTab === 'pendientes' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <ClipboardList size={18} className="text-blue-500" />
                    Pendientes del Congreso
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Administra las tareas y pendientes del congreso. Asigna responsables, montos y añade comentarios.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddPendiente(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus size={15} /> Nuevo Pendiente
                </button>
              </div>

              {showAddPendiente && (
                <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl space-y-4">
                  <h4 className="font-bold text-sm text-blue-900">Nuevo Pendiente</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre *</label>
                      <input
                        type="text"
                        placeholder="Nombre de la tarea / pendiente"
                        className="erp-input w-full bg-white"
                        value={newPendienteForm.name}
                        onChange={e => setNewPendienteForm(p => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Monto (Opcional)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="erp-input w-full bg-white"
                        value={newPendienteForm.amount}
                        onChange={e => setNewPendienteForm(p => ({ ...p, amount: e.target.value }))}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción</label>
                      <textarea
                        rows={2}
                        placeholder="Breve descripción del pendiente"
                        className="erp-input w-full bg-white"
                        value={newPendienteForm.description}
                        onChange={e => setNewPendienteForm(p => ({ ...p, description: e.target.value }))}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Responsable</label>
                      <select
                        className="erp-input w-full bg-white"
                        value={newPendienteForm.responsable_id}
                        onChange={e => setNewPendienteForm(p => ({ ...p, responsable_id: e.target.value }))}
                      >
                        <option value="">-- Sin asignar --</option>
                        {staffList.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.first_name || s.last_name ? `${s.first_name || ''} ${s.last_name || ''}`.trim() : s.email} {s.position ? `(${s.position})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreatePendiente}
                      disabled={!newPendienteForm.name.trim() || pendientesSaving['new']}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
                    >
                      {pendientesSaving['new'] ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Crear
                    </button>
                    <button type="button" onClick={() => { setShowAddPendiente(false); setNewPendienteForm({ name: '', description: '', amount: '', responsable_id: '' }) }} className="btn-secondary text-sm">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {pendientesLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
              ) : pendientes.length === 0 ? (
                <div className="text-center py-14 border-2 border-dashed border-gray-200 rounded-2xl space-y-2">
                  <ClipboardList size={36} className="text-gray-300 mx-auto" />
                  <p className="text-sm font-semibold text-gray-500">No hay pendientes registrados</p>
                  <p className="text-xs text-gray-400">Crea un pendiente para comenzar a dar seguimiento.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendientes.map(item => {
                    const itemId = item.id
                    const isSaving = !!pendientesSaving[itemId]
                    return (
                      <div key={itemId} className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all duration-200 ${item.completed ? 'border-gray-200 bg-gray-50/50' : 'border-gray-150'}`}>
                        <div className="p-4 flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={item.completed}
                              disabled={isSaving}
                              onChange={e => handleTogglePendiente(itemId, e.target.checked)}
                              className="mt-1.5 w-5 h-5 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className={`font-bold text-sm text-gray-900 ${item.completed ? 'line-through text-gray-400' : ''}`}>{item.name}</h4>
                              {item.description && (
                                <p className={`text-xs text-gray-500 mt-1 whitespace-pre-line ${item.completed ? 'text-gray-450' : ''}`}>{item.description}</p>
                              )}
                              
                              <div className="flex flex-wrap items-center gap-3 mt-3">
                                {item.amount !== null && (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                                    <DollarSign size={12} />
                                    {Number(item.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                  </span>
                                )}

                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                  <span className="font-medium">Responsable:</span>
                                  <select
                                    value={item.responsable_id || ''}
                                    disabled={isSaving}
                                    onChange={e => handleUpdateResponsable(itemId, e.target.value)}
                                    className="bg-transparent border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-650 hover:bg-gray-50 focus:bg-white"
                                  >
                                    <option value="">-- Sin asignar --</option>
                                    {staffList.map(s => (
                                      <option key={s.id} value={s.id}>
                                        {s.first_name || s.last_name ? `${s.first_name || ''} ${s.last_name || ''}`.trim() : s.email}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-start gap-2 shrink-0 self-end md:self-start">
                            <button
                              type="button"
                              onClick={() => handleDeletePendiente(itemId)}
                              disabled={isSaving}
                              className="p-1.5 text-gray-450 hover:text-red-650 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </div>
                        </div>

                        {/* Comments Block */}
                        <div className="bg-gray-50 border-t border-gray-100 p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <span className="text-xs font-semibold text-gray-450 shrink-0 select-none">Comentarios:</span>
                          <input
                            type="text"
                            placeholder="Añade un comentario sobre este pendiente..."
                            defaultValue={item.comments || ''}
                            disabled={isSaving}
                            onBlur={e => {
                              if (e.target.value !== (item.comments || '')) {
                                handleUpdateComments(itemId, e.target.value)
                              }
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                e.currentTarget.blur()
                              }
                            }}
                            className="flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-300"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'general' && (
            <div className="card p-6 md:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
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
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addVideoUrl())}
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
          )}

          {activeTab === 'talleres' && (
            <div className="card p-6 md:p-8 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar className="text-purple-600" size={20} /> Talleres</h2>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setIsAddExistingModalOpen(true)} className="btn-secondary py-1.5 px-3 text-sm"><Plus size={16} /> Vincular Existente</button>
                  <button type="button" onClick={addWorkshop} className="btn-secondary py-1.5 px-3 text-sm"><Plus size={16} /> Crear Taller</button>
                </div>
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
                  <div key={i} className="group relative p-4 bg-gray-50 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <button type="button" onClick={() => removeWorkshop(i)} className="absolute -top-2 -right-2 p-1 bg-white text-red-500 rounded-full border border-red-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nombre</label>
                      <input required type="text" className="erp-input w-full bg-white" value={w.name} onChange={e => updateWorkshop(i, 'name', e.target.value)} />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Doctores / Docentes *</label>
                      <DoctorSelector 
                        selectedIds={w.doctorIds || []} 
                        onChange={ids => updateWorkshop(i, 'doctorIds', ids)} 
                        multiple={true} 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Fecha y Hora Inicio</label>
                      <input required type="datetime-local" className="erp-input w-full bg-white" value={w.date_time ? new Date(w.date_time).toISOString().slice(0, 16) : ''} onChange={e => updateWorkshop(i, 'date_time', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Fecha y Hora Fin (Opcional)</label>
                      <input type="datetime-local" className="erp-input w-full bg-white" value={w.end_date_time ? new Date(w.end_date_time).toISOString().slice(0, 16) : ''} onChange={e => updateWorkshop(i, 'end_date_time', e.target.value)} />
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
          )}

          {/* TAB: STAFF MEMBERS */}
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
                    <p className="text-xs text-gray-500">Agrega colaboradores adicionales que participarán en este congreso temporalmente, sin registrarlos como usuarios en el sistema.</p>
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

          {/* TAB: ITINERARY */}
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

          {/* TAB: RESUMEN LOGISTICO */}
          {activeTab === 'resumen' && (() => {
            const consolidatedMap: Record<string, { nombre: string; categoria: string | null; tipo: string | null; cantidad: number }> = {}
            stations.forEach(station => {
              station.congreso_station_products.forEach((sp: any) => {
                const prod = sp.productos
                if (!prod) return
                if (consolidatedMap[prod.id]) {
                  consolidatedMap[prod.id].cantidad += sp.cantidad
                } else {
                  consolidatedMap[prod.id] = { nombre: prod.nombre, categoria: prod.categoria, tipo: prod.tipo, cantidad: sp.cantidad }
                }
              })
            })
            const consolidatedProducts = Object.values(consolidatedMap)

            const renderMemberCard = (member: any, hideVehicleInfo = false) => {
              const carId = member.isTemp ? member.carId : memberCarAssignments[member.id]
              const car = carList.find(c => c.id === carId)
              const userTasks = itinerary.filter(item => item.involvedMemberIds.includes(member.id))
              const isExpanded = !!expandedTasks[member.id]

              return (
                <div 
                  key={member.id}
                  draggable={true}
                  onDragStart={e => handleDragStartVehicle(e, member.id, member.isTemp)}
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl border border-gray-150 hover:border-blue-200 hover:shadow-md transition-all duration-300 bg-white cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center gap-3.5 min-w-[250px]">
                    <span className="text-[10px] text-gray-400 font-bold select-none cursor-grab shrink-0">✥</span>
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
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

                  {!hideVehicleInfo && (
                    <div className="flex items-center gap-2 min-w-[200px]">
                      <div className="p-2 bg-gray-50 border border-gray-100 rounded-xl text-gray-650">
                        <Car size={18} />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vehículo de Traslado</span>
                        <span className={`text-xs font-semibold ${car ? 'text-gray-900' : 'text-gray-500 italic'}`}>
                          {car ? (car.alias || `${car.make} ${car.model} (${car.plate_number})`) : 'Sin vehículo asignado'}
                        </span>
                      </div>
                    </div>
                  )}

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
            }

            const renderStaffListGrouped = () => {
              if (!groupByVehicle) {
                return (
                  <div className="space-y-4">
                    {assignedStaff.map(member => renderMemberCard(member))}
                  </div>
                )
              }

              const grouped: Record<string, any[]> = {}
              assignedStaff.forEach(member => {
                const carId = (member.isTemp ? member.carId : memberCarAssignments[member.id]) || 'no_car'
                if (!grouped[carId]) {
                  grouped[carId] = []
                }
                grouped[carId].push(member)
              })

              const sortedCarIds = Object.keys(grouped).sort((a, b) => {
                if (a === 'no_car') return 1
                if (b === 'no_car') return -1
                const carA = carList.find(c => c.id === a)
                const carB = carList.find(c => c.id === b)
                const nameA = carA ? (carA.alias || `${carA.make} ${carA.model} (${carA.plate_number})`) : ''
                const nameB = carB ? (carB.alias || `${carB.make} ${carB.model} (${carB.plate_number})`) : ''
                return nameA.localeCompare(nameB)
              })

              return (
                <div className="space-y-6">
                  {sortedCarIds.map(carId => {
                    const members = grouped[carId]
                    const car = carList.find(c => c.id === carId)
                    return (
                      <div 
                        key={carId} 
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => handleDropVehicle(e, carId === 'no_car' ? '' : carId)}
                        className="border border-gray-150 rounded-2xl p-5 bg-slate-50/50 space-y-4 hover:border-blue-300 hover:bg-blue-50/10 transition-all"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                              <Car size={18} />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-gray-900">
                                {car ? (car.alias || `${car.make} ${car.model} (${car.plate_number})`) : 'Sin vehículo asignado'}
                              </h4>
                              <p className="text-[11px] text-gray-500 font-medium">
                                {members.length} {members.length === 1 ? 'persona asignada' : 'personas asignadas'}
                              </p>
                            </div>
                          </div>
                          <span className="text-[9px] bg-slate-100 text-blue-700 font-bold px-1.5 py-0.2 rounded border">✥ Dropzone</span>
                        </div>
                        <div className="space-y-3 min-h-[50px]">
                          {members.map(member => renderMemberCard(member, true))}
                          {members.length === 0 && (
                            <p className="text-[11px] text-gray-400 italic text-center py-4">Arrastra staff aquí</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }

            return (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                  <span className="text-amber-500 mt-0.5">⚠️</span>
                  <div>
                    <h4 className="text-sm font-bold text-amber-800">Nota de Logística</h4>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Guarda los cambios del congreso antes de enviar notificaciones para asegurar que el staff reciba la información actualizada.
                    </p>
                  </div>
                </div>

                {consolidatedProducts.length > 0 && (
                  <div className="card p-6 bg-white shadow-sm border border-gray-150 rounded-2xl">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
                      <Wrench size={18} className="text-blue-500" />
                      Productos Necesarios (Todas las Estaciones)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Producto</th>
                            <th className="text-left py-2 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Categoría</th>
                            <th className="text-center py-2 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Cantidad Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {consolidatedProducts.map((p: any, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-gray-900">{p.nombre}</td>
                              <td className="py-2.5 px-3">
                                {p.categoria && (
                                  <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg">{p.categoria}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold text-sm">{p.cantidad}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="card p-6 bg-white shadow-sm border border-gray-150 rounded-2xl">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 mb-1">Resumen del Staff y Asignaciones</h3>
                      <p className="text-xs text-gray-500">Revisa la logística de traslado y actividades del staff para este congreso, y envíales sus notificaciones.</p>
                      
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => setGroupByVehicle(!groupByVehicle)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            groupByVehicle 
                              ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' 
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <Car size={14} />
                          {groupByVehicle ? 'Agrupado por Vehículo' : 'Agrupar por Vehículo'}
                        </button>
                      </div>
                    </div>
                    
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
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.49-3.232c1.648.978 3.256 1.488 4.982 1.489 5.433.003 9.85-4.387 9.853-9.782.002-2.614-1.011-5.071-2.853-6.914C16.638 3.718 14.186 2.7 11.579 2.7c-5.437 0-9.856 4.39-9.859 9.783-.001 1.832.483 3.619 1.401 5.2l-.188.685-.688 2.508 2.57-.674.632-.164zm10.74-4.821c-.244-.122-1.442-.712-1.666-.793-.223-.081-.385-.122-.547.122-.162.244-.63.793-.772.955-.143.162-.285.183-.529.061-.244-.122-1.029-.379-1.96-1.21-.724-.646-1.213-1.444-1.355-1.687-.143-.244-.015-.376.107-.497.11-.11.244-.285.366-.427.122-.142.162-.244.244-.407.081-.162.041-.305-.02-.427-.061-.122-.547-1.32-.75-1.81-.197-.474-.397-.41-.547-.417-.142-.007-.305-.009-.467-.009-.162 0-.427.061-.65.305-.223.244-.853.834-.853 2.035 0 1.2.873 2.36 1.001 2.475.127.115 1.705 2.612 4.14 3.655.58.248 1.03.396 1.38.508.583.185 1.114.159 1.533.096.467-.069 1.442-.589 1.646-1.159.203-.57.203-1.057.142-1.159-.06-.101-.223-.162-.467-.284z"/>
                        </svg>
                      )}
                      {isNotifyingAll ? 'Notificando...' : 'Notificar a todo el Staff'}
                    </button>
                  </div>

                  {assignedStaff.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 border border-dashed border-gray-200 rounded-2xl space-y-2">
                      <User size={36} className="text-gray-400 mx-auto" />
                      <p className="text-sm font-semibold text-gray-600">No hay personal de staff asignado.</p>
                      <p className="text-xs text-gray-500 max-w-sm mx-auto">Dirígete a la pestaña "Miembros del Staff" para asignar al equipo que participará en este congreso.</p>
                    </div>
                  ) : (
                    renderStaffListGrouped()
                  )}
                </div>
              </div>
            )
          })()}

          {/* TAB: HOTEL ROOMS */}
          {activeTab === 'hotel' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Unassigned Hotel Staff */}
              <div className="card p-5 bg-white shadow-sm border border-gray-150 rounded-2xl space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">Staff Sin Habitación</h3>
                  <p className="text-[11px] text-gray-500 mb-3">Arrastra y suelta miembros aquí para quitarlos de su habitación actual.</p>
                  
                  <div 
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDropUnassignedHotel}
                    className="min-h-[80px] rounded-xl border-2 border-dashed border-gray-200 p-3 bg-slate-50/50 hover:bg-slate-100/50 transition-all flex flex-wrap gap-2.5"
                  >
                    {unassignedHotelStaff.map(member => (
                      <div
                        key={member.id}
                        draggable={true}
                        onDragStart={e => handleDragStartHotel(e, member.id, member.isTemp)}
                        className="p-2.5 bg-white border border-gray-150 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-300 hover:shadow transition-all flex items-center gap-2 max-w-[200px]"
                      >
                        <span className="text-[9px] text-gray-400 font-bold select-none cursor-grab">✥</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{member.first_name} {member.last_name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{member.position}</p>
                        </div>
                      </div>
                    ))}
                    {unassignedHotelStaff.length === 0 && (
                      <p className="text-[11px] text-gray-400 italic text-center w-full py-4">Todos tienen habitación asignada</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Hotel Rooms Grid */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <BedDouble size={18} className="text-indigo-500" />
                      Reparto de Habitaciones
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Asigna habitaciones de hotel al staff y personas externas. Arrastra y suelta para organizar.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowAddRoom(true); setEditingRoomId(null) }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Plus size={15} /> Nueva Habitación
                  </button>
                </div>

                {showAddRoom && (
                  <div className="p-5 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-4">
                    <h4 className="font-bold text-sm text-indigo-900">Agregar Habitación</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Número / Nombre *</label>
                        <input
                          type="text"
                          placeholder="Ej. 101, Suite A"
                          className="erp-input w-full"
                          value={newRoomForm.room_number}
                          onChange={e => setNewRoomForm(p => ({ ...p, room_number: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Tipo</label>
                        <select
                          className="erp-input w-full"
                          value={newRoomForm.room_type}
                          onChange={e => setNewRoomForm(p => ({ ...p, room_type: e.target.value }))}
                        >
                          <option value="Sencilla">Sencilla</option>
                          <option value="Doble">Doble</option>
                          <option value="Triple">Triple</option>
                          <option value="Suite">Suite</option>
                          <option value="Junior Suite">Junior Suite</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Capacidad (personas)</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          className="erp-input w-full"
                          value={newRoomForm.capacity}
                          onChange={e => setNewRoomForm(p => ({ ...p, capacity: parseInt(e.target.value) || 1 }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Notas</label>
                        <input
                          type="text"
                          placeholder="Opcional"
                          className="erp-input w-full"
                          value={newRoomForm.notes}
                          onChange={e => setNewRoomForm(p => ({ ...p, notes: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-indigo-200">
                      <button type="button" onClick={() => setShowAddRoom(false)} className="btn-secondary text-sm">Cancelar</button>
                      <button
                        type="button"
                        onClick={handleCreateRoom}
                        disabled={!newRoomForm.room_number.trim() || hotelSaving['new']}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {hotelSaving['new'] ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        Crear Habitación
                      </button>
                    </div>
                  </div>
                )}

                {hotelLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-500" size={28} /></div>
                ) : hotelRooms.length === 0 ? (
                  <div className="text-center py-14 border-2 border-dashed border-gray-200 rounded-2xl space-y-2">
                    <BedDouble size={36} className="text-gray-300 mx-auto" />
                    <p className="text-sm font-semibold text-gray-500">No hay habitaciones registradas</p>
                    <p className="text-xs text-gray-400">Agrega una habitación para comenzar a asignar personas.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {hotelRooms.map(room => {
                      const occupancy = room.congreso_hotel_occupants.length
                      const isFull = occupancy >= room.capacity
                      const isAssigning = assigningRoomId === room.id
                      const isSavingRoom = room.id ? !!hotelSaving[room.id] : false

                      const availableStaff = assignedStaff.filter(s =>
                        s.isTemp
                          ? !room.congreso_hotel_occupants.some((o: any) => o.guest_name === s.first_name)
                          : !room.congreso_hotel_occupants.some((o: any) => o.user_id === s.id)
                      )

                      return (
                        <div 
                          key={room.id} 
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => room.id && handleDropRoom(e, room.id)}
                          className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden hover:border-indigo-300 transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                                  <BedDouble size={18} />
                                </div>
                                <div>
                                  <h4 className="font-bold text-gray-900 text-sm">Hab. {room.room_number}</h4>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {room.room_type && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg">{room.room_type}</span>
                                    )}
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                                      isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                      {occupancy}/{room.capacity} ocupantes
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssigningRoomId(isAssigning ? null : (room.id || null))
                                    setShowGuestForm(false)
                                    setGuestForm({ guest_name: '', guest_phone: '' })
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-all"
                                >
                                  <Users size={12} /> {isAssigning ? 'Cerrar' : 'Asignar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => room.id && handleDeleteRoom(room.id)}
                                  disabled={isSavingRoom}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  {isSavingRoom ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                </button>
                              </div>
                            </div>

                            <div className="h-1 w-full bg-gray-100">
                              <div
                                className={`h-1 transition-all rounded-full ${
                                  isFull ? 'bg-red-400' : occupancy > 0 ? 'bg-indigo-400' : 'bg-gray-200'
                                }`}
                                style={{ width: `${Math.min(100, (occupancy / room.capacity) * 100)}%` }}
                              />
                            </div>

                            <div className="p-4 space-y-2">
                              {room.congreso_hotel_occupants.length === 0 ? (
                                <p className="text-xs text-gray-400 italic text-center py-6 border border-dashed rounded-xl border-gray-150">
                                  Arrastra staff aquí
                                </p>
                              ) : (
                                room.congreso_hotel_occupants.map((occ: any) => {
                                  const profile = occ.user_profiles
                                  const name = profile
                                    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
                                    : occ.guest_name || 'Invitado'
                                  const sub = profile ? profile.email : (occ.guest_phone || 'Externo')

                                  const matchingStaff = assignedStaff.find(s =>
                                    s.isTemp ? s.first_name === occ.guest_name : s.id === occ.user_id
                                  )
                                  const isDraggable = !!matchingStaff
                                  const staffId = matchingStaff?.id
                                  const isTemp = !!matchingStaff?.isTemp

                                  return (
                                    <div 
                                      key={occ.id} 
                                      draggable={isDraggable}
                                      onDragStart={e => {
                                        if (isDraggable && staffId) {
                                          handleDragStartHotel(e, staffId, isTemp, room.id, occ.id)
                                        }
                                      }}
                                      className={`flex items-center justify-between gap-3 p-2.5 bg-gray-50 rounded-xl border border-gray-100 transition-all ${
                                        isDraggable ? 'cursor-grab active:cursor-grabbing hover:border-indigo-300 hover:bg-white hover:shadow-sm' : ''
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        {isDraggable && (
                                          <span className="text-[10px] text-gray-400 font-bold select-none">✥</span>
                                        )}
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                          profile ? 'bg-gradient-to-tr from-blue-500 to-indigo-600 text-white' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                          {name[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs font-semibold text-gray-900 truncate">{name}</p>
                                          <p className="text-[10px] text-gray-400 truncate">{sub}</p>
                                        </div>
                                        {!profile && (
                                          <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex-shrink-0">Externo</span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => occ.id && room.id && handleRemoveOccupant(room.id, occ.id)}
                                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                                      >
                                        <X size={13} />
                                      </button>
                                    </div>
                                  )
                                })
                              )}

                              {isAssigning && (
                                <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
                                  {availableStaff.length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Staff Disponible</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {availableStaff.map(s => (
                                          <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => room.id && handleAddStaffToRoom(room.id, s.id)}
                                            className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-indigo-200 text-indigo-800 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors"
                                          >
                                            <User size={11} />
                                            {s.first_name || s.last_name ? `${s.first_name || ''} ${s.last_name || ''}`.trim() : s.email}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="border-t border-indigo-200 pt-2">
                                    {!showGuestForm ? (
                                      <button
                                        type="button"
                                        onClick={() => setShowGuestForm(true)}
                                        className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                                      >
                                        <Plus size={12} /> Agregar persona externa
                                      </button>
                                    ) : (
                                      <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Persona Externa</p>
                                        <div className="grid grid-cols-2 gap-2">
                                          <input
                                            type="text"
                                            placeholder="Nombre *"
                                            className="erp-input py-1.5 text-xs"
                                            value={guestForm.guest_name}
                                            onChange={e => setGuestForm(p => ({ ...p, guest_name: e.target.value }))}
                                          />
                                          <input
                                            type="tel"
                                            placeholder="Teléfono"
                                            className="erp-input py-1.5 text-xs"
                                            value={guestForm.guest_phone}
                                            onChange={e => setGuestForm(p => ({ ...p, guest_phone: e.target.value }))}
                                          />
                                        </div>
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            onClick={() => { setShowGuestForm(false); setGuestForm({ guest_name: '', guest_phone: '' }) }}
                                            className="text-xs text-gray-500 hover:text-gray-700"
                                          >Cancelar</button>
                                          <button
                                            type="button"
                                            onClick={() => room.id && handleAddGuestToRoom(room.id)}
                                            disabled={!guestForm.guest_name.trim()}
                                            className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                          >
                                            Agregar
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
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

          {/* TAB: ESTACIONES */}
          {activeTab === 'estaciones' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Boxes size={18} className="text-blue-500" />
                    Estaciones del Congreso
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Crea estaciones y asigna los productos necesarios para cada una.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddStation(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus size={15} /> Nueva Estación
                </button>
              </div>

              {showAddStation && (
                <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl space-y-3">
                  <h4 className="font-bold text-sm text-blue-900">Nueva Estación</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nombre de la estación (ej. Estación 1, Pruebas, etc.)"
                      className="erp-input flex-1"
                      value={newStationName}
                      onChange={e => setNewStationName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateStation())}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreateStation}
                      disabled={!newStationName.trim() || stationsSaving['new']}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
                    >
                      {stationsSaving['new'] ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Crear
                    </button>
                    <button type="button" onClick={() => { setShowAddStation(false); setNewStationName('') }} className="btn-secondary text-sm">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {stationsLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
              ) : stations.length === 0 ? (
                <div className="text-center py-14 border-2 border-dashed border-gray-200 rounded-2xl space-y-2">
                  <Boxes size={36} className="text-gray-300 mx-auto" />
                  <p className="text-sm font-semibold text-gray-500">No hay estaciones registradas</p>
                  <p className="text-xs text-gray-400">Crea una estación para comenzar a asignar productos.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stations.map(station => {
                    const stationId = station.id!
                    const isSaving = !!stationsSaving[stationId]
                    const searchQuery = (stationSearchQuery[stationId] || '').toLowerCase()
                    const filteredCatalog = catalogProducts.filter(
                      p =>
                        !station.congreso_station_products.some((sp: any) => sp.product_id === p.id) &&
                        (p.nombre.toLowerCase().includes(searchQuery) ||
                          (p.categoria || '').toLowerCase().includes(searchQuery))
                    ).slice(0, 8)

                    return (
                      <div key={stationId} className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                              <Wrench size={16} />
                            </div>
                            {editingStationNameId === stationId ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  className="erp-input flex-1 py-1.5 text-sm"
                                  value={tempStationName}
                                  onChange={e => setTempStationName(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') { e.preventDefault(); handleRenameStation(stationId) }
                                    if (e.key === 'Escape') { setEditingStationNameId(null); setTempStationName('') }
                                  }}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRenameStation(stationId)}
                                  disabled={isSaving}
                                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {isSaving ? <Loader2 size={12} className="animate-spin" /> : 'Guardar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingStationNameId(null); setTempStationName('') }}
                                  className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 min-w-0">
                                <h4 className="font-bold text-gray-900 text-sm truncate">{station.name}</h4>
                                <button
                                  type="button"
                                  onClick={() => { setEditingStationNameId(stationId); setTempStationName(station.name) }}
                                  className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors shrink-0"
                                >
                                  <Edit size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg">
                              {station.congreso_station_products.length} productos
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteStation(stationId)}
                              disabled={isSaving}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </div>
                        </div>

                        <div className="p-4 space-y-3">
                          {station.congreso_station_products.length === 0 ? (
                            <p className="text-xs text-gray-400 italic text-center py-2">Sin productos asignados</p>
                          ) : (
                            <div className="space-y-1.5">
                              {station.congreso_station_products.map((sp: any) => {
                                const prod = sp.productos
                                return (
                                  <div key={sp.product_id} className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-semibold text-gray-900 truncate">{prod?.nombre || sp.product_id}</p>
                                      {prod?.categoria && (
                                        <span className="text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{prod.categoria}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateProductQty(stationId, sp.product_id, sp.cantidad - 1)}
                                        disabled={isSaving || sp.cantidad <= 1}
                                        className="w-6 h-6 flex items-center justify-center rounded-lg border border-gray-200 text-gray-650 hover:bg-gray-100 disabled:opacity-40 font-bold text-sm"
                                      >−</button>
                                      <span className="w-8 text-center text-sm font-bold text-gray-900">{sp.cantidad}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateProductQty(stationId, sp.product_id, sp.cantidad + 1)}
                                        disabled={isSaving}
                                        className="w-6 h-6 flex items-center justify-center rounded-lg border border-gray-200 text-gray-650 hover:bg-gray-100 font-bold text-sm"
                                      >+</button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveProductFromStation(stationId, sp.product_id)}
                                        disabled={isSaving}
                                        className="p-1 text-gray-400 hover:text-red-500 rounded ml-1 transition-colors"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          <div className="pt-2 border-t border-gray-100 relative">
                            <input
                              type="text"
                              placeholder="Buscar producto para agregar..."
                              className="erp-input w-full py-1.5 px-3 text-xs"
                              value={stationSearchQuery[stationId] || ''}
                              onChange={e => setStationSearchQuery(p => ({ ...p, [stationId]: e.target.value }))}
                            />
                            {searchQuery && filteredCatalog.length > 0 && (
                              <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto divide-y divide-gray-50">
                                {filteredCatalog.map(p => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleAddProductToStation(stationId, p.id)}
                                    className="w-full text-left p-2.5 hover:bg-blue-50 text-xs transition-colors flex items-center justify-between"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-gray-900 truncate">{p.nombre}</p>
                                      {p.categoria && (
                                        <span className="text-[9px] text-gray-500">{p.categoria}</span>
                                      )}
                                    </div>
                                    <Plus size={14} className="text-blue-600 shrink-0 ml-2" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'contactos' && (
            <div className="card p-6 md:p-8 space-y-4 animate-in fade-in zoom-in-95 duration-200">
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

          <div className="flex justify-end gap-4 pt-6">
            <Link href="/congresos" className="btn-secondary bg-white">{t('cancel')}</Link>
            <button type="submit" disabled={isSaving || isBudgetExceeded} className={`btn-primary ${isBudgetExceeded ? 'opacity-50 cursor-not-allowed' : ''}`}>
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

      <Modal open={isAddExistingModalOpen} onClose={() => setIsAddExistingModalOpen(false)} title="Vincular Taller Existente">
        <div className="space-y-4">
          {independentWorkshops.filter(w => !workshops.find(ew => ew.id === w.id)).map(w => (
            <div key={w.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div>
                <div className="font-bold">{w.name}</div>
                <div className="text-sm text-gray-500">{new Date(w.date_time).toLocaleString()}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWorkshops([...workshops, { ...w, doctorIds: w.doctors?.map((d: any) => d.doctor_id) || [] }])
                  setIsAddExistingModalOpen(false)
                }}
                className="btn-primary py-1 px-3 text-sm"
              >
                Vincular
              </button>
            </div>
          ))}
          {independentWorkshops.filter(w => !workshops.find(ew => ew.id === w.id)).length === 0 && (
            <div className="text-center text-gray-500 py-4">No hay talleres independientes disponibles.</div>
          )}
        </div>
      </Modal>
    </AppShell>
  )
}
