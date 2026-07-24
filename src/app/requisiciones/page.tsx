'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import { useUser } from '@/contexts/UserContext'
import {
  ClipboardList, Plus, Search, Loader2, Download, Trash2,
  Calendar, RefreshCw, Eye, FileSpreadsheet
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import PermissionGuard from '@/components/PermissionGuard'

interface RequisicionItem {
  id?: string
  descripcion: string
  cantidad: number
  unidad: string
  costo_estimado: number
}

interface Requisicion {
  id: string
  folio: string
  fecha_solicitud: string
  departamento: string
  fecha_requerida: string
  solicitante_nombre: string
  solicitante_telefono: string | null
  observaciones: string | null
  aprobacion_nombre: string | null
  aprobacion_fecha: string | null
  status: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'COMPRADA'
  created_at: string
  items: RequisicionItem[]
}

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-200',
  APROBADA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RECHAZADA: 'bg-rose-50 text-rose-700 border-rose-200',
  COMPRADA: 'bg-sky-50 text-sky-700 border-sky-200'
}

export default function RequisicionesPage() {
  const { t } = useI18n()
  const router = useRouter()

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requisiciones, setRequisiciones] = useState<Requisicion[]>([])

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/requisiciones')
      if (!res.ok) throw new Error('Error al cargar requisiciones')
      const json = await res.json()
      setRequisiciones(json.data || [])
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Filtered requisiciones list
  const filteredList = useMemo(() => {
    return requisiciones.filter(r => {
      const matchStatus = !statusFilter || r.status === statusFilter
      const q = searchTerm.toLowerCase().trim()
      if (!q) return matchStatus
      const matchSearch =
        r.folio.toLowerCase().includes(q) ||
        r.solicitante_nombre.toLowerCase().includes(q) ||
        r.departamento.toLowerCase().includes(q) ||
        (r.observaciones && r.observaciones.toLowerCase().includes(q))
      return matchStatus && matchSearch
    })
  }, [requisiciones, searchTerm, statusFilter])

  // Delete Requisition
  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta requisición?')) return
    try {
      const res = await fetch(`/api/requisiciones/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      fetchData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const getRequisitionTotal = (req: Requisicion) => {
    return req.items.reduce((acc, curr) => acc + (curr.cantidad * curr.costo_estimado), 0)
  }

  return (
    <AppShell>
      <PermissionGuard section="requisiciones" action="view">
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-blue-50/80 shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <ClipboardList className="text-[#0763a9]" size={28} />
                Requisiciones de Compra
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Administra, descarga y aprueba requisiciones de bienes o servicios.
              </p>
            </div>
            <button
              onClick={() => router.push('/requisiciones/nueva')}
              className="flex items-center justify-center gap-2 bg-[#0763a9] hover:bg-[#054e85] text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm active:scale-95"
            >
              <Plus size={20} />
              Nueva Requisición
            </button>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por folio, solicitante, departamento u observaciones..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-slate-5/30 transition-colors"
              />
            </div>
            <div className="w-full md:w-48">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white transition-colors"
              >
                <option value="">Todos los Estados</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="APROBADA">Aprobadas</option>
                <option value="RECHAZADA">Rechazadas</option>
                <option value="COMPRADA">Compradas</option>
              </select>
            </div>
            <button
              onClick={fetchData}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors"
              title="Actualizar datos"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Requisitions List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <Loader2 className="w-10 h-10 text-[#0763a9] animate-spin" />
              <p className="text-slate-400 text-sm mt-3">Cargando requisiciones...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm text-slate-400">
              <ClipboardList className="mx-auto w-12 h-12 text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">No se encontraron requisiciones</p>
              <p className="text-sm">Intenta ajustar tus filtros de búsqueda.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                      <th className="px-6 py-4">Folio</th>
                      <th className="px-6 py-4">Solicitante / Depto</th>
                      <th className="px-6 py-4">Fecha Solicitud</th>
                      <th className="px-6 py-4">Fecha Requerida</th>
                      <th className="px-6 py-4 text-right">Precio Total</th>
                      <th className="px-6 py-4 text-center">Estado</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                    {filteredList.map(req => {
                      const total = getRequisitionTotal(req)
                      return (
                        <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4 font-semibold text-slate-900">{req.folio}</td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-800">{req.solicitante_nombre}</div>
                            <div className="text-xs text-slate-400">{req.departamento}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Calendar size={14} />
                              {new Date(req.fecha_solicitud).toLocaleDateString('es-MX', { timeZone: 'UTC' })}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                              <Calendar size={14} />
                              {new Date(req.fecha_requerida).toLocaleDateString('es-MX', { timeZone: 'UTC' })}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-slate-900">
                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(total)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[req.status] || 'bg-slate-5 text-slate-700 border-slate-200'}`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => router.push(`/requisiciones/editar/${req.id}`)}
                                className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-[#0763a9] rounded-lg transition-colors"
                                title="Ver detalles y editar"
                              >
                                <Eye size={18} />
                              </button>
                              <a
                                href={`/api/requisiciones/${req.id}/export`}
                                download
                                className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                                title="Descargar PDF"
                              >
                                <Download size={18} />
                              </a>
                              <a
                                href={`/api/requisiciones/${req.id}/export-excel`}
                                download
                                className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"
                                title="Descargar Excel"
                              >
                                <FileSpreadsheet size={18} />
                              </a>
                              <button
                                onClick={() => handleDelete(req.id)}
                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Eliminar"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </PermissionGuard>
    </AppShell>
  )
}
