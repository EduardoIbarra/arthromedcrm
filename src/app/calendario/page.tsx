'use client'

import { useEffect, useState, useMemo } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, MapPin, Clock, User, DollarSign, Edit, Trash2, Globe, ArrowRight, Activity, Filter, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import PermissionGuard from '@/components/PermissionGuard'
import { useI18n } from '@/contexts/I18nContext'
import { useUser } from '@/contexts/UserContext'
import { Congreso, Evento } from '@/types/database'

// Localization constants
const MONTH_NAMES = {
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  zh: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
}

const DAY_NAMES = {
  es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  zh: ['日', '一', '二', '三', '四', '五', '六']
}

// Helper to parse date strings without timezone shifts
const parseLocalDate = (dateStr: string | null | undefined, timeStr: string) => {
  if (!dateStr) return new Date()
  const baseDate = typeof dateStr === 'string' ? dateStr.split('T')[0] : new Date(dateStr).toISOString().split('T')[0]
  return new Date(`${baseDate}T${timeStr}`)
}

interface UnifiedEvent {
  id: string
  title: string
  start: Date
  end: Date
  type: 'congreso' | 'workshop' | 'cirugia' | 'actividad' | 'otro'
  location?: string
  description?: string
  responsible?: string
  budget?: number
  status?: string
  parentCongressId?: string
  rawEvent?: any
}

export default function CalendarPage() {
  const { t, locale } = useI18n()
  const router = useRouter()
  const { profile } = useUser()

  const [currentDate, setCurrentDate] = useState(() => new Date())
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()

  // Data State
  const [congresos, setCongresos] = useState<Congreso[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [workshops, setWorkshops] = useState<any[]>([])
  const [cirugias, setCirugias] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  // Modals State
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null)

  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formEventId, setFormEventId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'cirugia',
    fecha_inicio: '',
    fecha_fin: '',
    ubicacion: '',
    responsable: '',
    presupuesto: '',
    estado: 'planificado',
    descripcion: ''
  })
  const [isSaving, setIsSaving] = useState(false)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch all calendar items (Congresos & Eventos)
  const fetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [resCongresos, resEventos, resWorkshops, resCirugias] = await Promise.all([
        fetch('/api/congresos'),
        fetch('/api/eventos'),
        fetch('/api/workshops'),
        fetch('/api/cirugias')
      ])

      if (!resCongresos.ok || !resEventos.ok || !resWorkshops.ok || !resCirugias.ok) {
        throw new Error('Failed to fetch calendar data')
      }

      const { data: congressData } = await resCongresos.json()
      const { data: eventData } = await resEventos.json()
      const { data: workshopData } = await resWorkshops.json()
      const { data: cirugiaData } = await resCirugias.json()

      setCongresos(congressData || [])
      setEventos(eventData || [])
      setWorkshops(workshopData || [])
      setCirugias(cirugiaData || [])
    } catch (err: any) {
      console.error('Error fetching calendar data:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Process and unify events
  const unifiedEvents = useMemo<UnifiedEvent[]>(() => {
    const list: UnifiedEvent[] = []

    // 1. Process Congresos
    congresos.forEach((c) => {
      const start = parseLocalDate(c.start_date, '00:00:00')
      const end = parseLocalDate(c.end_date, '23:59:59')
      list.push({
        id: `congreso-${c.id}`,
        title: c.name,
        start,
        end,
        type: 'congreso',
        location: c.location,
        description: c.description,
        parentCongressId: c.id,
        rawEvent: c
      })

      // Removed nested workshop parsing here since we fetch them separately
    })

    // 2. Process Workshops
    workshops.forEach((w) => {
      const wDate = new Date(w.date_time)
      const docNames = w.doctors?.map((d: any) => d.doctor?.name).join(', ') || w.professor || 'N/A'
      const congressInfo = w.congress || w.congresos
      const title = congressInfo ? `${congressInfo.name} - ${w.name}` : w.name
      list.push({
        id: `workshop-${w.id}`,
        title,
        start: wDate,
        end: w.end_date_time ? new Date(w.end_date_time) : wDate,
        type: 'workshop',
        location: congressInfo ? congressInfo.location : 'Por definir',
        description: `Docentes: ${docNames}. Cupo: ${w.max_people} personas. Costo: ${w.cost ? `$${w.cost}` : 'Gratuito'}`,
        responsible: docNames,
        parentCongressId: w.congress_id || undefined,
        rawEvent: w
      })
    })

    // 3. Process Custom Eventos (Surgeries, Activities, etc)
    eventos.forEach((e) => {
      const start = parseLocalDate(e.fecha_inicio, '00:00:00')
      const end = e.fecha_fin ? parseLocalDate(e.fecha_fin, '23:59:59') : parseLocalDate(e.fecha_inicio, '23:59:59')
      list.push({
        id: `custom-${e.id}`,
        title: e.nombre,
        start,
        end,
        type: e.tipo as any,
        location: e.ubicacion || undefined,
        description: e.descripcion || undefined,
        responsible: e.responsable || undefined,
        budget: e.presupuesto ? Number(e.presupuesto) : undefined,
        status: e.estado,
        rawEvent: e
      })
    })

    // 4. Process Cirugias
    cirugias.forEach((c) => {
      const cDate = new Date(c.fecha)
      list.push({
        id: `cirugia-${c.id}`,
        title: c.nombre,
        start: cDate,
        end: cDate,
        type: 'cirugia',
        description: `Médico: ${c.medico}. Estado: ${c.estado}. ${c.descripcion || c.notas || ''}`,
        responsible: c.medico,
        status: c.estado,
        rawEvent: c
      })
    })

    return list
  }, [congresos, eventos, workshops, cirugias])

  // Filter events
  const filteredEvents = useMemo(() => {
    return unifiedEvents.filter((event) => {
      // 1. Search Query
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        !query ||
        event.title.toLowerCase().includes(query) ||
        (event.description && event.description.toLowerCase().includes(query)) ||
        (event.location && event.location.toLowerCase().includes(query)) ||
        (event.responsible && event.responsible.toLowerCase().includes(query))

      // 2. Type Filter
      const matchesType = selectedType === 'all' || event.type === selectedType

      // 3. Status Filter (Only applicable for custom events)
      const matchesStatus =
        selectedStatus === 'all' ||
        (event.status && event.status === selectedStatus) ||
        (!event.status && selectedStatus === 'all')

      return matchesSearch && matchesType && matchesStatus
    })
  }, [unifiedEvents, searchQuery, selectedType, selectedStatus])

  // Calculate calendar grid days
  const calendarDays = useMemo(() => {
    const startOfMonth = new Date(currentYear, currentMonth, 1)
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0)
    
    // Day of the week of the 1st of the month (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const startDayOfWeek = startOfMonth.getDay()
    const daysInMonth = endOfMonth.getDate()

    const startOfPrevMonth = new Date(currentYear, currentMonth, 0)
    const daysInPrevMonth = startOfPrevMonth.getDate()

    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = []

    // 1. Previous month buffer days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1, daysInPrevMonth - i)
      days.push({
        date,
        isCurrentMonth: false,
        isToday: isSameDay(date, new Date())
      })
    }

    // 2. Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i)
      days.push({
        date,
        isCurrentMonth: true,
        isToday: isSameDay(date, new Date())
      })
    }

    // 3. Next month buffer days (fill standard 42-day calendar sheet)
    const totalCells = 42
    const nextMonthDaysToAdd = totalCells - days.length
    for (let i = 1; i <= nextMonthDaysToAdd; i++) {
      const date = new Date(currentYear, currentMonth + 1, i)
      days.push({
        date,
        isCurrentMonth: false,
        isToday: isSameDay(date, new Date())
      })
    }

    return days
  }, [currentYear, currentMonth])

  // Helper: check if two dates fall on the same calendar day
  function isSameDay(d1: Date, d2: Date) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate()
  }

  // Helper: check if a date falls within an event range
  function isDayInEvent(day: Date, event: UnifiedEvent) {
    // Zero-out times for checking range intersection
    const dayTime = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
    const startTime = new Date(event.start.getFullYear(), event.start.getMonth(), event.start.getDate()).getTime()
    const endTime = new Date(event.end.getFullYear(), event.end.getMonth(), event.end.getDate()).getTime()
    
    return dayTime >= startTime && dayTime <= endTime
  }

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Open Form for creating a new custom event
  const openNewEventModal = (prefilledDate?: Date) => {
    let dateStr = ''
    if (prefilledDate) {
      const y = prefilledDate.getFullYear()
      const m = String(prefilledDate.getMonth() + 1).padStart(2, '0')
      const d = String(prefilledDate.getDate()).padStart(2, '0')
      dateStr = `${y}-${m}-${d}`
    } else {
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const d = String(now.getDate()).padStart(2, '0')
      dateStr = `${y}-${m}-${d}`
    }

    setFormData({
      nombre: '',
      tipo: 'cirugia',
      fecha_inicio: dateStr,
      fecha_fin: dateStr,
      ubicacion: '',
      responsable: '',
      presupuesto: '',
      estado: 'planificado',
      descripcion: ''
    })
    setFormEventId(null)
    setIsEditing(false)
    setIsFormModalOpen(true)
  }

  // Open Form for editing an event
  const handleEditEvent = (event: UnifiedEvent) => {
    const e = event.rawEvent as Evento
    const format = (d: string | null) => {
      if (!d) return ''
      return d.substring(0, 10)
    }

    setFormData({
      nombre: e.nombre,
      tipo: e.tipo,
      fecha_inicio: format(e.fecha_inicio),
      fecha_fin: format(e.fecha_fin),
      ubicacion: e.ubicacion || '',
      responsable: e.responsable || '',
      presupuesto: e.presupuesto ? String(e.presupuesto) : '',
      estado: e.estado || 'planificado',
      descripcion: e.descripcion || ''
    })
    setFormEventId(e.id)
    setIsEditing(true)
    setIsDetailsModalOpen(false)
    setIsFormModalOpen(true)
  }

  // Save Event handler
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nombre || !formData.fecha_inicio) return

    setIsSaving(true)
    try {
      const url = isEditing ? `/api/eventos/${formEventId}` : '/api/eventos'
      const method = isEditing ? 'PATCH' : 'POST'

      const payload = {
        ...formData,
        presupuesto: formData.presupuesto ? Number(formData.presupuesto) : null,
        fecha_fin: formData.fecha_fin || formData.fecha_inicio,
        created_by: profile?.id || null
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        throw new Error('Error processing event request')
      }

      setIsFormModalOpen(false)
      fetchData()
    } catch (err: any) {
      console.error(err)
      alert(t('error') + ': ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Delete Event handler
  const handleDeleteEvent = async () => {
    if (!selectedEvent) return
    const id = selectedEvent.id.replace('custom-', '')
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/eventos/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')

      setIsDeleteModalOpen(false)
      setSelectedEvent(null)
      fetchData()
    } catch (err: any) {
      console.error(err)
      alert(t('error') + ': ' + err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const getEventBadgeStyle = (type: string) => {
    switch (type) {
      case 'congreso':
        return 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
      case 'cirugia':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
      case 'workshop':
        return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
      default:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
    }
  }

  const getEventBadgeDot = (type: string) => {
    switch (type) {
      case 'congreso':
        return 'bg-purple-500'
      case 'cirugia':
        return 'bg-emerald-500'
      case 'workshop':
        return 'bg-amber-500'
      default:
        return 'bg-indigo-500'
    }
  }

  const getEventTypeName = (type: string) => {
    switch (type) {
      case 'congreso':
        return t('congresos')
      case 'cirugia':
        return t('surgery')
      case 'workshop':
        return t('workshop')
      case 'actividad':
        return t('activity')
      case 'otro':
        return t('other')
      default:
        return type
    }
  }

  // Get current active translation dictionary
  const currentMonthName = MONTH_NAMES[locale as 'es' | 'en' | 'zh'][currentMonth]
  const currentDayNames = DAY_NAMES[locale as 'es' | 'en' | 'zh']

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <CalendarDays className="text-blue-600" size={28} />
              {t('calendar')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('appName')} / {t('events')}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => fetchData()}
              className="btn-secondary px-3 py-2"
              title="Recargar datos"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <PermissionGuard section="congresos" action="create">
              <button 
                onClick={() => openNewEventModal()}
                className="btn-primary"
              >
                <Plus size={18} /> {t('newEvent')}
              </button>
            </PermissionGuard>
          </div>
        </header>

        {/* Filters and Navigation Bar */}
        <div className="card p-4 flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            
            {/* Month Navigator Controls */}
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePrevMonth}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                title="Mes Anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-lg font-bold text-gray-900 min-w-[150px] text-center">
                {currentMonthName} {currentYear}
              </span>
              <button 
                onClick={handleNextMonth}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                title="Mes Siguiente"
              >
                <ChevronRight size={18} />
              </button>
              <button 
                onClick={handleToday}
                className="btn-secondary px-3.5 py-1.5 text-xs font-semibold ml-2"
              >
                Hoy
              </button>
            </div>

            {/* Event Filtering Controls */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <input
                  type="text"
                  placeholder="Buscar eventos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="erp-input w-full sm:w-[220px]"
                />
              </div>

              <div className="flex items-center gap-2 flex-1 sm:flex-none">
                <Filter size={16} className="text-gray-400" />
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="erp-input py-1.5 text-sm"
                  style={{ minWidth: '130px' }}
                >
                  <option value="all">Tipos: Todos</option>
                  <option value="congreso">{t('congresos')}</option>
                  <option value="cirugia">{t('surgery')}</option>
                  <option value="workshop">{t('workshop')}</option>
                  <option value="actividad">{t('activity')}</option>
                  <option value="otro">{t('other')}</option>
                </select>
              </div>

              <div className="flex items-center gap-2 flex-1 sm:flex-none">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="erp-input py-1.5 text-sm"
                  style={{ minWidth: '130px' }}
                >
                  <option value="all">Estatus: Todos</option>
                  <option value="planificado">Planificado</option>
                  <option value="realizado">Realizado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>

          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold pt-2 border-t border-gray-100">
            <span className="text-gray-400">Leyenda:</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> {t('congresos')}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> {t('surgery')}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Workshops</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Actividades / Otros</span>
          </div>
        </div>

        {/* Calendar Grid Sheet */}
        {isLoading ? (
          <div className="card p-24 flex flex-col justify-center items-center gap-4">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-sm font-semibold text-gray-500">Cargando eventos...</p>
          </div>
        ) : error ? (
          <div className="card p-12 text-center text-red-500 bg-red-50 border-red-100">
            <p className="font-bold">Error loading calendar events:</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {/* Grid Day Headers */}
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50 text-center font-bold text-xs uppercase tracking-wider text-gray-500 py-3">
              {currentDayNames.map((day, idx) => (
                <div key={idx}>{day}</div>
              ))}
            </div>

            {/* Grid Day Cells */}
            <div className="grid grid-cols-7 bg-gray-200 gap-[1px]">
              {calendarDays.map(({ date, isCurrentMonth, isToday }, idx) => {
                // Filter events that fall on this day
                const dayEvents = filteredEvents.filter((event) => isDayInEvent(date, event))

                return (
                  <div 
                    key={idx} 
                    onClick={() => {
                      if (isCurrentMonth) openNewEventModal(date)
                    }}
                    className={`
                      min-h-[110px] md:min-h-[130px] p-2 bg-white flex flex-col gap-1 transition-all duration-150 relative group cursor-pointer
                      ${isCurrentMonth ? 'hover:bg-blue-50/20' : 'bg-gray-50/50 text-gray-400'}
                    `}
                  >
                    {/* Day Number Label */}
                    <div className="flex justify-between items-center mb-1">
                      <span 
                        className={`
                          text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
                          ${isToday 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                          }
                        `}
                      >
                        {date.getDate()}
                      </span>
                      
                      {/* Plus icon on hover for current month days */}
                      {isCurrentMonth && (
                        <span className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity p-0.5 rounded-full hover:bg-blue-50">
                          <Plus size={14} />
                        </span>
                      )}
                    </div>

                    {/* Day Events Container */}
                    <div className="flex flex-col gap-1 flex-1 overflow-y-auto max-h-[80px] md:max-h-[95px] pr-0.5">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation() // Stop cell trigger
                            setSelectedEvent(event)
                            setIsDetailsModalOpen(true)
                          }}
                          className={`
                            px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate border transition-all duration-150 flex items-center gap-1
                            ${getEventBadgeStyle(event.type)}
                          `}
                          title={event.title}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getEventBadgeDot(event.type)}`}></span>
                          <span className="truncate">{event.title}</span>
                        </div>
                      ))}

                      {/* Indicator for extra events */}
                      {dayEvents.length > 3 && (
                        <div className="text-[9px] font-bold text-blue-600 pl-1 mt-0.5">
                          + {dayEvents.length - 3} más
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Modal: Event Details */}
        <Modal
          open={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title={selectedEvent ? getEventTypeName(selectedEvent.type) : ''}
        >
          {selectedEvent && (
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className={`p-3 rounded-2xl border flex items-center justify-center mt-1 flex-shrink-0 ${getEventBadgeStyle(selectedEvent.type).split(' ')[0]}`}>
                  <CalendarDays size={24} className={selectedEvent.type === 'cirugia' ? 'text-emerald-600' : selectedEvent.type === 'congreso' ? 'text-purple-600' : 'text-blue-600'} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 leading-snug">
                    {selectedEvent.type === 'cirugia' ? (
                      <Link 
                        href={`/cirugias/${selectedEvent.id.replace('cirugia-', '')}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      >
                        {selectedEvent.title}
                      </Link>
                    ) : selectedEvent.type === 'workshop' ? (
                      <Link 
                        href={`/talleres/${selectedEvent.id.replace('workshop-', '')}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      >
                        {selectedEvent.title}
                      </Link>
                    ) : selectedEvent.parentCongressId ? (
                      <Link 
                        href={`/congresos/${selectedEvent.parentCongressId}/view`}
                        className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      >
                        {selectedEvent.title}
                      </Link>
                    ) : (
                      selectedEvent.title
                    )}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wide border ${getEventBadgeStyle(selectedEvent.type)}`}>
                      {getEventTypeName(selectedEvent.type)}
                    </span>
                    {selectedEvent.status && (
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold capitalize border ${
                        selectedEvent.status === 'realizado' 
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : selectedEvent.status === 'cancelado'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      }`}>
                        {selectedEvent.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-b border-gray-100 py-4 space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Clock size={16} className="text-gray-400" />
                  <span>
                    <strong>Vigencia:</strong>{' '}
                    {selectedEvent.type === 'workshop' ? (
                      (() => {
                        const dStart = selectedEvent.start
                        const dEnd = selectedEvent.end
                        const startStr = `${dStart.toLocaleDateString('es-MX')} ${dStart.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                        const sameDay = dStart.toDateString() === dEnd.toDateString()
                        if (sameDay) {
                          return `${startStr} - ${dEnd.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                        } else {
                          return `${startStr} - ${dEnd.toLocaleDateString('es-MX')} ${dEnd.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                        }
                      })()
                    ) : selectedEvent.type === 'cirugia' ? (
                      (() => {
                        const dStart = selectedEvent.start
                        return `${dStart.toLocaleDateString('es-MX')} ${dStart.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                      })()
                    ) : (
                      <>
                        {selectedEvent.start.toLocaleDateString()}
                        {selectedEvent.start.toLocaleDateString() !== selectedEvent.end.toLocaleDateString() && (
                          <> - {selectedEvent.end.toLocaleDateString()}</>
                        )}
                      </>
                    )}
                  </span>
                </div>

                {selectedEvent.location && (
                  <div className="flex items-start gap-3 text-sm text-gray-600">
                    <MapPin size={16} className="text-gray-400 mt-0.5" />
                    <span><strong>{t('location')}:</strong> {selectedEvent.location}</span>
                  </div>
                )}

                {selectedEvent.responsible && (
                  <div className="flex items-start gap-3 text-sm text-gray-600">
                    <User size={16} className="text-gray-400 mt-0.5" />
                    <span><strong>{t('responsible')}:</strong> {selectedEvent.responsible}</span>
                  </div>
                )}

                {selectedEvent.budget !== undefined && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <DollarSign size={16} className="text-gray-400" />
                    <span><strong>{t('budget')}:</strong> ${selectedEvent.budget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
                  </div>
                )}
              </div>

              {selectedEvent.description && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Detalles</span>
                  <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3.5 rounded-xl border border-gray-100 whitespace-pre-line">
                    {selectedEvent.description}
                  </p>
                </div>
              )}

              {/* Action Buttons inside Details */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                {/* Action Links */}
                {selectedEvent.type === 'cirugia' ? (
                  <Link
                    href={`/cirugias/${selectedEvent.id.replace('cirugia-', '')}`}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1.5 group/link"
                  >
                    <span>Ver detalle de la cirugía</span>
                    <ArrowRight size={14} className="group-hover/link:translate-x-0.5 transition-transform" />
                  </Link>
                ) : selectedEvent.type === 'workshop' ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <Link
                      href={`/talleres/${selectedEvent.id.replace('workshop-', '')}`}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1.5 group/link"
                    >
                      <span>Ver detalle del taller</span>
                      <ArrowRight size={14} className="group-hover/link:translate-x-0.5 transition-transform" />
                    </Link>
                    {selectedEvent.parentCongressId && (
                      <Link
                        href={`/congresos/${selectedEvent.parentCongressId}/view`}
                        className="text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1.5 group/link"
                      >
                        <span>{t('viewParentCongress')}</span>
                        <ArrowRight size={14} className="group-hover/link:translate-x-0.5 transition-transform" />
                      </Link>
                    )}
                  </div>
                ) : selectedEvent.parentCongressId ? (
                  <Link
                    href={`/congresos/${selectedEvent.parentCongressId}/view`}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1.5 group/link"
                  >
                    <span>{t('viewParentCongress')}</span>
                    <ArrowRight size={14} className="group-hover/link:translate-x-0.5 transition-transform" />
                  </Link>
                ) : (
                  <div></div>
                )}

                {/* Edit / Delete custom events */}
                {selectedEvent.id.startsWith('custom-') && (
                  <div className="flex items-center gap-2">
                    <PermissionGuard section="congresos" action="edit">
                      <button
                        onClick={() => handleEditEvent(selectedEvent)}
                        className="btn-secondary py-2 px-3 flex items-center gap-1 text-sm font-semibold"
                      >
                        <Edit size={14} /> {t('edit')}
                      </button>
                    </PermissionGuard>
                    <PermissionGuard section="congresos" action="delete">
                      <button
                        onClick={() => setIsDeleteModalOpen(true)}
                        className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700 py-2 px-3 flex items-center gap-1 text-sm font-semibold"
                      >
                        <Trash2 size={14} /> {t('delete')}
                      </button>
                    </PermissionGuard>
                  </div>
                )}
              </div>

            </div>
          )}
        </Modal>

        {/* Modal: Create or Edit Event Form */}
        <Modal
          open={isFormModalOpen}
          onClose={() => !isSaving && setIsFormModalOpen(false)}
          title={isEditing ? t('editEvent') : t('newEvent')}
        >
          <form onSubmit={handleSaveEvent} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Event Name */}
              <div className="col-span-full space-y-1.5">
                <label className="text-sm font-bold text-gray-700 block">Nombre del Evento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cirugía de rodilla Dr. Martínez"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="erp-input"
                  disabled={isSaving}
                />
              </div>

              {/* Event Type */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700 block">{t('eventType')}</label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  className="erp-input"
                  disabled={isSaving}
                >
                  <option value="cirugia">{t('surgery')}</option>
                  <option value="workshop">{t('workshop')}</option>
                  <option value="actividad">{t('activity')}</option>
                  <option value="otro">{t('other')}</option>
                </select>
              </div>

              {/* Event Status */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700 block">{t('status')}</label>
                <select
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                  className="erp-input"
                  disabled={isSaving}
                >
                  <option value="planificado">Planificado</option>
                  <option value="realizado">Realizado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              {/* Start Date */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700 block">{t('startDate')} *</label>
                <input
                  type="date"
                  required
                  value={formData.fecha_inicio}
                  onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                  className="erp-input"
                  disabled={isSaving}
                />
              </div>

              {/* End Date */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700 block">{t('endDate')}</label>
                <input
                  type="date"
                  value={formData.fecha_fin}
                  onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                  className="erp-input"
                  disabled={isSaving}
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700 block">{t('location')}</label>
                <input
                  type="text"
                  placeholder="Ej. Hospital Ángeles Lomas"
                  value={formData.ubicacion}
                  onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                  className="erp-input"
                  disabled={isSaving}
                />
              </div>

              {/* Responsible Person */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700 block">{t('responsible')}</label>
                <input
                  type="text"
                  placeholder="Ej. Dr. Alejandro Gómez"
                  value={formData.responsable}
                  onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
                  className="erp-input"
                  disabled={isSaving}
                />
              </div>

              {/* Budget */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700 block">{t('budget')} (MXN)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.presupuesto}
                    onChange={(e) => setFormData({ ...formData, presupuesto: e.target.value })}
                    className="erp-input pl-8"
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="col-span-full space-y-1.5">
                <label className="text-sm font-bold text-gray-700 block">{t('description')}</label>
                <textarea
                  placeholder="Notas adicionales, detalles de instrumental requerido, etc."
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="erp-input min-h-[90px] resize-y"
                  disabled={isSaving}
                />
              </div>

            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="btn-secondary"
                disabled={isSaving}
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSaving}
              >
                {isSaving ? t('loading') : t('saveChanges')}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Delete Event Confirmation */}
        <Modal
          open={isDeleteModalOpen}
          onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
          title={t('delete')}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              {t('deleteEventDesc')}
              <br/><br/>
              <strong>{selectedEvent?.title}</strong>
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setIsDeleteModalOpen(false)} 
                className="btn-secondary"
                disabled={isDeleting}
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleDeleteEvent} 
                className="btn-primary bg-red-600 border-red-600 hover:bg-red-700 hover:border-red-700 text-white"
                disabled={isDeleting}
              >
                {isDeleting ? t('loading') : t('delete')}
              </button>
            </div>
          </div>
        </Modal>

      </div>
    </AppShell>
  )
}
