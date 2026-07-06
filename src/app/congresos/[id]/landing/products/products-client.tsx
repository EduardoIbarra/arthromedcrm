/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, MapPin, Users, Clock, User, Phone, Mail,
  ChevronRight, Package, ArrowLeft, Download, Globe,
  Shield, CheckCircle2, Tag, AlignLeft, Loader2, X,
  ShoppingBag, Trash2, Plus, Minus, FileText, Search, ArrowRight
} from 'lucide-react'
import Link from 'next/link'

interface CatalogItem {
  catalog_id: string
  catalog: {
    id: string
    name: string
    pdf_url: string
    description: string | null
  }
}

interface CongresoData {
  id: string
  name: string
  start_date: string
  end_date: string
  location: string
  description: string
  flyer: string | null
  specialty_ids: string[]
  line_ids?: string[]
  workshops: any[]
  contacts: any[]
  congress_catalogos?: CatalogItem[]
  enable_workshops?: boolean
  terms_doctor?: string | null
  terms_distributor?: string | null
  video_urls?: string[]
}

const formatCurrency = (val: number | string | null) => {
  if (val === null || val === undefined) return '$0.00'
  const num = typeof val === 'string' ? parseFloat(val) : val
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num)
}

const calculateDiscountedPrice = (price: number, type: string) => {
  // 5% discount for equipment, 4% for consumables
  const discount = type === 'equipment' ? 0.05 : 0.04
  return price * (1 - discount)
}

export default function CongressProductsClient({ initialCongress }: { initialCongress?: any }) {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()

  const normalizeCongress = (data: any): CongresoData => {
    return {
      ...data,
      workshops: (data.workshops || data.congress_workshops || []).map((w: any) => ({
        ...w,
        enrollments: w.enrollments || w.congress_workshop_enrollments || []
      })),
      contacts: data.contacts || data.congress_contacts || [],
      congress_catalogos: (data.congress_catalogos || []).map((cc: any) => ({
        ...cc,
        catalog: cc.catalog || cc.catalogos
      }))
    }
  }

  const [congress, setCongressState] = useState<CongresoData | null>(
    initialCongress ? normalizeCongress(initialCongress) : null
  )

  const setCongress = (data: CongresoData | null) => {
    setCongressState(data ? normalizeCongress(data) : null)
  }

  const [products, setProducts] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(!initialCongress)
  const [error, setError] = useState<string | null>(null)

  // Cart States
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

  // Load cart from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`arthromed_cart_${id}`)
    if (saved) {
      try {
        setCart(JSON.parse(saved))
      } catch (e) {}
    }
  }, [id])

  // Save cart to localStorage
  useEffect(() => {
    if (Object.keys(cart).length > 0) {
      localStorage.setItem(`arthromed_cart_${id}`, JSON.stringify(cart))
    } else {
      localStorage.removeItem(`arthromed_cart_${id}`)
    }
  }, [cart, id])

  const addToCart = (product: any) => {
    setCart(prev => ({
      ...prev,
      [product.id]: (prev[product.id] || 0) + 1
    }))
    setIsCartOpen(true)
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

  const getCartTotal = () => {
    return Object.entries(cart).reduce((total, [productId, qty]) => {
      const product = products.find(p => p.id === productId)
      if (!product) return total
      const discountPrice = calculateDiscountedPrice(product.sale_price || 0, product.type || '')
      return total + (discountPrice * qty)
    }, 0)
  }

  const getCartCount = () => {
    return Object.values(cart).reduce((a, b) => a + b, 0)
  }

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
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

      const savedClientId = localStorage.getItem('arthromed_lead_client_id')

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          congressId: id,
          clientName: checkoutForm.name,
          email: checkoutForm.email,
          phone: checkoutForm.phone,
          notes: checkoutForm.notes,
          items: orderItems,
          clientId: savedClientId || null
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to place order')
      }

      const resData = await res.json()
      if (resData.clientId) {
        localStorage.setItem('arthromed_lead_client_id', resData.clientId)
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

  // Fetch Products
  useEffect(() => {
    if (initialCongress) {
      const hasSpecialties = initialCongress.specialty_ids?.length > 0
      const hasLines = initialCongress.line_ids?.length > 0
      if (hasSpecialties || hasLines) {
        const params = new URLSearchParams()
        if (hasSpecialties) {
          initialCongress.specialty_ids.forEach((sid: string) => params.append('specialty_ids', sid))
        }
        if (hasLines) {
          initialCongress.line_ids.forEach((lid: string) => params.append('line_ids', lid))
        }
        fetch(`/api/products/filter?${params.toString()}`)
          .then(r => r.json())
          .then(d => {
            if (d.data) setProducts(d.data)
            setLoading(false)
          })
          .catch(err => {
            console.error(err)
            setLoading(false)
          })
      } else {
        setLoading(false)
      }
      return
    }

    async function loadData() {
      try {
        const res = await fetch(`/api/congresos/${id}`)
        if (!res.ok) throw new Error('Congress not found')
        const { data } = await res.json()
        setCongress(data)

        const hasSpecialties = data.specialty_ids?.length > 0
        const hasLines = data.line_ids?.length > 0
        if (hasSpecialties || hasLines) {
          const params = new URLSearchParams()
          if (hasSpecialties) {
            data.specialty_ids.forEach((sid: string) => params.append('specialty_ids', sid))
          }
          if (hasLines) {
            data.line_ids.forEach((lid: string) => params.append('line_ids', lid))
          }
          fetch(`/api/products/filter?${params.toString()}`)
            .then(r => r.json())
            .then(d => { if (d.data) setProducts(d.data) })
            .catch(console.error)
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id, initialCongress])

  // Filter & Group products
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products
    const term = searchTerm.toLowerCase()
    return products.filter(p => 
      (p.nombre_lista || p.description || '').toLowerCase().includes(term) ||
      (p.model || '').toLowerCase().includes(term) ||
      (p.order_code || '').toLowerCase().includes(term) ||
      (p.line || '').toLowerCase().includes(term)
    )
  }, [products, searchTerm])

  const groupedProducts = useMemo(() => {
    return filteredProducts.reduce((acc: { [key: string]: any[] }, p) => {
      const lineName = p.line || 'Otros'
      if (!acc[lineName]) acc[lineName] = []
      acc[lineName].push(p)
      return acc
    }, {})
  }, [filteredProducts])

  const sortedLines = useMemo(() => {
    return Object.keys(groupedProducts).sort((a, b) => {
      if (a === 'Otros') return 1
      if (b === 'Otros') return -1
      return a.localeCompare(b)
    })
  }, [groupedProducts])

  // Hash/Anchor Scroll Effect
  useEffect(() => {
    if (products.length > 0 && typeof window !== 'undefined') {
      const hash = window.location.hash
      if (hash) {
        const decodedHash = decodeURIComponent(hash.substring(1))
        const element = document.getElementById(decodedHash)
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 300)
        }
      }
    }
  }, [products])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#0763a9] animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-slate-500">Cargando productos del congreso...</p>
        </div>
      </div>
    )
  }

  if (error || !congress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-red-100 shadow-xl text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <X size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Error al cargar</h2>
          <p className="text-sm text-slate-500 mb-6">{error || 'Congreso no encontrado'}</p>
          <Link href="/" className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Banner / Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link
            href={`/congresos/${id}/landing`}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold text-sm transition-colors"
          >
            <ArrowLeft size={16} /> Volver al Congreso
          </Link>

          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar productos..."
              className="w-full pl-9 pr-4 py-2 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <ShoppingBag size={20} />
            {getCartCount() > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow">
                {getCartCount()}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-6xl mx-auto px-4 py-10 space-y-12">
        <div className="border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-black text-slate-900 mb-2">Catálogo de Productos</h1>
          <p className="text-slate-500">{congress.name}</p>
        </div>

        {sortedLines.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
            <Package className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-500 font-medium">No se encontraron productos recomendados para los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="space-y-16">
            {sortedLines.map((lineName) => (
              <section
                key={lineName}
                id={`line-${lineName}`}
                className="space-y-6 scroll-mt-20"
              >
                <h2 className="text-xl font-bold text-slate-900 border-l-4 border-blue-500 pl-3 uppercase tracking-wider">
                  {lineName}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupedProducts[lineName].map((p) => (
                    <div
                      key={p.id}
                      className="bg-white border border-slate-200 rounded-3xl overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all flex flex-col group"
                    >
                      {p.image_urls && p.image_urls.length > 0 && (
                        <div className="w-full aspect-video relative bg-white border-b border-slate-100 flex items-center justify-center p-4">
                          <img src={p.image_urls[0]} alt={p.description} className="max-w-full max-h-full object-contain group-hover:scale-102 transition-transform mix-blend-multiply" />
                        </div>
                      )}
                      <div className="p-6 flex flex-col flex-1">
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.type === 'equipment' ? 'EQUIPO' : 'CONSUMIBLE'}</span>
                          <div className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md text-[10px] font-bold">
                            -{p.type === 'equipment' ? '5%' : '4%'}
                          </div>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors line-clamp-2">{p.nombre_lista || p.description}</h3>
                        <p className="text-xs text-slate-400 mb-6 flex-1">{p.model || p.order_code || 'Referencia estándar'}</p>

                        <div className="flex items-end justify-between gap-3 mt-auto">
                          <div>
                            <p className="text-[10px] text-slate-400 line-through mb-0.5">{formatCurrency(p.sale_price || 0)}</p>
                            <p className="text-xl font-extrabold text-slate-900">{formatCurrency(calculateDiscountedPrice(p.sale_price || 0, p.type || ''))}</p>
                          </div>
                          <button
                            onClick={() => addToCart(p)}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-full shadow hover:shadow-lg transition-all"
                            aria-label="Agregar al carrito"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="text-[#0763a9]" size={20} />
                  <h3 className="font-extrabold text-slate-800">Mi Cotización</h3>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {Object.keys(cart).length === 0 ? (
                  <div className="text-center py-20">
                    <ShoppingBag className="mx-auto text-slate-200 mb-4" size={48} />
                    <p className="text-slate-400 font-medium text-sm">Tu carrito está vacío</p>
                  </div>
                ) : (
                  Object.entries(cart).map(([productId, qty]) => {
                    const product = products.find(p => p.id === productId)
                    if (!product) return null
                    const discountedPrice = calculateDiscountedPrice(product.sale_price || 0, product.type || '')
                    return (
                      <div key={productId} className="flex gap-4 p-4 border border-slate-100 rounded-2xl bg-slate-50/50">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{product.nombre_lista || product.description}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{product.model || product.order_code}</p>
                          <p className="text-sm font-bold text-slate-800 mt-2">{formatCurrency(discountedPrice * qty)}</p>
                        </div>
                        <div className="flex flex-col justify-between items-end">
                          <button onClick={() => removeFromCart(productId)} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors">
                            <Trash2 size={14} />
                          </button>
                          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm mt-2">
                            <button onClick={() => updateQuantity(productId, qty - 1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><Minus size={12} /></button>
                            <span className="text-xs font-bold text-slate-800 px-1">{qty}</span>
                            <button onClick={() => updateQuantity(productId, qty + 1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><Plus size={12} /></button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {Object.keys(cart).length > 0 && (
                <div className="p-6 border-t border-slate-100 space-y-4 bg-slate-50">
                  <div className="flex justify-between items-center text-sm font-bold text-slate-800">
                    <span>Total Estimado:</span>
                    <span className="text-xl font-black text-slate-900">{formatCurrency(getCartTotal())}</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsCartOpen(false)
                      setIsCheckoutOpen(true)
                    }}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 flex items-center justify-center gap-2"
                  >
                    Proceder a Cotización <ArrowRight size={16} />
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
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl relative"
            >
              <button onClick={() => setIsCheckoutOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-500">
                <X size={18} />
              </button>

              <h3 className="text-2xl font-black text-slate-800 mb-6">Solicitar Cotización</h3>

              <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={checkoutForm.name}
                    onChange={e => setCheckoutForm({ ...checkoutForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={checkoutForm.email}
                    onChange={e => setCheckoutForm({ ...checkoutForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Teléfono</label>
                  <input
                    type="tel"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={checkoutForm.phone}
                    onChange={e => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notas / Comentarios</label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={checkoutForm.notes}
                    onChange={e => setCheckoutForm({ ...checkoutForm, notes: e.target.value })}
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-between items-center mb-6">
                  <span className="text-sm font-bold text-slate-500">Total a Cotizar:</span>
                  <span className="text-xl font-black text-slate-800">{formatCurrency(getCartTotal())}</span>
                </div>

                <button
                  type="submit"
                  disabled={isPlacingOrder}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPlacingOrder ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar Solicitud'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {orderSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">¡Solicitud Enviada!</h3>
              <p className="text-sm text-slate-500 mb-6">Hemos recibido tu solicitud de cotización. Un asesor de Arthromed se pondrá en contacto contigo pronto.</p>
              <button
                onClick={() => setOrderSuccess(false)}
                className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-bold shadow hover:shadow-lg transition-all"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
