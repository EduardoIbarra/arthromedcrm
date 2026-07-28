'use client'

import { useState, useEffect } from 'react'
import {
  Plus, Edit2, Trash2, Check, X, Loader2, ListChecks, ArrowUpDown
} from 'lucide-react'

interface TareaPreset {
  id: string
  tarea: string
  descripcion_ot: string
  descripcion_reporte: string
  orden: number
}

export default function MantenimientoTareasPresetManager() {
  const [tareas, setTareas] = useState<TareaPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewRow, setShowNewRow] = useState(false)

  // Edit form state
  const [editForm, setEditForm] = useState({
    tarea: '',
    descripcion_ot: '',
    descripcion_reporte: '',
    orden: 0,
  })

  // New form state
  const [newForm, setNewForm] = useState({
    tarea: '',
    descripcion_ot: '',
    descripcion_reporte: '',
    orden: 0,
  })

  const fetchTareas = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/mantenimiento/tareas-preset')
      if (res.ok) {
        const data = await res.json()
        setTareas(data)
      }
    } catch (e) {
      console.error('Error fetching tareas preset:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTareas()
  }, [])

  const startEdit = (t: TareaPreset) => {
    setEditingId(t.id)
    setEditForm({
      tarea: t.tarea,
      descripcion_ot: t.descripcion_ot,
      descripcion_reporte: t.descripcion_reporte,
      orden: t.orden,
    })
  }

  const saveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/mantenimiento/tareas-preset/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        setEditingId(null)
        fetchTareas()
      }
    } catch (e) {
      console.error('Error saving edited tarea:', e)
    }
  }

  const createTarea = async () => {
    if (!newForm.tarea.trim()) return
    try {
      const res = await fetch('/api/mantenimiento/tareas-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newForm,
          orden: newForm.orden || tareas.length + 1,
        }),
      })
      if (res.ok) {
        setShowNewRow(false)
        setNewForm({ tarea: '', descripcion_ot: '', descripcion_reporte: '', orden: 0 })
        fetchTareas()
      }
    } catch (e) {
      console.error('Error creating tarea:', e)
    }
  }

  const deleteTarea = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta tarea predeterminada?')) return
    try {
      const res = await fetch(`/api/mantenimiento/tareas-preset/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) fetchTareas()
    } catch (e) {
      console.error('Error deleting tarea:', e)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Catálogo de Tareas Predeterminadas</h2>
            <p className="text-xs text-gray-500">
              Estas tareas aparecen pre-cargadas al crear un nuevo reporte de mantenimiento preventivo.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setShowNewRow(true)
            setNewForm({ tarea: '', descripcion_ot: '', descripcion_reporte: '', orden: tareas.length + 1 })
          }}
          className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Nueva Tarea</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                <th className="p-3 font-bold w-16 text-center">Orden</th>
                <th className="p-3 font-bold w-48">Nombre Tarea</th>
                <th className="p-3 font-bold">Descripción OT (Work Order)</th>
                <th className="p-3 font-bold">Descripción Reporte (Narrativa)</th>
                <th className="p-3 font-bold text-right w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">

              {/* New Row Form */}
              {showNewRow && (
                <tr className="bg-blue-50/40 border-b border-blue-100">
                  <td className="p-2 text-center">
                    <input
                      type="number"
                      value={newForm.orden}
                      onChange={e => setNewForm({ ...newForm, orden: Number(e.target.value) })}
                      className="w-12 text-center rounded-lg border border-gray-300 py-1 text-xs outline-none"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      placeholder="Nombre de tarea..."
                      value={newForm.tarea}
                      onChange={e => setNewForm({ ...newForm, tarea: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 p-1.5 text-xs font-semibold outline-none"
                    />
                  </td>
                  <td className="p-2">
                    <textarea
                      rows={2}
                      placeholder="Descripción corta para Orden de Trabajo..."
                      value={newForm.descripcion_ot}
                      onChange={e => setNewForm({ ...newForm, descripcion_ot: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 p-1.5 text-xs outline-none resize-none"
                    />
                  </td>
                  <td className="p-2">
                    <textarea
                      rows={2}
                      placeholder="Descripción narrativa para Reporte con fotos..."
                      value={newForm.descripcion_reporte}
                      onChange={e => setNewForm({ ...newForm, descripcion_reporte: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 p-1.5 text-xs outline-none resize-none"
                    />
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={createTarea}
                        className="rounded-lg bg-emerald-600 text-white p-1.5 hover:bg-emerald-700"
                        title="Guardar"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setShowNewRow(false)}
                        className="rounded-lg bg-gray-200 text-gray-700 p-1.5 hover:bg-gray-300"
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Tareas List */}
              {tareas.map(t => (
                <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                  {editingId === t.id ? (
                    <>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          value={editForm.orden}
                          onChange={e => setEditForm({ ...editForm, orden: Number(e.target.value) })}
                          className="w-12 text-center rounded-lg border border-gray-300 py-1 text-xs outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={editForm.tarea}
                          onChange={e => setEditForm({ ...editForm, tarea: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 p-1.5 text-xs font-semibold outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <textarea
                          rows={3}
                          value={editForm.descripcion_ot}
                          onChange={e => setEditForm({ ...editForm, descripcion_ot: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 p-1.5 text-xs outline-none resize-none"
                        />
                      </td>
                      <td className="p-2">
                        <textarea
                          rows={3}
                          value={editForm.descripcion_reporte}
                          onChange={e => setEditForm({ ...editForm, descripcion_reporte: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 p-1.5 text-xs outline-none resize-none"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => saveEdit(t.id)}
                            className="rounded-lg bg-emerald-600 text-white p-1.5 hover:bg-emerald-700"
                            title="Guardar"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-lg bg-gray-200 text-gray-700 p-1.5 hover:bg-gray-300"
                            title="Cancelar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 text-center font-bold text-gray-400">{t.orden}</td>
                      <td className="p-3 font-bold text-gray-900">{t.tarea}</td>
                      <td className="p-3 text-gray-700 whitespace-pre-wrap leading-relaxed">{t.descripcion_ot}</td>
                      <td className="p-3 text-gray-700 whitespace-pre-wrap leading-relaxed">{t.descripcion_reporte}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => startEdit(t)}
                            className="rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-600 p-1.5 text-gray-600 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteTarea(t.id)}
                            className="rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-600 p-1.5 text-gray-600 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
