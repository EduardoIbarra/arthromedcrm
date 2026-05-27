'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Scissors,
  Plus,
  Search,
  X,
  RefreshCw,
  Calendar,
  User,
  Users,
  Package,
  DollarSign,
  Trash2,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  XCircle,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'

// ─── Types ───────────────────────────────────────────────────────────────────

type Cirugia = {
  id: string
  nombre: string
  medico: string
  descripcion: string | null
  fecha: string
  estado: string
  notas: string | null
  created_at: string
  cirugia_equipo: { id: string; user_id: string; rol: string | null }[]
  cirugia_productos: {
    id: string
    cantidad: number
    es_consumible: boolean
    tipo_uso: string
    precio_unitario: number | null
    productos: { nombre: string; precio_unitario: number }
  }[]
  cirugia_conceptos: {
    id: string
    concepto: string
    cantidad: number
    precio_unitario: number
    subtotal: number
  }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ESTADOS: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  programada: {
    label: 'Programada',
    color: '#0763a9',
    bg: '#e8f1f9',
    icon: Clock,
  },
  en_curso: {
    label: 'En Curso',
    color: '#d97706',
    bg: '#fef3c7',
    icon: PlayCircle,
  },
  completada: {
    label: 'Completada',
    color: '#059669',
    bg: '#d1fae5',
    icon: CheckCircle2,
  },
  cancelada: {
    label: 'Cancelada',
    color: '#dc2626',
    bg: '#fee2e2',
    icon: XCircle,
  },
}

function calcTotal(c: Cirugia): number {
  const fromProducts = c.cirugia_productos.reduce((sum, p) => {
    const price = p.precio_unitario ?? Number(p.productos.precio_unitario)
    return sum + price * p.cantidad
  }, 0)
  const fromConceptos = c.cirugia_conceptos.reduce((sum, con) => sum + Number(con.subtotal), 0)
  return fromProducts + fromConceptos
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CirugiasPage() {
  const [cirugias, setCirugias] = useState<Cirugia[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterEstado, setFilterEstado] = useState<string>('all')
  const [deleteTarget, setDeleteTarget] = useState<Cirugia | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchCirugias = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cirugias')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setCirugias(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchCirugias() }, [fetchCirugias])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/cirugias/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error)
      }
      setCirugias(prev => prev.filter(c => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (e: any) {
      alert('Error al eliminar: ' + e.message)
    } finally {
      setIsDeleting(false)
    }
  }

  // ─── Derived ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let r = cirugias
    if (filterEstado !== 'all') r = r.filter(c => c.estado === filterEstado)
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        c.medico.toLowerCase().includes(q)
      )
    }
    return r
  }, [cirugias, filterEstado, search])

  const kpi = useMemo(() => ({
    total: cirugias.length,
    programadas: cirugias.filter(c => c.estado === 'programada').length,
    en_curso: cirugias.filter(c => c.estado === 'en_curso').length,
    completadas: cirugias.filter(c => c.estado === 'completada').length,
  }), [cirugias])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">

        {/* ── Header ── */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: '#e8f1f9' }}>
                <Scissors size={22} style={{ color: '#0763a9' }} />
              </span>
              Cirugías
            </h1>
            <p className="text-sm text-gray-500 mt-1">Arthromed ERP / Gestión de Cirugías</p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              id="btn-refresh-cirugias"
              onClick={fetchCirugias}
              className="btn-secondary text-sm"
              disabled={isLoading}
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              Actualizar
            </button>
            <Link
              id="btn-new-cirugia"
              href="/cirugias/new"
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Plus size={16} />
              Nueva Cirugía
            </Link>
          </div>
        </header>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { key: 'all', label: 'Total', value: kpi.total, color: '#0763a9', bg: '#e8f1f9' },
            { key: 'programada', label: 'Programadas', value: kpi.programadas, color: '#0763a9', bg: '#dbeafe' },
            { key: 'en_curso', label: 'En Curso', value: kpi.en_curso, color: '#d97706', bg: '#fef3c7' },
            { key: 'completada', label: 'Completadas', value: kpi.completadas, color: '#059669', bg: '#d1fae5' },
          ].map(({ key, label, value, color, bg }) => (
            <button
              key={key}
              id={`kpi-${key}`}
              onClick={() => setFilterEstado(key)}
              className={`card p-4 text-left transition-all hover:shadow-md ${filterEstado === key ? 'ring-2' : ''}`}
              style={{ ringColor: color } as any}
            >
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
              <p className="text-3xl font-bold mt-1" style={{ color }}>{value}</p>
              <div className="mt-2 h-1 rounded-full" style={{ background: bg }} />
            </button>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              id="cirugias-search"
              type="text"
              placeholder="Buscar por nombre o médico…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="erp-input w-full"
              style={{ paddingLeft: '2.25rem' }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <select
            id="cirugias-filter-estado"
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
            className="erp-input text-sm"
          >
            <option value="all">Todos los estados</option>
            <option value="programada">Programadas</option>
            <option value="en_curso">En Curso</option>
            <option value="completada">Completadas</option>
            <option value="cancelada">Canceladas</option>
          </select>
        </div>

        {/* ── Table ── */}
        {isLoading ? (
          <div className="card p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-red-500 bg-red-50 border-red-100">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="card p-16 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#e8f1f9' }}>
              <Scissors size={28} style={{ color: '#0763a9' }} />
            </div>
            <div>
              <p className="font-semibold text-gray-700">No hay cirugías registradas</p>
              <p className="text-sm text-gray-400 mt-1">Crea una nueva cirugía para comenzar</p>
            </div>
            <Link href="/cirugias/new" className="btn-primary text-sm flex items-center gap-2">
              <Plus size={15} />
              Nueva Cirugía
            </Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cirugía</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Médico</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Fecha y Hora</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Equipo</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Productos</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">Total Est.</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(cir => {
                    const estado = ESTADOS[cir.estado] || ESTADOS['programada']
                    const EstadoIcon = estado.icon
                    const total = calcTotal(cir)
                    return (
                      <tr key={cir.id} className="hover:bg-blue-50/20 transition-colors">
                        {/* Nombre */}
                        <td className="p-4">
                          <p className="text-sm font-semibold text-gray-900">{cir.nombre}</p>
                          {cir.descripcion && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{cir.descripcion}</p>
                          )}
                        </td>

                        {/* Médico */}
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <User size={13} className="text-gray-400 shrink-0" />
                            <span className="text-sm text-gray-700">{cir.medico}</span>
                          </div>
                        </td>

                        {/* Fecha */}
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-gray-400 shrink-0" />
                            <div>
                              <p className="text-sm text-gray-700">{formatDate(cir.fecha)}</p>
                              <p className="text-xs text-gray-400">{formatTime(cir.fecha)}</p>
                            </div>
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="p-4">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                            style={{ color: estado.color, background: estado.bg }}
                          >
                            <EstadoIcon size={11} />
                            {estado.label}
                          </span>
                        </td>

                        {/* Equipo */}
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <Users size={13} className="text-gray-400 shrink-0" />
                            <span className="text-sm text-gray-700">
                              {cir.cirugia_equipo.length > 0
                                ? `${cir.cirugia_equipo.length} miembro${cir.cirugia_equipo.length !== 1 ? 's' : ''}`
                                : <span className="text-gray-300">—</span>}
                            </span>
                          </div>
                        </td>

                        {/* Productos */}
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <Package size={13} className="text-gray-400 shrink-0" />
                            <span className="text-sm text-gray-700">
                              {cir.cirugia_productos.length > 0
                                ? `${cir.cirugia_productos.length} producto${cir.cirugia_productos.length !== 1 ? 's' : ''}`
                                : <span className="text-gray-300">—</span>}
                            </span>
                          </div>
                        </td>

                        {/* Total */}
                        <td className="p-4 text-right">
                          <span className="text-sm font-semibold text-gray-800">
                            {total > 0
                              ? `$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                              : <span className="text-gray-300">—</span>}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/cirugias/${cir.id}`}
                              id={`btn-edit-cirugia-${cir.id}`}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Ver / Editar"
                            >
                              <ChevronRight size={16} />
                            </Link>
                            <button
                              id={`btn-delete-cirugia-${cir.id}`}
                              onClick={() => setDeleteTarget(cir)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between text-xs text-gray-400">
              <span>{filtered.length} cirugía{filtered.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => { if (!isDeleting) setDeleteTarget(null) }}
        title="Eliminar Cirugía"
        maxWidth="420px"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              ¿Estás seguro de que deseas eliminar{' '}
              <span className="font-semibold text-gray-900">"{deleteTarget.nombre}"</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary" disabled={isDeleting}>
                Cancelar
              </button>
              <button
                id="btn-confirm-delete-cirugia"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                {isDeleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  )
}
