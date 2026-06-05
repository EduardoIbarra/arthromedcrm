'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Calendar, Users, DollarSign, BookOpen, Trash2, Edit } from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/contexts/I18nContext'

interface Workshop {
  id: string
  name: string
  date_time: string
  max_people: number
  cost: number | null
  congress_id: string | null
  congress?: { name: string }
  _count?: { enrollments: number }
  doctors?: { doctor: { name: string } }[]
}

export default function TalleresPage() {
  const { t } = useI18n()
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

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

  useEffect(() => {
    fetchWorkshops()
  }, [])

  const filtered = workshops.filter(w => 
    w.name.toLowerCase().includes(search.toLowerCase()) || 
    (w.congress?.name && w.congress.name.toLowerCase().includes(search.toLowerCase()))
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
              const docNames = w.doctors?.map(d => d.doctor.name).join(', ') || 'Sin doctor asignado'
              return (
                <div key={w.id} className="card p-5 hover:border-blue-200 transition-colors group flex flex-col h-full">
                  <div className="flex-1">
                    {w.congress_id && (
                      <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold uppercase rounded mb-2">
                        Congreso: {w.congress?.name}
                      </span>
                    )}
                    <h3 className="font-bold text-lg text-gray-900 leading-tight mb-2">{w.name}</h3>
                    
                    <div className="space-y-2 mt-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-blue-500" />
                        <span>{date.toLocaleDateString('es-MX')} {date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-blue-500" />
                        <span>Docente: <span className="font-medium text-gray-900">{docNames}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-blue-500" />
                        <span>Cupo: {w._count?.enrollments || 0} / {w.max_people}</span>
                      </div>
                      {w.cost !== null && (
                        <div className="flex items-center gap-2">
                          <DollarSign size={14} className="text-green-500" />
                          <span className="font-medium text-green-700">${Number(w.cost).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/talleres/${w.id}`} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit size={16} />
                    </Link>
                    <button onClick={() => handleDelete(w.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
