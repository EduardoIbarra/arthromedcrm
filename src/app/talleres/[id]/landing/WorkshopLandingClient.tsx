'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Users, DollarSign, Clock, FileText, CheckCircle2, User, Phone, Mail, Loader2, Download, ArrowRight, Shield } from 'lucide-react'

interface WorkshopData {
  id: string
  name: string
  date_time: string
  end_date_time?: string | null
  max_people: number
  cost: number | null
  congress_id: string | null
  congresos?: { id: string; name: string; location: string } | null
  congress_workshop_doctors?: { doctors: { id: string; name: string; specialty_ids: string[]; avatar_url: string | null } }[]
  _count: { congress_workshop_enrollments: number }
  flyer: string | null
  description: string | null
}

export default function WorkshopLandingClient({ initialWorkshop }: { initialWorkshop: WorkshopData }) {
  const [workshop, setWorkshop] = useState<WorkshopData>(initialWorkshop)
  const [isRegistered, setIsRegistered] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const date = new Date(workshop.date_time)
  const docNames = workshop.congress_workshop_doctors?.map(d => d.doctors.name).join(', ') || 'Docente de Especialidad'
  const spacesLeft = Math.max(0, workshop.max_people - workshop._count.congress_workshop_enrollments)
  const isFull = spacesLeft <= 0

  useEffect(() => {
    const registered = localStorage.getItem(`arthromed_workshop_registered_${workshop.id}`) === 'true'
    if (registered) {
      setIsRegistered(true)
    }
  }, [workshop.id])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/workshops/${workshop.id}/register-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Error al inscribirse al taller.')
      }

      // Save registration state to localStorage
      localStorage.setItem(`arthromed_workshop_registered_${workshop.id}`, 'true')
      setIsRegistered(true)

      // Increment enrollment count locally
      setWorkshop(prev => ({
        ...prev,
        _count: {
          congress_workshop_enrollments: prev._count.congress_workshop_enrollments + 1
        }
      }))
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
  }

  return (
    <div className="min-h-screen bg-[#f0f5fa] text-[#37383a] relative overflow-x-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-100/40 blur-[120px] rounded-full" />
        <div className="absolute bottom-[20%] right-[-5%] w-[40%] h-[40%] bg-indigo-50/50 blur-[100px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[400px] bg-gradient-to-tr from-blue-50 to-transparent blur-[120px] rounded-full" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-12 md:py-20 flex flex-col gap-12">
        {/* Logo and Header */}
        <header className="flex justify-between items-center pb-6 border-b border-gray-200/60">
          <img
            src="https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png"
            alt="Arthromed Logo"
            className="h-12 md:h-16 object-contain"
          />
          {workshop.congresos && (
            <span className="text-xs md:text-sm font-semibold text-gray-500 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm truncate max-w-xs md:max-w-md">
              Congreso: {workshop.congresos.name}
            </span>
          )}
        </header>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-start">
          {/* Left Column: Workshop Details & Description */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold uppercase tracking-wider">
                Taller de Especialidad
              </span>
              <h1 className="text-3xl md:text-5xl font-black text-gray-900 leading-tight">
                {workshop.name}
              </h1>
              <p className="text-lg text-gray-600 font-medium">
                Impartido por: <span className="text-blue-600">{docNames}</span>
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-1">
                <Calendar size={18} className="text-blue-500" />
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">Fecha</span>
                <span className="text-sm font-bold text-gray-900">
                  {(() => {
                    const dStart = new Date(workshop.date_time)
                    const dEnd = workshop.end_date_time ? new Date(workshop.end_date_time) : null
                    const startStr = dStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
                    if (dEnd && !isNaN(dEnd.getTime())) {
                      const sameDay = dStart.toDateString() === dEnd.toDateString()
                      if (!sameDay) {
                        return `${startStr} - ${dEnd.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`
                      }
                    }
                    return startStr
                  })()}
                </span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-1">
                <Clock size={18} className="text-blue-500" />
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">Hora</span>
                <span className="text-sm font-bold text-gray-900">
                  {(() => {
                    const dStart = new Date(workshop.date_time)
                    const dEnd = workshop.end_date_time ? new Date(workshop.end_date_time) : null
                    const startStr = dStart.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                    if (dEnd && !isNaN(dEnd.getTime())) {
                      return `${startStr} - ${dEnd.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                    }
                    return startStr
                  })()} hrs
                </span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-1">
                <DollarSign size={18} className="text-green-500" />
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">Costo</span>
                <span className="text-sm font-bold text-green-700">{workshop.cost && Number(workshop.cost) > 0 ? formatCurrency(Number(workshop.cost)) : 'Gratuito'}</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-1">
                <Users size={18} className="text-purple-500" />
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">Cupos Libres</span>
                <span className="text-sm font-bold text-gray-900">{isFull ? 'Agotado' : `${spacesLeft} lugares`}</span>
              </div>
            </div>

            {/* Description */}
            {workshop.description && (
              <section className="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm space-y-4">
                <h2 className="text-xl font-black text-gray-900">Descripción del Taller</h2>
                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{workshop.description}</p>
              </section>
            )}

            {/* Flyer Display */}
            {workshop.flyer && (
              <section className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black text-gray-900">Material y Volante Informativo</h2>
                  <a
                    href={workshop.flyer}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                  >
                    <Download size={14} /> Descargar Flyer
                  </a>
                </div>
                
                <div className="bg-white rounded-3xl border border-gray-200 p-4 shadow-sm overflow-hidden flex justify-center items-center max-h-[500px]">
                  {workshop.flyer.endsWith('.pdf') ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <FileText size={48} className="text-blue-500" />
                      <span className="text-sm font-semibold text-gray-800">El folleto informativo está en formato PDF</span>
                      <a
                        href={workshop.flyer}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary text-xs"
                      >
                        Abrir folleto completo
                      </a>
                    </div>
                  ) : (
                    <img
                      src={workshop.flyer}
                      alt="Workshop Flyer"
                      className="max-w-full max-h-[460px] object-contain rounded-xl"
                    />
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Right Column: Registration Card */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-xl shadow-blue-900/5 relative overflow-hidden">
              {/* Top accent bar */}
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />

              <AnimatePresence mode="wait">
                {!isRegistered ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-gray-900">Registro de Asistencia</h3>
                      <p className="text-sm text-gray-500">
                        {isFull 
                          ? 'Lo sentimos, este taller ha alcanzado su límite de cupo. Regístrate para lista de espera.'
                          : 'Completa tus datos para asegurar tu lugar en esta sesión especial.'}
                      </p>
                    </div>

                    {error && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-600 font-semibold">
                        {error}
                      </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Nombre Completo *</label>
                        <div className="relative">
                          <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            required
                            type="text"
                            placeholder="Ej: Dr. Alejandro López"
                            className="erp-input w-full pl-10 py-3 text-sm"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Correo Electrónico *</label>
                        <div className="relative">
                          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            required
                            type="email"
                            placeholder="correo@ejemplo.com"
                            className="erp-input w-full pl-10 py-3 text-sm"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Teléfono / WhatsApp</label>
                        <div className="relative">
                          <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder="55 1234 5678"
                            className="erp-input w-full pl-10 py-3 text-sm"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting || (isFull && !isRegistered)}
                        className={`w-full py-4 rounded-2xl text-white font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 transition-all ${
                          isFull && !isRegistered
                            ? 'bg-gray-300 shadow-none cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20 active:scale-[0.98]'
                        }`}
                      >
                        {submitting ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <>
                            <span>{isFull ? 'Registrar en Espera' : 'Asegurar mi Lugar'}</span>
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                    </form>

                    <div className="flex items-center gap-2 pt-2 border-t border-gray-150 text-[10px] text-gray-400 font-semibold leading-normal">
                      <Shield size={14} className="shrink-0 text-blue-500" />
                      <span>Al registrarte, declaras ser profesional de la salud y aceptas recibir información académica del taller.</span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="text-center py-6 space-y-6"
                  >
                    <div className="w-16 h-16 bg-emerald-100 border border-emerald-200 rounded-full flex items-center justify-center text-emerald-500 mx-auto animate-pulse">
                      <CheckCircle2 size={36} />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-gray-900">¡Registro Exitoso!</h3>
                      <p className="text-sm text-gray-500">
                        Tu lugar en el taller ha sido confirmado. Hemos enviado los detalles a tu dirección de correo electrónico.
                      </p>
                    </div>

                    {/* Google Calendar Link */}
                    <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 text-left text-xs space-y-2">
                      <p className="font-bold text-gray-700">Detalles de tu Sesión:</p>
                      <p className="text-gray-600 font-medium">📅 Taller: <span className="text-gray-900">{workshop.name}</span></p>
                      <p className="text-gray-600 font-medium">🕒 Horario: <span className="text-gray-900">
                        {(() => {
                          const dStart = new Date(workshop.date_time)
                          const dEnd = workshop.end_date_time ? new Date(workshop.end_date_time) : null
                          const startDayStr = dStart.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
                          const startTimeStr = dStart.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                          if (dEnd && !isNaN(dEnd.getTime())) {
                            const sameDay = dStart.toDateString() === dEnd.toDateString()
                            if (sameDay) {
                              return `${startDayStr} de ${startTimeStr} a ${dEnd.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} hrs`
                            } else {
                              return `${startDayStr} ${startTimeStr} - ${dEnd.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })} ${dEnd.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} hrs`
                            }
                          }
                          return `${startDayStr} a las ${startTimeStr} hrs`
                        })()}
                      </span></p>
                      <p className="text-gray-600 font-medium">📍 Ubicación: <span className="text-gray-900">{workshop.congresos?.location || 'Por confirmar'}</span></p>
                    </div>

                    {(() => {
                      const startDateStr = date.toISOString().replace(/-|:|\.\d\d\d/g, "")
                      const endDate = workshop.end_date_time ? new Date(workshop.end_date_time) : new Date(date.getTime() + 2 * 60 * 60 * 1000)
                      const endDateStr = endDate.toISOString().replace(/-|:|\.\d\d\d/g, "")
                      return (
                        <a
                          href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(workshop.name)}&dates=${startDateStr}/${endDateStr}&details=${encodeURIComponent(workshop.description || '')}&location=${encodeURIComponent(workshop.congresos?.location || '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition-colors border border-blue-100"
                        >
                          Añadir a Google Calendar
                        </a>
                      )
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
