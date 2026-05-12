'use client'

import { useEffect, useState } from 'react'
import { Gasto } from '@/types/database'
import { useI18n } from '@/contexts/I18nContext'
import { Receipt, Plus, Edit2, Trash2, Calendar, DollarSign, MessageSquare, Tag } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import PermissionGuard from '@/components/PermissionGuard'

interface GastoWithCongreso extends Gasto {
  congreso?: {
    name: string
  }
  category?: {
    name: string
  }
}

export default function GastosPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [gastos, setGastos] = useState<GastoWithCongreso[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedGasto, setSelectedGasto] = useState<GastoWithCongreso | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchGastos = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/gastos')
      if (!res.ok) {
        throw new Error('Failed to fetch gastos')
      }
      const { data } = await res.json()
      setGastos(data)
    } catch (err: any) {
      console.error('Error fetching gastos:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchGastos()
  }, [])

  const handleDelete = async () => {
    if (!selectedGasto) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/gastos/${selectedGasto.id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete')
      
      setIsDeleteModalOpen(false)
      fetchGastos()
    } catch (err: any) {
      console.error('Error deleting gasto:', err)
      alert(t('error') + ': ' + err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount)
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Receipt className="text-blue-600" size={28} />
              {t('gastos')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('appName')} / {t('events')}
            </p>
          </div>
          <PermissionGuard section="gastos" action="create">
            <Link 
              href="/gastos/new" 
              className="btn-primary"
            >
              <Plus size={18} /> {t('newGasto')}
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
            {gastos.map(gasto => (
              <div key={gasto.id} className="card p-6 flex flex-col items-start gap-4 hover:border-blue-300 hover:shadow-md transition-all group relative overflow-hidden h-full">
                
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <PermissionGuard section="gastos" action="edit">
                    <button 
                      onClick={(e) => { 
                        e.preventDefault(); e.stopPropagation(); 
                        router.push(`/gastos/${gasto.id}`) 
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title={t('editGasto')}
                    >
                      <Edit2 size={16} />
                    </button>
                  </PermissionGuard>
                  <PermissionGuard section="gastos" action="delete">
                    <button 
                      onClick={(e) => { 
                        e.preventDefault(); e.stopPropagation(); 
                        setSelectedGasto(gasto); 
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
                  <Receipt size={24} />
                </div>
                
                <div className="flex-1 w-full">
                  <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">{gasto.name}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 min-h-[2.5rem]">{gasto.description}</p>
                  
                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400 uppercase font-semibold">{t('total')}</span>
                      <span className="text-lg font-bold text-blue-600">{formatCurrency(gasto.total)}</span>
                    </div>
                    
                    <div className="pt-2 space-y-1.5 border-t border-gray-50">
                      {gasto.category && (
                        <p className="text-xs text-blue-600 font-semibold flex items-center gap-2">
                          <Tag size={12} />
                          {gasto.category.name}
                        </p>
                      )}
                      {gasto.congreso && (
                        <p className="text-xs text-gray-500 flex items-center gap-2">
                          <Calendar size={12} className="text-blue-400" />
                          <span className="truncate">{gasto.congreso.name}</span>
                        </p>
                      )}
                      <p className="text-xs text-gray-400 flex items-center gap-2">
                        <DollarSign size={12} />
                        {t('amount')}: {formatCurrency(gasto.amount)} | {t('iva')} ({gasto.iva_percent}%): {formatCurrency(gasto.iva)}
                      </p>
                      {gasto.comments && (
                        <p className="text-xs text-gray-400 flex items-center gap-2 italic truncate">
                          <MessageSquare size={12} />
                          {gasto.comments}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            ))}
            
            {gastos.length === 0 && (
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
              {t('deleteGastoDesc')}
              <br/><br/>
              <strong>{selectedGasto?.name}</strong>
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
