'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calendar, MapPin, Users, Clock, User, Phone, Mail, 
  ChevronRight, Package, ArrowRight, Download, Globe,
  Shield, CheckCircle2, Sparkles, Tag, AlignLeft, Loader2, X
} from 'lucide-react'
import Link from 'next/link'

interface CongresoData {
  id: string
  name: string
  start_date: string
  end_date: string
  location: string
  description: string
  flyer: string | null
  specialty_ids: string[]
  workshops: any[]
  contacts: any[]
}

export default function CongressLandingPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const [congress, setCongress] = useState<CongresoData | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [clientName, setClientName] = useState<string | null>(null)
  const [currentClientId, setCurrentClientId] = useState<string | null>(null)
  const [processingWorkshop, setProcessingWorkshop] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/congresos/${id}`)
        if (!res.ok) throw new Error('Congress not found')
        const { data } = await res.json()
        setCongress(data)

        if (data.specialty_ids?.length > 0) {
          const params = new URLSearchParams()
          data.specialty_ids.forEach((sid: string) => params.append('specialty_ids', sid))
          const prodRes = await fetch(`/api/products/filter?${params.toString()}`)
          if (prodRes.ok) {
            const prodData = await prodRes.json()
            setProducts(prodData.data)
          }
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  useEffect(() => {
    const cid = searchParams.get('clientId') || localStorage.getItem('arthromed_lead_client_id')
    if (cid) {
      localStorage.setItem('arthromed_lead_client_id', cid)
      setCurrentClientId(cid)
      fetch(`/api/clients/${cid}`)
        .then(res => res.json())
        .then(res => {
          if (res.data && res.data.name) {
            setClientName(res.data.name.split(' ')[0])
          }
        })
        .catch(console.error)
    }
  }, [searchParams])

  const handleEnrollToggle = async (workshopId: string, isEnrolled: boolean) => {
    if (!currentClientId) {
      alert('Debe registrarse primero escaneando el código QR para poder inscribirse a talleres.')
      return
    }
    
    setProcessingWorkshop(workshopId)
    try {
      const method = isEnrolled ? 'DELETE' : 'POST'
      const url = isEnrolled 
        ? `/api/workshops/${workshopId}/enroll?clientId=${currentClientId}`
        : `/api/workshops/${workshopId}/enroll`

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: isEnrolled ? null : JSON.stringify({ clientId: currentClientId })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error en la operación')
      }

      setCongress(prev => {
        if (!prev) return prev
        const newWorkshops = prev.workshops.map(w => {
          if (w.id === workshopId) {
            const enrollments = [...(w.enrollments || [])]
            if (isEnrolled) {
              return { ...w, enrollments: enrollments.filter((e: any) => e.client_id !== currentClientId) }
            } else {
              return { ...w, enrollments: [...enrollments, { client_id: currentClientId }] }
            }
          }
          return w
        })
        return { ...prev, workshops: newWorkshops }
      })

    } catch (err: any) {
      alert(err.message)
    } finally {
      setProcessingWorkshop(null)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <motion.div 
        animate={{ scale: [1, 1.1, 1], rotate: [0, 90, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
      />
    </div>
  )

  if (error || !congress) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
        <Users className="text-red-500" size={40} />
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">Evento no encontrado</h1>
      <p className="text-slate-400 max-w-md">Lo sentimos, no pudimos encontrar los detalles de este congreso.</p>
    </div>
  )

  const calculateDiscountedPrice = (price: number, type: string) => {
    const discount = type === 'equipment' ? 0.05 : 0.04
    return price * (1 - discount)
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-blue-500 selection:text-white overflow-x-hidden">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[30%] bg-indigo-600/10 blur-[100px] rounded-full" />
      </div>

      {/* Hero Section */}
      <header className="relative pt-20 pb-32 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8"
          >
            <Sparkles size={14} /> Congreso Médico Exclusivo
          </motion.div>

          {clientName && (
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-2xl md:text-3xl font-medium text-slate-300 mb-4"
            >
              ¡Bienvenido, Dr. {clientName}!
            </motion.h2>
          )}
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold text-white mb-8 tracking-tight"
          >
            {congress.name}
          </motion.h1>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-6 text-lg text-slate-300"
          >
            <div className="flex items-center gap-2">
              <Calendar className="text-blue-500" size={20} />
              <span>{new Date(congress.start_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="text-blue-500" size={20} />
              <span>{congress.location}</span>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Content Grid */}
      <main className="relative max-w-6xl mx-auto px-6 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left Column: Info & Workshops */}
        <div className="lg:col-span-8 space-y-12">
          
          {/* Description */}
          <section className="bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <AlignLeft className="text-blue-500" /> Acerca del Congreso
            </h2>
            <p className="text-slate-400 leading-relaxed text-lg whitespace-pre-wrap">
              {congress.description}
            </p>
          </section>

          {/* Workshops */}
          {congress.workshops && congress.workshops.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Calendar className="text-purple-500" /> Talleres Disponibles
                </h2>
                <span className="text-sm text-slate-500">{congress.workshops.length} sesiones</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {congress.workshops.map((w, i) => {
                  const enrolledCount = w.enrollments?.length || 0
                  const isEnrolled = currentClientId ? w.enrollments?.some((e: any) => e.client_id === currentClientId) : false
                  const isFull = enrolledCount >= w.max_people

                  return (
                  <motion.div 
                    key={w.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="group bg-white/[0.03] border border-white/[0.08] rounded-3xl p-6 hover:bg-white/[0.06] transition-all hover:border-blue-500/30 flex flex-col"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                        <Users size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg">{w.name}</h3>
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                          <User size={12} /> {w.professor}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3 pt-4 border-t border-white/[0.05] flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Fecha y Hora:</span>
                        <span className="text-slate-300 font-medium">
                          {new Date(w.date_time).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Cupo:</span>
                        <span className="text-slate-300 font-medium">{enrolledCount} / {w.max_people} personas</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Costo:</span>
                        <span className="text-blue-400 font-bold">{w.cost > 0 ? formatCurrency(w.cost) : 'Gratis'}</span>
                      </div>
                    </div>
                    
                    <div className="pt-5 mt-4 border-t border-white/[0.05]">
                      <button 
                        onClick={() => handleEnrollToggle(w.id, isEnrolled)}
                        disabled={processingWorkshop === w.id || (!isEnrolled && isFull)}
                        className={`group/btn w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                          isEnrolled 
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-red-500/20 hover:text-red-400 border border-emerald-500/30 hover:border-red-500/30' 
                            : (!isEnrolled && isFull)
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20'
                        }`}
                      >
                        {processingWorkshop === w.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : isEnrolled ? (
                          <>
                            <span className="flex group-hover/btn:hidden items-center gap-2"><CheckCircle2 size={18} /> Inscrito</span>
                            <span className="hidden group-hover/btn:flex items-center gap-2"><X size={18} /> Cancelar</span>
                          </>
                        ) : isFull ? (
                          'Cupo Lleno'
                        ) : (
                          'Inscribirme'
                        )}
                      </button>
                    </div>
                  </motion.div>
                )})}
              </div>
            </section>
          )}

          {/* Featured Products */}
          {products.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Package className="text-emerald-500" /> Productos Recomendados
                </h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider">
                  <Tag size={12} /> Descuentos de Congreso
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {products.map((p, i) => (
                  <motion.div 
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    className="bg-white/[0.03] border border-white/[0.08] rounded-3xl overflow-hidden hover:bg-white/[0.05] transition-all group"
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{p.type === 'equipment' ? 'EQUIPO' : 'CONSUMIBLE'}</span>
                        <div className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black">
                          -{p.type === 'equipment' ? '5%' : '4%'}
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors line-clamp-2">{p.description}</h3>
                      <p className="text-sm text-slate-500 mb-6">{p.model || p.order_code || 'Referencia estándar'}</p>
                      
                      <div className="flex items-end gap-3">
                        <div>
                          <p className="text-[10px] text-slate-500 line-through mb-1">{formatCurrency(p.sale_price || 0)}</p>
                          <p className="text-2xl font-black text-white">{formatCurrency(calculateDiscountedPrice(p.sale_price || 0, p.type || ''))}</p>
                        </div>
                        <Link 
                          href="#" 
                          className="ml-auto w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/40"
                        >
                          <ArrowRight size={20} />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Flyer & Contacts */}
        <aside className="lg:col-span-4 space-y-8">
          
          {/* Flyer Card */}
          {congress.flyer && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/[0.03] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="aspect-[3/4] relative bg-slate-900 flex items-center justify-center group overflow-hidden">
                <img 
                  src={congress.flyer} 
                  alt="Congress Flyer" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                />
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <a 
                    href={congress.flyer} 
                    target="_blank" 
                    rel="noreferrer"
                    className="btn-primary rounded-full px-6 flex items-center gap-2"
                  >
                    <Download size={18} /> Descargar Flyer
                  </a>
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-500 text-center italic">Documentación oficial del evento</p>
              </div>
            </motion.div>
          )}

          {/* Contacts Card */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-blue-600 rounded-3xl p-8 shadow-xl shadow-blue-900/20"
          >
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
              <Phone size={20} /> Contacto & Ayuda
            </h3>
            <div className="space-y-6">
              {congress.contacts && congress.contacts.length > 0 ? (
                congress.contacts.map((c, i) => (
                  <div key={i} className="space-y-2">
                    <p className="text-blue-100 text-xs font-bold uppercase tracking-widest">{c.name}</p>
                    <div className="flex flex-col gap-2">
                      {c.number && (
                        <a href={`tel:${c.number}`} className="flex items-center gap-2 text-white hover:text-blue-200 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><Phone size={14} /></div>
                          <span className="font-medium">{c.number}</span>
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-white hover:text-blue-200 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><Mail size={14} /></div>
                          <span className="font-medium truncate">{c.email}</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-blue-100 text-sm">No hay información de contacto disponible actualmente.</p>
              )}
            </div>
            <button className="w-full mt-8 py-4 bg-white text-blue-600 rounded-2xl font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
              Chatear con un asesor <ChevronRight size={18} />
            </button>
          </motion.div>

          {/* Trust Badge */}
          <div className="flex items-center justify-center gap-3 py-6 grayscale opacity-40">
            <Shield size={24} />
            <span className="font-bold tracking-tighter text-xl italic uppercase">Arthromed ERP</span>
          </div>

        </aside>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-white/[0.05] text-center">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-slate-500 text-sm">© 2026 Arthromed — Equipo Médico de Alto Rendimiento. Todos los derechos reservados.</p>
        </div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        
        body {
          font-family: 'Outfit', sans-serif;
        }

        .btn-primary {
          @apply bg-blue-600 text-white font-bold py-3 px-8 rounded-2xl hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-900/20;
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;  
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}
