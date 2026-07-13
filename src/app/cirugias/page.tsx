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
  LayoutTemplate,
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

  // ─── Tabs & Plantillas State ───
  const [activeTab, setActiveTab] = useState<'cirugias' | 'plantillas'>('cirugias')
  const [plantillas, setPlantillas] = useState<any[]>([])
  const [stockItems, setStockItems] = useState<any[]>([])
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateDesc, setTemplateDesc] = useState('')
  const [templateProductos, setTemplateProductos] = useState<any[]>([])
  const [templateProdSearch, setTemplateProdSearch] = useState('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<any>(null)
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false)

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

  const fetchPlantillas = useCallback(async () => {
    try {
      const res = await fetch('/api/cirugias/plantillas')
      const json = await res.json()
      if (res.ok) setPlantillas(json.data)
    } catch (e) {
      console.error('[fetchPlantillas]', e)
    }
  }, [])

  const fetchStock = useCallback(async () => {
    try {
      const res = await fetch('/api/inventario')
      const json = await res.json()
      if (res.ok) setStockItems(json.data)
    } catch (e) {
      console.error('[fetchStock]', e)
    }
  }, [])

  useEffect(() => {
    fetchCirugias()
    fetchPlantillas()
    fetchStock()
  }, [fetchCirugias, fetchPlantillas, fetchStock])

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

  // ─── Plantillas Actions ───

  const openNewTemplateModal = () => {
    setEditingTemplate(null)
    setTemplateName('')
    setTemplateDesc('')
    setTemplateProductos([])
    setTemplateProdSearch('')
    setIsTemplateModalOpen(true)
  }

  const openEditTemplateModal = (plantilla: any) => {
    setEditingTemplate(plantilla)
    setTemplateName(plantilla.nombre)
    setTemplateDesc(plantilla.descripcion || '')
    setTemplateProductos(
      (plantilla.cirugia_plantilla_productos || []).map((p: any) => ({
        producto_id: p.producto_id,
        cantidad: p.cantidad,
        es_consumible: p.es_consumible,
        tipo_uso: p.tipo_uso,
        precio_unitario: p.precio_unitario != null ? Number(p.precio_unitario) : 0,
        _nombre: p.productos?.nombre || 'Producto Desconocido',
      }))
    )
    setTemplateProdSearch('')
    setIsTemplateModalOpen(true)
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      alert('El nombre es requerido')
      return
    }
    setIsSavingTemplate(true)
    try {
      const method = editingTemplate ? 'PUT' : 'POST'
      const url = editingTemplate
        ? `/api/cirugias/plantillas/${editingTemplate.id}`
        : '/api/cirugias/plantillas'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: templateName,
          descripcion: templateDesc,
          productos: templateProductos.map(p => ({
            producto_id: p.producto_id,
            cantidad: p.cantidad,
            es_consumible: p.es_consumible,
            tipo_uso: p.tipo_uso,
            precio_unitario: p.precio_unitario,
          })),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }

      await fetchPlantillas()
      setIsTemplateModalOpen(false)
    } catch (e: any) {
      alert('Error al guardar plantilla: ' + e.message)
    } finally {
      setIsSavingTemplate(false)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateTarget) return
    setIsDeletingTemplate(true)
    try {
      const res = await fetch(`/api/cirugias/plantillas/${deleteTemplateTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error)
      }
      setPlantillas(prev => prev.filter(p => p.id !== deleteTemplateTarget.id))
      setDeleteTemplateTarget(null)
    } catch (e: any) {
      alert('Error al eliminar plantilla: ' + e.message)
    } finally {
      setIsDeletingTemplate(false)
    }
  }

  const addTemplateProducto = (prod: any) => {
    if (templateProductos.find(p => p.producto_id === prod.id)) return
    setTemplateProductos(prev => [
      ...prev,
      {
        producto_id: prod.id,
        cantidad: 1,
        es_consumible: false,
        tipo_uso: 'venta',
        precio_unitario: prod.precio_unitario,
        _nombre: prod.nombre,
      },
    ])
    setTemplateProdSearch('')
  }

  const removeTemplateProducto = (id: string) => {
    setTemplateProductos(prev => prev.filter(p => p.producto_id !== id))
  }

  const updateTemplateProducto = (id: string, key: string, val: any) => {
    setTemplateProductos(prev =>
      prev.map(p => {
        if (p.producto_id !== id) return p
        return { ...p, [key]: val }
      })
    )
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

  const filteredPlantillas = useMemo(() => {
    if (!search) return plantillas
    const q = search.toLowerCase()
    return plantillas.filter(
      p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(q))
    )
  }, [plantillas, search])

  const filteredStock = useMemo(() => {
    if (!templateProdSearch) return []
    return stockItems.filter(
      s =>
        !templateProductos.find(p => p.producto_id === s.id) &&
        s.nombre.toLowerCase().includes(templateProdSearch.toLowerCase())
    )
  }, [stockItems, templateProductos, templateProdSearch])

  const templateHasShortage = useMemo(() => {
    return templateProductos.some(p => {
      const stock = stockItems.find(s => s.id === p.producto_id)?.stock_actual || 0
      return p.cantidad > stock
    })
  }, [templateProductos, stockItems])

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
              Cirugías y Plantillas
            </h1>
            <p className="text-sm text-gray-500 mt-1">Arthromed ERP / Gestión de Cirugías y Plantillas</p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            {activeTab === 'cirugias' ? (
              <>
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
              </>
            ) : (
              <button
                id="btn-new-template"
                onClick={openNewTemplateModal}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Plus size={16} />
                Nueva Plantilla
              </button>
            )}
          </div>
        </header>

        {/* ── Tab Selector ── */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('cirugias')}
            className={`px-5 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'cirugias'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Scissors size={15} />
            Cirugías
          </button>
          <button
            onClick={() => setActiveTab('plantillas')}
            className={`px-5 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'plantillas'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package size={15} />
            Plantillas de Cirugía
          </button>
        </div>

        {activeTab === 'cirugias' ? (
          <>
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
                            <td className="p-4">
                              <p className="text-sm font-semibold text-gray-900">{cir.nombre}</p>
                              {cir.descripcion && (
                                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{cir.descripcion}</p>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-1.5">
                                <User size={13} className="text-gray-400 shrink-0" />
                                <span className="text-sm text-gray-700">{cir.medico}</span>
                              </div>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Calendar size={13} className="text-gray-400 shrink-0" />
                                <div>
                                  <p className="text-sm text-gray-700">{formatDate(cir.fecha)}</p>
                                  <p className="text-xs text-gray-400">{formatTime(cir.fecha)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span
                                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                                style={{ color: estado.color, background: estado.bg }}
                              >
                                <EstadoIcon size={11} />
                                {estado.label}
                              </span>
                            </td>
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
                            <td className="p-4 text-right">
                              <span className="text-sm font-semibold text-gray-800">
                                {total > 0
                                  ? `$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                                  : <span className="text-gray-300">—</span>}
                              </span>
                            </td>
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
          </>
        ) : (
          <>
            {/* ── Search Templates ── */}
            <div className="card p-4 flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="plantillas-search"
                  type="text"
                  placeholder="Buscar plantilla por nombre o descripción…"
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
            </div>

            {/* ── Templates List ── */}
            {filteredPlantillas.length === 0 ? (
              <div className="card p-16 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#e8f1f9' }}>
                  <Package size={28} style={{ color: '#0763a9' }} />
                </div>
                <div>
                  <p className="font-semibold text-gray-700">No hay plantillas de cirugía registradas</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Crea una plantilla y úsala con el botón Usar para precargar todos los productos en una cirugía
                  </p>
                </div>
                <button
                  onClick={openNewTemplateModal}
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  <Plus size={15} />
                  Crear Plantilla
                </button>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/60 border-b border-gray-100">
                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plantilla</th>
                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Productos</th>
                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-40">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredPlantillas.map((plantilla) => (
                        <tr key={plantilla.id} className="hover:bg-blue-50/20 transition-colors">
                          <td className="p-4">
                            <p className="text-sm font-semibold text-gray-900">{plantilla.nombre}</p>
                          </td>
                          <td className="p-4">
                            <p className="text-sm text-gray-600 line-clamp-1">{plantilla.descripcion || <span className="text-gray-300">—</span>}</p>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-gray-700">
                              {plantilla.cirugia_plantilla_productos?.length || 0} producto(s)
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                id={`btn-usar-plantilla-${plantilla.id}`}
                                href={`/cirugias/new?plantilla=${plantilla.id}`}
                                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                                title="Crear cirugía con esta plantilla"
                              >
                                <LayoutTemplate size={13} />
                                Usar
                              </Link>
                              <button
                                onClick={() => openEditTemplateModal(plantilla)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                title="Editar"
                              >
                                <ChevronRight size={16} />
                              </button>
                              <button
                                onClick={() => setDeleteTemplateTarget(plantilla)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
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

      {/* ── Delete Template Modal ── */}
      <Modal
        open={deleteTemplateTarget !== null}
        onClose={() => { if (!isDeletingTemplate) setDeleteTemplateTarget(null) }}
        title="Eliminar Plantilla de Cirugía"
        maxWidth="420px"
      >
        {deleteTemplateTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              ¿Estás seguro de que deseas eliminar la plantilla{' '}
              <span className="font-semibold text-gray-900">"{deleteTemplateTarget.nombre}"</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setDeleteTemplateTarget(null)} className="btn-secondary" disabled={isDeletingTemplate}>
                Cancelar
              </button>
              <button
                onClick={handleDeleteTemplate}
                disabled={isDeletingTemplate}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                {isDeletingTemplate ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Template Editor Modal ── */}
      <Modal
        open={isTemplateModalOpen}
        onClose={() => { if (!isSavingTemplate) setIsTemplateModalOpen(false) }}
        title={editingTemplate ? "Editar Plantilla de Cirugía" : "Nueva Plantilla de Cirugía"}
        maxWidth="760px"
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
          {/* Form Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nombre de la Plantilla</label>
              <input
                type="text"
                placeholder="Ej. Artroscopía de Hombro"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                className="erp-input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Descripción</label>
              <input
                type="text"
                placeholder="Detalles sobre el tipo de cirugía..."
                value={templateDesc}
                onChange={e => setTemplateDesc(e.target.value)}
                className="erp-input w-full"
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Product Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Package size={15} style={{ color: '#0763a9' }} />
                Productos de la Plantilla
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Agrega los productos requeridos por defecto y verifica disponibilidad.</p>
            </div>

            {/* Product search */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar producto del inventario…"
                value={templateProdSearch}
                onChange={e => setTemplateProdSearch(e.target.value)}
                className="erp-input w-full"
                style={{ paddingLeft: '2.25rem' }}
              />
            </div>

            {/* Product dropdown */}
            {templateProdSearch && filteredStock.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm max-h-52 overflow-y-auto bg-white z-50 position-relative">
                {filteredStock.slice(0, 10).map(prod => (
                  <button
                    key={prod.id}
                    onClick={() => addTemplateProducto(prod)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{prod.nombre}</p>
                      <p className="text-xs text-gray-400">{prod.categoria || '—'} · Stock: {prod.stock_actual}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 shrink-0">
                      ${Number(prod.precio_unitario).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Overall Inventory warning */}
            {templateHasShortage && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2 animate-pulse">
                <AlertCircle size={15} className="shrink-0" />
                <span><strong>Advertencia:</strong> Algunos productos superan el stock actual en el almacén de inventario.</span>
              </div>
            )}

            {/* Selected Products list */}
            {templateProductos.length > 0 ? (
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                      <th className="p-3">Producto</th>
                      <th className="p-3 w-20">Cant.</th>
                      <th className="p-3 w-28">Tipo Uso</th>
                      <th className="p-3 w-20">Consum.</th>
                      <th className="p-3 w-28">Precio</th>
                      <th className="p-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {templateProductos.map(p => {
                      const stockItem = stockItems.find(s => s.id === p.producto_id)
                      const stockAvailable = stockItem?.stock_actual || 0
                      const hasShortage = p.cantidad > stockAvailable

                      return (
                        <tr key={p.producto_id} className={`hover:bg-gray-50/50 ${hasShortage ? 'bg-amber-50/20' : ''}`}>
                          <td className="p-3">
                            <p className="font-semibold text-gray-800 text-xs">{p._nombre}</p>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                              Stock: {stockAvailable}
                              {hasShortage && (
                                <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Insuficiente</span>
                              )}
                            </p>
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="1"
                              value={p.cantidad}
                              onChange={e => updateTemplateProducto(p.producto_id, 'cantidad', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-14 p-1 border border-gray-200 rounded text-center text-xs"
                            />
                          </td>
                          <td className="p-3">
                            <select
                              value={p.tipo_uso}
                              onChange={e => updateTemplateProducto(p.producto_id, 'tipo_uso', e.target.value)}
                              className="p-1 border border-gray-200 rounded text-xs w-24"
                            >
                              <option value="venta">Venta</option>
                              <option value="renta">Renta</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={p.es_consumible}
                              onChange={e => updateTemplateProducto(p.producto_id, 'es_consumible', e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={p.precio_unitario}
                              onChange={e => updateTemplateProducto(p.producto_id, 'precio_unitario', Math.max(0, parseFloat(e.target.value) || 0))}
                              className="w-24 p-1 border border-gray-200 rounded text-right text-xs"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => removeTemplateProducto(p.producto_id)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
                No hay productos agregados a la plantilla. Busca y selecciona productos arriba.
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => setIsTemplateModalOpen(false)}
              className="btn-secondary text-sm"
              disabled={isSavingTemplate}
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveTemplate}
              className="btn-primary text-sm"
              disabled={isSavingTemplate}
            >
              {isSavingTemplate ? 'Guardando…' : 'Guardar Plantilla'}
            </button>
          </div>
        </div>
      </Modal>

    </AppShell>
  )
}
