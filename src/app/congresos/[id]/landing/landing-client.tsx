'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, MapPin, Users, Clock, User, Phone, Mail,
  ChevronRight, Package, ArrowRight, Download, Globe,
  Shield, CheckCircle2, Sparkles, Tag, AlignLeft, Loader2, X,
  ShoppingBag, Trash2, Plus, Minus
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
  enable_workshops?: boolean
  terms_doctor?: string | null
  terms_distributor?: string | null
}

export default function CongressLandingClient() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const [congress, setCongress] = useState<CongresoData | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [clientName, setClientName] = useState<string | null>(null)
  const [currentClientId, setCurrentClientId] = useState<string | null>(null)
  const [clientRole, setClientRole] = useState<'médico' | 'distribuidor' | null>(null)
  const [processingWorkshop, setProcessingWorkshop] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cart & Pre-order States
  const [cart, setCart] = useState<{ [productId: string]: number }>({})
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  })
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)

  const addToCart = (product: any) => {
    setCart(prev => ({
      ...prev,
      [product.id]: (prev[product.id] || 0) + 1
    }))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      const newCart = { ...cart }
      delete newCart[productId]
      setCart(newCart)
    } else {
      setCart(prev => ({
        ...prev,
        [productId]: quantity
      }))
    }
  }

  const removeFromCart = (productId: string) => {
    const newCart = { ...cart }
    delete newCart[productId]
    setCart(newCart)
  }

  const calculateCartTotal = () => {
    return Object.entries(cart).reduce((total, [productId, qty]) => {
      const product = products.find(p => p.id === productId)
      if (!product) return total
      const discountPrice = calculateDiscountedPrice(product.sale_price || 0, product.type || '')
      return total + (discountPrice * qty)
    }, 0)
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPlacingOrder(true)

    try {
      const orderItems = Object.entries(cart).map(([productId, qty]) => {
        const product = products.find(p => p.id === productId)
        const unitPrice = product ? calculateDiscountedPrice(product.sale_price || 0, product.type || '') : 0
        return {
          productId,
          quantity: qty,
          unitPrice
        }
      })

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: currentClientId || undefined,
          contactInfo: currentClientId ? undefined : {
            name: checkoutForm.name,
            email: checkoutForm.email,
            phone: checkoutForm.phone
          },
          congressId: id,
          notes: checkoutForm.notes,
          items: orderItems
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al procesar la pre-orden')
      }

      const resData = await res.json()

      // If a new client was registered, save their client ID
      if (resData.clientId && !currentClientId) {
        localStorage.setItem('arthromed_lead_client_id', resData.clientId)
        setCurrentClientId(resData.clientId)
        if (checkoutForm.name) {
          setClientName(checkoutForm.name.split(' ')[0])
        }
      }

      setCart({})
      setIsCartOpen(false)
      setIsCheckoutOpen(false)
      setOrderSuccess(true)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsPlacingOrder(false)
    }
  }

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
          if (res.data) {
            if (res.data.name) {
              setClientName(res.data.name.split(' ')[0])
            }
            if (res.data.tags && Array.isArray(res.data.tags)) {
              const tags = res.data.tags.map((t: string) => t.toLowerCase())
              if (tags.includes('médico') || tags.includes('medico')) {
                setClientRole('médico')
              } else if (tags.includes('distribuidor')) {
                setClientRole('distribuidor')
              }
            }
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

  const groupedProducts = products.reduce((acc: { [key: string]: any[] }, p) => {
    const lineName = p.line ? p.line.trim().toUpperCase() : 'GENERAL'
    if (!acc[lineName]) {
      acc[lineName] = []
    }
    acc[lineName].push(p)
    return acc
  }, {})

  const sortedLines = Object.keys(groupedProducts).sort((a, b) => {
    if (a === 'GENERAL') return 1
    if (b === 'GENERAL') return -1
    return a.localeCompare(b)
  })

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

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex justify-center mt-12"
          >
            <a
              href="https://arthromed.com.mx/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold px-10 py-5 rounded-2xl shadow-xl shadow-blue-500/20 hover:shadow-2xl hover:shadow-blue-500/30 transition-all duration-300 hover:scale-105 active:scale-95 text-lg border border-blue-400/20"
            >
              <Globe className="animate-[spin_6s_linear_infinite]" size={22} />
              <span>Ver Catálogos</span>
              <ChevronRight size={20} />
            </a>
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
              <div className={`grid grid-cols-1 ${congress.workshops.length > 1 ? 'md:grid-cols-2' : ''} gap-6`}>
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
                        {congress.enable_workshops !== false && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Cupo:</span>
                            <span className="text-slate-300 font-medium">{enrolledCount} / {w.max_people} personas</span>
                          </div>
                        )}
                        {congress.enable_workshops !== false && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Costo:</span>
                            <span className="text-blue-400 font-bold">{w.cost > 0 ? formatCurrency(w.cost) : 'Gratis'}</span>
                          </div>
                        )}
                      </div>

                      {congress.enable_workshops !== false && (
                        <div className="pt-5 mt-4 border-t border-white/[0.05]">
                          <button
                            onClick={() => handleEnrollToggle(w.id, isEnrolled)}
                            disabled={processingWorkshop === w.id || (!isEnrolled && isFull)}
                            className={`group/btn w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isEnrolled
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
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Featured Products */}
          {products.length > 0 && (
            <section className="space-y-8">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Package className="text-emerald-500" /> Productos Recomendados
                </h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider">
                  <Tag size={12} /> Descuentos de Congreso
                </div>
              </div>

              <div className="space-y-10">
                {sortedLines.map((lineName) => (
                  <div key={lineName} className="space-y-4">
                    <h3 className="text-lg font-bold text-white/95 flex items-center gap-2 border-l-4 border-blue-500 pl-3 uppercase tracking-wider">
                      {lineName}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {groupedProducts[lineName].map((p) => (
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
                              {cart[p.id] ? (
                                <div className="ml-auto flex items-center bg-blue-600 rounded-xl overflow-hidden shadow-lg shadow-blue-900/30">
                                  <button
                                    onClick={() => updateQuantity(p.id, cart[p.id] - 1)}
                                    className="px-3 py-2 hover:bg-blue-500 transition-colors text-white font-bold text-xs"
                                  >
                                    -
                                  </button>
                                  <span className="px-2 text-white font-black text-xs min-w-[20px] text-center">
                                    {cart[p.id]}
                                  </span>
                                  <button
                                    onClick={() => updateQuantity(p.id, cart[p.id] + 1)}
                                    className="px-3 py-2 hover:bg-blue-500 transition-colors text-white font-bold text-xs"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => addToCart(p)}
                                  className="ml-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-900/40"
                                >
                                  <span>Cotizar</span>
                                  <ArrowRight size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Terms & Conditions Section */}
          <section className="bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Shield className="text-blue-500" size={20} /> Términos y Condiciones
            </h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Consulte las bases regulatorias y condiciones de registro establecidas para este congreso según su perfil profesional.
            </p>

            <div className={`grid grid-cols-1 ${clientRole === null ? 'md:grid-cols-2' : ''} gap-8`}>
              {/* Doctors Terms */}
              {(clientRole === null || clientRole === 'médico') && (
                <div className="bg-slate-950/40 rounded-2xl p-6 border border-white/[0.04] flex flex-col">
                  <div className="flex items-center gap-2 mb-4 border-b border-white/[0.05] pb-3">
                    <User className="text-blue-400" size={18} />
                    <h3 className="font-bold text-white text-base">Médicos Especialistas</h3>
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                    {congress.terms_doctor || 'Al registrarse, usted acepta recibir información sobre congresos, talleres y productos de alta especialidad médica distribuidos por Arthromed. Sus datos serán procesados con absoluta confidencialidad en cumplimiento de nuestro aviso de privacidad.'}
                  </div>
                </div>
              )}

              {/* Distributors Terms */}
              {(clientRole === null || clientRole === 'distribuidor') && (
                <div className="bg-slate-950/40 rounded-2xl p-6 border border-white/[0.04] flex flex-col">
                  <div className="flex items-center gap-2 mb-4 border-b border-white/[0.05] pb-3">
                    <Users className="text-indigo-400" size={18} />
                    <h3 className="font-bold text-white text-base">Distribuidores Comerciales</h3>
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                    {congress.terms_distributor || 'Al registrarse como distribuidor, usted acepta cumplir con las políticas comerciales de distribución de Arthromed y autoriza el contacto de un asesor comercial para evaluar la alianza comercial de acuerdo con nuestras políticas vigentes.'}
                  </div>
                </div>
              )}
            </div>
          </section>
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
            {/* <button className="w-full mt-8 py-4 bg-white text-blue-600 rounded-2xl font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
              Chatear con un asesor <ChevronRight size={18} />
            </button> */}
          </motion.div>

          {/* Trust Badge */}
          <div className="flex items-center justify-center gap-3 py-6 grayscale opacity-40">
            <Shield size={24} />
            <span className="font-bold tracking-tighter text-xl italic uppercase">Arthromed ERP</span>
          </div>

        </aside>
      </main>

      {/* Floating Cart Button */}
      <AnimatePresence>
        {Object.keys(cart).length > 0 && (
          <motion.div
            initial={{ scale: 0, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0, y: 50, opacity: 0 }}
            className="fixed bottom-6 right-6 z-40"
          >
            <button
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold px-6 py-4 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <div className="relative">
                <ShoppingBag size={20} />
                <span className="absolute -top-3.5 -right-3.5 bg-rose-500 text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950 font-black">
                  {Object.values(cart).reduce((a, b) => a + b, 0)}
                </span>
              </div>
              <span>Ver pre-orden</span>
              <span className="bg-white/10 px-2 py-0.5 rounded-lg text-sm">
                {formatCurrency(calculateCartTotal())}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-slate-900 border-l border-white/[0.08] shadow-2xl z-50 flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/[0.05] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="text-blue-500" size={24} />
                  <h2 className="text-xl font-bold text-white">Tu Pre-orden</h2>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {Object.entries(cart).map(([productId, qty]) => {
                  const product = products.find(p => p.id === productId)
                  if (!product) return null
                  const discountedPrice = calculateDiscountedPrice(product.sale_price || 0, product.type || '')

                  return (
                    <div
                      key={productId}
                      className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl flex gap-4 items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm truncate">{product.description}</p>
                        <p className="text-xs text-slate-500 mt-1">{product.model || product.order_code}</p>
                        <p className="text-sm font-bold text-blue-400 mt-2">{formatCurrency(discountedPrice)}</p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => removeFromCart(productId)}
                          className="text-slate-500 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>

                        <div className="flex items-center bg-slate-800 rounded-lg overflow-hidden border border-white/[0.05]">
                          <button
                            onClick={() => updateQuantity(productId, qty - 1)}
                            className="px-2 py-1 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="px-2 text-white font-bold text-xs min-w-[20px] text-center">{qty}</span>
                          <button
                            onClick={() => updateQuantity(productId, qty + 1)}
                            className="px-2 py-1 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {Object.keys(cart).length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 gap-3 py-20">
                    <ShoppingBag size={48} className="opacity-20" />
                    <p className="font-medium">Tu carrito está vacío</p>
                    <p className="text-xs max-w-[200px]">Agrega productos recomendados del congreso para cotizar.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              {Object.keys(cart).length > 0 && (
                <div className="p-6 border-t border-white/[0.05] bg-slate-950/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Total de Pre-orden</span>
                    <span className="text-2xl font-black text-white">{formatCurrency(calculateCartTotal())}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-normal">
                    * Los precios mostrados incluyen el descuento exclusivo del congreso.
                  </p>
                  <button
                    onClick={() => {
                      setIsCartOpen(false)
                      setIsCheckoutOpen(true)
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 text-base transition-all shadow-lg shadow-blue-900/30 cursor-pointer"
                  >
                    <span>Proceder a Pre-ordenar</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCheckoutOpen(false)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50"
            />
            {/* Modal Container */}
            <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-slate-900 border border-white/[0.08] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col relative"
              >
                {/* Header */}
                <div className="p-6 border-b border-white/[0.05] flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Tag className="text-blue-500" size={20} />
                    Finalizar Pre-orden
                  </h3>
                  <button
                    onClick={() => setIsCheckoutOpen(false)}
                    className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handlePlaceOrder} className="p-6 space-y-6">
                  {currentClientId ? (
                    <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl flex items-center gap-3">
                      <CheckCircle2 className="text-blue-400 flex-shrink-0" size={20} />
                      <p className="text-sm text-slate-300">
                        Pre-ordenando como: <strong className="text-white">Dr. {clientName || 'Registrado'}</strong>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl">
                        <p className="text-xs text-yellow-400 leading-normal">
                          Para colocar tu pre-orden, ingresa tus datos de contacto. Te registraremos como prospecto para dar seguimiento a tu cotización.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Nombre Completo *</label>
                        <input
                          type="text"
                          required
                          value={checkoutForm.name}
                          onChange={e => setCheckoutForm({ ...checkoutForm, name: e.target.value })}
                          placeholder="Ej. Dr. Alejandro Gómez"
                          className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-blue-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Correo Electrónico *</label>
                          <input
                            type="email"
                            required
                            value={checkoutForm.email}
                            onChange={e => setCheckoutForm({ ...checkoutForm, email: e.target.value })}
                            placeholder="ejemplo@correo.com"
                            className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-blue-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Teléfono (10 dígitos) *</label>
                          <input
                            type="tel"
                            required
                            pattern="[0-9]{10}"
                            value={checkoutForm.phone}
                            onChange={e => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
                            placeholder="8110203040"
                            className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-blue-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Notas o Comentarios Adicionales</label>
                    <textarea
                      value={checkoutForm.notes}
                      onChange={e => setCheckoutForm({ ...checkoutForm, notes: e.target.value })}
                      placeholder="Dirección de envío, dudas técnicas, o especificaciones..."
                      rows={3}
                      className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-blue-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors resize-none"
                    />
                  </div>

                  {/* Clarification Alert */}
                  <div className="bg-indigo-600/10 border border-indigo-500/20 p-4 rounded-2xl">
                    <p className="text-xs text-indigo-300 leading-relaxed">
                      💡 <strong>Nota Importante:</strong> Esto es una pre-orden de cotización. Ningún cargo se realizará en este momento. Un ejecutivo de ventas de Arthromed revisará la disponibilidad de tu equipo/consumible y se comunicará contigo para confirmar el pedido y método de pago.
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isPlacingOrder}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/20 disabled:opacity-50 cursor-pointer"
                  >
                    {isPlacingOrder ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>Colocar Pre-orden</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {orderSuccess && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50"
            />
            {/* Modal */}
            <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-slate-900 border border-emerald-500/20 rounded-3xl w-full max-w-md p-8 text-center shadow-2xl relative"
              >
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-400 animate-bounce">
                  <CheckCircle2 size={44} />
                </div>
                <h3 className="text-2xl font-black text-white mb-3">¡Pre-orden Recibida!</h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  Tu pre-orden de cotización con precios de congreso ha sido registrada correctamente. Un ejecutivo de nuestro equipo de ventas se pondrá en contacto contigo muy pronto para brindarte atención personalizada.
                </p>
                <button
                  onClick={() => setOrderSuccess(false)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer"
                >
                  Entendido
                </button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

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
