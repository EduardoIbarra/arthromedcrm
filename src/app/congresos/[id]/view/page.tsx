'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { 
  ArrowLeft, Calendar, MapPin, AlignLeft, Globe, 
  Users, User, DollarSign, Edit2, ChevronRight, Phone, Mail,
  ShoppingBag, ChevronDown, ChevronUp
} from 'lucide-react'
import Link from 'next/link'
import PermissionGuard from '@/components/PermissionGuard'
import { motion, AnimatePresence } from 'framer-motion'

export default function CongresoViewPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const router = useRouter()
  const [congreso, setCongreso] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Orders State
  const [orders, setOrders] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch(`/api/congresos/${id}/orders`)
        if (!res.ok) throw new Error('Failed to load orders')
        const { data } = await res.json()
        setOrders(data || [])
      } catch (err) {
        console.error('Error loading orders:', err)
      } finally {
        setLoadingOrders(false)
      }
    }
    fetchOrders()
  }, [id])

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrderId(prev => (prev === orderId ? null : orderId))
  }

  useEffect(() => {
    const fetchCongreso = async () => {
      try {
        const res = await fetch(`/api/congresos/${id}`)
        if (!res.ok) throw new Error('Failed to load')
        const { data } = await res.json()
        setCongreso(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCongreso()
  }, [id])

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6 md:p-8 max-w-5xl mx-auto flex justify-center items-center h-64">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      </AppShell>
    )
  }

  if (error || !congreso) {
    return (
      <AppShell>
        <div className="p-6 md:p-8 max-w-5xl mx-auto">
          <div className="card p-8 text-center text-red-500 bg-red-50 border-red-100">
            {error || 'Congreso no encontrado'}
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in space-y-6">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-gray-100 pb-6">
          <div className="space-y-3">
            <Link 
              href="/congresos" 
              className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft size={16} className="mr-1" />
              {t('back')}
            </Link>
            
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              {congreso.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-medium">
                <Calendar size={14} />
                {new Date(congreso.start_date).toLocaleDateString()} - {new Date(congreso.end_date).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={14} className="text-gray-400" />
                {congreso.location}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <Link 
              href={`/congresos/${id}/planning`} 
              className="btn-secondary bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            >
              <Calendar size={18} /> {t('planning')}
            </Link>
            <Link 
              href={`/congresos/${id}/landing`} 
              target="_blank"
              className="btn-secondary"
            >
              <Globe size={18} /> Ver Landing
            </Link>
            <PermissionGuard section="congresos" action="edit">
              <Link 
                href={`/congresos/${id}`} 
                className="btn-primary"
              >
                <Edit2 size={18} /> {t('edit')}
              </Link>
            </PermissionGuard>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <section className="card p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlignLeft size={18} className="text-blue-600" />
                Descripción
              </h2>
              <div className="text-gray-600 whitespace-pre-wrap leading-relaxed text-sm">
                {congreso.description || 'Sin descripción...'}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Users size={20} className="text-blue-600" />
                  Talleres ({congreso.workshops?.length || 0})
                </h2>
              </div>

              {congreso.workshops?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {congreso.workshops.map((w: any) => {
                    const enrolledCount = w.enrollments?.length || 0
                    const isFull = enrolledCount >= w.max_people
                    const capacityPercentage = Math.min(100, Math.round((enrolledCount / w.max_people) * 100))
                    
                    return (
                      <Link 
                        key={w.id} 
                        href={`/congresos/${id}/workshops/${w.id}`}
                        className="card p-5 hover:border-blue-300 hover:shadow-md transition-all group block"
                      >
                        <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">{w.name}</h3>
                        
                        <div className="space-y-2 mb-4">
                          <p className="text-sm text-gray-500 flex items-center gap-2">
                            <Calendar size={14} className="text-gray-400" />
                            {new Date(w.date_time).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-sm text-gray-500 flex items-center gap-2">
                            <User size={14} className="text-gray-400" />
                            {w.professor}
                          </p>
                        </div>

                        <div className="mt-auto border-t border-gray-100 pt-3 flex items-center justify-between">
                          <div className="flex flex-col w-2/3 pr-4">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium text-gray-600">Cupo: {enrolledCount} / {w.max_people}</span>
                              <span className={isFull ? 'text-red-500 font-bold' : 'text-blue-600 font-bold'}>
                                {capacityPercentage}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${isFull ? 'bg-red-500' : 'bg-blue-600'}`} 
                                style={{ width: `${capacityPercentage}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-sm font-medium text-blue-600 flex items-center">
                            Ver Inscritos <ChevronRight size={16} />
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="card p-8 text-center text-gray-500 bg-gray-50/50">
                  No hay talleres configurados para este congreso.
                </div>
              )}
            </section>

            {/* Pre-Orders Section */}
            <section className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingBag size={20} className="text-blue-600" />
                  Pre-órdenes de Productos ({orders.length})
                </h2>
              </div>

              {loadingOrders ? (
                <div className="card p-8 flex justify-center items-center">
                  <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
              ) : orders.length > 0 ? (
                <div className="space-y-3">
                  {orders.map((order: any) => {
                    const isExpanded = expandedOrderId === order.id
                    const orderDate = new Date(order.created_at).toLocaleString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                    
                    return (
                      <div 
                        key={order.id}
                        className="card overflow-hidden hover:border-blue-200 transition-all bg-white border border-gray-100 rounded-xl"
                      >
                        {/* Summary Row */}
                        <div 
                          onClick={() => toggleOrderExpand(order.id)}
                          className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none hover:bg-gray-50/40 transition-colors"
                        >
                          <div className="space-y-1">
                            <h3 className="font-bold text-gray-900">Dr. {order.clients?.name || 'Prospecto Anónimo'}</h3>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                              {order.clients?.email_primary && (
                                <span className="flex items-center gap-1">
                                  <Mail size={12} /> {order.clients.email_primary}
                                </span>
                              )}
                              {order.clients?.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone size={12} /> {order.clients.phone}
                                </span>
                              )}
                              <span className="bg-slate-100 px-2 py-0.5 rounded font-mono text-[10px]">
                                ID: {order.id.slice(0, 8)}...
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-6">
                            <div className="text-right">
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Pre-orden</p>
                              <p className="text-lg font-black text-blue-600">
                                {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(order.total_amount)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 font-medium">{orderDate}</span>
                              <div className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors">
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Detail Block */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              className="border-t border-gray-100 bg-gray-50/30 overflow-hidden"
                            >
                              <div className="p-5 space-y-4">
                                <div className="space-y-2">
                                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Productos de Interés</h4>
                                  <div className="divide-y divide-gray-100 border border-gray-200/60 rounded-xl bg-white overflow-hidden shadow-sm">
                                    {order.order_items.map((item: any) => (
                                      <div key={item.id} className="p-4 flex items-center justify-between text-sm">
                                        <div className="space-y-1">
                                          <p className="font-semibold text-gray-800">{item.product?.description}</p>
                                          <p className="text-xs text-gray-400 font-medium">
                                            Mod: {item.product?.model || 'Estándar'} | Cód: {item.product?.order_code || 'N/A'}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-mono text-gray-600">Cant: <strong className="text-gray-900">{item.quantity}</strong></p>
                                          <p className="text-xs text-gray-500 mt-0.5">
                                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.unit_price)} c/u
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {order.notes && (
                                  <div className="bg-blue-50/20 border border-blue-100/50 p-4 rounded-xl space-y-1">
                                    <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider">Notas del Médico</h4>
                                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="card p-8 text-center text-gray-500 bg-gray-50/50">
                  Aún no se han registrado pre-órdenes en este congreso.
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {congreso.flyer && (
              <section className="card overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="font-bold text-gray-900 text-sm">Flyer del Evento</h2>
                </div>
                <div className="aspect-[3/4] bg-gray-900 flex items-center justify-center">
                  <img src={congreso.flyer} alt="Flyer" className="w-full h-full object-cover" />
                </div>
              </section>
            )}

            {congreso.contacts?.length > 0 && (
              <section className="card">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="font-bold text-gray-900 text-sm">Contactos</h2>
                </div>
                <div className="p-4 space-y-4">
                  {congreso.contacts.map((c: any, i: number) => (
                    <div key={i} className="space-y-1 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                      <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                      {c.number && (
                        <p className="text-sm text-gray-500 flex items-center gap-2">
                          <Phone size={14} className="text-gray-400" /> {c.number}
                        </p>
                      )}
                      {c.email && (
                        <p className="text-sm text-gray-500 flex items-center gap-2 truncate">
                          <Mail size={14} className="text-gray-400 flex-shrink-0" /> {c.email}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
          
        </div>
      </div>
    </AppShell>
  )
}
