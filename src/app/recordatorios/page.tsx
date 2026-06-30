'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Calendar, Users, Bell, Trash2, Edit, Send, Play, X, Loader2, Check, AlertCircle, Clock, ToggleLeft, ToggleRight, Sparkles, RefreshCw, MessageSquare } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'

interface UserProfile {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  whatsapp: string | null
  position: string | null
}

interface Reminder {
  id: string
  title: string
  message: string
  target_type: 'surgery' | 'congress' | 'workshop' | 'general'
  target_id: string | null
  time: string
  notify_all_participants: boolean
  extra_contacts: string[]
  dates?: string[]
  active: boolean
  created_at: string
  _count?: { whatsapp_reminder_logs: number }
  whatsapp_reminder_logs?: {
    id: string
    sent_at: string
    status: string
    recipient_name: string | null
    recipient_phone: string
    error_message: string | null
  }[]
}

interface EventOption {
  id: string
  name: string
  dateLabel: string
}

export default function RecordatoriosPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [staff, setStaff] = useState<UserProfile[]>([])
  const [surgeries, setSurgeries] = useState<any[]>([])
  const [congresses, setCongresses] = useState<any[]>([])
  const [workshops, setWorkshops] = useState<any[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)

  // Form State
  const [formTitle, setFormTitle] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [formTargetType, setFormTargetType] = useState<'surgery' | 'congress' | 'workshop' | 'general'>('surgery')
  const [formTargetId, setFormTargetId] = useState('')
  const [formTime, setFormTime] = useState('17:00')
  const [formNotifyAll, setFormNotifyAll] = useState(true)
  const [formExtraContacts, setFormExtraContacts] = useState<string[]>([])
  const [formActive, setFormActive] = useState(true)
  const [formDates, setFormDates] = useState<string[]>([])
  const [dateInput, setDateInput] = useState('')

  // Quick Test Panel State
  const [testReminderId, setTestReminderId] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Cron Trigger State
  const [isTriggeringCron, setIsTriggeringCron] = useState(false)
  const [cronResult, setCronResult] = useState<any | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fetchData = async () => {
    try {
      setIsLoading(true)
      // Fetch reminders
      const remindersRes = await fetch('/api/recordatorios')
      if (remindersRes.ok) {
        const { data } = await remindersRes.json()
        setReminders(data || [])
      }

      // Fetch staff profiles
      const staffRes = await fetch('/api/recordatorios/users')
      if (staffRes.ok) {
        const { data } = await staffRes.json()
        setStaff(data || [])
      }

      // Fetch surgeries
      const surgeriesRes = await fetch('/api/cirugias')
      if (surgeriesRes.ok) {
        const { data } = await surgeriesRes.json()
        setSurgeries(data || [])
      }

      // Fetch congresses
      const congressesRes = await fetch('/api/congresos')
      if (congressesRes.ok) {
        const { data } = await congressesRes.json()
        setCongresses(data || [])
      }

      // Fetch workshops
      const workshopsRes = await fetch('/api/workshops')
      if (workshopsRes.ok) {
        const { data } = await workshopsRes.json()
        setWorkshops(data || [])
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setIsLoading(false)
    }
  };

  useEffect(() => {
    fetchData()
  }, [])

  // Filtered Reminders
  const filteredReminders = reminders.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.message.toLowerCase().includes(search.toLowerCase())
  )

  // Helper to get matching target options based on chosen type
  const getEventOptions = (): EventOption[] => {
    if (formTargetType === 'surgery') {
      return surgeries.map(s => ({
        id: s.id,
        name: `${s.nombre} (Dr. ${s.medico})`,
        dateLabel: new Date(s.fecha).toLocaleDateString('es-MX', { dateStyle: 'short', timeZone: 'America/Mexico_City' })
      }))
    }
    if (formTargetType === 'congress') {
      return congresses.map(c => ({
        id: c.id,
        name: c.name,
        dateLabel: `${new Date(c.start_date).toLocaleDateString('es-MX', { dateStyle: 'short', timeZone: 'America/Mexico_City' })} - ${new Date(c.end_date).toLocaleDateString('es-MX', { dateStyle: 'short', timeZone: 'America/Mexico_City' })}`
      }))
    }
    if (formTargetType === 'workshop') {
      return workshops.map(w => ({
        id: w.id,
        name: w.name,
        dateLabel: new Date(w.date_time).toLocaleDateString('es-MX', { dateStyle: 'short', timeZone: 'America/Mexico_City' })
      }))
    }
    return []
  };

  // Helper to find target event name for a card
  const getEventName = (targetType: string, targetId: string | null) => {
    if (targetType === 'general' || !targetId) {
      return 'General (Sin vincular a evento)'
    }
    if (targetType === 'surgery') {
      const s = surgeries.find(item => item.id === targetId)
      return s ? `${s.nombre} (Dr. ${s.medico})` : 'Cirugía Desconocida'
    }
    if (targetType === 'congress') {
      const c = congresses.find(item => item.id === targetId)
      return c ? c.name : 'Congreso Desconocido'
    }
    if (targetType === 'workshop') {
      const w = workshops.find(item => item.id === targetId)
      return w ? w.name : 'Taller Desconocido'
    }
    return 'Evento'
  };

  const handleOpenCreate = () => {
    setEditingReminder(null)
    setFormTitle('')
    setFormMessage('')
    setFormTargetType('surgery')
    setFormTargetId('')
    setFormTime('17:00')
    setFormNotifyAll(true)
    setFormExtraContacts([])
    setFormActive(true)
    setFormDates([])
    setDateInput('')
    setIsModalOpen(true)
  };

  const handleOpenEdit = (reminder: Reminder) => {
    setEditingReminder(reminder)
    setFormTitle(reminder.title)
    setFormMessage(reminder.message)
    setFormTargetType(reminder.target_type)
    setFormTargetId(reminder.target_id || '')
    setFormTime(reminder.time)
    setFormNotifyAll(reminder.notify_all_participants)
    setFormExtraContacts(reminder.extra_contacts || [])
    setFormActive(reminder.active)
    setFormDates(reminder.dates || [])
    setDateInput('')
    setIsModalOpen(true)
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const isEventRequired = formTargetType !== 'general';
    if (!formTitle || !formMessage || !formTargetType || (isEventRequired && !formTargetId)) {
      alert('Por favor completa todos los campos obligatorios.')
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        title: formTitle,
        message: formMessage,
        target_type: formTargetType,
        target_id: isEventRequired ? formTargetId : null,
        time: formTime,
        notify_all_participants: isEventRequired ? formNotifyAll : false,
        extra_contacts: formExtraContacts,
        active: formActive,
        dates: formTargetType === 'general' ? formDates : []
      }

      let res
      if (editingReminder) {
        res = await fetch(`/api/recordatorios/${editingReminder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        res = await fetch('/api/recordatorios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      if (res.ok) {
        await fetchData()
        setIsModalOpen(false)
      } else {
        const errorData = await res.json()
        alert(`Error al guardar: ${errorData.error || 'Intenta de nuevo'}`)
      }
    } catch (err: any) {
      console.error(err)
      alert('Error de conexión al guardar el recordatorio.')
    } finally {
      setIsSubmitting(false)
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este recordatorio? Todos sus registros históricos también serán eliminados.')) return
    try {
      const res = await fetch(`/api/recordatorios/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setReminders(prev => prev.filter(r => r.id !== id))
        if (testReminderId === id) setTestReminderId('')
      }
    } catch (err) {
      console.error(err)
    }
  };

  const handleToggleActive = async (reminder: Reminder) => {
    try {
      const res = await fetch(`/api/recordatorios/${reminder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !reminder.active })
      })
      if (res.ok) {
        setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, active: !r.active } : r))
      }
    } catch (err) {
      console.error(err)
    }
  };

  const handleSendTest = async () => {
    if (!testReminderId || !testPhone) {
      setTestResult({ success: false, message: 'Selecciona un recordatorio e introduce un número de teléfono.' })
      return
    }

    try {
      setIsTesting(true)
      setTestResult(null)
      const res = await fetch('/api/recordatorios/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderId: testReminderId, testPhone })
      })
      const data = await res.json()
      if (res.ok) {
        setTestResult({ success: true, message: '¡Mensaje enviado con éxito via respond.io!' })
        fetchData() // Refresh logs
      } else {
        setTestResult({ success: false, message: data.error || 'Error al enviar.' })
      }
    } catch (err: any) {
      setTestResult({ success: false, message: 'Error de red.' })
    } finally {
      setIsTesting(false)
    }
  };

  const handleTriggerCron = async () => {
    try {
      setIsTriggeringCron(true)
      setCronResult(null)
      const res = await fetch('/api/cron/reminders/send', {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok) {
        setCronResult({ success: true, count: data.processed?.length || 0, details: data.processed })
        fetchData() // Refresh status/logs
      } else {
        setCronResult({ success: false, error: data.error || 'Error en ejecución' })
      }
    } catch (err: any) {
      setCronResult({ success: false, error: 'Error de red al ejecutar cron.' })
    } finally {
      setIsTriggeringCron(false)
    }
  };

  // Helper to insert placeholders into textarea
  const insertPlaceholder = (placeholder: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const before = text.substring(0, start)
    const after = text.substring(end, text.length)

    setFormMessage(before + placeholder + after)
    
    // Focus back and set selection
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length)
    }, 10)
  };

  const toggleStaffContact = (staffId: string) => {
    setFormExtraContacts(prev =>
      prev.includes(staffId)
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    )
  };

  // Extract all logs from all reminders for unified list
  const allLogs = reminders
    .flatMap(r => (r.whatsapp_reminder_logs || []).map(log => ({ ...log, reminderTitle: r.title })))
    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
    .slice(0, 15)

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-blue-50 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#0763a9' }}>
              Recordatorios de WhatsApp
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Diseña recordatorios periódicos para cirugías, talleres y congresos a través del agente virtual <span className="font-semibold text-blue-600">ArthroNexus</span>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTriggerCron}
              disabled={isTriggeringCron}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition disabled:opacity-50"
            >
              {isTriggeringCron ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Procesar Pendientes
            </button>
            
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-white shadow-sm transition"
              style={{ backgroundColor: '#0763a9' }}
            >
              <Plus size={18} />
              Crear Recordatorio
            </button>
          </div>
        </div>

        {/* Cron Process Alert Result */}
        {cronResult && (
          <div className={`p-4 rounded-xl flex items-start gap-3 border ${cronResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {cronResult.success ? (
              <>
                <Check size={20} className="text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Procesamiento de recordatorios completado exitosamente.</p>
                  <p className="text-xs mt-1 text-green-700">Se escanearon los recordatorios programados y se procesaron {cronResult.count} eventos hoy.</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle size={20} className="text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Error al procesar recordatorios.</p>
                  <p className="text-xs mt-1 text-red-700">{cronResult.error}</p>
                </div>
              </>
            )}
            <button className="ml-auto text-gray-400 hover:text-gray-600" onClick={() => setCronResult(null)}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Main Grid: Left List, Right Test Panel + Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Reminders List (2/3 width) */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Search Bar */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Search size={18} />
              </span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar recordatorios por título o contenido..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition shadow-sm"
              />
            </div>

            {/* List */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-blue-50 shadow-sm">
                <Loader2 size={36} className="animate-spin text-blue-500" />
                <p className="text-sm text-gray-500 mt-3">Cargando recordatorios...</p>
              </div>
            ) : filteredReminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-blue-50 text-center shadow-sm">
                <Bell size={40} className="text-blue-200 mb-3" />
                <p className="font-medium text-gray-700">No se encontraron recordatorios</p>
                <p className="text-xs text-gray-400 max-w-md mt-1">Crea un recordatorio para automatizar notificaciones por WhatsApp a los participantes de tus cirugías, congresos y talleres.</p>
                <button
                  onClick={handleOpenCreate}
                  className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg text-white"
                  style={{ backgroundColor: '#0763a9' }}
                >
                  Nuevo Recordatorio
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredReminders.map(reminder => (
                  <div
                    key={reminder.id}
                    className={`flex flex-col justify-between bg-white border rounded-2xl p-5 hover:shadow-md transition duration-200 ${!reminder.active ? 'opacity-75 border-gray-100 bg-gray-50/50' : 'border-blue-100'}`}
                  >
                    <div>
                      {/* Badge & Toggle Row */}
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          reminder.target_type === 'surgery' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                          reminder.target_type === 'congress' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                          'bg-teal-50 text-teal-700 border border-teal-100'
                        }`}>
                          {reminder.target_type === 'surgery' ? 'Cirugía' :
                           reminder.target_type === 'congress' ? 'Congreso' : 'Taller'}
                        </span>
                        
                        <button
                          onClick={() => handleToggleActive(reminder)}
                          className="text-gray-500 hover:text-blue-600 transition"
                          title={reminder.active ? 'Desactivar recordatorio' : 'Activar recordatorio'}
                        >
                          {reminder.active ? (
                            <ToggleRight size={28} className="text-blue-500" />
                          ) : (
                            <ToggleLeft size={28} className="text-gray-300" />
                          )}
                        </button>
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-base mb-1" style={{ color: '#37383a' }}>{reminder.title}</h3>
                      
                      {/* Target Event Info */}
                      <div className="text-xs text-gray-500 flex flex-col gap-1 mb-3 bg-blue-50/40 p-2.5 rounded-xl border border-blue-50/30">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-blue-500 shrink-0" />
                          <span className="font-semibold truncate">
                            {reminder.target_type === 'general' ? 'General (Sin vincular a evento)' : getEventName(reminder.target_type, reminder.target_id)}
                          </span>
                        </div>
                        {reminder.target_type === 'general' && (
                          <div className="text-[10px] text-gray-600 mt-1 pl-4.5 border-l border-blue-200">
                            {reminder.dates && reminder.dates.length > 0 ? (
                              <span className="block break-words">
                                <span className="font-medium text-gray-400 uppercase tracking-wider text-[9px] block mb-0.5">Días Programados:</span>
                                {reminder.dates.map(d => {
                                  const [y, m, dayVal] = d.split('-');
                                  return `${dayVal}/${m}`;
                                }).join(', ')}
                              </span>
                            ) : (
                              <span className="block italic text-gray-400">Todos los días</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Time and Options Row */}
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-4 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock size={13} className="text-gray-400" />
                          {reminder.time}
                        </span>
                        <span className="flex items-center gap-1" title="Miembros notificados">
                          <Users size={13} className="text-gray-400" />
                          {reminder.notify_all_participants ? 'Miembros + ' : ''}
                          {reminder.extra_contacts?.length || 0} Personal
                        </span>
                      </div>

                      {/* Text Message Preview */}
                      <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100 italic line-clamp-3 mb-4 whitespace-pre-line">
                        "{reminder.message}"
                      </p>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                      <span className="text-[10px] text-gray-400">ID: {reminder.id.substring(0,8)}...</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setTestReminderId(reminder.id)
                            setTestPhone('')
                            setTestResult(null)
                            // Scroll to test panel on mobile
                            document.getElementById('test-panel')?.scrollIntoView({ behavior: 'smooth' })
                          }}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                          title="Probar envío"
                        >
                          <Send size={15} />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(reminder)}
                          className="p-1.5 text-gray-500 hover:bg-gray-50 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(reminder.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Testing & Unified Logs (1/3 width) */}
          <div className="space-y-6">
            
            {/* Quick Test Panel */}
            <div id="test-panel" className="bg-white border border-blue-50 rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: '#37383a' }}>
                <Sparkles size={16} className="text-blue-500" />
                Prueba Rápida de WhatsApp
              </h2>
              
              <div className="space-y-3">
                {/* Select reminder to test */}
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Recordatorio</label>
                  <select
                    value={testReminderId}
                    onChange={e => setTestReminderId(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Selecciona recordatorio --</option>
                    {reminders.map(r => (
                      <option key={r.id} value={r.id}>{r.title} ({r.target_type})</option>
                    ))}
                  </select>
                </div>

                {/* Custom phone number */}
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Número de Prueba</label>
                  <input
                    type="tel"
                    value={testPhone}
                    onChange={e => setTestPhone(e.target.value)}
                    placeholder="Ej. +52 811 000 0000"
                    className="w-full rounded-xl border border-gray-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Trigger Button */}
                <button
                  onClick={handleSendTest}
                  disabled={isTesting || !testReminderId || !testPhone}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold text-white shadow-sm hover:opacity-95 transition disabled:opacity-50"
                  style={{ backgroundColor: '#0763a9' }}
                >
                  {isTesting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Enviando Prueba...
                    </>
                  ) : (
                    <>
                      <Play size={13} />
                      Enviar WhatsApp
                    </>
                  )}
                </button>
              </div>

              {/* Test Result Message */}
              {testResult && (
                <div className={`p-3 rounded-xl text-xs flex gap-2 ${testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  {testResult.success ? <Check size={16} className="shrink-0 text-green-600" /> : <AlertCircle size={16} className="shrink-0 text-red-600" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            {/* Unified Activity Logs Panel */}
            <div className="bg-white border border-blue-50 rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: '#37383a' }}>
                <Clock size={16} className="text-gray-500" />
                Historial de Envíos Recientes
              </h2>

              {allLogs.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-6">No hay registros de envío recientes.</p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {allLogs.map(log => (
                    <div key={log.id} className="border-b border-gray-50 pb-2.5 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs text-gray-700 truncate max-w-[120px]" title={log.recipient_name || ''}>
                          {log.recipient_name || log.recipient_phone}
                        </span>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase ${
                          log.status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {log.status === 'success' ? 'Éxito' : 'Fallo'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                        <span className="truncate max-w-[140px]" title={log.reminderTitle}>
                          {log.reminderTitle}
                        </span>
                        <span>
                          {new Date(log.sent_at).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      {log.error_message && (
                        <p className="text-[9px] text-red-500 bg-red-50/50 p-1.5 rounded mt-1">
                          ⚠️ {log.error_message}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Create / Edit Modal Dialog */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingReminder ? 'Editar Recordatorio' : 'Crear Nuevo Recordatorio'}
        maxWidth="600px"
      >
        <form onSubmit={handleSave} className="space-y-4">
          
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre / Título del Recordatorio *</label>
            <input
              type="text"
              required
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="Ej. Recordatorio Matutino de Quirófano"
              className="w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Event Hookup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Type */}
            <div className={formTargetType === 'general' ? 'md:col-span-2' : ''}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo de Evento *</label>
              <select
                value={formTargetType}
                onChange={e => {
                  setFormTargetType(e.target.value as any)
                  setFormTargetId('') // Reset target id when changing type
                }}
                className="w-full rounded-xl border border-gray-200 p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="surgery">Cirugía (Cirugías)</option>
                <option value="congress">Congreso (Congresos)</option>
                <option value="workshop">Taller (Congress Workshops)</option>
                <option value="general">General (Sin Vincular a Evento)</option>
              </select>
            </div>

            {/* Target Event Selection */}
            {formTargetType !== 'general' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Vincular a Evento Específico *</label>
                <select
                  required
                  value={formTargetId}
                  onChange={e => setFormTargetId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Selecciona Evento --</option>
                  {getEventOptions().map(opt => (
                    <option key={opt.id} value={opt.id}>
                      [{opt.dateLabel}] {opt.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Manual Dates Selection for General type */}
          {formTargetType === 'general' && (
            <div className="p-4 bg-gray-50/60 border border-gray-100 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-gray-700">
                  Seleccionar Fechas de Envío (Opcional)
                </label>
                {formDates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormDates([])}
                    className="text-[10px] text-red-500 hover:underline focus:outline-none"
                  >
                    Limpiar todas
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-400 -mt-1">
                Si no seleccionas ninguna fecha, se enviará todos los días a la hora configurada.
              </p>
              
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateInput}
                  onChange={e => setDateInput(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (dateInput && !formDates.includes(dateInput)) {
                      setFormDates([...formDates, dateInput].sort())
                      setDateInput('')
                    }
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white rounded-xl transition shadow-sm hover:opacity-90 active:scale-95"
                  style={{ backgroundColor: '#0763a9' }}
                >
                  Añadir
                </button>
              </div>

              {formDates.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {formDates.map(date => {
                    const [y, m, dayVal] = date.split('-')
                    return (
                      <span
                        key={date}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg border border-blue-100 transition hover:bg-blue-100/50"
                      >
                        {`${dayVal}/${m}/${y}`}
                        <button
                          type="button"
                          onClick={() => setFormDates(formDates.filter(d => d !== date))}
                          className="hover:text-red-600 focus:outline-none font-bold text-sm leading-none"
                        >
                          &times;
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Time Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Hora de Envío (Hora Centro de México) *</label>
            <div className="relative max-w-[160px]">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Clock size={16} />
              </span>
              <input
                type="time"
                required
                value={formTime}
                onChange={e => setFormTime(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Se enviará cada día que dure el evento a la hora seleccionada (el valor predeterminado es 17:00 / 5pm).
            </p>
          </div>

          {/* Template Variables Helper */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-700">Contenido del Mensaje (WhatsApp) *</label>
              <span className="text-[10px] font-semibold text-blue-600 flex items-center gap-1">
                <MessageSquare size={12} />
                Variables disponibles
              </span>
            </div>
            
            {/* Helper buttons */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => insertPlaceholder('{nombre_evento}')}
                className="px-2.5 py-1 text-[10px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition border border-blue-100"
              >
                🏷️ Evento
              </button>
              {formTargetType === 'surgery' && (
                <>
                  <button
                    type="button"
                    onClick={() => insertPlaceholder('{medico}')}
                    className="px-2.5 py-1 text-[10px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition border border-blue-100"
                  >
                    👨‍⚕️ Médico
                  </button>
                  <button
                    type="button"
                    onClick={() => insertPlaceholder('{fecha}')}
                    className="px-2.5 py-1 text-[10px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition border border-blue-100"
                  >
                    📅 Fecha/Hora
                  </button>
                </>
              )}
              {formTargetType === 'congress' && (
                <>
                  <button
                    type="button"
                    onClick={() => insertPlaceholder('{ubicacion}')}
                    className="px-2.5 py-1 text-[10px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition border border-blue-100"
                  >
                    📍 Ubicación
                  </button>
                  <button
                    type="button"
                    onClick={() => insertPlaceholder('{fecha_inicio}')}
                    className="px-2.5 py-1 text-[10px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition border border-blue-100"
                  >
                    📅 Inicio
                  </button>
                  <button
                    type="button"
                    onClick={() => insertPlaceholder('{fecha_fin}')}
                    className="px-2.5 py-1 text-[10px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition border border-blue-100"
                  >
                    📅 Fin
                  </button>
                </>
              )}
              {formTargetType === 'workshop' && (
                <>
                  <button
                    type="button"
                    onClick={() => insertPlaceholder('{profesor}')}
                    className="px-2.5 py-1 text-[10px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition border border-blue-100"
                  >
                    👨‍🏫 Profesor
                  </button>
                  <button
                    type="button"
                    onClick={() => insertPlaceholder('{fecha}')}
                    className="px-2.5 py-1 text-[10px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition border border-blue-100"
                  >
                    📅 Fecha/Hora
                  </button>
                </>
              )}
            </div>

            <textarea
              ref={textareaRef}
              required
              rows={4}
              value={formMessage}
              onChange={e => setFormMessage(e.target.value)}
              placeholder="Escribe el mensaje aquí. Puedes arrastrar o dar clic en los botones de arriba para usar variables. Ej: Hola, recuerda que hoy tenemos el taller {nombre_evento} con el profesor {profesor}."
              className="w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-sans"
            />
            <p className="text-[10px] text-gray-500 mt-1.5 pl-1 flex items-center gap-1">
              <span>💡</span>
              <span>El mensaje se enviará integrado en la plantilla oficial de respond.io (<strong className="font-semibold text-blue-600">recordatorio_general_staff</strong>).</span>
            </p>
          </div>

          {/* Participant Notifications settings */}
          <div className="bg-blue-50/50 p-4 border border-blue-100 rounded-xl space-y-3">
            {formTargetType !== 'general' && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="notify_all"
                    checked={formNotifyAll}
                    onChange={e => setFormNotifyAll(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 w-4 h-4"
                  />
                  <label htmlFor="notify_all" className="text-xs font-semibold text-gray-700 cursor-pointer">
                    Notificar a los participantes inscritos en el evento (Recomendado)
                  </label>
                </div>
                <p className="text-[10px] text-gray-500 pl-6 -mt-1">
                  Envía el recordatorio a los usuarios inscritos o miembros del staff asignados al equipo del evento (ej. cirugia_equipo, congreso_members, congress_workshop_members).
                </p>

                <hr className="border-blue-100 my-2" />
              </>
            )}

            {/* Extra contacts grid */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {formTargetType === 'general' ? 'Destinatarios (Personal Staff) *' : 'Destinatarios Adicionales (Personal Staff)'}
              </label>
              {staff.length === 0 ? (
                <p className="text-[10px] text-gray-400 italic">No hay personal cargado en el sistema.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                  {staff.map(person => {
                    const isChecked = formExtraContacts.includes(person.id)
                    const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim() || person.email
                    return (
                      <div
                        key={person.id}
                        onClick={() => toggleStaffContact(person.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition ${
                          isChecked
                            ? 'bg-blue-100/50 border-blue-400 text-blue-900 font-medium'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 w-3 h-3"
                        />
                        <span className="truncate" title={fullName}>{fullName}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Active status */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="active_status"
              checked={formActive}
              onChange={e => setFormActive(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 w-4 h-4"
            />
            <label htmlFor="active_status" className="text-xs font-semibold text-gray-700 cursor-pointer">
              Recordatorio Activo (Listo para enviar en el próximo cron)
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1 px-4 py-2 text-xs font-semibold text-white rounded-xl shadow transition"
              style={{ backgroundColor: '#0763a9' }}
            >
              {isSubmitting && <Loader2 size={12} className="animate-spin" />}
              {editingReminder ? 'Guardar Cambios' : 'Crear Recordatorio'}
            </button>
          </div>

        </form>
      </Modal>
    </AppShell>
  )
}
