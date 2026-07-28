'use client'

import { useState, useEffect } from 'react'
import {
  Wrench,
  Plus,
  Search,
  FileText,
  Download,
  Eye,
  Trash2,
  Filter,
  CheckSquare,
  Square,
  QrCode,
  Calendar,
  Layers,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ClipboardCheck,
  ListChecks
} from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import NuevoRegistroModal from './NuevoRegistroModal'
import GenerarReporteModal from './GenerarReporteModal'
import NuevoMantenimientoModal from './NuevoMantenimientoModal'
import MantenimientoTareasPresetManager from './MantenimientoTareasPresetManager'

interface MantenimientoRegistro {
  id: string
  folio: string
  fecha_reporte: string
  producto: string
  numero_serie_lote: string
  tipo_falla: string
  descripcion_detalle: string
  frecuencia: number
  observaciones?: string
  fabricante?: string
  periodo_evaluado?: string
  evidencias?: any[]
  status: string
  reporte_id?: string
  reporte?: any
  created_at: string
}

interface MantenimientoReporte {
  id: string
  folio: string
  titulo: string
  fabricante: string
  periodo_evaluado: string
  elaborado_por: string
  empresa: string
  fecha_reporte: string
  registros: MantenimientoRegistro[]
  created_at: string
}

interface MantenimientoPreventivo {
  id: string
  folio: string
  cliente: string
  producto: string
  numero_serie: string
  fecha_servicio: string
  elaborado_por: string
  status: string
  tareas: any[]
  created_at: string
}

export default function MantenimientoPage() {
  const [activeTab, setActiveTab] = useState<'registros' | 'reportes' | 'preventivo' | 'tareas_preset'>('registros')
  const [loading, setLoading] = useState(true)
  const [registros, setRegistros] = useState<MantenimientoRegistro[]>([])
  const [reportes, setReportes] = useState<MantenimientoReporte[]>([])
  const [preventivos, setPreventivos] = useState<MantenimientoPreventivo[]>([])

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [fabricanteFilter, setFabricanteFilter] = useState('ALL')
  const [prevSearch, setPrevSearch] = useState('')

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Modals state
  const [showNuevoModal, setShowNuevoModal] = useState(false)
  const [showGenerarModal, setShowGenerarModal] = useState(false)
  const [showPreventivModal, setShowPreventivModal] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<MantenimientoRegistro | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [resReg, resRep, resPrev] = await Promise.all([
        fetch('/api/mantenimiento/registros'),
        fetch('/api/mantenimiento/reportes'),
        fetch('/api/mantenimiento/preventivo'),
      ])

      if (resReg.ok) setRegistros(await resReg.json())
      if (resRep.ok) setReportes(await resRep.json())
      if (resPrev.ok) setPreventivos(await resPrev.json())
    } catch (err) {
      console.error('Error loading maintenance data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Filtering records
  const filteredRegistros = registros.filter(reg => {
    const matchesSearch =
      !searchTerm ||
      reg.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.numero_serie_lote.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.tipo_falla.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.descripcion_detalle.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'ALL' || reg.status === statusFilter
    const matchesFabricante =
      fabricanteFilter === 'ALL' ||
      (reg.fabricante && reg.fabricante.toLowerCase().includes(fabricanteFilter.toLowerCase()))

    return matchesSearch && matchesStatus && matchesFabricante
  })

  // Select all / deselect all
  const handleSelectAll = () => {
    if (selectedIds.length === filteredRegistros.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredRegistros.map(r => r.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este registro de falla?')) return
    try {
      const res = await fetch(`/api/mantenimiento/registros/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setRegistros(prev => prev.filter(r => r.id !== id))
        setSelectedIds(prev => prev.filter(i => i !== id))
      }
    } catch (err) {
      console.error('Error deleting record:', err)
    }
  }

  const handleDeleteReport = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este reporte? Se desvincularán sus registros asociados.')) return
    try {
      const res = await fetch(`/api/mantenimiento/reportes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchData()
      }
    } catch (err) {
      console.error('Error deleting report:', err)
    }
  }

  const handleReportGenerated = (reporteId: string) => {
    setSelectedIds([])
    setActiveTab('reportes')
    fetchData()
    // Open generated PDF in new tab
    window.open(`/api/mantenimiento/reportes/${reporteId}/pdf`, '_blank')
  }

  const formatDateStr = (dStr: string) => {
    if (!dStr) return '—'
    return new Date(dStr).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mantenimiento</h1>
            <p className="text-xs text-gray-500">
              Gestión de fallas, reportes de fabricante y mantenimiento preventivo con trazabilidad QR.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-all"
            title="Recargar datos"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          {activeTab === 'preventivo' ? (
            <button
              onClick={() => setShowPreventivModal(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-semibold shadow-md shadow-emerald-500/20 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo Reporte Preventivo</span>
            </button>
          ) : (
            <button
              onClick={() => setShowNuevoModal(true)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo Registro de Falla</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('registros')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'registros'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Registros de Fallas ({registros.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reportes')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'reportes'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Reportes de Fallas ({reportes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('preventivo')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'preventivo'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ClipboardCheck className="h-4 w-4" />
          <span>Mantenimiento Preventivo ({preventivos.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tareas_preset')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'tareas_preset'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ListChecks className="h-4 w-4" />
          <span>Catálogo de Tareas</span>
        </button>
      </div>

      {/* Action Bar when records are selected */}
      {selectedIds.length > 0 && activeTab === 'registros' && (
        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-900 p-4 text-white shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
              {selectedIds.length}
            </span>
            <span className="text-xs font-medium">
              {selectedIds.length === 1
                ? '1 registro de falla seleccionado'
                : `${selectedIds.length} registros de fallas seleccionados`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-blue-200 hover:text-white transition-colors"
            >
              Desmarcar todos
            </button>

            <button
              onClick={() => setShowGenerarModal(true)}
              className="flex items-center gap-2 rounded-xl bg-white text-blue-900 hover:bg-blue-50 px-4 py-2 text-xs font-bold shadow-md transition-all"
            >
              <FileText className="h-4 w-4 text-blue-600" />
              <span>Generar reporte para Fabricante</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: REGISTROS DE FALLAS */}
      {activeTab === 'registros' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por folio, producto, serie, falla..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Filter className="h-3.5 w-3.5" />
                <span>Estado:</span>
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none focus:border-blue-500"
              >
                <option value="ALL">Todos los estados</option>
                <option value="REGISTRADO">Disponible (REGISTRADO)</option>
                <option value="EN_REPORTE">En Reporte (EN_REPORTE)</option>
                <option value="RESUELTO">Resuelto (RESUELTO)</option>
              </select>
            </div>
          </div>

          {/* Table of Records */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                    <th className="p-3.5 w-10 text-center">
                      <button
                        onClick={handleSelectAll}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        {selectedIds.length > 0 && selectedIds.length === filteredRegistros.length ? (
                          <CheckSquare className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-3.5">Folio / Fecha</th>
                    <th className="p-3.5">Producto / Modelo</th>
                    <th className="p-3.5">Serie / Lote</th>
                    <th className="p-3.5">Tipo de Falla</th>
                    <th className="p-3.5">Descripción</th>
                    <th className="p-3.5 text-center">Evidencias</th>
                    <th className="p-3.5">Estado</th>
                    <th className="p-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-400">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                        <span>Cargando registros de mantenimiento...</span>
                      </td>
                    </tr>
                  ) : filteredRegistros.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-400">
                        <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                        <p className="font-semibold text-gray-700">No se encontraron registros de fallas</p>
                        <p className="text-xs text-gray-400 mt-1">Haga clic en "Nuevo Registro de Falla" para añadir uno.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRegistros.map(reg => {
                      const isSelected = selectedIds.includes(reg.id)
                      const evidenciasCount = Array.isArray(reg.evidencias) ? reg.evidencias.length : 0

                      return (
                        <tr
                          key={reg.id}
                          className={`hover:bg-blue-50/40 transition-colors ${
                            isSelected ? 'bg-blue-50/70 font-medium' : ''
                          }`}
                        >
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => toggleSelect(reg.id)}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="font-bold text-gray-900">{reg.folio}</div>
                            <div className="text-[11px] text-gray-400">{formatDateStr(reg.fecha_reporte)}</div>
                          </td>
                          <td className="p-3.5 font-semibold text-gray-900">{reg.producto}</td>
                          <td className="p-3.5 font-mono text-gray-700">{reg.numero_serie_lote}</td>
                          <td className="p-3.5 font-medium text-gray-800">{reg.tipo_falla}</td>
                          <td className="p-3.5 max-w-xs truncate text-gray-600" title={reg.descripcion_detalle}>
                            {reg.descripcion_detalle}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            {evidenciasCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                                📸 {evidenciasCount}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            {reg.status === 'EN_REPORTE' ? (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                                En Reporte ({reg.reporte?.folio || 'Asignado'})
                              </span>
                            ) : reg.status === 'RESUELTO' ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                                Resuelto
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200">
                                Disponible
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right whitespace-nowrap space-x-2">
                            <button
                              onClick={() => setSelectedDetail(reg)}
                              className="inline-flex items-center gap-1 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                              title="Ver Detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(reg.id)}
                              className="inline-flex items-center gap-1 rounded-lg p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REPORTES GENERADOS */}
      {activeTab === 'reportes' && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                  <th className="p-3.5">Folio / Fecha</th>
                  <th className="p-3.5">Título del Reporte</th>
                  <th className="p-3.5">Fabricante / Destinatario</th>
                  <th className="p-3.5">Periodo Evaluado</th>
                  <th className="p-3.5">Elaborado Por</th>
                  <th className="p-3.5 text-center">Piezas / Equipos</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {reportes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="font-semibold text-gray-700">No se han generado reportes para fabricantes aún</p>
                      <p className="text-xs text-gray-400 mt-1">Seleccione 1 o más registros de la lista de fallas y haga clic en "Generar reporte para Fabricante".</p>
                    </td>
                  </tr>
                ) : (
                  reportes.map(rep => (
                    <tr key={rep.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-bold text-gray-900">{rep.folio}</div>
                        <div className="text-[11px] text-gray-400">{formatDateStr(rep.fecha_reporte)}</div>
                      </td>
                      <td className="p-3.5 font-bold text-gray-900">{rep.titulo}</td>
                      <td className="p-3.5 font-semibold text-blue-700">{rep.fabricante}</td>
                      <td className="p-3.5 font-medium text-gray-700">{rep.periodo_evaluado}</td>
                      <td className="p-3.5 text-gray-600">{rep.elaborado_por}</td>
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                          {rep.registros?.length || 0} ítems
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap space-x-2">
                        <a
                          href={`/api/mantenimiento/reportes/${rep.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 text-xs font-semibold transition-colors"
                          title="Ver PDF"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>PDF</span>
                        </a>

                        <a
                          href={`/mantenimiento/reportes/${rep.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 px-2.5 py-1 text-xs font-semibold transition-colors"
                          title="Trazabilidad QR"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          <span>Trazabilidad</span>
                        </a>

                        <button
                          onClick={() => handleDeleteReport(rep.id)}
                          className="inline-flex items-center gap-1 rounded-lg p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                          title="Eliminar Reporte"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Detail Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{selectedDetail.folio}</h3>
                <p className="text-xs text-gray-500">{formatDateStr(selectedDetail.fecha_reporte)}</p>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div>
                  <span className="text-gray-500 font-semibold block">Producto / Modelo:</span>
                  <span className="font-bold text-gray-900">{selectedDetail.producto}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold block">Serie / Lote:</span>
                  <span className="font-mono text-gray-900">{selectedDetail.numero_serie_lote}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold block">Fabricante:</span>
                  <span className="text-gray-900">{selectedDetail.fabricante || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold block">Frecuencia:</span>
                  <span className="text-gray-900">{selectedDetail.frecuencia}</span>
                </div>
              </div>

              <div>
                <span className="text-gray-500 font-semibold block mb-1">Tipo de Falla:</span>
                <p className="font-semibold text-gray-900 bg-red-50 text-red-800 p-2 rounded-lg border border-red-100">
                  {selectedDetail.tipo_falla}
                </p>
              </div>

              <div>
                <span className="text-gray-500 font-semibold block mb-1">Descripción Detallada:</span>
                <p className="text-gray-800 bg-gray-50 p-2.5 rounded-lg border border-gray-200 leading-relaxed whitespace-pre-wrap">
                  {selectedDetail.descripcion_detalle}
                </p>
              </div>

              {selectedDetail.observaciones && (
                <div>
                  <span className="text-gray-500 font-semibold block mb-1">Observaciones:</span>
                  <p className="text-gray-700">{selectedDetail.observaciones}</p>
                </div>
              )}

              {/* Evidencias list */}
              {Array.isArray(selectedDetail.evidencias) && selectedDetail.evidencias.length > 0 && (
                <div>
                  <span className="text-gray-500 font-semibold block mb-1">Evidencias Fotográficas:</span>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {selectedDetail.evidencias.map((ev: any, i: number) => (
                      <div key={i} className="rounded-lg border border-gray-200 p-1.5 bg-gray-50">
                        {ev.url && (
                          <img
                            src={ev.url}
                            alt={ev.title}
                            className="h-24 w-full rounded object-cover border border-gray-200 mb-1"
                          />
                        )}
                        <p className="font-bold text-[11px] text-gray-900 truncate">{ev.title}</p>
                        {ev.description && <p className="text-[10px] text-gray-500 truncate">{ev.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                onClick={() => setSelectedDetail(null)}
                className="rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 text-xs font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MANTENIMIENTO PREVENTIVO */}
      {activeTab === 'preventivo' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, producto, folio..."
                value={prevSearch}
                onChange={e => setPrevSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              />
            </div>
            <span className="text-xs text-gray-500 font-semibold">{preventivos.length} registros</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
            </div>
          ) : preventivos.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
              <ClipboardCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-500">Sin reportes de mantenimiento preventivo</p>
              <p className="text-xs text-gray-400 mt-1">Haz clic en "Nuevo Reporte Preventivo" para comenzar</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-3.5 font-bold text-gray-600">Folio</th>
                    <th className="p-3.5 font-bold text-gray-600">Cliente</th>
                    <th className="p-3.5 font-bold text-gray-600">Producto</th>
                    <th className="p-3.5 font-bold text-gray-600">No. Serie</th>
                    <th className="p-3.5 font-bold text-gray-600">Fecha Servicio</th>
                    <th className="p-3.5 font-bold text-gray-600">Técnico</th>
                    <th className="p-3.5 font-bold text-gray-600 text-center">Tareas</th>
                    <th className="p-3.5 font-bold text-gray-600 text-center">Estado</th>
                    <th className="p-3.5 font-bold text-gray-600 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preventivos
                    .filter(p =>
                      !prevSearch ||
                      p.folio.toLowerCase().includes(prevSearch.toLowerCase()) ||
                      p.cliente.toLowerCase().includes(prevSearch.toLowerCase()) ||
                      p.producto.toLowerCase().includes(prevSearch.toLowerCase()) ||
                      p.numero_serie.toLowerCase().includes(prevSearch.toLowerCase())
                    )
                    .map(prev => (
                      <tr key={prev.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-3.5">
                          <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            {prev.folio}
                          </span>
                        </td>
                        <td className="p-3.5 font-semibold text-gray-900">{prev.cliente}</td>
                        <td className="p-3.5 text-gray-700">{prev.producto}</td>
                        <td className="p-3.5 font-mono text-gray-600">{prev.numero_serie}</td>
                        <td className="p-3.5 text-gray-600">
                          {formatDateStr(prev.fecha_servicio)}
                        </td>
                        <td className="p-3.5 text-gray-600">{prev.elaborado_por}</td>
                        <td className="p-3.5 text-center">
                          <span className="font-bold text-gray-800">{Array.isArray(prev.tareas) ? prev.tareas.length : 0}</span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                            prev.status === 'COMPLETADO'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {prev.status}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/mantenimiento/preventivo/${prev.id}`}
                              className="flex items-center gap-1 rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" /> Ver
                            </Link>
                            <a
                              href={`/api/mantenimiento/preventivo/${prev.id}/pdf`}
                              target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-[11px] font-semibold transition-colors shadow-sm"
                            >
                              <Download className="h-3.5 w-3.5" /> PDF
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CATÁLOGO DE TAREAS PREDETERMINADAS */}
      {activeTab === 'tareas_preset' && (
        <MantenimientoTareasPresetManager />
      )}

      {/* Nuevo Registro Modal */}
      <NuevoRegistroModal
        isOpen={showNuevoModal}
        onClose={() => setShowNuevoModal(false)}
        onSuccess={fetchData}
      />

      {/* Generar Reporte Modal */}
      <GenerarReporteModal
        isOpen={showGenerarModal}
        onClose={() => setShowGenerarModal(false)}
        selectedRecordIds={selectedIds}
        recordsCount={selectedIds.length}
        onSuccess={handleReportGenerated}
      />

      {/* Nuevo Mantenimiento Preventivo Modal */}
      <NuevoMantenimientoModal
        isOpen={showPreventivModal}
        onClose={() => setShowPreventivModal(false)}
        onSuccess={(id) => {
          fetchData()
          window.open(`/api/mantenimiento/preventivo/${id}/pdf`, '_blank')
        }}
      />
    </div>
    </AppShell>
  )
}
