'use client'

import { useEffect, useState } from 'react'
import { Plus, Edit3, Trash2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import Link from 'next/link'

type TipoInventario = {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
}

export default function TiposInventarioPage() {
  const [tipos, setTipos] = useState<TipoInventario[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ nombre: '', descripcion: '', activo: true })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const fetchTipos = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/inventario/tipos')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setTipos(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTipos()
  }, [])

  const openNew = () => {
    setEditingId(null)
    setFormData({ nombre: '', descripcion: '', activo: true })
    setFormError(null)
    setIsModalOpen(true)
  }

  const openEdit = (tipo: TipoInventario) => {
    setEditingId(tipo.id)
    setFormData({ nombre: tipo.nombre, descripcion: tipo.descripcion || '', activo: tipo.activo })
    setFormError(null)
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setFormError(null)

    const url = editingId ? `/api/inventario/tipos/${editingId}` : '/api/inventario/tipos'
    const method = editingId ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      
      await fetchTipos()
      setIsModalOpen(false)
    } catch (e: any) {
      setFormError(e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este tipo de inventario?')) return

    try {
      const res = await fetch(`/api/inventario/tipos/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      
      setTipos(prev => prev.filter(t => t.id !== id))
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-gray-500 mb-1 text-sm">
              <Link href="/inventario" className="hover:text-blue-600 flex items-center gap-1">
                <ArrowLeft size={14} /> Volver a Inventario
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Tipos de Inventario</h1>
            <p className="text-sm text-gray-500 mt-1">Gestiona las diferentes ubicaciones o tipos de inventario</p>
          </div>
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} />
            Nuevo Tipo
          </button>
        </header>

        {isLoading ? (
          <div className="card p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-red-500 bg-red-50">{error}</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tipos.map(tipo => (
                  <tr key={tipo.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-4 font-medium text-gray-900">{tipo.nombre}</td>
                    <td className="p-4 text-sm text-gray-500">{tipo.descripcion || '—'}</td>
                    <td className="p-4">
                      {tipo.activo ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                          <CheckCircle2 size={11} /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          <AlertCircle size={11} /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(tipo)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md">
                          <Edit3 size={15} />
                        </button>
                        <button onClick={() => handleDelete(tipo.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tipos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-400">No hay tipos de inventario.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={isModalOpen} onClose={() => { if (!isSaving) setIsModalOpen(false) }} title={editingId ? 'Editar Tipo de Inventario' : 'Nuevo Tipo de Inventario'} maxWidth="450px">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              required
              className="erp-input w-full"
              value={formData.nombre}
              onChange={e => setFormData({ ...formData, nombre: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              className="erp-input w-full"
              rows={3}
              value={formData.descripcion}
              onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activo-check"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={formData.activo}
              onChange={e => setFormData({ ...formData, activo: e.target.checked })}
            />
            <label htmlFor="activo-check" className="text-sm text-gray-700">Activo</label>
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{formError}</p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary" disabled={isSaving}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
