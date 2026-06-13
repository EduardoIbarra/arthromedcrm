'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import { FileText, Plus, Edit2, Trash2, ExternalLink, Upload, X, Loader2, Search } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import PermissionGuard from '@/components/PermissionGuard'
import { createClient } from '@/lib/supabase/client'

interface Catalog {
  id: string
  name: string
  pdf_url: string
  description: string | null
  created_at: string
}

export default function CatalogosPage() {
  const { t } = useI18n()
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [filteredCatalogs, setFilteredCatalogs] = useState<Catalog[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedCatalog, setSelectedCatalog] = useState<Catalog | null>(null)

  // Form States
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    pdf_url: ''
  })
  const [uploading, setUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const supabase = createClient()

  const fetchCatalogs = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/catalogos')
      if (!res.ok) throw new Error('Failed to fetch catalogs')
      const { data } = await res.json()
      setCatalogs(data)
      setFilteredCatalogs(data)
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCatalogs()
  }, [])

  useEffect(() => {
    const term = searchTerm.toLowerCase()
    setFilteredCatalogs(
      catalogs.filter(c => 
        c.name.toLowerCase().includes(term) || 
        (c.description && c.description.toLowerCase().includes(term))
      )
    )
  }, [searchTerm, catalogs])

  const handleOpenAdd = () => {
    setSelectedCatalog(null)
    setFormData({ name: '', description: '', pdf_url: '' })
    setIsEditModalOpen(true)
  }

  const handleOpenEdit = (catalog: Catalog) => {
    setSelectedCatalog(catalog)
    setFormData({
      name: catalog.name,
      description: catalog.description || '',
      pdf_url: catalog.pdf_url
    })
    setIsEditModalOpen(true)
  }

  const handleOpenDelete = (catalog: Catalog) => {
    setSelectedCatalog(catalog)
    setIsDeleteModalOpen(true)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      alert('Solo se admiten archivos PDF.')
      return
    }

    setUploading(true)
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const { data, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(`catalogos/${fileName}`, file)
      
      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(data.path)

      setFormData(prev => ({ ...prev, pdf_url: publicUrlData.publicUrl }))
    } catch (err: any) {
      console.error(err)
      alert('Error al subir PDF: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.pdf_url) {
      alert('Nombre y PDF son campos obligatorios.')
      return
    }

    setIsSaving(true)
    try {
      const method = selectedCatalog ? 'PATCH' : 'POST'
      const url = selectedCatalog ? `/api/catalogos/${selectedCatalog.id}` : '/api/catalogos'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to save catalog')
      }

      setIsEditModalOpen(false)
      fetchCatalogs()
    } catch (err: any) {
      console.error(err)
      alert(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedCatalog) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/catalogos/${selectedCatalog.id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete catalog')
      setIsDeleteModalOpen(false)
      fetchCatalogs()
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
              <FileText className="text-blue-600" size={28} />
              Catálogos
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('appName')} / Gestión de Documentos PDF
            </p>
          </div>
          <PermissionGuard section="congresos" action="create">
            <button 
              onClick={handleOpenAdd} 
              className="btn-primary"
            >
              <Plus size={18} /> Nuevo Catálogo
            </button>
          </PermissionGuard>
        </header>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar catálogos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="erp-input w-full pl-10"
          />
        </div>

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
            {filteredCatalogs.map(catalog => (
              <div key={catalog.id} className="card p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all group relative overflow-hidden h-full bg-white">
                
                {/* Admin Actions */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <PermissionGuard section="congresos" action="edit">
                    <button 
                      onClick={() => handleOpenEdit(catalog)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title={t('edit')}
                    >
                      <Edit2 size={16} />
                    </button>
                  </PermissionGuard>
                  <PermissionGuard section="congresos" action="delete">
                    <button 
                      onClick={() => handleOpenDelete(catalog)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title={t('delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </PermissionGuard>
                </div>

                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 group-hover:scale-110 group-hover:bg-red-100 transition-all duration-300">
                    <FileText size={24} />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1">{catalog.name}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 min-h-[40px]">
                      {catalog.description || 'Sin descripción.'}
                    </p>
                  </div>
                </div>

                <div className="w-full pt-4 mt-6 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-xs text-gray-400">
                    Subido el {new Date(catalog.created_at).toLocaleDateString()}
                  </span>
                  <a 
                    href={catalog.pdf_url} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    Abrir PDF <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ))}
            
            {filteredCatalogs.length === 0 && (
              <div className="col-span-full card p-12 text-center text-gray-500 bg-white">
                No se encontraron catálogos
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Modal */}
        <Modal 
          open={isEditModalOpen} 
          onClose={() => !isSaving && setIsEditModalOpen(false)}
          title={selectedCatalog ? 'Editar Catálogo' : 'Nuevo Catálogo'}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-semibold">Nombre *</label>
              <input 
                required 
                type="text" 
                className="erp-input w-full" 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-semibold">Descripción</label>
              <textarea 
                rows={3} 
                className="erp-input w-full" 
                value={formData.description} 
                onChange={e => setFormData({ ...formData, description: e.target.value })} 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-semibold">Archivo PDF *</label>
              <div className="space-y-2">
                {formData.pdf_url && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-100 rounded-xl">
                    <FileText size={16} className="text-blue-600" />
                    <span className="text-sm text-blue-600 truncate flex-1 font-medium">
                      Archivo cargado correctamente
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setFormData(p => ({ ...p, pdf_url: '' }))} 
                      className="text-red-500 hover:bg-red-50 p-1 rounded-lg"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                {!formData.pdf_url && (
                  <label className="btn-secondary w-full justify-center cursor-pointer text-sm py-2.5">
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    Subir Archivo PDF
                    <input 
                      type="file" 
                      accept=".pdf" 
                      className="hidden" 
                      onChange={handleFileUpload} 
                      disabled={uploading} 
                    />
                  </label>
                )}
              </div>
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
                disabled={isSaving || uploading}
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
          title="Eliminar Catálogo"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              ¿Estás seguro de que deseas eliminar este catálogo? Esta acción no se puede deshacer y se removerá de todos los congresos asociados.
              <br/><br/>
              <strong>{selectedCatalog?.name}</strong>
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
