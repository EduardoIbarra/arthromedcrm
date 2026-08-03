'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  Car,
  Wrench,
  AlertTriangle,
  History,
  ArrowLeft,
  Plus,
  Calendar,
  DollarSign,
  User,
  CheckCircle2,
  Clock,
  FileText,
  Printer,
  Loader2,
  MapPin,
  Stethoscope,
  GraduationCap,
  Building2,
  ExternalLink,
  ChevronRight
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { useI18n } from '@/contexts/I18nContext'
import { CarFleetMaintenance, CarFleetIncident } from '@/types/database'

interface CarDetail {
  id: string
  alias: string | null
  make: string
  model: string
  year: number
  plate_number: string
  color: string | null
  status: string
  notes: string | null
  assigned_to_id: string | null
  assigned_to?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
    position: string | null
    whatsapp: string | null
  } | null
  maintenance_logs: CarFleetMaintenance[]
  incident_logs: CarFleetIncident[]
  usage_logs: Array<{
    id: string
    type: 'cirugia' | 'taller' | 'congreso' | 'manual'
    title: string
    subtitle?: string
    date: string
    location?: string
    driverName?: string
    status?: string
    linkUrl?: string
    notes?: string
  }>
}

export default function CarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t } = useI18n()

  const [car, setCar] = useState<CarDetail | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'maintenance' | 'incidents' | 'usage'>('maintenance')

  // Modals state
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false)
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false)
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form States
  const [maintenanceForm, setMaintenanceForm] = useState({
    title: '',
    type: 'preventive',
    description: '',
    cost: '',
    status: 'scheduled',
    date: new Date().toISOString().split('T')[0],
    next_due_date: '',
    performed_by: '',
    notes: ''
  })

  const [incidentForm, setIncidentForm] = useState({
    title: '',
    severity: 'minor',
    description: '',
    date: new Date().toISOString().split('T')[0],
    cost: '',
    status: 'open',
    reported_by_id: '',
    notes: ''
  })

  const [usageForm, setUsageForm] = useState({
    title: '',
    user_id: '',
    date_time: new Date().toISOString().slice(0, 16),
    location: '',
    notes: ''
  })

  const fetchCarDetail = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/car-fleet/${id}`)
      if (res.ok) {
        const { data } = await res.json()
        setCar(data)
      } else {
        console.error('Error fetching car detail')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/cirugias/usuarios')
      if (res.ok) {
        const { data } = await res.json()
        setUsers(data || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchCarDetail()
    fetchUsers()
  }, [id])

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!maintenanceForm.title || !maintenanceForm.date) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/car-fleet/${id}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maintenanceForm)
      })
      if (res.ok) {
        setIsMaintenanceModalOpen(false)
        setMaintenanceForm({
          title: '',
          type: 'preventive',
          description: '',
          cost: '',
          status: 'scheduled',
          date: new Date().toISOString().split('T')[0],
          next_due_date: '',
          performed_by: '',
          notes: ''
        })
        fetchCarDetail()
      } else {
        const err = await res.json()
        alert('Error: ' + err.error)
      }
    } catch (err) {
      console.error(err)
      alert('Error guardando mantenimiento')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveIncident = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!incidentForm.title || !incidentForm.description || !incidentForm.date) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/car-fleet/${id}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incidentForm)
      })
      if (res.ok) {
        setIsIncidentModalOpen(false)
        setIncidentForm({
          title: '',
          severity: 'minor',
          description: '',
          date: new Date().toISOString().split('T')[0],
          cost: '',
          status: 'open',
          reported_by_id: '',
          notes: ''
        })
        fetchCarDetail()
      } else {
        const err = await res.json()
        alert('Error: ' + err.error)
      }
    } catch (err) {
      console.error(err)
      alert('Error guardando incidencia')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveUsage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usageForm.title || !usageForm.date_time) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/car-fleet/${id}/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usageForm)
      })
      if (res.ok) {
        setIsUsageModalOpen(false)
        setUsageForm({
          title: '',
          user_id: '',
          date_time: new Date().toISOString().slice(0, 16),
          location: '',
          notes: ''
        })
        fetchCarDetail()
      } else {
        const err = await res.json()
        alert('Error: ' + err.error)
      }
    } catch (err) {
      console.error(err)
      alert('Error guardando registro de uso')
    } finally {
      setIsSaving(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'in_use':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'maintenance':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available':
        return t('available') || 'Disponible'
      case 'in_use':
        return t('in_use') || 'En Uso'
      case 'maintenance':
        return t('maintenance') || 'Mantenimiento'
      default:
        return status
    }
  }

  const getMaintenanceTypeBadge = (type: string) => {
    switch (type) {
      case 'preventive':
        return { label: 'Preventivo', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      case 'corrective':
        return { label: 'Correctivo', class: 'bg-rose-50 text-rose-700 border-rose-200' }
      case 'service':
        return { label: 'Servicio / Afinación', class: 'bg-blue-50 text-blue-700 border-blue-200' }
      case 'inspection':
        return { label: 'Verificación / Inspección', class: 'bg-purple-50 text-purple-700 border-purple-200' }
      case 'tire_change':
        return { label: 'Llantas', class: 'bg-amber-50 text-amber-700 border-amber-200' }
      default:
        return { label: type, class: 'bg-gray-50 text-gray-700 border-gray-200' }
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'minor':
        return { label: 'Leve', class: 'bg-blue-50 text-blue-700 border-blue-200' }
      case 'moderate':
        return { label: 'Moderada', class: 'bg-amber-50 text-amber-700 border-amber-200' }
      case 'severe':
        return { label: 'Grave', class: 'bg-red-50 text-red-700 border-red-200' }
      default:
        return { label: severity, class: 'bg-gray-50 text-gray-700 border-gray-200' }
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 size={36} className="animate-spin text-[#0763a9]" />
        </div>
      </AppShell>
    )
  }

  if (!car) {
    return (
      <AppShell>
        <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
          <p className="text-gray-500">Vehículo no encontrado.</p>
          <Link href="/car-fleet" className="btn-primary inline-flex items-center gap-2">
            <ArrowLeft size={16} /> Volver a Flota Vehicular
          </Link>
        </div>
      </AppShell>
    )
  }

  // Calculate maintenance metrics
  const completedMaintenance = car.maintenance_logs?.filter(m => m.status === 'completed') || []
  const totalMaintenanceCost = completedMaintenance.reduce((acc, m) => acc + (Number(m.cost) || 0), 0)
  const scheduledMaintenance = car.maintenance_logs?.filter(m => m.status === 'scheduled' || m.status === 'in_progress') || []
  const totalIncidentCost = (car.incident_logs || []).reduce((acc, inc) => acc + (Number(inc.cost) || 0), 0)

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">
        {/* Header navigation */}
        <div className="flex items-center justify-between">
          <Link href="/car-fleet" className="text-sm font-semibold text-gray-500 hover:text-[#0763a9] flex items-center gap-2 transition-colors">
            <ArrowLeft size={16} /> Volver a la Lista de Flota
          </Link>
          <div className="flex items-center gap-3">
            <a
              href={`/api/car-fleet/${car.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs flex items-center gap-2 bg-white hover:bg-gray-50 border-gray-300 text-gray-700 shadow-sm"
            >
              <Printer size={15} /> Exportar PDF
            </a>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeColor(car.status)}`}>
              {getStatusLabel(car.status)}
            </span>
          </div>
        </div>

        {/* Vehicle Main Info Banner */}
        <div className="card p-6 border-l-4 border-l-[#0763a9] bg-gradient-to-r from-white via-white to-blue-50/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-blue-100/70 text-[#0763a9] rounded-2xl">
                <Car size={32} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight">
                  {car.alias || `${car.make} ${car.model}`}
                </h1>
                {car.alias && (
                  <p className="text-sm font-medium text-gray-500">{car.make} {car.model} ({car.year})</p>
                )}
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-600">
                  <span className="bg-gray-100 px-2.5 py-1 rounded font-mono font-bold text-gray-800 border border-gray-200">
                    Placas: {car.plate_number}
                  </span>
                  {car.color && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border border-gray-300 inline-block" style={{ backgroundColor: car.color.toLowerCase() }} />
                      Color: {car.color}
                    </span>
                  )}
                  <span>Año: {car.year}</span>
                </div>
              </div>
            </div>

            {/* Assigned conductor profile card */}
            <div className="bg-white/80 border border-gray-200 p-3.5 rounded-xl flex items-center gap-3 min-w-[240px]">
              <div className="p-2 bg-gray-100 text-gray-600 rounded-full">
                <User size={20} />
              </div>
              <div className="text-xs">
                <span className="text-gray-400 block text-[10px] font-semibold uppercase tracking-wider">Conductor Asignado</span>
                {car.assigned_to ? (
                  <div>
                    <span className="font-bold text-gray-900 block">
                      {car.assigned_to.first_name || car.assigned_to.last_name
                        ? `${car.assigned_to.first_name || ''} ${car.assigned_to.last_name || ''}`.trim()
                        : car.assigned_to.email}
                    </span>
                    {car.assigned_to.position && (
                      <span className="text-gray-500 block">{car.assigned_to.position}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-400 italic">No asignado</span>
                )}
              </div>
            </div>
          </div>

          {car.notes && (
            <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600 bg-gray-50/70 p-3 rounded-lg">
              <span className="font-semibold text-gray-700">Notas Generales: </span>
              {car.notes}
            </div>
          )}
        </div>

        {/* Quick Statistics Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Wrench size={20} />
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Mantenimientos Realizados</span>
              <span className="text-lg font-bold text-gray-900">{completedMaintenance.length}</span>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Clock size={20} />
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Programados</span>
              <span className="text-lg font-bold text-gray-900">{scheduledMaintenance.length}</span>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle size={20} />
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Incidencias Reportadas</span>
              <span className="text-lg font-bold text-gray-900">{car.incident_logs?.length || 0}</span>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <History size={20} />
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Usos Registrados</span>
              <span className="text-lg font-bold text-gray-900">{car.usage_logs?.length || 0}</span>
            </div>
          </div>
        </div>

        {/* Tab Header & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-3">
          <div className="flex gap-2 bg-gray-100/80 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('maintenance')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'maintenance' ? 'bg-white text-[#0763a9] shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Wrench size={16} /> Mantenimientos ({car.maintenance_logs?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('incidents')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'incidents' ? 'bg-white text-[#0763a9] shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <AlertTriangle size={16} /> Incidencias ({car.incident_logs?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('usage')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'usage' ? 'bg-white text-[#0763a9] shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <History size={16} /> Historial de Uso ({car.usage_logs?.length || 0})
            </button>
          </div>

          <div>
            {activeTab === 'maintenance' && (
              <button onClick={() => setIsMaintenanceModalOpen(true)} className="btn-primary text-xs flex items-center gap-2">
                <Plus size={16} /> Registrar Mantenimiento
              </button>
            )}
            {activeTab === 'incidents' && (
              <button onClick={() => setIsIncidentModalOpen(true)} className="btn-primary text-xs flex items-center gap-2 bg-rose-600 hover:bg-rose-700 border-rose-600">
                <Plus size={16} /> Registrar Incidencia
              </button>
            )}
            {activeTab === 'usage' && (
              <button onClick={() => setIsUsageModalOpen(true)} className="btn-primary text-xs flex items-center gap-2">
                <Plus size={16} /> Registrar Uso Manual
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Maintenance Logs & Follow-ups */}
        {activeTab === 'maintenance' && (
          <div className="space-y-4">
            {car.maintenance_logs && car.maintenance_logs.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {car.maintenance_logs.map(log => {
                  const badge = getMaintenanceTypeBadge(log.type)
                  return (
                    <div key={log.id} className="card p-5 hover:border-blue-200 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${badge.class}`}>
                              {badge.label}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                              log.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                              log.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              log.status === 'cancelled' ? 'bg-gray-100 text-gray-600' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {log.status === 'completed' ? 'Completado' :
                               log.status === 'in_progress' ? 'En Proceso' :
                               log.status === 'cancelled' ? 'Cancelado' : 'Programado'}
                            </span>
                          </div>

                          <h4 className="text-base font-bold text-gray-900">{log.title}</h4>
                          {log.description && (
                            <p className="text-sm text-gray-600">{log.description}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap md:flex-col md:items-end justify-between text-xs text-gray-500 gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-gray-100">
                          <div className="flex items-center gap-1 font-semibold text-gray-700">
                            <Calendar size={14} className="text-gray-400" />
                            Fecha: {new Date(log.date).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </div>

                          {log.next_due_date && (
                            <div className="flex items-center gap-1 text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <Clock size={13} />
                              Próximo Servicio: {new Date(log.next_due_date).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </div>
                          )}

                          {log.cost !== null && log.cost !== undefined && (
                            <div className="font-mono font-bold text-sm text-gray-900">
                              Cost: ${Number(log.cost).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </div>
                          )}

                          {log.performed_by && (
                            <div className="text-gray-500">
                              Realizado por: <span className="font-medium text-gray-800">{log.performed_by}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {log.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 italic bg-gray-50 p-2.5 rounded-lg">
                          Notas: {log.notes}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="card p-12 text-center text-gray-500 bg-gray-50 border-dashed">
                <Wrench size={36} className="mx-auto text-gray-300 mb-2" />
                <p className="font-semibold">Sin mantenimientos registrados</p>
                <p className="text-xs text-gray-400 mt-1">Registra revisiones preventivas, servicios o reparaciones para dar seguimiento vehicular.</p>
                <button onClick={() => setIsMaintenanceModalOpen(true)} className="btn-primary text-xs mt-4 inline-flex items-center gap-2">
                  <Plus size={16} /> Registrar Primer Mantenimiento
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Incident Logs */}
        {activeTab === 'incidents' && (
          <div className="space-y-4">
            {car.incident_logs && car.incident_logs.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {car.incident_logs.map(inc => {
                  const severityBadge = getSeverityBadge(inc.severity)
                  return (
                    <div key={inc.id} className="card p-5 border-l-4 border-l-rose-500 hover:border-rose-300 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${severityBadge.class}`}>
                              Gravedad: {severityBadge.label}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                              inc.status === 'resolved' || inc.status === 'closed' ? 'bg-emerald-100 text-emerald-800' :
                              inc.status === 'under_review' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {inc.status === 'resolved' ? 'Resuelto' :
                               inc.status === 'closed' ? 'Cerrado' :
                               inc.status === 'under_review' ? 'En Revisión' : 'Abierto'}
                            </span>
                          </div>

                          <h4 className="text-base font-bold text-gray-900">{inc.title}</h4>
                          <p className="text-sm text-gray-700 bg-rose-50/50 p-2.5 rounded-lg border border-rose-100/50">
                            {inc.description}
                          </p>
                        </div>

                        <div className="flex flex-wrap md:flex-col md:items-end justify-between text-xs text-gray-500 gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-gray-100">
                          <div className="flex items-center gap-1 font-semibold text-gray-700">
                            <Calendar size={14} className="text-gray-400" />
                            Fecha: {new Date(inc.date).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </div>

                          {inc.cost !== null && inc.cost !== undefined && (
                            <div className="font-mono font-bold text-sm text-rose-700">
                              Costo / Daño: ${Number(inc.cost).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </div>
                          )}

                          {inc.reported_by && (
                            <div className="text-gray-500">
                              Reportado por: <span className="font-medium text-gray-800">
                                {inc.reported_by.first_name || inc.reported_by.last_name
                                  ? `${inc.reported_by.first_name || ''} ${inc.reported_by.last_name || ''}`.trim()
                                  : inc.reported_by.email}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {inc.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 italic bg-gray-50 p-2 rounded">
                          Seguimiento / Notas: {inc.notes}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="card p-12 text-center text-gray-500 bg-gray-50 border-dashed">
                <AlertTriangle size={36} className="mx-auto text-gray-300 mb-2" />
                <p className="font-semibold">Sin incidencias ni percances reportados</p>
                <p className="text-xs text-gray-400 mt-1">Este vehículo no presenta ningún reporte de choque, rayón, multa o falla técnica.</p>
                <button onClick={() => setIsIncidentModalOpen(true)} className="btn-primary text-xs mt-4 inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 border-rose-600">
                  <Plus size={16} /> Reportar Incidencia
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Usage History (Cirugias, Talleres, Congresos) */}
        {activeTab === 'usage' && (
          <div className="space-y-4">
            {car.usage_logs && car.usage_logs.length > 0 ? (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="p-4">Tipo / Evento</th>
                        <th className="p-4">Fecha</th>
                        <th className="p-4">Ubicación / Sede</th>
                        <th className="p-4">Asignado a / Conductor</th>
                        <th className="p-4 text-right">Ver</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {car.usage_logs.map(log => {
                        return (
                          <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                {log.type === 'cirugia' && (
                                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                    <Stethoscope size={18} />
                                  </div>
                                )}
                                {log.type === 'taller' && (
                                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <GraduationCap size={18} />
                                  </div>
                                )}
                                {log.type === 'congreso' && (
                                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                    <Building2 size={18} />
                                  </div>
                                )}
                                {log.type === 'manual' && (
                                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                                    <Car size={18} />
                                  </div>
                                )}

                                <div>
                                  <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                    {log.title}
                                    {log.type === 'manual' && (
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                                        Manual
                                      </span>
                                    )}
                                    {log.status && (
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-normal">
                                        {log.status}
                                      </span>
                                    )}
                                  </div>
                                  {log.subtitle && (
                                    <div className="text-xs text-gray-500">{log.subtitle}</div>
                                  )}
                                  {log.notes && (
                                    <div className="text-xs text-gray-500 italic mt-0.5">{log.notes}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-xs font-medium text-gray-700 whitespace-nowrap">
                              {log.date ? new Date(log.date).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>
                            <td className="p-4 text-xs text-gray-600">
                              {log.location ? (
                                <span className="flex items-center gap-1">
                                  <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                                  {log.location}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">No especificada</span>
                              )}
                            </td>
                            <td className="p-4 text-xs text-gray-700 font-medium">
                              {log.driverName || <span className="text-gray-400 italic">Sin conductor</span>}
                            </td>
                            <td className="p-4 text-right">
                              {log.linkUrl ? (
                                <Link
                                  href={log.linkUrl}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0763a9] hover:underline"
                                >
                                  Ir al Registro <ChevronRight size={14} />
                                </Link>
                              ) : (
                                <span className="text-xs text-gray-400 font-medium">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="card p-12 text-center text-gray-500 bg-gray-50 border-dashed">
                <History size={36} className="mx-auto text-gray-300 mb-2" />
                <p className="font-semibold">Sin registros de uso en el sistema</p>
                <p className="text-xs text-gray-400 mt-1">Este vehículo aún no ha sido asignado en Cirugías, Talleres o Congresos.</p>
                <button onClick={() => setIsUsageModalOpen(true)} className="btn-primary text-xs mt-4 inline-flex items-center gap-2">
                  <Plus size={16} /> Registrar Primer Uso
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal: Add Maintenance */}
        <Modal open={isMaintenanceModalOpen} onClose={() => setIsMaintenanceModalOpen(false)} title="Registrar Mantenimiento / Servicio">
          <form onSubmit={handleSaveMaintenance} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Título del Servicio *</label>
              <input required type="text" className="erp-input w-full" value={maintenanceForm.title} onChange={e => setMaintenanceForm({ ...maintenanceForm, title: e.target.value })} placeholder="Ej. Servicio 10,000 km, Cambio de Llantas" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Mantenimiento</label>
                <select className="erp-input w-full" value={maintenanceForm.type} onChange={e => setMaintenanceForm({ ...maintenanceForm, type: e.target.value })}>
                  <option value="preventive">Mantenimiento Preventivo</option>
                  <option value="corrective">Mantenimiento Correctivo</option>
                  <option value="service">Servicio General / Afinación</option>
                  <option value="inspection">Verificación / Inspección</option>
                  <option value="tire_change">Cambio de Llantas / Frenos</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Estatus del Servicio</label>
                <select className="erp-input w-full" value={maintenanceForm.status} onChange={e => setMaintenanceForm({ ...maintenanceForm, status: e.target.value })}>
                  <option value="scheduled">Programado</option>
                  <option value="in_progress">En Proceso</option>
                  <option value="completed">Completado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Fecha del Servicio *</label>
                <input required type="date" className="erp-input w-full" value={maintenanceForm.date} onChange={e => setMaintenanceForm({ ...maintenanceForm, date: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Próxima Fecha Sugerida</label>
                <input type="date" className="erp-input w-full" value={maintenanceForm.next_due_date} onChange={e => setMaintenanceForm({ ...maintenanceForm, next_due_date: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Costo ($ MXN)</label>
                <input type="number" step="0.01" min="0" className="erp-input w-full" value={maintenanceForm.cost} onChange={e => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })} placeholder="Ej. 2500" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Taller / Realizado por</label>
                <input type="text" className="erp-input w-full" value={maintenanceForm.performed_by} onChange={e => setMaintenanceForm({ ...maintenanceForm, performed_by: e.target.value })} placeholder="Ej. Agenica Agencia Toyota / Taller Central" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Descripción</label>
              <textarea rows={2} className="erp-input w-full" value={maintenanceForm.description} onChange={e => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })} placeholder="Detalles de las piezas cambiadas o servicio efectuado..." />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Notas adicionales</label>
              <textarea rows={2} className="erp-input w-full" value={maintenanceForm.notes} onChange={e => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })} placeholder="Garantía, observaciones adicionales..." />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => setIsMaintenanceModalOpen(false)} className="btn-secondary px-4">Cancelar</button>
              <button type="submit" disabled={isSaving} className="btn-primary">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Guardar Mantenimiento'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Add Incident */}
        <Modal open={isIncidentModalOpen} onClose={() => setIsIncidentModalOpen(false)} title="Reportar Incidencia / Percance">
          <form onSubmit={handleSaveIncident} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Título de la Incidencia *</label>
              <input required type="text" className="erp-input w-full" value={incidentForm.title} onChange={e => setIncidentForm({ ...incidentForm, title: e.target.value })} placeholder="Ej. Ponchadura de llanta, Rayón en portuela, Golpe posterior" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Gravedad</label>
                <select className="erp-input w-full" value={incidentForm.severity} onChange={e => setIncidentForm({ ...incidentForm, severity: e.target.value })}>
                  <option value="minor">Leve (Detalle estético / falla menor)</option>
                  <option value="moderate">Moderado (Requiere reparación)</option>
                  <option value="severe">Grave (Accidente / Inmovilizado)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Estatus</label>
                <select className="erp-input w-full" value={incidentForm.status} onChange={e => setIncidentForm({ ...incidentForm, status: e.target.value })}>
                  <option value="open">Abierto</option>
                  <option value="under_review">En Revisión</option>
                  <option value="resolved">Resuelto</option>
                  <option value="closed">Cerrado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Fecha del Suceso *</label>
                <input required type="date" className="erp-input w-full" value={incidentForm.date} onChange={e => setIncidentForm({ ...incidentForm, date: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Costo Deducible / Reparación ($)</label>
                <input type="number" step="0.01" min="0" className="erp-input w-full" value={incidentForm.cost} onChange={e => setIncidentForm({ ...incidentForm, cost: e.target.value })} placeholder="Ej. 1500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Reportado por (Staff)</label>
              <select className="erp-input w-full" value={incidentForm.reported_by_id} onChange={e => setIncidentForm({ ...incidentForm, reported_by_id: e.target.value })}>
                <option value="">-- Seleccionar --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Descripción del Suceso *</label>
              <textarea required rows={3} className="erp-input w-full" value={incidentForm.description} onChange={e => setIncidentForm({ ...incidentForm, description: e.target.value })} placeholder="Detalla cómo ocurrió y el estado del vehículo..." />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Notas de seguimiento</label>
              <textarea rows={2} className="erp-input w-full" value={incidentForm.notes} onChange={e => setIncidentForm({ ...incidentForm, notes: e.target.value })} placeholder="Número de reporte de seguro, estatus de ajustador..." />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => setIsIncidentModalOpen(false)} className="btn-secondary px-4">Cancelar</button>
              <button type="submit" disabled={isSaving} className="btn-primary bg-rose-600 hover:bg-rose-700 border-rose-600">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Reportar Incidencia'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Add Manual Usage */}
        <Modal open={isUsageModalOpen} onClose={() => setIsUsageModalOpen(false)} title="Registrar Uso Manual de Vehículo">
          <form onSubmit={handleSaveUsage} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Título / Motivo del Uso *</label>
              <input required type="text" className="erp-input w-full" value={usageForm.title} onChange={e => setUsageForm({ ...usageForm, title: e.target.value })} placeholder="Ej. Traslado de muestras, Entrega de equipo, Traslado de personal" />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Conductor / Usuario</label>
              <select className="erp-input w-full" value={usageForm.user_id} onChange={e => setUsageForm({ ...usageForm, user_id: e.target.value })}>
                <option value="">-- Seleccionar Conductor --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Fecha y Hora *</label>
                <input required type="datetime-local" className="erp-input w-full" value={usageForm.date_time} onChange={e => setUsageForm({ ...usageForm, date_time: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Ubicación / Destino</label>
                <input type="text" className="erp-input w-full" value={usageForm.location} onChange={e => setUsageForm({ ...usageForm, location: e.target.value })} placeholder="Ej. Hospital Muguerza, Aeropuerto, Clínica 25" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Notas / Observaciones</label>
              <textarea rows={3} className="erp-input w-full" value={usageForm.notes} onChange={e => setUsageForm({ ...usageForm, notes: e.target.value })} placeholder="Detalles de la ruta, odómetro o motivos específicos..." />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => setIsUsageModalOpen(false)} className="btn-secondary px-4">Cancelar</button>
              <button type="submit" disabled={isSaving} className="btn-primary">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Guardar Registro de Uso'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  )
}
