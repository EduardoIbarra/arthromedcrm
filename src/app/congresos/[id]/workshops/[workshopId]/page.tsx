'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { 
  ArrowLeft, Calendar, User, DollarSign, Users,
  Mail, Phone, ExternalLink
} from 'lucide-react'
import Link from 'next/link'

export default function WorkshopViewPage() {
  const { id, workshopId } = useParams<{ id: string; workshopId: string }>()
  const { t } = useI18n()
  const [workshop, setWorkshop] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchWorkshop = async () => {
      try {
        const res = await fetch(`/api/workshops/${workshopId}`)
        if (!res.ok) throw new Error('Failed to load')
        const { data } = await res.json()
        setWorkshop(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }
    fetchWorkshop()
  }, [workshopId])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6 md:p-8 max-w-5xl mx-auto flex justify-center items-center h-64">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      </AppShell>
    )
  }

  if (error || !workshop) {
    return (
      <AppShell>
        <div className="p-6 md:p-8 max-w-5xl mx-auto">
          <div className="card p-8 text-center text-red-500 bg-red-50 border-red-100">
            {error || 'Taller no encontrado'}
          </div>
        </div>
      </AppShell>
    )
  }

  const enrolledCount = workshop.enrollments?.length || 0
  const isFull = enrolledCount >= workshop.max_people
  const capacityPercentage = Math.min(100, Math.round((enrolledCount / workshop.max_people) * 100))

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in space-y-6">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-gray-100 pb-6">
          <div className="space-y-3 w-full">
            <Link 
              href={`/congresos/${id}/view`} 
              className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft size={16} className="mr-1" />
              {workshop.congress?.name}
            </Link>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                {workshop.name}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5 bg-purple-50 text-purple-700 px-2.5 py-1 rounded-md font-medium">
                <Calendar size={14} />
                {(() => {
                  const dStart = new Date(workshop.date_time)
                  const dEnd = workshop.end_date_time ? new Date(workshop.end_date_time) : null
                  const startStr = dStart.toLocaleString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  if (dEnd && !isNaN(dEnd.getTime())) {
                    const sameDay = dStart.toDateString() === dEnd.toDateString()
                    if (sameDay) {
                      return `${startStr} - ${dEnd.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                    } else {
                      return `${startStr} - ${dEnd.toLocaleString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                    }
                  }
                  return startStr
                })()}
              </span>
              <span className="flex items-center gap-1.5">
                <User size={14} className="text-gray-400" />
                {workshop.professor}
              </span>
              <span className="flex items-center gap-1.5 font-medium text-blue-600">
                <DollarSign size={14} />
                {workshop.cost > 0 ? formatCurrency(workshop.cost) : 'Gratis'}
              </span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          {/* Capacity Card */}
          <div className="md:col-span-1 card p-6 h-fit bg-gradient-to-b from-white to-gray-50/50">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users size={16} className="text-blue-500" />
              Capacidad
            </h2>
            <div className="text-4xl font-black text-gray-900 mb-2">
              {enrolledCount} <span className="text-xl text-gray-400 font-medium">/ {workshop.max_people}</span>
            </div>
            
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-2">
              <div 
                className={`h-full rounded-full ${isFull ? 'bg-red-500' : 'bg-blue-600'}`} 
                style={{ width: `${capacityPercentage}%` }}
              />
            </div>
            <p className="text-xs font-medium text-gray-500 text-right">
              {capacityPercentage}% Ocupado
            </p>
          </div>

          {/* Enrolled Users Table */}
          <div className="md:col-span-3 card overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Inscritos ({enrolledCount})</h2>
            </div>
            
            {enrolledCount > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Cliente</th>
                      <th className="px-6 py-4 font-semibold">Contacto</th>
                      <th className="px-6 py-4 font-semibold">Fecha Inscripción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {workshop.enrollments.map((enrollment: any) => (
                      <tr key={enrollment.client.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                              {enrollment.client.name.substring(0, 2)}
                            </div>
                            <div>
                              <Link href={`/clients/${enrollment.client.id}`} className="font-medium text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-1 group">
                                {enrollment.client.name}
                                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              </Link>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 space-y-1">
                          {enrollment.client.email_primary && (
                            <div className="flex items-center gap-2 text-xs">
                              <Mail size={12} className="text-gray-400" />
                              {enrollment.client.email_primary}
                            </div>
                          )}
                          {enrollment.client.phone && (
                            <div className="flex items-center gap-2 text-xs">
                              <Phone size={12} className="text-gray-400" />
                              {enrollment.client.phone}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(enrollment.created_at).toLocaleString('es-MX', { 
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-500">
                Aún no hay inscritos en este taller.
              </div>
            )}
          </div>

        </div>
      </div>
    </AppShell>
  )
}
