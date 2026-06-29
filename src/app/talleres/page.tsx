'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Calendar, Users, DollarSign, BookOpen, Trash2, Edit, QrCode, ExternalLink, X, Loader2, Mail, Phone, Check, Award } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/contexts/I18nContext'
import Modal from '@/components/Modal'
import SearchableSelect from '@/components/SearchableSelect'
import { QRCodeSVG } from 'qrcode.react'
import DiplomaBuilder from './_components/DiplomaBuilder'
import DiplomaGeneratorModal from './_components/DiplomaGeneratorModal'

interface Workshop {
  id: string
  name: string
  date_time: string
  end_date_time?: string | null
  max_people: number
  cost: number | null
  congress_id: string | null
  congresos?: { name: string }
  _count?: { congress_workshop_enrollments: number }
  congress_workshop_doctors?: { doctors: { name: string } }[]
  flyer?: string | null
  description?: string | null
  diploma_template?: any
  professor: string
}

export default function TalleresPage() {
  const { t } = useI18n()
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal States
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false)
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [selectedWorkshop, setSelectedWorkshop] = useState<Workshop | null>(null)

  // Diploma States
  const [isDiplomaBuilderOpen, setIsDiplomaBuilderOpen] = useState(false)
  const [isDiplomaGeneratorOpen, setIsDiplomaGeneratorOpen] = useState(false)
  const [selectedStudentName, setSelectedStudentName] = useState('')

  const handleOpenDiplomaBuilder = (workshop: Workshop) => {
    setSelectedWorkshop(workshop)
    setIsDiplomaBuilderOpen(true)
  }

  const handleGenerateDiploma = (studentName: string) => {
    setSelectedStudentName(studentName)
    setIsDiplomaGeneratorOpen(true)
  }

  const handleDiplomaSave = (updatedTemplate: any) => {
    if (selectedWorkshop) {
      setWorkshops(prev => prev.map(w => 
        w.id === selectedWorkshop.id 
          ? { ...w, diploma_template: updatedTemplate } 
          : w
      ))
      setSelectedWorkshop(prev => prev ? { ...prev, diploma_template: updatedTemplate } : null)
    }
  }

  // Attendance management states
  const [enrolledUsers, setEnrolledUsers] = useState<any[]>([])
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false)

  // Quick client creation inside attendance modal
  const [isCreatingNewClient, setIsCreatingNewClient] = useState(false)
  const [newClientForm, setNewClientForm] = useState({ name: '', email: '', phone: '' })
  const [isSubmittingNewClient, setIsSubmittingNewClient] = useState(false)

  const fetchWorkshops = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/workshops')
      if (res.ok) {
        const { data } = await res.json()
        setWorkshops(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients?pageSize=1000')
      if (res.ok) {
        const { data } = await res.json()
        setClients(data || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchWorkshops()
    fetchClients()
  }, [])

  const filtered = workshops.filter(w => 
    w.name.toLowerCase().includes(search.toLowerCase()) || 
    (w.congresos?.name && w.congresos.name.toLowerCase().includes(search.toLowerCase()))
  )

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este taller?')) return
    try {
      const res = await fetch(`/api/workshops/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setWorkshops(prev => prev.filter(w => w.id !== id))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchWorkshopDetails = async (id: string) => {
    setIsLoadingDetails(true)
    try {
      const res = await fetch(`/api/workshops/${id}`)
      if (res.ok) {
        const { data } = await res.json()
        setEnrolledUsers(data.congress_workshop_enrollments || [])
        // Update main list count as well
        setWorkshops(prev => prev.map(w => 
          w.id === id 
            ? { ...w, _count: { congress_workshop_enrollments: data.congress_workshop_enrollments.length } } 
            : w
        ))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const handleOpenAttendance = (workshop: Workshop) => {
    setSelectedWorkshop(workshop)
    setIsAttendanceModalOpen(true)
    setIsCreatingNewClient(false)
    setNewClientForm({ name: '', email: '', phone: '' })
    setSelectedClient('')
    fetchWorkshopDetails(workshop.id)
  }

  const handleOpenQr = (workshop: Workshop) => {
    setSelectedWorkshop(workshop)
    setIsQrModalOpen(true)
  }

  const handleEnroll = async (clientId: string) => {
    if (!selectedWorkshop) return
    setIsSubmittingEnrollment(true)
    try {
      const res = await fetch(`/api/workshops/${selectedWorkshop.id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId })
      })
      if (res.ok) {
        await fetchWorkshopDetails(selectedWorkshop.id)
        setSelectedClient('')
      } else {
        const err = await res.json()
        alert('Error: ' + err.error)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmittingEnrollment(false)
    }
  }

  const handleUnenroll = async (clientId: string) => {
    if (!selectedWorkshop) return
    if (!confirm('¿Seguro que deseas desinscribir a esta persona?')) return
    try {
      const res = await fetch(`/api/workshops/${selectedWorkshop.id}/enroll?clientId=${clientId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        await fetchWorkshopDetails(selectedWorkshop.id)
      } else {
        const err = await res.json()
        alert('Error: ' + err.error)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateAndEnroll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWorkshop) return
    setIsSubmittingNewClient(true)
    try {
      const clientRes = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClientForm.name,
          email_primary: newClientForm.email,
          phone: newClientForm.phone,
          status: 'Nuevo Prospecto',
          source: 'Registro Taller Admin'
        })
      })

      if (!clientRes.ok) {
        const err = await clientRes.json()
        throw new Error(err.error || 'Error al crear cliente')
      }

      const { data: newClient } = await clientRes.json()

      const enrollRes = await fetch(`/api/workshops/${selectedWorkshop.id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: newClient.id })
      })

      if (enrollRes.ok) {
        await fetchWorkshopDetails(selectedWorkshop.id)
        setNewClientForm({ name: '', email: '', phone: '' })
        setIsCreatingNewClient(false)
        fetchClients()
      } else {
        const err = await enrollRes.json()
        alert('Cliente creado pero error al inscribir: ' + err.error)
      }
    } catch (err: any) {
      console.error(err)
      alert(err.message)
    } finally {
      setIsSubmittingNewClient(false)
    }
  }

  const getPublicUrl = (id: string) => {
    if (typeof window === 'undefined') return `/talleres/${id}/landing`
    return `${window.location.origin}/talleres/${id}/landing`
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <BookOpen className="text-blue-600" size={28} />
              {t('talleres')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{t('workshopsDirectory')}</p>
          </div>
          <Link href="/talleres/new" className="btn-primary flex items-center gap-2">
            <Plus size={18} /> {t('createWorkshop')}
          </Link>
        </header>

        <div className="card p-4 flex items-center gap-3">
          <Search size={20} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder={t('searchWorkshop')}
            className="w-full bg-transparent border-none focus:outline-none text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="card p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-16 text-center text-gray-500">
            {t('noWorkshopsFound')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(w => {
              const date = new Date(w.date_time)
              const docNames = w.congress_workshop_doctors?.map(d => d.doctors.name).join(', ') || 'Sin doctor asignado'
              const enrollCount = w._count?.congress_workshop_enrollments || 0

              return (
                <div key={w.id} className="card p-5 hover:border-blue-200 transition-colors group flex flex-col h-full relative overflow-hidden">
                  <div className="flex-1">
                    {w.congress_id && (
                      <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold uppercase rounded mb-2">
                        Congreso: {w.congresos?.name}
                      </span>
                    )}
                    <h3 className="font-bold text-lg text-gray-900 leading-tight mb-2 pr-16">{w.name}</h3>
                    
                    <div className="space-y-2 mt-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-blue-500" />
                        <span>
                          {(() => {
                            const dStart = new Date(w.date_time)
                            const dEnd = w.end_date_time ? new Date(w.end_date_time) : null
                            const startStr = `${dStart.toLocaleDateString('es-MX')} ${dStart.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                            if (dEnd && !isNaN(dEnd.getTime())) {
                              const sameDay = dStart.toDateString() === dEnd.toDateString()
                              if (sameDay) {
                                return `${startStr} - ${dEnd.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                              } else {
                                return `${startStr} - ${dEnd.toLocaleDateString('es-MX')} ${dEnd.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                              }
                            }
                            return startStr
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-blue-500" />
                        <span className="truncate">Docente: <span className="font-medium text-gray-900">{docNames}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-blue-500" />
                        <span>Cupo: {enrollCount} / {w.max_people}</span>
                      </div>
                      {w.cost !== null && (
                        <div className="flex items-center gap-2">
                          <DollarSign size={14} className="text-green-500" />
                          <span className="font-medium text-green-700">${Number(w.cost).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 font-sans">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleOpenAttendance(w)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Users size={14} /> Asistentes
                      </button>
                      <button 
                        onClick={() => handleOpenDiplomaBuilder(w)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold transition-colors"
                        title="Diseñar Diploma"
                      >
                        <Award size={14} /> Diploma
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleOpenQr(w)}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Ver Código QR"
                      >
                        <QrCode size={16} />
                      </button>
                      <Link href={`/talleres/${w.id}`} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit size={16} />
                      </Link>
                      <button onClick={() => handleDelete(w.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <a 
                    href={getPublicUrl(w.id)} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors inline-flex items-center gap-1 text-[10px] font-semibold"
                  >
                    Pública <ExternalLink size={12} />
                  </a>
                </div>
              )
            })}
          </div>
        )}

        {/* Attendance Modal */}
        <Modal 
          open={isAttendanceModalOpen} 
          onClose={() => setIsAttendanceModalOpen(false)}
          title={`Control de Asistentes - ${selectedWorkshop?.name}`}
          maxWidth="650px"
        >
          <div className="space-y-6">
            {/* Limit Banner */}
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
              <span className="text-sm text-gray-600">Cupo Registrado:</span>
              <span className="text-base font-bold text-gray-900">
                {enrolledUsers.length} / {selectedWorkshop?.max_people}
              </span>
            </div>

            {/* Quick Actions (Enroll / Create Client) */}
            <div className="border-t border-b border-gray-100 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Inscribir Participante</h3>
                <button 
                  type="button" 
                  onClick={() => setIsCreatingNewClient(!isCreatingNewClient)}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  {isCreatingNewClient ? 'Seleccionar existente' : '+ Crear nuevo cliente'}
                </button>
              </div>

              {!isCreatingNewClient ? (
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <SearchableSelect 
                      placeholder="Buscar cliente..."
                      options={clients.map(c => ({ value: c.id, label: `${c.name} (${c.email_primary || 'Sin correo'})` }))}
                      value={selectedClient}
                      onChange={setSelectedClient}
                    />
                  </div>
                  <button 
                    disabled={!selectedClient || isSubmittingEnrollment}
                    onClick={() => handleEnroll(selectedClient)}
                    className="btn-primary py-2.5 px-4 font-semibold text-sm shrink-0"
                  >
                    {isSubmittingEnrollment ? <Loader2 size={16} className="animate-spin" /> : 'Inscribir'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateAndEnroll} className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-blue-700">Registrar y Auto-Inscribir Cliente</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input 
                      required 
                      type="text" 
                      placeholder="Nombre *" 
                      className="erp-input w-full bg-white text-xs py-2"
                      value={newClientForm.name}
                      onChange={e => setNewClientForm({ ...newClientForm, name: e.target.value })}
                    />
                    <input 
                      required 
                      type="email" 
                      placeholder="Correo *" 
                      className="erp-input w-full bg-white text-xs py-2"
                      value={newClientForm.email}
                      onChange={e => setNewClientForm({ ...newClientForm, email: e.target.value })}
                    />
                    <input 
                      type="text" 
                      placeholder="Teléfono" 
                      className="erp-input w-full bg-white text-xs py-2"
                      value={newClientForm.phone}
                      onChange={e => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsCreatingNewClient(false)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmittingNewClient}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-500 flex items-center gap-1"
                    >
                      {isSubmittingNewClient ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Registrar
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Registered Attendees List */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900">Asistentes Inscritos</h3>
              {isLoadingDetails ? (
                <div className="flex justify-center p-6"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
              ) : enrolledUsers.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-6">No hay participantes inscritos en este taller.</p>
              ) : (
                <div className="border border-gray-150 rounded-2xl divide-y divide-gray-100 overflow-hidden bg-white max-h-80 overflow-y-auto">
                  {enrolledUsers.map((enroll) => {
                    const client = enroll.clients
                    if (!client) return null
                    return (
                      <div key={enroll.id} className="p-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{client.name}</p>
                          <div className="flex gap-4 text-xs text-gray-500 mt-0.5">
                            {client.email_primary && <span className="flex items-center gap-1"><Mail size={12} /> {client.email_primary}</span>}
                            {client.phone && <span className="flex items-center gap-1"><Phone size={12} /> {client.phone}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <button 
                            onClick={() => handleGenerateDiploma(client.name)}
                            className="p-1.5 text-amber-600 hover:text-amber-750 hover:bg-amber-55 rounded-md transition-colors"
                            title="Generar Diploma"
                          >
                            <Award size={16} />
                          </button>
                          <button 
                            onClick={() => handleUnenroll(client.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Eliminar del taller"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            
            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button onClick={() => setIsAttendanceModalOpen(false)} className="btn-secondary">
                Cerrar
              </button>
            </div>
          </div>
        </Modal>

        {/* QR Code Modal */}
        <Modal 
          open={isQrModalOpen} 
          onClose={() => setIsQrModalOpen(false)}
          title="Código QR del Taller"
        >
          <div className="flex flex-col items-center justify-center p-4 space-y-6 text-center">
            <p className="text-sm text-gray-600">
              Escanea este código QR para abrir directamente la Landing Page de registro para este taller:<br/>
              <strong className="text-[#0763a9] text-xs font-mono block mt-2 break-all">{selectedWorkshop && getPublicUrl(selectedWorkshop.id)}</strong>
            </p>
            
            {selectedWorkshop && (
              <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
                <QRCodeSVG 
                  value={getPublicUrl(selectedWorkshop.id)} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
            )}
            
            <div className="flex gap-2 w-full pt-4">
              <button 
                onClick={() => setIsQrModalOpen(false)} 
                className="btn-secondary w-full justify-center"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>

        {/* Diploma Builder Modal */}
        {selectedWorkshop && isDiplomaBuilderOpen && (
          <DiplomaBuilder 
            isOpen={isDiplomaBuilderOpen}
            onClose={() => setIsDiplomaBuilderOpen(false)}
            taller={selectedWorkshop}
            onSave={handleDiplomaSave}
          />
        )}

        {/* Diploma Generator Modal */}
        {selectedWorkshop && isDiplomaGeneratorOpen && (
          <DiplomaGeneratorModal 
            isOpen={isDiplomaGeneratorOpen}
            onClose={() => setIsDiplomaGeneratorOpen(false)}
            studentName={selectedStudentName}
            taller={selectedWorkshop}
          />
        )}

      </div>
    </AppShell>
  )
}
