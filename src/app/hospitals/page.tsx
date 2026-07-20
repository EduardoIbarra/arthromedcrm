'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Hospital, HospitalGroup } from '@/types/database'
import { useI18n } from '@/contexts/I18nContext'
import { Building, ArrowRight, Plus, Edit2, Trash2, Tag } from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import PermissionGuard from '@/components/PermissionGuard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function HospitalsPage() {
  const { t } = useI18n()
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [groups, setGroups] = useState<HospitalGroup[]>([])
  const [error, setError] = useState<string | null>(null)

  // CRUD State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [formData, setFormData] = useState({ id: '', name: '', notes: '', admission_process: '', billing_process: '', group_id: '' })
  const [isSaving, setIsSaving] = useState(false)

  const fetchHospitals = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('hospitals')
        .select('*')
        .order('name')
        
      if (error) throw error
      setHospitals(data as Hospital[])
    } catch (err: any) {
      console.error('Error fetching hospitals:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase.from('hospital_groups').select('*').order('name')
      if (error) throw error
      setGroups(data as HospitalGroup[])
    } catch (err: any) {
      console.error('Error fetching hospital groups:', err)
    }
  }

  useEffect(() => {
    fetchHospitals()
    fetchGroups()
  }, [])
  const handleOpenModal = (hospital?: any) => {
    if (hospital) {
      setFormData({ 
        id: hospital.id, 
        name: hospital.name, 
        notes: hospital.notes || '', 
        admission_process: hospital.admission_process || '', 
        billing_process: hospital.billing_process || '',
        group_id: hospital.group_id || ''
      })
    } else {
      setFormData({ id: '', name: '', notes: '', admission_process: '', billing_process: '', group_id: '' })
    }
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) return
    setIsSaving(true)
    try {
      if (formData.id) {
        // Edit
        const { error } = await supabase
          .from('hospitals')
          .update({
            name: formData.name,
            notes: formData.notes,
            admission_process: formData.admission_process,
            billing_process: formData.billing_process,
            group_id: formData.group_id || null
          })
          .eq('id', formData.id)
        if (error) throw error
      } else {
        // Create
        const { error } = await supabase
          .from('hospitals')
          .insert({
            name: formData.name,
            notes: formData.notes,
            admission_process: formData.admission_process,
            billing_process: formData.billing_process,
            group_id: formData.group_id || null
          })
        if (error) throw error
      }
      setIsModalOpen(false)
      fetchHospitals()
    } catch (err: any) {
      console.error('Error saving hospital:', err)
      alert(t('error') + ': ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!formData.id) return
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('hospitals')
        .delete()
        .eq('id', formData.id)
      if (error) throw error
      setIsDeleteModalOpen(false)
      fetchHospitals()
    } catch (err: any) {
      console.error('Error deleting hospital:', err)
      alert(t('error') + ': ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Tag className="text-blue-600" size={28} />
            {t('hospitals')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('appName')} / {t('hospitals')}
          </p>
        </div>
        <PermissionGuard section="hospitals" action="create">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleOpenModal()} 
              className="btn-primary"
            >
              <Plus size={18} /> {t('newHospital')}
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'card' ? 'list' : 'card')}
              className="btn-secondary"
              title={viewMode === 'card' ? t('listView') : t('cardView')}
            >
              {viewMode === 'card' ? '📋 List' : '🗂 Card'}
            </button>
          </div>
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
        <>
          {viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hospitals.map(hospital => (
                <Link key={hospital.id} href={`/hospitals/${hospital.id}/prices`}>
                  <div className="card p-6 flex flex-col items-start gap-4 hover:border-blue-300 hover:shadow-md transition-all group cursor-pointer h-full relative overflow-hidden">
                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <PermissionGuard section="hospitals" action="edit">
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenModal(hospital); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard section="hospitals" action="delete">
                        <button 
                          onClick={(e) => { 
                            e.preventDefault(); e.stopPropagation(); 
                            setFormData({ id: hospital.id, name: hospital.name, notes: '', admission_process: '', billing_process: '', group_id: '' }); 
                            setIsDeleteModalOpen(true); 
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </PermissionGuard>
                    </div>

                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 group-hover:bg-blue-100 transition-all duration-300">
                      <Building size={24} />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{hospital.name}</h3>
                      <p className="text-sm text-gray-500 group-hover:text-blue-600 transition-colors inline-flex items-center gap-1 font-medium">
                        {t('hospitalPrices')} <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </p>
                    </div>

                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto card">
              <table className="min-w-full border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('name')}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('notes')}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('admissionProcess')}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('billingProcess')}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {hospitals.map(hospital => (
                    <tr key={hospital.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{hospital.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{(hospital as any).notes || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{(hospital as any).admission_process || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{(hospital as any).billing_process || '-'}</td>
                      <td className="px-4 py-3 flex gap-2">
                        <PermissionGuard section="hospitals" action="edit">
                          <button onClick={() => handleOpenModal(hospital)} className="text-gray-400 hover:text-blue-600"><Edit2 size={16} /></button>
                        </PermissionGuard>
                        <PermissionGuard section="hospitals" action="delete">
                          <button onClick={() => { setFormData({ id: hospital.id, name: hospital.name, notes: '', admission_process: '', billing_process: '', group_id: '' }); setIsDeleteModalOpen(true); }} className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                        </PermissionGuard>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {hospitals.length === 0 && (
            <div className="col-span-full card p-12 text-center text-gray-500">
              {t('noResults')}
            </div>
          )}
        </>
      )}

      {/* Form Modal */}
      <Modal 
        open={isModalOpen} 
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={formData.id ? t('editHospital') : t('newHospital')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('hospitalName')}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="erp-input w-full"
              autoFocus
            />
            <label className="block text-sm font-medium text-gray-700 mt-3 mb-1">{t('notes')}</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="erp-input w-full"
            />
            <label className="block text-sm font-medium text-gray-700 mt-3 mb-1">{t('admissionProcess')}</label>
            <input
              type="text"
              value={formData.admission_process || ''}
              onChange={(e) => setFormData({ ...formData, admission_process: e.target.value })}
              className="erp-input w-full"
            />
            <label className="block text-sm font-medium text-gray-700 mt-3 mb-1">{t('billingProcess')}</label>
            <input
              type="text"
              value={formData.billing_process || ''}
              onChange={(e) => setFormData({ ...formData, billing_process: e.target.value })}
              className="erp-input w-full"
            />
            <label className="block text-sm font-medium text-gray-700 mt-3 mb-1">{t('hospitalGroup')}</label>
            <select
              value={formData.group_id || ''}
              onChange={(e) => setFormData({ ...formData, group_id: e.target.value || '' })}
              className="erp-input w-full"
            >
              <option value="">{t('none')}</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button 
              onClick={() => setIsModalOpen(false)} 
              className="btn-secondary"
              disabled={isSaving}
            >
              {t('cancel')}
            </button>
            <button 
              onClick={handleSave} 
              className="btn-primary"
              disabled={!formData.name.trim() || isSaving}
            >
              {isSaving ? t('loading') : t('saveChanges')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal 
        open={isDeleteModalOpen} 
        onClose={() => !isSaving && setIsDeleteModalOpen(false)}
        title={t('delete')}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            {t('deleteHospitalDesc')}
            <br/><br/>
            <strong>{formData.name}</strong>
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <button 
              onClick={() => setIsDeleteModalOpen(false)} 
              className="btn-secondary"
              disabled={isSaving}
            >
              {t('cancel')}
            </button>
            <button 
              onClick={handleDelete} 
              className="btn-primary bg-red-600 border-red-600 hover:bg-red-700 hover:border-red-700 text-white"
              disabled={isSaving}
            >
              {isSaving ? t('loading') : t('delete')}
            </button>
          </div>
        </div>
      </Modal>

    </div>
    </AppShell>
  )
}
