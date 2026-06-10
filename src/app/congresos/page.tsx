/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { Congreso } from '@/types/database'
import { useI18n } from '@/contexts/I18nContext'
import { Calendar, Plus, Edit2, Trash2, MapPin, Clock, Globe, Grid, List, QrCode, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<'name' | 'date' | 'location' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    const savedMode = localStorage.getItem('congresos_view_mode') as 'grid' | 'list'
    if (savedMode === 'grid' || savedMode === 'list') {
      setViewMode(savedMode)
    }
  }, [])

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode)
    localStorage.setItem('congresos_view_mode', mode)
  }

  const handleSort = (field: 'name' | 'date' | 'location') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const filteredAndSortedCongresos = congresos
    .filter(congreso => {
      const query = searchQuery.toLowerCase().trim()
      if (!query) return true
      return (
        congreso.name.toLowerCase().includes(query) ||
        congreso.location.toLowerCase().includes(query) ||
        (congreso.description && congreso.description.toLowerCase().includes(query))
      )
    })
    .sort((a, b) => {
      if (!sortField) return 0
      
      let valA: any = ''
      let valB: any = ''
      
      if (sortField === 'name') {
        valA = a.name.toLowerCase()
        valB = b.name.toLowerCase()
      } else if (sortField === 'location') {
        valA = a.location.toLowerCase()
        valB = b.location.toLowerCase()
      } else if (sortField === 'date') {
        valA = new Date(a.start_date).getTime()
        valB = new Date(b.start_date).getTime()
      }
      
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

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

        <div className="card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
            <Search size={20} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder={t('searchCongresses' as any) || 'Buscar congresos...'}
              className="w-full bg-transparent border-none focus:outline-none text-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => handleSetViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-950'
              }`}
              title={t('cardView')}
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => handleSetViewMode('list')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-950'
              }`}
              title={t('listView')}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="card p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-red-500 bg-red-50 border-red-100">
            {error}
          </div>
        ) : filteredAndSortedCongresos.length === 0 ? (
          <div className="card p-12 text-center text-gray-500">
            {t('noResults')}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedCongresos.map(congreso => (
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
                
                <Link href={`/congresos/${congreso.id}/view`} className="flex-1 w-full group/link block">
                  <h3 className="text-lg font-bold text-gray-900 mb-1 truncate group-hover/link:text-blue-600 transition-colors">{congreso.name}</h3>
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
                </Link>

                <div className="w-full pt-4 mt-auto border-t border-gray-100 flex justify-between items-center">
                  <Link 
                    href={`/congresos/${congreso.id}/landing`} 
                    target="_blank"
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                  >
                    <Globe size={14} /> Ver Landing
                  </Link>
                  <Link 
                    href={`/qr?congressId=${congreso.id}`} 
                    className="text-sm font-medium text-gray-400 hover:text-gray-650 transition-colors"
                  >
                    {t('generateQr')}
                  </Link>
                </div>

                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-2xl shadow-sm">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/75 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                <tr>
                  <th 
                    onClick={() => handleSort('name')}
                    className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100/50 transition-colors select-none group/th"
                  >
                    <div className="flex items-center gap-1">
                      {t('name')}
                      {sortField === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />
                      ) : (
                        <ArrowUpDown size={14} className="text-gray-300 opacity-0 group-hover/th:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('date')}
                    className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100/50 transition-colors select-none group/th"
                  >
                    <div className="flex items-center gap-1">
                      {t('date')}
                      {sortField === 'date' ? (
                        sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />
                      ) : (
                        <ArrowUpDown size={14} className="text-gray-300 opacity-0 group-hover/th:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('location')}
                    className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100/50 transition-colors select-none group/th"
                  >
                    <div className="flex items-center gap-1">
                      {t('location')}
                      {sortField === 'location' ? (
                        sortDirection === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />
                      ) : (
                        <ArrowUpDown size={14} className="text-gray-300 opacity-0 group-hover/th:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left select-none">{t('landingPages')}</th>
                  <th className="px-6 py-4 text-right select-none">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredAndSortedCongresos.map(congreso => (
                  <tr key={congreso.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/congresos/${congreso.id}/view`} className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors">
                        {congreso.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-blue-400" />
                        <span>
                          {new Date(congreso.start_date).toLocaleDateString()} - {new Date(congreso.end_date).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2 max-w-xs">
                        <MapPin size={14} className="text-blue-400 flex-shrink-0" />
                        <span className="truncate" title={congreso.location}>{congreso.location}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-3">
                        <Link 
                          href={`/congresos/${congreso.id}/landing`} 
                          target="_blank"
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg"
                        >
                          <Globe size={12} /> Ver Landing
                        </Link>
                        <Link 
                          href={`/qr?congressId=${congreso.id}`} 
                          className="text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1 hover:bg-gray-100 px-2.5 py-1 rounded-lg"
                        >
                          <QrCode size={12} /> QR
                        </Link>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end items-center gap-1.5">
                        <PermissionGuard section="congresos" action="edit">
                          <button 
                            onClick={() => router.push(`/congresos/${congreso.id}`)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all cursor-pointer"
                            title={t('editCongress')}
                          >
                            <Edit2 size={16} />
                          </button>
                        </PermissionGuard>
                        <PermissionGuard section="congresos" action="delete">
                          <button 
                            onClick={() => { 
                              setSelectedCongreso(congreso); 
                              setIsDeleteModalOpen(true); 
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all cursor-pointer"
                            title={t('delete')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </PermissionGuard>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
