'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import { Palette, Plus, Edit2, Trash2, Search, Loader2, X } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import PermissionGuard from '@/components/PermissionGuard'

interface ProductLine {
  id: string
  name: string
  description: string | null
  color: string
  created_at: string
}

const BRAND_PALETTE = [
  { name: 'Sports Medicine', color: '#F8CBAD' },
  { name: 'ENT', color: '#BDD7EE' },
  { name: 'Spine', color: '#C6E0B4' },
  { name: 'UBE', color: '#33CCCC' },
  { name: 'Uro & Gyn', color: '#FFE699' },
  { name: 'Systems', color: '#38bdf8' },
  { name: 'Vision', color: '#E2D5F8' }
]

export default function LineasPage() {
  const { t } = useI18n()
  const [lines, setLines] = useState<ProductLine[]>([])
  const [filteredLines, setFilteredLines] = useState<ProductLine[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedLine, setSelectedLine] = useState<ProductLine | null>(null)

  // Form States
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#0763a9'
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchLines = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/catalogos/lineas')
      if (!res.ok) throw new Error('Failed to fetch lines')
      const { data } = await res.json()
      setLines(data)
      setFilteredLines(data)
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLines()
  }, [])

  useEffect(() => {
    const term = searchTerm.toLowerCase()
    setFilteredLines(
      lines.filter(l => 
        l.name.toLowerCase().includes(term) || 
        (l.description && l.description.toLowerCase().includes(term))
      )
    )
  }, [searchTerm, lines])

  const handleOpenAdd = () => {
    setSelectedLine(null)
    setFormData({ name: '', description: '', color: '#0763a9' })
    setIsEditModalOpen(true)
  }

  const handleOpenEdit = (line: ProductLine) => {
    setSelectedLine(line)
    setFormData({
      name: line.name,
      description: line.description || '',
      color: line.color
    })
    setIsEditModalOpen(true)
  }

  const handleOpenDelete = (line: ProductLine) => {
    setSelectedLine(line)
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
      const method = selectedLine ? 'PATCH' : 'POST'
      const url = selectedLine ? `/api/catalogos/lineas/${selectedLine.id}` : '/api/catalogos/lineas'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to save line')
      }

      setIsEditModalOpen(false)
      fetchLines()
    } catch (err: any) {
      console.error(err)
      alert(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedLine) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/catalogos/lineas/${selectedLine.id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete line')
      setIsDeleteModalOpen(false)
      fetchLines()
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
              <Palette className="text-[#0763a9]" size={28} />
              Líneas de Distribución
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('appName')} / Gestión de líneas de producto y colores institucionales
            </p>
          </div>
          <PermissionGuard section="congresos" action="create">
            <button 
              onClick={handleOpenAdd} 
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={18} /> Nueva Línea
            </button>
          </PermissionGuard>
        </header>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar líneas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="erp-input w-full pl-10"
          />
        </div>

        {isLoading ? (
          <div className="card p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-[#0763a9] rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-red-500 bg-red-50 border-red-100">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLines.map(line => (
              <div 
                key={line.id} 
                className="card p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all group relative overflow-hidden h-full bg-white border border-gray-200"
              >
                {/* Color Banner Ribbon */}
                <div 
                  className="absolute top-0 left-0 right-0 h-2" 
                  style={{ backgroundColor: line.color }}
                />

                {/* Admin Actions */}
                <div className="absolute top-4 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <PermissionGuard section="congresos" action="edit">
                    <button 
                      onClick={() => handleOpenEdit(line)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title={t('edit')}
                    >
                      <Edit2 size={16} />
                    </button>
                  </PermissionGuard>
                  <PermissionGuard section="congresos" action="delete">
                    <button 
                      onClick={() => handleOpenDelete(line)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title={t('delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </PermissionGuard>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-6 h-6 rounded-full border border-gray-200 shadow-sm flex-shrink-0"
                      style={{ backgroundColor: line.color }}
                    />
                    <h3 className="text-lg font-bold text-gray-900 mb-0 line-clamp-1">{line.name}</h3>
                  </div>
                  
                  <p className="text-sm text-gray-500 line-clamp-3 min-h-[60px]">
                    {line.description || 'Sin descripción.'}
                  </p>
                </div>

                <div className="w-full pt-4 mt-6 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
                  <span>Código de Color: <strong className="font-mono text-gray-700">{line.color.toUpperCase()}</strong></span>
                  <span>Creado el {new Date(line.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            
            {filteredLines.length === 0 && (
              <div className="col-span-full card p-12 text-center text-gray-500 bg-white">
                No se encontraron líneas de distribución
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Modal */}
        <Modal 
          open={isEditModalOpen} 
          onClose={() => !isSaving && setIsEditModalOpen(false)}
          title={selectedLine ? 'Editar Línea' : 'Nueva Línea'}
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
              <label className="block text-sm font-medium text-gray-700 mb-2 font-semibold">Color de la Línea *</label>
              <div className="space-y-3">
                {/* Brand Colors Shortcut */}
                <div className="space-y-1">
                  <span className="text-xs text-gray-500 font-medium">Paleta institucional recomendada:</span>
                  <div className="flex flex-wrap gap-2">
                    {BRAND_PALETTE.map(brand => (
                      <button
                        key={brand.name}
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, color: brand.color }))}
                        className={`w-8 h-8 rounded-full border shadow-sm transition-transform hover:scale-110 flex items-center justify-center ${formData.color.toLowerCase() === brand.color.toLowerCase() ? 'ring-2 ring-offset-2 ring-blue-600 scale-105' : 'border-gray-200'}`}
                        style={{ backgroundColor: brand.color }}
                        title={brand.name}
                      >
                        {formData.color.toLowerCase() === brand.color.toLowerCase() && (
                          <span className="text-[10px] font-bold text-gray-800">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Color Selector */}
                <div className="flex items-center gap-3 pt-2">
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 font-medium block mb-1">Color personalizado:</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        className="w-10 h-10 border border-gray-300 rounded-lg p-0.5 cursor-pointer" 
                        value={formData.color} 
                        onChange={e => setFormData({ ...formData, color: e.target.value })} 
                      />
                      <input
                        type="text"
                        className="erp-input w-28 uppercase font-mono text-center"
                        value={formData.color}
                        maxLength={7}
                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  {/* Live Preview */}
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 font-medium block mb-1">Vista Previa:</span>
                    <span 
                      className="px-3 py-1 rounded-full text-xs font-bold border"
                      style={{ 
                        backgroundColor: formData.color, 
                        color: '#1f2937', 
                        borderColor: 'rgba(0,0,0,0.1)' 
                      }}
                    >
                      {formData.name || 'Texto de Ejemplo'}
                    </span>
                  </div>
                </div>
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
          title="Eliminar Línea de Distribución"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              ¿Estás seguro de que deseas eliminar esta línea de distribución? Esta acción no se puede deshacer y puede afectar las cartas generadas asociadas a esta línea.
              <br/><br/>
              <strong>{selectedLine?.name}</strong>
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
