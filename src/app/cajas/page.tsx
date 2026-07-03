'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import { Box, Plus, Edit2, Trash2, Search, Loader2, Maximize2, Scale, Info, Palette } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import PermissionGuard from '@/components/PermissionGuard'

interface Caja {
  id: string
  name: string
  largo: number | null
  ancho: number | null
  alto: number | null
  unidad: string
  peso_max: number | null
  color: string
  descripcion: string | null
  notas: string | null
  created_at: string
}

export default function CajasPage() {
  const { t } = useI18n()
  const [cajas, setCajas] = useState<Caja[]>([])
  const [filteredCajas, setFilteredCajas] = useState<Caja[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedCaja, setSelectedCaja] = useState<Caja | null>(null)

  // Form States
  const [formData, setFormData] = useState({
    name: '',
    largo: '',
    ancho: '',
    alto: '',
    unidad: 'cm',
    peso_max: '',
    color: '#0763a9',
    descripcion: '',
    notas: ''
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchCajas = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/cajas')
      if (!res.ok) throw new Error('Failed to fetch cajas')
      const { data } = await res.json()
      setCajas(data)
      setFilteredCajas(data)
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCajas()
  }, [])

  useEffect(() => {
    const term = searchTerm.toLowerCase()
    setFilteredCajas(
      cajas.filter(c => 
        c.name.toLowerCase().includes(term) || 
        (c.descripcion && c.descripcion.toLowerCase().includes(term)) ||
        (c.notas && c.notas.toLowerCase().includes(term))
      )
    )
  }, [searchTerm, cajas])

  const handleOpenAdd = () => {
    setSelectedCaja(null)
    setFormData({
      name: '',
      largo: '',
      ancho: '',
      alto: '',
      unidad: 'cm',
      peso_max: '',
      color: '#0763a9',
      descripcion: '',
      notas: ''
    })
    setIsEditModalOpen(true)
  }

  const handleOpenEdit = (caja: Caja) => {
    setSelectedCaja(caja)
    setFormData({
      name: caja.name,
      largo: caja.largo !== null ? String(caja.largo) : '',
      ancho: caja.ancho !== null ? String(caja.ancho) : '',
      alto: caja.alto !== null ? String(caja.alto) : '',
      unidad: caja.unidad || 'cm',
      peso_max: caja.peso_max !== null ? String(caja.peso_max) : '',
      color: caja.color || '#0763a9',
      descripcion: caja.descripcion || '',
      notas: caja.notas || ''
    })
    setIsEditModalOpen(true)
  }

  const handleOpenDelete = (caja: Caja) => {
    setSelectedCaja(caja)
    setIsDeleteModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert('El nombre es obligatorio.')
      return
    }

    setIsSaving(true)
    try {
      const method = selectedCaja ? 'PATCH' : 'POST'
      const url = selectedCaja ? `/api/cajas/${selectedCaja.id}` : '/api/cajas'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to save caja')
      }

      setIsEditModalOpen(false)
      fetchCajas()
    } catch (err: any) {
      console.error(err)
      alert(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedCaja) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/cajas/${selectedCaja.id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete caja')
      setIsDeleteModalOpen(false)
      fetchCajas()
    } catch (err: any) {
      console.error(err)
      alert(err.message)
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
              <Box className="text-[#0763a9]" size={28} />
              Cajas
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('appName')} / Gestión de cajas de empaque, dimensiones y pesos máximos
            </p>
          </div>
          <PermissionGuard section="cajas" action="create">
            <button 
              onClick={handleOpenAdd} 
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={18} /> Nueva Caja
            </button>
          </PermissionGuard>
        </header>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar cajas por nombre o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="erp-input w-full pl-10"
          />
        </div>

        {isLoading ? (
          <div className="card p-12 flex justify-center bg-white border border-gray-100 rounded-2xl shadow-sm">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-[#0763a9] rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-red-500 bg-red-50 border-red-100 rounded-2xl">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCajas.map(caja => {
              const hasSizes = caja.largo || caja.ancho || caja.alto
              return (
                <div 
                  key={caja.id} 
                  className="card p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all group relative overflow-hidden h-full bg-white border border-gray-200 rounded-2xl shadow-sm"
                >
                  {/* Decorative color strip */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-1.5 transition-all duration-300"
                    style={{ backgroundColor: caja.color || '#0763a9' }}
                  />

                  {/* Actions overlay */}
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <PermissionGuard section="cajas" action="edit">
                      <button 
                        onClick={() => handleOpenEdit(caja)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t('edit')}
                      >
                        <Edit2 size={16} />
                      </button>
                    </PermissionGuard>
                    <PermissionGuard section="cajas" action="delete">
                      <button 
                        onClick={() => handleOpenDelete(caja)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t('delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </PermissionGuard>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                        <Box size={18} className="text-gray-400" />
                        {caja.name}
                      </h3>
                      {caja.descripcion && (
                        <p className="text-sm text-gray-500 line-clamp-2 min-h-[40px]">
                          {caja.descripcion}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 text-sm text-gray-600 border-t border-gray-50 pt-3">
                      <div className="flex items-center gap-2">
                        <Maximize2 size={16} className="text-gray-400" />
                        <span>
                          <strong>Medidas: </strong>
                          {hasSizes ? (
                            `${caja.largo || '-'} × ${caja.ancho || '-'} × ${caja.alto || '-'} ${caja.unidad}`
                          ) : (
                            <span className="text-gray-400 italic">No especificadas</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Scale size={16} className="text-gray-400" />
                        <span>
                          <strong>Peso máx: </strong>
                          {caja.peso_max !== null ? `${caja.peso_max} kg` : <span className="text-gray-400 italic">No especificado</span>}
                        </span>
                      </div>

                      {caja.notas && (
                        <div className="flex items-start gap-2 bg-gray-50 p-2 rounded-lg mt-2">
                          <Info size={14} className="text-[#0763a9] mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-gray-500 italic line-clamp-2">
                            {caja.notas}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full pt-4 mt-6 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                      Creado el {new Date(caja.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-500">Color visual:</span>
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-200" 
                        style={{ backgroundColor: caja.color }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
            
            {filteredCajas.length === 0 && (
              <div className="col-span-full card p-12 text-center text-gray-500 bg-white border border-gray-200 rounded-2xl shadow-sm">
                No se encontraron cajas.
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Modal */}
        <Modal 
          open={isEditModalOpen} 
          onClose={() => !isSaving && setIsEditModalOpen(false)}
          title={selectedCaja ? 'Editar Caja' : 'Nueva Caja'}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre de la Caja *</label>
              <input 
                required 
                type="text" 
                placeholder="Ej. Caja Mediana Reforzada"
                className="erp-input w-full" 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Largo</label>
                <input 
                  type="number" 
                  step="any"
                  placeholder="0.0"
                  className="erp-input w-full text-sm" 
                  value={formData.largo} 
                  onChange={e => setFormData({ ...formData, largo: e.target.value })} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Ancho</label>
                <input 
                  type="number" 
                  step="any"
                  placeholder="0.0"
                  className="erp-input w-full text-sm" 
                  value={formData.ancho} 
                  onChange={e => setFormData({ ...formData, ancho: e.target.value })} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Alto</label>
                <input 
                  type="number" 
                  step="any"
                  placeholder="0.0"
                  className="erp-input w-full text-sm" 
                  value={formData.alto} 
                  onChange={e => setFormData({ ...formData, alto: e.target.value })} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Unidad</label>
                <select 
                  className="erp-input w-full text-sm py-2 px-1"
                  value={formData.unidad} 
                  onChange={e => setFormData({ ...formData, unidad: e.target.value })}
                >
                  <option value="cm">cm</option>
                  <option value="in">in</option>
                  <option value="mm">mm</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Peso Máximo (kg)</label>
                <input 
                  type="number" 
                  step="any"
                  placeholder="Ej. 15.5"
                  className="erp-input w-full" 
                  value={formData.peso_max} 
                  onChange={e => setFormData({ ...formData, peso_max: e.target.value })} 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Color Identificador</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="color" 
                    className="w-10 h-10 p-0 border border-gray-300 rounded-lg cursor-pointer" 
                    value={formData.color} 
                    onChange={e => setFormData({ ...formData, color: e.target.value })} 
                  />
                  <input 
                    type="text" 
                    className="erp-input flex-1 text-sm uppercase" 
                    maxLength={7}
                    value={formData.color} 
                    onChange={e => setFormData({ ...formData, color: e.target.value })} 
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Descripción</label>
              <textarea 
                rows={2} 
                placeholder="Breve descripción del uso o material..."
                className="erp-input w-full text-sm" 
                value={formData.descripcion} 
                onChange={e => setFormData({ ...formData, descripcion: e.target.value })} 
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Notas Opcionales</label>
              <textarea 
                rows={2} 
                placeholder="Observaciones o notas adicionales..."
                className="erp-input w-full text-sm" 
                value={formData.notas} 
                onChange={e => setFormData({ ...formData, notas: e.target.value })} 
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
              <button 
                type="button" 
                onClick={() => setIsEditModalOpen(false)} 
                className="btn-secondary"
                disabled={isSaving}
              >
                {t('cancel')}
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={isSaving}
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Delete Modal */}
        <Modal 
          open={isDeleteModalOpen} 
          onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
          title="Eliminar Caja"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              ¿Estás seguro de que deseas eliminar esta caja? Esta acción no se puede deshacer.
              <br/><br/>
              <strong>{selectedCaja?.name}</strong>
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
