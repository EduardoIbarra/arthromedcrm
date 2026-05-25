'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { 
  ArrowLeft, Calendar, Users, Plus, Trash2, Edit2, Check, X, 
  Upload, FileSpreadsheet, Loader2, Info, CheckSquare, Square,
  MapPin, Clock, FileText, Settings, UserPlus
} from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'

interface ItineraryItem {
  id?: string
  activity: string
  date: string // YYYY-MM-DD
  time: string | null // HH:MM
  location: string | null
  notes: string | null
  isEditing?: boolean
}

interface Traveler {
  id?: string
  name: string
  role: string | null
  has_pin: boolean
  has_gafete: boolean
  notes: string | null
  isEditing?: boolean
}

interface CongresoDetails {
  id: string
  name: string
  start_date: string
  end_date: string
  location: string
}

export default function CongressPlanningPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const router = useRouter()

  // State
  const [congreso, setCongreso] = useState<CongresoDetails | null>(null)
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([])
  const [travelers, setTravelers] = useState<Traveler[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'itinerary' | 'travelers' | 'import'>('itinerary')
  
  // Day-selector for Itinerary
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0)
  const [dayTabs, setDayTabs] = useState<{ dateStr: string; label: string }[]>([])

  // Excel Import Preview State
  const [importedItinerary, setImportedItinerary] = useState<ItineraryItem[]>([])
  const [importedTravelers, setImportedTravelers] = useState<Traveler[]>([])
  const [showImportPreview, setShowImportPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Quick Add forms
  const [newActivity, setNewActivity] = useState({
    activity: '',
    datetime: '',
    location: '',
    notes: ''
  })
  const [newTraveler, setNewTraveler] = useState({
    name: '',
    role: '',
    has_pin: false,
    has_gafete: true,
    notes: ''
  })

  // Load Data
  const fetchData = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/congresos/${id}/planning`)
      if (!res.ok) throw new Error('Failed to load planning data')
      const json = await res.json()
      
      const cong = json.data.congreso
      setCongreso(cong)
      
      // Parse dates to get list of days
      if (cong.start_date && cong.end_date) {
        const start = new Date(cong.start_date + 'T00:00:00')
        const end = new Date(cong.end_date + 'T00:00:00')
        const daysList: { dateStr: string; label: string }[] = []
        
        let current = new Date(start)
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0]
          const label = `${dayNames[current.getDay()]} ${current.getDate()}`
          daysList.push({ dateStr, label })
          // Add one day
          current.setDate(current.getDate() + 1)
        }
        setDayTabs(daysList)
      }

      // Set items
      setItineraryItems(json.data.itineraryItems.map((item: any) => ({
        ...item,
        date: item.date.split('T')[0]
      })))
      setTravelers(json.data.travelers)
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

  useEffect(() => {
    if (dayTabs[selectedDayIndex]) {
      setNewActivity(prev => ({
        ...prev,
        datetime: `${dayTabs[selectedDayIndex].dateStr}T08:00`
      }))
    }
  }, [selectedDayIndex, dayTabs])

  // Itinerary handlers
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newActivity.activity || !newActivity.datetime) return
    
    setError(null)
    const [date, time] = newActivity.datetime.split('T')
    
    try {
      const res = await fetch(`/api/congresos/${id}/itinerary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity: newActivity.activity,
          date,
          time: time || null,
          location: newActivity.location || null,
          notes: newActivity.notes || null
        })
      })
      
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to add activity')
      }
      
      const json = await res.json()
      setItineraryItems(prev => [...prev, { ...json.data, date: json.data.date.split('T')[0] }].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return (a.time || '').localeCompare(b.time || '')
      }))
      
      setNewActivity(prev => ({ ...prev, activity: '', location: '', notes: '' }))
      showToast('Actividad agregada con éxito')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleUpdateActivity = async (item: ItineraryItem) => {
    if (!item.id) return
    try {
      const res = await fetch(`/api/congresos/${id}/itinerary/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity: item.activity,
          date: item.date,
          time: item.time,
          location: item.location,
          notes: item.notes
        })
      })
      
      if (!res.ok) throw new Error('Failed to update activity')
      
      setItineraryItems(prev => prev.map(i => i.id === item.id ? { ...item, isEditing: false } : i))
      showToast('Actividad actualizada')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDeleteActivity = async (itemId: string) => {
    if (!confirm('¿Seguro de que deseas eliminar esta actividad?')) return
    try {
      const res = await fetch(`/api/congresos/${id}/itinerary/${itemId}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete activity')
      
      setItineraryItems(prev => prev.filter(i => i.id !== itemId))
      showToast('Actividad eliminada')
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Traveler handlers
  const handleAddTraveler = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTraveler.name) return
    setError(null)
    
    try {
      const res = await fetch(`/api/congresos/${id}/travelers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTraveler.name,
          role: newTraveler.role || null,
          has_pin: newTraveler.has_pin,
          has_gafete: newTraveler.has_gafete,
          notes: newTraveler.notes || null
        })
      })
      
      if (!res.ok) throw new Error('Failed to add traveler')
      const json = await res.json()
      
      setTravelers(prev => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewTraveler({ name: '', role: '', has_pin: false, has_gafete: true, notes: '' })
      showToast('Viajero agregado con éxito')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleUpdateTraveler = async (traveler: Traveler) => {
    if (!traveler.id) return
    try {
      const res = await fetch(`/api/congresos/${id}/travelers/${traveler.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: traveler.name,
          role: traveler.role,
          has_pin: traveler.has_pin,
          has_gafete: traveler.has_gafete,
          notes: traveler.notes
        })
      })
      
      if (!res.ok) throw new Error('Failed to update traveler')
      
      setTravelers(prev => prev.map(t => t.id === traveler.id ? { ...traveler, isEditing: false } : t))
      showToast('Viajero actualizado')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDeleteTraveler = async (travelerId: string) => {
    if (!confirm('¿Seguro de que deseas eliminar este viajero del equipo?')) return
    try {
      const res = await fetch(`/api/congresos/${id}/travelers/${travelerId}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete traveler')
      
      setTravelers(prev => prev.filter(t => t.id !== travelerId))
      showToast('Viajero eliminado')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleTogglePin = async (traveler: Traveler) => {
    const updated = { ...traveler, has_pin: !traveler.has_pin }
    setTravelers(prev => prev.map(t => t.id === traveler.id ? updated : t))
    if (traveler.id) {
      try {
        await fetch(`/api/congresos/${id}/travelers/${traveler.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ has_pin: updated.has_pin })
        })
      } catch (err) {
        console.error(err)
      }
    }
  }

  const handleToggleGafete = async (traveler: Traveler) => {
    const updated = { ...traveler, has_gafete: !traveler.has_gafete }
    setTravelers(prev => prev.map(t => t.id === traveler.id ? updated : t))
    if (traveler.id) {
      try {
        await fetch(`/api/congresos/${id}/travelers/${traveler.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ has_gafete: updated.has_gafete })
        })
      } catch (err) {
        console.error(err)
      }
    }
  }

  // Excel parsing logic
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !congreso) return
    setError(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

        if (rows.length < 8) {
          throw new Error('El archivo no contiene suficientes filas. Verifique el formato.')
        }

        // 1. Parse header row for days (Row 7, index 6)
        // e.g. [ 'Hora ', 'Martes 19 de mayo', 'Miercoles 20 de mayo ', ... ]
        const headerRow = rows[6] || []
        const parsedDays: { dateStr: string; colIdx: number }[] = []
        
        headerRow.forEach((val, colIdx) => {
          if (colIdx > 0 && val) {
            // Map column to offset date from congreso start_date
            const date = new Date(congreso.start_date + 'T00:00:00')
            date.setDate(date.getDate() + (colIdx - 1))
            parsedDays.push({
              dateStr: date.toISOString().split('T')[0],
              colIdx
            })
          }
        })

        if (parsedDays.length === 0) {
          throw new Error('No se detectaron columnas de días en la fila 7 del archivo.')
        }

        // 2. Scan below Row 30 for locations and travelers
        let locationsMap: { [key: string]: string } = {}
        let parsedTravelers: Traveler[] = []
        let driverNames: string[] = []

        rows.forEach((row, rowIdx) => {
          row.forEach((cellVal, colIdx) => {
            if (typeof cellVal === 'string') {
              const cleaned = cellVal.trim().toLowerCase()
              
              // Find drivers (Conductores)
              if (cleaned === 'conductores' && row[colIdx + 1]) {
                const namesStr = String(row[colIdx + 1])
                driverNames = namesStr.split(',').map(n => n.trim().toLowerCase())
              }
              
              // Find activity locations
              if (cleaned === 'ubicaciones de actividades') {
                // Read rows below this cell
                for (let i = rowIdx + 1; i < rows.length; i++) {
                  const locKey = rows[i]?.[colIdx]
                  const locVal = rows[i]?.[colIdx + 1]
                  if (locKey && locVal && String(locKey).trim()) {
                    locationsMap[String(locKey).trim().toLowerCase()] = String(locVal).trim()
                  } else if (!locKey || !String(locKey).trim()) {
                    // Stop on empty row
                    break
                  }
                }
              }

              // Find Travelers list
              if (cleaned === 'equipo arthromed') {
                for (let i = rowIdx + 1; i < rows.length; i++) {
                  const nameVal = rows[i]?.[colIdx]
                  const pinVal = rows[i]?.[colIdx + 1]
                  if (nameVal && String(nameVal).trim() && String(nameVal).toLowerCase() !== 'gafetes' && String(nameVal).toLowerCase() !== 'pines') {
                    const name = String(nameVal).trim()
                    const hasPin = String(pinVal).toLowerCase().includes('pin')
                    parsedTravelers.push({
                      name,
                      role: null, // role determined below
                      has_pin: hasPin,
                      has_gafete: true, // by default they are team members
                      notes: null
                    })
                  } else if (!nameVal || !String(nameVal).trim() || String(nameVal).toLowerCase() === 'gafetes') {
                    break
                  }
                }
              }
            }
          })
        })

        // Apply driver roles to travelers
        if (driverNames.length > 0) {
          parsedTravelers = parsedTravelers.map(t => {
            const matchesDriver = driverNames.some(dName => t.name.toLowerCase().includes(dName))
            return {
              ...t,
              role: matchesDriver ? 'Conductor' : null
            }
          })
        }

        // 3. Parse activities (Row 8 to 29)
        const parsedItinerary: ItineraryItem[] = []
        
        for (let r = 7; r < 29; r++) {
          const row = rows[r]
          if (!row || row.length === 0) continue

          const rawTime = row[0]
          if (rawTime === undefined || rawTime === null) continue

          // Parse time value
          let timeStr: string | null = null
          if (typeof rawTime === 'number') {
            const totalMinutes = Math.round(rawTime * 24 * 60)
            const hours = Math.floor(totalMinutes / 60)
            const minutes = totalMinutes % 60
            timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
          } else {
            const strVal = String(rawTime).trim()
            if (/^\d{1,2}:\d{2}$/.test(strVal)) {
              const parts = strVal.split(':')
              timeStr = `${parts[0].padStart(2, '0')}:${parts[1]}`
            } else if (strVal) {
              timeStr = strVal
            }
          }

          // Read days activity in columns
          parsedDays.forEach(day => {
            const cellVal = row[day.colIdx]
            if (cellVal && String(cellVal).trim()) {
              const activity = String(cellVal).trim()
              
              // Smart location matchmaking
              let matchedLocation = null
              const lowerActivity = activity.toLowerCase()
              for (const [key, loc] of Object.entries(locationsMap)) {
                if (lowerActivity.includes(key) || key.includes(lowerActivity)) {
                  matchedLocation = loc
                  break
                }
              }

              parsedItinerary.push({
                activity,
                date: day.dateStr,
                time: timeStr,
                location: matchedLocation,
                notes: null
              })
            }
          })
        }

        // Set to preview
        setImportedItinerary(parsedItinerary)
        setImportedTravelers(parsedTravelers)
        setShowImportPreview(true)
        showToast(`Se leyeron ${parsedItinerary.length} actividades y ${parsedTravelers.length} viajeros de Excel`)
      } catch (err: any) {
        console.error(err)
        setError('Error al procesar el archivo Excel: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleSaveImportedData = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/congresos/${id}/planning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itineraryItems: importedItinerary,
          travelers: importedTravelers,
          override: true // Replace existing planning with imported
        })
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to save imported data')
      }

      await fetchData()
      setShowImportPreview(false)
      setActiveTab('itinerary')
      showToast('Itinerario y viajeros importados correctamente')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Toast / messages helpers
  const showToast = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => {
      setSuccessMsg(null)
    }, 4000)
  }

  // Filter activities for selected day
  const filteredItineraryItems = itineraryItems.filter(
    item => dayTabs[selectedDayIndex] && item.date === dayTabs[selectedDayIndex].dateStr
  )

  // Traveler Stats
  const totalPins = travelers.filter(t => t.has_pin).length
  const totalGafetes = travelers.filter(t => t.has_gafete).length

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 flex justify-center items-center h-64">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="flex items-center gap-4">
            <Link href={`/congresos/${id}/view`} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                {t('planning')}: {congreso?.name}
              </h1>
              {congreso && (
                <p className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                  <span><Calendar size={13} className="inline mr-1" />{new Date(congreso.start_date).toLocaleDateString()} - {new Date(congreso.end_date).toLocaleDateString()}</span>
                  <span><MapPin size={13} className="inline mr-1" />{congreso.location}</span>
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('import')}
              className={`btn-secondary ${activeTab === 'import' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white'}`}
            >
              <Upload size={16} /> Importar Excel
            </button>
          </div>
        </header>

        {/* Feedback Messages */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="card p-4 text-red-500 bg-red-50 border-red-100 flex items-center gap-3"
            >
              <X size={20} className="flex-shrink-0" />
              <div className="text-sm font-medium">{error}</div>
            </motion.div>
          )}
          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="fixed bottom-6 right-6 z-50 card p-4 bg-emerald-600 text-white shadow-xl flex items-center gap-3 border-none"
            >
              <Check size={20} />
              <div className="text-sm font-semibold">{successMsg}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs Bar */}
        <div className="flex border-b border-gray-200 gap-6">
          <button
            onClick={() => { setActiveTab('itinerary'); setShowImportPreview(false); }}
            className={`py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2
              ${activeTab === 'itinerary' && !showImportPreview
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }
            `}
          >
            <Clock size={16} /> {t('itinerary')}
          </button>
          <button
            onClick={() => { setActiveTab('travelers'); setShowImportPreview(false); }}
            className={`py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2
              ${activeTab === 'travelers' && !showImportPreview
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }
            `}
          >
            <Users size={16} /> {t('travelers')} ({travelers.length})
          </button>
          {showImportPreview && (
            <button
              onClick={() => setActiveTab('import')}
              className="py-3 text-sm font-semibold border-b-2 border-amber-500 text-amber-600 flex items-center gap-2"
            >
              <FileSpreadsheet size={16} /> Vista Previa Importación
            </button>
          )}
        </div>

        {/* MAIN PANEL CONTENT */}
        <div className="space-y-6">
          
          {/* TAB 1: ITINERARY TIMELINE */}
          {activeTab === 'itinerary' && !showImportPreview && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Day selection and Timeline */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Horizontal Day list */}
                {dayTabs.length > 0 ? (
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    {dayTabs.map((day, idx) => (
                      <button
                        key={day.dateStr}
                        onClick={() => setSelectedDayIndex(idx)}
                        className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all
                          ${selectedDayIndex === idx
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                          }
                        `}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="card p-6 text-center text-gray-500 text-sm">
                    No se han configurado fechas correctas para este Congreso. Por favor edite las fechas de inicio/fin.
                  </div>
                )}

                {/* Activity List */}
                <div className="space-y-4">
                  {filteredItineraryItems.length > 0 ? (
                    <div className="relative pl-6 border-l-2 border-indigo-100 space-y-6 py-2">
                      {filteredItineraryItems.map((item) => (
                        <div key={item.id} className="relative group">
                          {/* Dot indicator */}
                          <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-indigo-600 bg-white group-hover:scale-125 transition-transform" />
                          
                          <div className="card p-5 hover:border-indigo-200 hover:shadow-sm transition-all bg-white border border-gray-100 rounded-xl space-y-3">
                            {item.isEditing ? (
                              // Edit Form inline
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase">Actividad *</label>
                                    <input
                                      type="text"
                                      className="erp-input w-full bg-gray-50"
                                      value={item.activity}
                                      onChange={e => setItineraryItems(prev => prev.map(i => i.id === item.id ? { ...i, activity: e.target.value } : i))}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase">Fecha y Hora *</label>
                                    <input
                                      required
                                      type="datetime-local"
                                      className="erp-input w-full bg-gray-50"
                                      value={`${item.date}T${item.time || '08:00'}`}
                                      onChange={e => {
                                        const [date, time] = e.target.value.split('T')
                                        setItineraryItems(prev => prev.map(i => i.id === item.id ? { ...i, date, time } : i))
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase">Ubicación</label>
                                    <input
                                      type="text"
                                      className="erp-input w-full bg-gray-50"
                                      value={item.location || ''}
                                      onChange={e => setItineraryItems(prev => prev.map(i => i.id === item.id ? { ...i, location: e.target.value } : i))}
                                    />
                                  </div>
                                  <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase">Notas</label>
                                    <textarea
                                      rows={2}
                                      className="erp-input w-full bg-gray-50"
                                      value={item.notes || ''}
                                      onChange={e => setItineraryItems(prev => prev.map(i => i.id === item.id ? { ...i, notes: e.target.value } : i))}
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                  <button
                                    onClick={() => setItineraryItems(prev => prev.map(i => i.id === item.id ? { ...i, isEditing: false } : i))}
                                    className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 font-semibold rounded-lg text-gray-700"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={() => handleUpdateActivity(item)}
                                    className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 font-semibold rounded-lg text-white"
                                  >
                                    Guardar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // Read view
                              <div>
                                <div className="flex items-start justify-between gap-4">
                                  <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      {item.time && (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                                          <Clock size={12} /> {item.time} hs
                                        </span>
                                      )}
                                      {item.location && (
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                          <MapPin size={12} /> {item.location}
                                        </span>
                                      )}
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-base">{item.activity}</h3>
                                    {item.notes && (
                                      <p className="text-sm text-gray-500 whitespace-pre-wrap">{item.notes}</p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => setItineraryItems(prev => prev.map(i => i.id === item.id ? { ...i, isEditing: true } : i))}
                                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                      title="Editar"
                                    >
                                      <Edit2 size={15} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteActivity(item.id!)}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Eliminar"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="card p-8 text-center text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                      <Clock size={36} className="mx-auto text-gray-300 mb-3" />
                      <p className="font-medium text-sm">No hay actividades registradas para este día.</p>
                      <p className="text-xs text-gray-400 mt-1">Usa el panel de la derecha para agregar actividades o importa la planeación desde un archivo Excel.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Add activity panel */}
              <div className="space-y-6">
                <section className="card p-6 bg-white border border-gray-100 shadow-sm rounded-2xl">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Plus size={18} className="text-indigo-600" />
                    Nueva Actividad
                  </h3>
                  <form onSubmit={handleAddActivity} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre de Actividad *</label>
                      <input
                        required
                        type="text"
                        placeholder="Ej. Taller de Artroscopia"
                        className="erp-input w-full"
                        value={newActivity.activity}
                        onChange={e => setNewActivity({ ...newActivity, activity: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha y Hora *</label>
                      <input
                        required
                        type="datetime-local"
                        className="erp-input w-full"
                        value={newActivity.datetime}
                        onChange={e => setNewActivity({ ...newActivity, datetime: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Ubicación / Salón</label>
                      <input
                        type="text"
                        placeholder="Ej. Salón Océano 3"
                        className="erp-input w-full"
                        value={newActivity.location}
                        onChange={e => setNewActivity({ ...newActivity, location: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Notas / Detalles</label>
                      <textarea
                        rows={3}
                        placeholder="Ej. Llevar material biológico..."
                        className="erp-input w-full"
                        value={newActivity.notes}
                        onChange={e => setNewActivity({ ...newActivity, notes: e.target.value })}
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn-primary w-full justify-center py-2.5 mt-2"
                    >
                      <Plus size={16} /> Agregar al Itinerario
                    </button>
                  </form>
                </section>

                {dayTabs[selectedDayIndex] && (
                  <div className="card p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-start gap-3">
                    <Info size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-indigo-900 leading-relaxed">
                      <strong className="block mb-1">Día Seleccionado:</strong>
                      Las actividades que agregues se guardarán directamente en el itinerario del día: <span className="font-semibold">{dayTabs[selectedDayIndex].label} ({dayTabs[selectedDayIndex].dateStr})</span>.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TRAVELERS CHECKLIST */}
          {activeTab === 'travelers' && !showImportPreview && (
            <div className="space-y-6">
              
              {/* Traveler Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card p-5 bg-white border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Viajeros</p>
                    <p className="text-2xl font-black text-indigo-600 mt-1">{travelers.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><Users size={22} /></div>
                </div>

                <div className="card p-5 bg-white border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Gafetes Requeridos</p>
                    <p className="text-2xl font-black text-blue-600 mt-1">{totalGafetes}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><FileText size={22} /></div>
                </div>

                <div className="card p-5 bg-white border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Pines Requeridos</p>
                    <p className="text-2xl font-black text-purple-600 mt-1">{totalPins}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600"><Settings size={22} /></div>
                </div>
              </div>

              {/* Main Checklist / Table */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Traveling Table */}
                <div className="lg:col-span-3 card p-0 overflow-hidden bg-white border border-gray-100 shadow-sm rounded-2xl">
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">Listado de Viajeros y Logística</h3>
                  </div>

                  {travelers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-semibold text-xs uppercase tracking-wider">
                            <th className="p-4 pl-6">Nombre</th>
                            <th className="p-4">Rol / Responsabilidad</th>
                            <th className="p-4 text-center">Gafete</th>
                            <th className="p-4 text-center">Pin</th>
                            <th className="p-4">Notas de Logística (Vuelos, Hotel)</th>
                            <th className="p-4 pr-6 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {travelers.map((traveler) => (
                            <tr key={traveler.id} className="hover:bg-gray-50/50 transition-colors group">
                              
                              {traveler.isEditing ? (
                                // Edit Mode
                                <td colSpan={6} className="p-4 px-6 bg-indigo-50/20">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="md:col-span-2">
                                      <label className="block text-[10px] font-bold text-gray-400 uppercase">Nombre *</label>
                                      <input
                                        type="text"
                                        className="erp-input w-full bg-white"
                                        value={traveler.name}
                                        onChange={e => setTravelers(prev => prev.map(t => t.id === traveler.id ? { ...t, name: e.target.value } : t))}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-gray-400 uppercase">Rol</label>
                                      <input
                                        type="text"
                                        placeholder="Ej. Conductor, Ponente"
                                        className="erp-input w-full bg-white"
                                        value={traveler.role || ''}
                                        onChange={e => setTravelers(prev => prev.map(t => t.id === traveler.id ? { ...t, role: e.target.value } : t))}
                                      />
                                    </div>
                                    <div className="flex items-center gap-4 pt-4">
                                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={traveler.has_gafete}
                                          onChange={e => setTravelers(prev => prev.map(t => t.id === traveler.id ? { ...t, has_gafete: e.target.checked } : t))}
                                          className="rounded border-gray-300 text-indigo-600"
                                        />
                                        Gafete
                                      </label>
                                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={traveler.has_pin}
                                          onChange={e => setTravelers(prev => prev.map(t => t.id === traveler.id ? { ...t, has_pin: e.target.checked } : t))}
                                          className="rounded border-gray-300 text-indigo-600"
                                        />
                                        Pin
                                      </label>
                                    </div>
                                    <div className="md:col-span-4">
                                      <label className="block text-[10px] font-bold text-gray-400 uppercase">Notas de Logística</label>
                                      <input
                                        type="text"
                                        placeholder="Vuelo de salida, hotel asignado, etc."
                                        className="erp-input w-full bg-white"
                                        value={traveler.notes || ''}
                                        onChange={e => setTravelers(prev => prev.map(t => t.id === traveler.id ? { ...t, notes: e.target.value } : t))}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-2 pt-3">
                                    <button
                                      onClick={() => setTravelers(prev => prev.map(t => t.id === traveler.id ? { ...t, isEditing: false } : t))}
                                      className="px-3 py-1.5 text-xs bg-white hover:bg-gray-100 border border-gray-200 font-semibold rounded-lg text-gray-700"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      onClick={() => handleUpdateTraveler(traveler)}
                                      className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 font-semibold rounded-lg text-white"
                                    >
                                      Guardar
                                    </button>
                                  </div>
                                </td>
                              ) : (
                                // Read Mode
                                <>
                                  <td className="p-4 pl-6 font-semibold text-gray-900">{traveler.name}</td>
                                  <td className="p-4">
                                    {traveler.role ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                                        {traveler.role}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-xs italic">Sin rol asignado</span>
                                    )}
                                  </td>
                                  <td className="p-4 text-center">
                                    <button
                                      onClick={() => handleToggleGafete(traveler)}
                                      className="text-gray-400 hover:text-indigo-600 transition-colors mx-auto block"
                                      title={traveler.has_gafete ? 'Gafete Asegurado' : 'Sin Gafete'}
                                    >
                                      {traveler.has_gafete ? (
                                        <CheckSquare className="text-indigo-600" size={18} />
                                      ) : (
                                        <Square size={18} />
                                      )}
                                    </button>
                                  </td>
                                  <td className="p-4 text-center">
                                    <button
                                      onClick={() => handleTogglePin(traveler)}
                                      className="text-gray-400 hover:text-indigo-600 transition-colors mx-auto block"
                                      title={traveler.has_pin ? 'Pin Entregado' : 'Sin Pin'}
                                    >
                                      {traveler.has_pin ? (
                                        <CheckSquare className="text-indigo-600" size={18} />
                                      ) : (
                                        <Square size={18} />
                                      )}
                                    </button>
                                  </td>
                                  <td className="p-4 text-xs text-gray-500 max-w-[240px] truncate" title={traveler.notes || ''}>
                                    {traveler.notes || '-'}
                                  </td>
                                  <td className="p-4 pr-6 text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => setTravelers(prev => prev.map(t => t.id === traveler.id ? { ...t, isEditing: true } : t))}
                                        className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTraveler(traveler.id!)}
                                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </>
                              )}
                              
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-12 text-center text-gray-400">
                      <Users size={40} className="mx-auto text-gray-300 mb-3" />
                      <p className="font-semibold text-sm">No hay personal de equipo viajando registrado.</p>
                      <p className="text-xs text-gray-400 mt-1">Registra personal en el formulario lateral o importa el archivo de planeación completo.</p>
                    </div>
                  )}
                </div>

                {/* Add Traveler Form */}
                <div className="card p-6 bg-white border border-gray-100 shadow-sm rounded-2xl h-fit">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <UserPlus size={18} className="text-indigo-600" />
                    Registrar Viajero
                  </h3>
                  <form onSubmit={handleAddTraveler} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre Completo *</label>
                      <input
                        required
                        type="text"
                        placeholder="Ej. Ricardo Reyes"
                        className="erp-input w-full"
                        value={newTraveler.name}
                        onChange={e => setNewTraveler({ ...newTraveler, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Rol / Responsabilidad</label>
                      <input
                        type="text"
                        placeholder="Ej. Conductor, Coordinador"
                        className="erp-input w-full"
                        value={newTraveler.role}
                        onChange={e => setNewTraveler({ ...newTraveler, role: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-4 pt-1">
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newTraveler.has_gafete}
                          onChange={e => setNewTraveler({ ...newTraveler, has_gafete: e.target.checked })}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Gafete
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newTraveler.has_pin}
                          onChange={e => setNewTraveler({ ...newTraveler, has_pin: e.target.checked })}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Pin
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Notas de Logística</label>
                      <input
                        type="text"
                        placeholder="Vuelos, hotel, etc."
                        className="erp-input w-full"
                        value={newTraveler.notes}
                        onChange={e => setNewTraveler({ ...newTraveler, notes: e.target.value })}
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn-primary w-full justify-center py-2.5 mt-2"
                    >
                      <Plus size={16} /> Agregar Viajero
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EXCEL IMPORT & PREVIEW */}
          {(activeTab === 'import' || showImportPreview) && (
            <div className="space-y-6">
              
              {!showImportPreview ? (
                // Dropzone
                <div className="card p-12 bg-white border border-dashed border-gray-300 rounded-3xl text-center space-y-4 hover:border-indigo-400 transition-colors">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto">
                    <FileSpreadsheet size={32} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">Importar Archivo de Planeación</h3>
                    <p className="text-sm text-gray-500 max-w-md mx-auto mt-1 leading-relaxed">
                      Sube el archivo Excel de planeación. El importador extraerá automáticamente las actividades diarias por columnas, las ubicaciones de los stands/talleres y el equipo viajero con sus pines.
                    </p>
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleExcelUpload}
                      accept=".xlsx,.xls"
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-primary"
                    >
                      <Upload size={16} /> Seleccionar Archivo Excel
                    </button>
                  </div>
                </div>
              ) : (
                // Import Preview table layout
                <div className="space-y-6">
                  
                  {/* Warning banner */}
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                    <Info className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                    <div className="text-sm text-amber-900">
                      <strong className="block font-semibold">Atención: Modo Reemplazo Automático</strong>
                      Al hacer clic en "Guardar Datos Importados", se <span className="font-bold text-amber-700">eliminará el itinerario y los viajeros existentes</span> registrados para este congreso en el ERP, y se guardarán los que se muestran abajo. Asegúrate de verificar toda la información.
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between items-center bg-gray-50/50 p-4 border border-gray-100 rounded-2xl">
                    <div className="text-sm text-gray-600">
                      Detectado: <strong className="text-gray-900">{importedItinerary.length} actividades</strong> y <strong className="text-gray-900">{importedTravelers.length} viajeros</strong>.
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowImportPreview(false); setImportedItinerary([]); setImportedTravelers([]); }}
                        className="btn-secondary bg-white"
                      >
                        Descartar
                      </button>
                      <button
                        onClick={handleSaveImportedData}
                        disabled={isSaving}
                        className="btn-primary bg-indigo-600 hover:bg-indigo-700"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 size={16} className="animate-spin" /> Guardando...
                          </>
                        ) : (
                          <>
                            <Check size={16} /> Guardar Datos Importados
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Data Preview */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Itinerary Preview */}
                    <div className="card p-0 bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                      <div className="p-4 bg-gray-50 border-b border-gray-100">
                        <h4 className="font-bold text-sm text-gray-900">Vista Previa: Itinerario de Actividades ({importedItinerary.length})</h4>
                      </div>
                      <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100">
                        {importedItinerary.map((item, idx) => (
                          <div key={idx} className="p-3.5 text-xs flex justify-between items-start gap-4">
                            <div className="space-y-1">
                              <p className="font-semibold text-gray-900">{item.activity}</p>
                              {item.location && (
                                <p className="text-[10px] text-emerald-600 font-medium"><MapPin size={10} className="inline mr-0.5" />{item.location}</p>
                              )}
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <p className="font-bold text-gray-600">{new Date(item.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                              {item.time && <p className="text-gray-400">{item.time} hs</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Travelers Preview */}
                    <div className="card p-0 bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                      <div className="p-4 bg-gray-50 border-b border-gray-100">
                        <h4 className="font-bold text-sm text-gray-900">Vista Previa: Equipo Viajero ({importedTravelers.length})</h4>
                      </div>
                      <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100">
                        {importedTravelers.map((traveler, idx) => (
                          <div key={idx} className="p-3.5 text-xs flex justify-between items-center">
                            <div>
                              <p className="font-semibold text-gray-900">{traveler.name}</p>
                              {traveler.role && <p className="text-[10px] text-gray-400">{traveler.role}</p>}
                            </div>
                            <div className="flex gap-2">
                              {traveler.has_gafete && (
                                <span className="px-2 py-0.5 font-bold text-[9px] bg-blue-50 text-blue-700 rounded border border-blue-100">Gafete</span>
                              )}
                              {traveler.has_pin && (
                                <span className="px-2 py-0.5 font-bold text-[9px] bg-purple-50 text-purple-700 rounded border border-purple-100">Pin</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </AppShell>
  )
}
