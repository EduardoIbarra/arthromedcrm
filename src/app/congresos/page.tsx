'use client'

import { useEffect, useState } from 'react'
import { Congreso } from '@/types/database'
import { useI18n } from '@/contexts/I18nContext'
import { Calendar, Plus, Edit2, Trash2, MapPin, Clock } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import PermissionGuard from '@/components/PermissionGuard'

export default function CongresosPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [congresos, setCongresos] = useState<Congreso[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedCongreso, setSelectedCongreso] = useState<Congreso | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchCongresos = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/congresos')
      if (!res.ok) {
        throw new Error('Failed to fetch congresos')
      }
      const { data } = await res.json()
      setCongresos(data)
    } catch (err: any) {
      console.error('Error fetching congresos:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCongresos()
  }, [])

  const handleDelete = async () => {
    if (!selectedCongreso) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/congresos/${selectedCongreso.id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete')
      
      setIsDeleteModalOpen(false)
      fetchCongresos()
    } catch (err: any) {
      console.error('Error deleting congreso:', err)
      alert(t('error') + ': ' + err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Calendar className="text-blue-600" size={28} />
              {t('congresos')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('appName')} / {t('events')}
            </p>
          </div>
          <PermissionGuard section="congresos" action="create">
            <Link 
              href="/congresos/new" 
              className="btn-primary"
            >
              <Plus size={18} /> {t('newCongress')}
            </Link>
          </PermissionGuard>
        </header>

        {isLoading ? (
          <div className="card p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-red-500 bg-red-50 border-red-100">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {congresos.map(congreso => (
              <div key={congreso.id} className="card p-6 flex flex-col items-start gap-4 hover:border-blue-300 hover:shadow-md transition-all group relative overflow-hidden h-full">
                
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <PermissionGuard section="congresos" action="edit">
                    <button 
                      onClick={(e) => { 
                        e.preventDefault(); e.stopPropagation(); 
                        router.push(`/congresos/${congreso.id}`) 
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title={t('editCongress')}
                    >
                      <Edit2 size={16} />
                    </button>
                  </PermissionGuard>
                  <PermissionGuard section="congresos" action="delete">
                    <button 
                      onClick={(e) => { 
                        e.preventDefault(); e.stopPropagation(); 
                        setSelectedCongreso(congreso); 
                        setIsDeleteModalOpen(true); 
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title={t('delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </PermissionGuard>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 group-hover:bg-blue-100 transition-all duration-300">
                  <Calendar size={24} />
                </div>
                
                <div className="flex-1 w-full">
                  <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">{congreso.name}</h3>
                  <div className="space-y-2 mt-3">
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <Clock size={14} className="text-blue-400" />
                      {new Date(congreso.start_date).toLocaleDateString()} - {new Date(congreso.end_date).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-500 flex items-center gap-2 truncate">
                      <MapPin size={14} className="text-blue-400 flex-shrink-0" />
                      <span className="truncate">{congreso.location}</span>
                    </p>
                  </div>
                </div>

                <div className="w-full pt-4 mt-auto border-t border-gray-100 flex justify-between items-center">
                  <Link 
                    href={`/qr?congressId=${congreso.id}`} 
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {t('generateQr')}
                  </Link>
                </div>

                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            ))}
            
            {congresos.length === 0 && (
              <div className="col-span-full card p-12 text-center text-gray-500">
                {t('noResults')}
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <Modal 
          open={isDeleteModalOpen} 
          onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
          title={t('delete')}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              {t('deleteCongressDesc')}
              <br/><br/>
              <strong>{selectedCongreso?.name}</strong>
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setIsDeleteModalOpen(false)} 
                className="btn-secondary"
                disabled={isDeleting}
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleDelete} 
                className="btn-primary bg-red-600 border-red-600 hover:bg-red-700 hover:border-red-700 text-white"
                disabled={isDeleting}
              >
                {isDeleting ? t('loading') : t('delete')}
              </button>
            </div>
          </div>
        </Modal>

      </div>
    </AppShell>
  )
}
