'use client'

import { useEffect, useState, useRef } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { TrendingUp, Plus, Edit2, Trash2, Calendar, DollarSign, LayoutGrid, List, Filter, Download, XCircle, Search, FileSpreadsheet, ChevronDown, Check, Loader2, Building2, Trophy, Award } from 'lucide-react'
import * as XLSX from 'xlsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import PermissionGuard from '@/components/PermissionGuard'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts'

interface Venta {
  id: string
  cliente_id: string
  cliente_nombre: string
  anio: number
  mes: number
  monto: number
  created_at: string
}

const COLORS = ['#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#99f6e4', '#0284c7', '#0369a1', '#075985']

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function VentasPage() {
  const { t } = useI18n()
  const { formatCurrency, formatChartTick } = useCurrency()
  const router = useRouter()
  const [ventas, setVentas] = useState<Venta[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedClientFilter, setSelectedClientFilter] = useState<string | null>(null)
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('')
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [chartTab, setChartTab] = useState<'monthly' | 'yearly' | 'compare_monthly'>('monthly')
  const [listGroupBy, setListGroupBy] = useState<'individual' | 'client'>('individual')
  const [selectedGroupedClient, setSelectedGroupedClient] = useState<{
    cliente_id: string
    cliente_nombre: string
    total_monto: number
    record_count: number
    sales: Venta[]
  } | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const fetchVentas = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (selectedYearFilter) params.append('anio', selectedYearFilter)
      if (selectedMonthFilter) params.append('mes', selectedMonthFilter)
      
      const res = await fetch('/api/ventas?' + params.toString())
      if (!res.ok) {
        throw new Error('Failed to fetch ventas')
      }
      const { data } = await res.json()
      setVentas(data)
    } catch (err: any) {
      console.error('Error fetching ventas:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchVentas()
  }, [selectedYearFilter, selectedMonthFilter])

  const handleDelete = async () => {
    if (!selectedVenta) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/ventas/${selectedVenta.id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete sales record')
      
      setIsDeleteModalOpen(false)
      fetchVentas()
    } catch (err: any) {
      console.error('Error deleting venta:', err)
      alert(t('error') + ': ' + err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExportExcel = () => {
    setIsExportDropdownOpen(false)
    if (filteredVentas.length === 0) return
    const dataToExport = filteredVentas.map(v => ({
      Cliente: v.cliente_nombre,
      Año: v.anio,
      Mes: MONTH_NAMES[v.mes - 1] || v.mes,
      Monto: v.monto,
      'Fecha Creación': v.created_at ? new Date(v.created_at).toLocaleDateString() : '-'
    }))
    
    const worksheet = XLSX.utils.json_to_sheet(dataToExport)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ventas')
    XLSX.writeFile(workbook, 'Reporte_Ventas_Mensuales.xlsx')
  }

  // Local formatCurrency and formatChartTick helpers removed in favor of global useCurrency context helpers

  // 1. Filtered lists for cross-filtering and rendering
  const searchFilter = (v: Venta) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    const matchesClient = v.cliente_nombre?.toLowerCase().includes(term) || false
    const matchesYear = String(v.anio).includes(term)
    const matchesMonthName = (MONTH_NAMES[v.mes - 1] || '').toLowerCase().includes(term)
    const matchesMonto = String(v.monto).includes(term)
    return matchesClient || matchesYear || matchesMonthName || matchesMonto
  }

  const filteredVentas = ventas.filter(v => {
    if (!searchFilter(v)) return false
    if (selectedClientFilter && v.cliente_nombre !== selectedClientFilter) return false
    return true
  })

  // 2. Analytics Data Preparation
  // Top Clients & Others
  const clientMap = ventas.filter(searchFilter).reduce((acc, curr) => {
    const clientName = curr.cliente_nombre || 'Sin Nombre'
    acc[clientName] = (acc[clientName] || 0) + Number(curr.monto || 0)
    return acc
  }, {} as Record<string, number>)

  const sortedClients = Object.entries(clientMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const top7 = sortedClients.slice(0, 7)
  const others = sortedClients.slice(7)

  const clientData = [...top7]
  if (others.length > 0) {
    const othersTotal = others.reduce((acc, curr) => acc + curr.value, 0)
    clientData.push({
      name: t('others' as any) || 'Otros',
      value: othersTotal
    })
  }

  // Monthly Trend (for Bar Chart)
  const monthlyDataMap = Array.from({ length: 12 }, (_, i) => ({
    name: MONTH_NAMES[i].substring(0, 3),
    value: 0
  }))

  ventas.filter(searchFilter).forEach(v => {
    if (v.mes >= 1 && v.mes <= 12) {
      monthlyDataMap[v.mes - 1].value += Number(v.monto || 0)
    }
  })

  // Yearly Sales comparison (for Bar Chart)
  const yearlySalesMap = ventas.filter(searchFilter).reduce((acc, curr) => {
    const year = curr.anio
    acc[year] = (acc[year] || 0) + Number(curr.monto || 0)
    return acc
  }, {} as Record<number, number>)

  const yearlySalesData = Object.entries(yearlySalesMap)
    .map(([year, value]) => ({ name: String(year), value }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Monthly comparison across active years (for multi-line Line Chart)
  const yearsSet = new Set<number>()
  ventas.filter(searchFilter).forEach(v => {
    if (v.anio) yearsSet.add(v.anio)
  })
  const activeYears = Array.from(yearsSet).sort()

  const compareMonthlyData = Array.from({ length: 12 }, (_, i) => {
    const item: any = {
      name: MONTH_NAMES[i].substring(0, 3)
    }
    activeYears.forEach(yr => {
      item[String(yr)] = 0
    })
    return item
  })

  ventas.filter(searchFilter).forEach(v => {
    if (v.mes >= 1 && v.mes <= 12 && v.anio) {
      const yearStr = String(v.anio)
      if (compareMonthlyData[v.mes - 1][yearStr] !== undefined) {
        compareMonthlyData[v.mes - 1][yearStr] += Number(v.monto || 0)
      }
    }
  })

  // Grouped by client for list/grid view
  const groupedClientsMap = filteredVentas.reduce((acc, curr) => {
    const clientId = curr.cliente_id
    const clientName = curr.cliente_nombre || 'Sin Nombre'
    if (!acc[clientId]) {
      acc[clientId] = {
        cliente_id: clientId,
        cliente_nombre: clientName,
        total_monto: 0,
        record_count: 0,
        sales: [] as Venta[]
      }
    }
    acc[clientId].total_monto += Number(curr.monto || 0)
    acc[clientId].record_count += 1
    acc[clientId].sales.push(curr)
    return acc
  }, {} as Record<string, { cliente_id: string; cliente_nombre: string; total_monto: number; record_count: number; sales: Venta[] }>)

  const groupedClientsData = Object.values(groupedClientsMap).sort((a, b) => b.total_monto - a.total_monto)

  const kpiTotalSales = filteredVentas.reduce((acc, curr) => acc + Number(curr.monto || 0), 0)
  const kpiAverageSale = filteredVentas.length > 0 ? kpiTotalSales / filteredVentas.length : 0
  const kpiActiveClients = new Set(filteredVentas.map(v => v.cliente_id)).size
  const kpiSalesCount = filteredVentas.length

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-8">
        
        {/* HEADER */}
        <header className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <TrendingUp className="text-teal-600" size={28} />
                {t('ventas' as any) || 'Ventas'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {t('appName')} / {t('ventas' as any) || 'Ventas'}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <PermissionGuard section="ventas" action="create">
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)} 
                    className="btn-secondary whitespace-nowrap flex items-center gap-1.5"
                  >
                    <Download size={18} /> Exportar <ChevronDown size={14} className="text-gray-500" />
                  </button>
                  {isExportDropdownOpen && (
                    <div className="absolute left-0 md:right-0 md:left-auto mt-2 w-56 rounded-xl bg-white border border-gray-200 shadow-lg py-1 z-30 animate-fade-in">
                      <button
                        onClick={handleExportExcel}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors cursor-pointer border-b border-gray-100"
                      >
                        <FileSpreadsheet size={16} className="text-green-600" />
                        <div>
                          <p className="font-semibold text-gray-900">Excel</p>
                          <p className="text-xs text-gray-400">Exportar listado actual</p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
                <Link href="/ventas/new" className="btn-primary whitespace-nowrap !bg-teal-600 hover:!bg-teal-700 !border-teal-700">
                  <Plus size={18} /> {t('newVenta' as any) || 'Nueva Venta'}
                </Link>
              </PermissionGuard>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
              <Filter size={18} className="text-gray-400 ml-2" />
              <select 
                className="erp-input !py-1.5 !px-3 text-sm !border-0 bg-transparent focus:ring-0"
                value={selectedYearFilter}
                onChange={e => setSelectedYearFilter(e.target.value)}
                title={t('year' as any) || 'Año'}
              >
                <option value="">-- {t('year' as any) || 'Año'} --</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
              <span className="text-gray-300">|</span>
              <select 
                className="erp-input !py-1.5 !px-3 text-sm !border-0 bg-transparent focus:ring-0"
                value={selectedMonthFilter}
                onChange={e => setSelectedMonthFilter(e.target.value)}
                title={t('month' as any) || 'Mes'}
              >
                <option value="">-- {t('month' as any) || 'Mes'} --</option>
                {MONTH_NAMES.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>

            {/* Active Filter Badges */}
            {(selectedClientFilter || selectedYearFilter || selectedMonthFilter || searchTerm) && (
              <div className="flex flex-wrap items-center gap-2">
                {selectedClientFilter && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-100">
                    <span>{t('clientFilter' as any) || 'Cliente'}: {selectedClientFilter}</span>
                    <button 
                      onClick={() => setSelectedClientFilter(null)}
                      className="hover:bg-teal-100 p-0.5 rounded-full transition-colors"
                      title="Quitar filtro"
                    >
                      <XCircle size={14} className="text-teal-500 hover:text-teal-700" />
                    </button>
                  </span>
                )}
                {selectedYearFilter && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                    <span>{t('yearFilter' as any) || 'Año'}: {selectedYearFilter}</span>
                    <button 
                      onClick={() => setSelectedYearFilter('')}
                      className="hover:bg-blue-100 p-0.5 rounded-full transition-colors"
                      title="Quitar filtro"
                    >
                      <XCircle size={14} className="text-blue-500 hover:text-blue-700" />
                    </button>
                  </span>
                )}
                {selectedMonthFilter && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                    <span>{t('monthFilter' as any) || 'Mes'}: {MONTH_NAMES[parseInt(selectedMonthFilter) - 1]}</span>
                    <button 
                      onClick={() => setSelectedMonthFilter('')}
                      className="hover:bg-purple-100 p-0.5 rounded-full transition-colors"
                      title="Quitar filtro"
                    >
                      <XCircle size={14} className="text-purple-500 hover:text-purple-700" />
                    </button>
                  </span>
                )}
                {searchTerm && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">
                    <span>{t('search') || 'Buscar'}: &quot;{searchTerm}&quot;</span>
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="hover:bg-gray-200 p-0.5 rounded-full transition-colors"
                      title="Quitar filtro"
                    >
                      <XCircle size={14} className="text-gray-500 hover:text-gray-700" />
                    </button>
                  </span>
                )}
                <button 
                  onClick={() => {
                    setSelectedClientFilter(null)
                    setSelectedYearFilter('')
                    setSelectedMonthFilter('')
                    setSearchTerm('')
                  }}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {t('cleanFilters')}
                </button>
              </div>
            )}

            {/* Group By selector and View Toggle */}
            <div className="flex items-center gap-3 ml-auto flex-wrap sm:flex-nowrap">
              {/* Group By Toggle */}
              <div className="flex items-center p-1 bg-gray-150 p-1 rounded-lg text-xs font-semibold border border-gray-200">
                <button
                  onClick={() => setListGroupBy('individual')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${listGroupBy === 'individual' ? 'bg-white text-teal-600 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {t('individualRecords' as any) || 'Individuales'}
                </button>
                <button
                  onClick={() => setListGroupBy('client')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${listGroupBy === 'client' ? 'bg-white text-teal-600 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {t('groupedByClient' as any) || 'Por Cliente'}
                </button>
              </div>

              {/* View Toggle */}
              <div className="flex items-center p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  title={t('gridView') as string}
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  title={t('listView') as string}
                >
                  <List size={18} />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* KPIS */}
        {!isLoading && !error && ventas.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-3 sm:p-4 flex flex-col justify-center border-l-4 border-l-teal-600 overflow-hidden">
              <span className="text-xs sm:text-sm text-gray-500 font-medium">{t('totalSales' as any) || 'Ventas Totales'}</span>
              <span className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5 sm:mt-1 truncate" title={formatCurrency(kpiTotalSales)}>{formatCurrency(kpiTotalSales, true)}</span>
            </div>
            <div className="card p-3 sm:p-4 flex flex-col justify-center border-l-4 border-l-blue-600 overflow-hidden">
              <span className="text-xs sm:text-sm text-gray-500 font-medium">{t('averageSale' as any) || 'Promedio Mensual'}</span>
              <span className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5 sm:mt-1 truncate" title={formatCurrency(kpiAverageSale)}>{formatCurrency(kpiAverageSale, true)}</span>
            </div>
            <div className="card p-3 sm:p-4 flex flex-col justify-center border-l-4 border-l-orange-500">
              <span className="text-xs sm:text-sm text-gray-500 font-medium">{t('activeClients') || 'Clientes Activos'}</span>
              <span className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5 sm:mt-1">{kpiActiveClients}</span>
            </div>
            <div className="card p-3 sm:p-4 flex flex-col justify-center border-l-4 border-l-purple-600">
              <span className="text-xs sm:text-sm text-gray-500 font-medium">{t('salesCount' as any) || 'No. de Ventas'}</span>
              <span className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5 sm:mt-1">{kpiSalesCount}</span>
            </div>
          </div>
        )}

        {/* ANALYTICS CHARTS */}
        {!isLoading && !error && ventas.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales by Client Pie Chart (Top 7 + Others, Names only on hover) */}
            <div className="card p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">
                {t('salesByClient' as any) || 'Ventas por Cliente'}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={clientData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={50} 
                      outerRadius={80} 
                      paddingAngle={2} 
                      dataKey="value"
                      onClick={(data) => {
                        if (data && typeof data.name === 'string') {
                          const name = data.name
                          const isOthers = name === (t('others' as any) || 'Otros')
                          if (!isOthers) {
                            setSelectedClientFilter(prev => prev === name ? null : name)
                          }
                        }
                      }}
                      style={{ cursor: 'pointer', outline: 'none' }}
                    >
                      {clientData.map((entry, index) => {
                        const isSelected = selectedClientFilter === entry.name
                        const isAnySelected = selectedClientFilter !== null
                        const isOthers = entry.name === (t('others' as any) || 'Otros')
                        const fillColor = isOthers ? '#94a3b8' : COLORS[index % COLORS.length]
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={fillColor} 
                            opacity={isAnySelected ? (isSelected ? 1.0 : 0.3) : 1.0}
                            stroke={isSelected ? '#0d9488' : '#fff'}
                            strokeWidth={isSelected ? 2 : 1}
                          />
                        )
                      })}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value), true)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Monthly & Yearly Trend Chart with Tabs */}
            <div className="card p-6 flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <h3 className="text-sm font-bold text-gray-700">
                  {chartTab === 'monthly' && (t('salesByMonth' as any) || 'Ventas por Mes')}
                  {chartTab === 'yearly' && (t('salesByYear' as any) || 'Ventas por Año')}
                  {chartTab === 'compare_monthly' && (t('compareYears' as any) || 'Comparativa de Años')}
                </h3>
                <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs self-start sm:self-auto border border-gray-200">
                  <button
                    onClick={() => setChartTab('monthly')}
                    className={`px-2.5 py-1 rounded-md transition-all font-semibold ${chartTab === 'monthly' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    Ene-Dic
                  </button>
                  <button
                    onClick={() => setChartTab('yearly')}
                    className={`px-2.5 py-1 rounded-md transition-all font-semibold ${chartTab === 'yearly' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    Anual
                  </button>
                  <button
                    onClick={() => setChartTab('compare_monthly')}
                    className={`px-2.5 py-1 rounded-md transition-all font-semibold ${chartTab === 'compare_monthly' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    Comparar
                  </button>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {chartTab === 'monthly' ? (
                    <BarChart data={monthlyDataMap}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={formatChartTick} />
                      <Tooltip formatter={(value: any) => formatCurrency(Number(value), true)} />
                      <Bar 
                        dataKey="value" 
                        fill="#0d9488" 
                        radius={[4, 4, 0, 0]}
                        onClick={(data) => {
                          if (data && typeof data.name === 'string') {
                            const name = data.name
                            const monthIdx = MONTH_NAMES.findIndex(m => m.startsWith(name))
                            if (monthIdx !== -1) {
                              const monthStr = String(monthIdx + 1)
                              setSelectedMonthFilter(prev => prev === monthStr ? '' : monthStr)
                            }
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </BarChart>
                  ) : chartTab === 'yearly' ? (
                    <BarChart data={yearlySalesData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={formatChartTick} />
                      <Tooltip formatter={(value: any) => formatCurrency(Number(value), true)} />
                      <Bar 
                        dataKey="value" 
                        fill="#0284c7" 
                        radius={[4, 4, 0, 0]}
                        onClick={(data) => {
                          if (data && typeof data.name === 'string') {
                            const name = data.name
                            setSelectedYearFilter(prev => prev === name ? '' : name)
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </BarChart>
                  ) : (
                    <LineChart data={compareMonthlyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={formatChartTick} />
                      <Tooltip formatter={(value: any) => formatCurrency(Number(value), true)} />
                      <Legend />
                      {activeYears.map((yr, idx) => {
                        const yearStr = String(yr)
                        const colors = ['#0d9488', '#0284c7', '#ea580c', '#7c3aed', '#db2777']
                        return (
                          <Line
                            key={yearStr}
                            type="monotone"
                            dataKey={yearStr}
                            stroke={colors[idx % colors.length]}
                            strokeWidth={2}
                            activeDot={{ r: 8 }}
                          />
                        )
                      })}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Clients Ranking Card */}
            <div className="card p-6 flex flex-col h-[370px]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-700">{t('clientRanking' as any) || 'Ranking de Clientes'}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t('topClientsDesc' as any) || 'Clientes con mayores ventas acumuladas'}</p>
                </div>
                <Trophy className="text-amber-500" size={20} />
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {clientData.map((client, index) => {
                  const rank = index + 1
                  const maxVal = clientData[0]?.value || 1
                  const percent = (client.value / maxVal) * 100
                  const isSelected = selectedClientFilter === client.name
                  const isAnySelected = selectedClientFilter !== null

                  // Styling for Top 3
                  let badgeClass = "bg-gray-100 text-gray-600"
                  let cardBorderClass = "border-transparent"
                  let TrophyIcon = null

                  if (rank === 1) {
                    badgeClass = "bg-amber-100 text-amber-800 ring-2 ring-amber-300"
                    cardBorderClass = "border-amber-100 bg-amber-50/10"
                    TrophyIcon = <Trophy className="text-amber-500 fill-amber-300" size={14} />
                  } else if (rank === 2) {
                    badgeClass = "bg-slate-200 text-slate-800 ring-2 ring-slate-300"
                    cardBorderClass = "border-slate-100 bg-slate-50/10"
                    TrophyIcon = <Award className="text-slate-400 fill-slate-200" size={14} />
                  } else if (rank === 3) {
                    badgeClass = "bg-orange-100 text-orange-850 ring-2 ring-orange-200"
                    cardBorderClass = "border-orange-100 bg-orange-50/10"
                    TrophyIcon = <Award className="text-orange-400 fill-orange-100" size={14} />
                  }

                  return (
                    <div 
                      key={client.name}
                      onClick={() => setSelectedClientFilter(prev => prev === client.name ? null : client.name)}
                      className={`
                        p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 hover:shadow-sm
                        ${cardBorderClass}
                        ${isAnySelected ? (isSelected ? 'border-teal-500 bg-teal-50/20 shadow-sm' : 'opacity-40') : 'hover:border-gray-200'}
                      `}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${badgeClass}`}>
                            {rank}
                          </span>
                          <span className="font-semibold text-gray-900 text-sm truncate">{client.name}</span>
                          {TrophyIcon}
                        </div>
                        <span className="font-bold text-teal-650 text-sm whitespace-nowrap">
                          {formatCurrency(client.value)}
                        </span>
                      </div>
                      
                      {/* progress bar */}
                      <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden">
                        <div 
                          className={`h-1 rounded-full transition-all duration-500 ${
                            rank === 1 ? 'bg-amber-500' :
                            rank === 2 ? 'bg-slate-400' :
                            rank === 3 ? 'bg-orange-400' : 'bg-teal-600'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                {clientData.length === 0 && (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400 py-8">
                    No hay datos disponibles
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search Input */}
        {!isLoading && !error && ventas.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('searchSales' as any) || 'Buscar ventas...'}
                className="erp-input pl-10 pr-10 w-full"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                >
                  <XCircle size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* CONTENT */}
        {isLoading ? (
          <div className="card p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-red-500 bg-red-50 border-red-100">
            {error}
          </div>
        ) : ventas.length === 0 ? (
          <div className="card p-12 text-center text-gray-500">
            {t('noResults')}
          </div>
        ) : filteredVentas.length === 0 ? (
          <div className="card p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
            <p className="font-medium text-gray-600">{t('noFilteredSalesResults' as any) || 'No se encontraron ventas con los filtros aplicados.'}</p>
            <button 
              onClick={() => {
                setSelectedClientFilter(null)
                setSelectedYearFilter('')
                setSelectedMonthFilter('')
                setSearchTerm('')
              }}
              className="btn-secondary !py-1.5 !px-4 text-xs"
            >
              {t('cleanFilters')}
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          listGroupBy === 'client' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupedClientsData.map(clientGroup => (
                <div 
                  key={clientGroup.cliente_id} 
                  className="card p-6 flex flex-col items-start gap-4 hover:border-teal-300 hover:shadow-md transition-all group relative overflow-hidden h-full cursor-pointer"
                  onClick={() => {
                    setSelectedGroupedClient(clientGroup)
                    setIsDetailModalOpen(true)
                  }}
                >
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 group-hover:scale-110 group-hover:bg-teal-100 transition-all duration-300">
                    <Building2 size={24} />
                  </div>
                  
                  <div className="flex-1 w-full">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-2">{clientGroup.cliente_nombre}</h3>
                    
                    <div className="space-y-2 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400 uppercase font-semibold">{t('totalSales' as any) || 'Total Ventas'}</span>
                        <span className="text-lg font-bold text-teal-600">{formatCurrency(clientGroup.total_monto)}</span>
                      </div>
                      
                      <div className="pt-2 flex justify-between items-center border-t border-gray-50 text-xs text-gray-500">
                        <span>{t('salesCount' as any) || 'No. de Ventas'}:</span>
                        <span className="font-semibold text-gray-800">{clientGroup.record_count}</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-teal-50 to-transparent rounded-bl-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVentas.map(venta => (
                <div 
                  key={venta.id} 
                  className="card p-6 flex flex-col items-start gap-4 hover:border-teal-300 hover:shadow-md transition-all group relative overflow-hidden h-full cursor-pointer"
                  onClick={() => router.push(`/ventas/${venta.id}`)}
                >
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <PermissionGuard section="ventas" action="edit">
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/ventas/${venta.id}`) }}
                        className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                        title={t('edit') as string}
                      >
                        <Edit2 size={16} />
                      </button>
                    </PermissionGuard>
                    <PermissionGuard section="ventas" action="delete">
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedVenta(venta); setIsDeleteModalOpen(true); }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title={t('delete') as string}
                      >
                        <Trash2 size={16} />
                      </button>
                    </PermissionGuard>
                  </div>

                  <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 group-hover:scale-110 group-hover:bg-teal-100 transition-all duration-300">
                    <Building2 size={24} />
                  </div>
                  
                  <div className="flex-1 w-full">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-2">{venta.cliente_nombre}</h3>
                    
                    <div className="space-y-2 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400 uppercase font-semibold">{t('monto' as any) || 'Monto'}</span>
                        <span className="text-lg font-bold text-teal-600">{formatCurrency(venta.monto)}</span>
                      </div>
                      
                      <div className="pt-2 space-y-1.5 border-t border-gray-50">
                        <p className="text-xs text-gray-500 flex items-center gap-2">
                          <Calendar size={12} className="text-teal-500" />
                          {MONTH_NAMES[venta.mes - 1]} / {venta.anio}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-teal-50 to-transparent rounded-bl-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* LIST VIEW */
          listGroupBy === 'client' ? (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-600">
                      <th className="p-4">{t('client' as any) || 'Cliente'}</th>
                      <th className="p-4">{t('salesCount' as any) || 'No. de Ventas'}</th>
                      <th className="p-4">{t('totalSales' as any) || 'Total Ventas'}</th>
                      <th className="p-4 text-right">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupedClientsData.map(clientGroup => (
                      <tr 
                        key={clientGroup.cliente_id} 
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedGroupedClient(clientGroup)
                          setIsDetailModalOpen(true)
                        }}
                      >
                        <td className="p-4">
                          <div className="font-medium text-gray-900 truncate max-w-md">{clientGroup.cliente_nombre}</div>
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {clientGroup.record_count}
                        </td>
                        <td className="p-4 text-sm font-semibold text-teal-650">
                          {formatCurrency(clientGroup.total_monto)}
                        </td>
                        <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedGroupedClient(clientGroup)
                              setIsDetailModalOpen(true)
                            }}
                            className="btn-secondary !py-1 !px-3 text-xs"
                          >
                            {t('viewDetail' as any) || 'Ver Detalle'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-600">
                      <th className="p-4">{t('client' as any) || 'Cliente'}</th>
                      <th className="p-4">{t('year' as any) || 'Año'}</th>
                      <th className="p-4">{t('month' as any) || 'Mes'}</th>
                      <th className="p-4">{t('monto' as any) || 'Monto'}</th>
                      <th className="p-4 text-right">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredVentas.map(venta => (
                      <tr 
                        key={venta.id} 
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/ventas/${venta.id}`)}
                      >
                        <td className="p-4">
                          <div className="font-medium text-gray-900 truncate max-w-md">{venta.cliente_nombre}</div>
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {venta.anio}
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {MONTH_NAMES[venta.mes - 1]}
                        </td>
                        <td className="p-4 text-sm font-semibold text-teal-650">
                          {formatCurrency(venta.monto)}
                        </td>
                        <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <PermissionGuard section="ventas" action="edit">
                              <button
                                onClick={() => router.push(`/ventas/${venta.id}`)}
                                className="p-1.5 text-gray-400 hover:text-teal-650 hover:bg-teal-50 rounded-lg transition-all"
                                title={t('edit') as string}
                              >
                                <Edit2 size={16} />
                              </button>
                            </PermissionGuard>
                            <PermissionGuard section="ventas" action="delete">
                              <button
                                onClick={() => { setSelectedVenta(venta); setIsDeleteModalOpen(true); }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title={t('delete') as string}
                              >
                                <Trash2 size={16} />
                              </button>
                            </PermissionGuard>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('confirm') as string}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {t('deleteVentaDesc' as any) || '¿Estás seguro de que deseas eliminar esta venta?'}
          </p>
          {selectedVenta && (
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-150">
              <p className="text-sm font-semibold text-gray-900">{selectedVenta.cliente_nombre}</p>
              <p className="text-xs text-gray-500 mt-1">
                Periodo: {MONTH_NAMES[selectedVenta.mes - 1]} / {selectedVenta.anio} | Monto: {formatCurrency(selectedVenta.monto)}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="btn-secondary"
              disabled={isDeleting}
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleDelete}
              className="btn-primary !bg-red-600 hover:!bg-red-700 !border-red-700"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="animate-spin" size={18} /> : t('delete')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Grouped Client Sales Detail Modal */}
      <Modal
        open={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedGroupedClient(null)
        }}
        title={`${t('salesDetail' as any) || 'Detalle de Ventas'} - ${selectedGroupedClient?.cliente_nombre || ''}`}
      >
        {selectedGroupedClient && (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
            {/* KPI Summaries in Modal */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-100">
                <p className="text-xs text-teal-700 font-semibold uppercase">{t('totalSales' as any) || 'Ventas Totales'}</p>
                <p className="text-xl font-bold text-teal-850 mt-1">{formatCurrency(selectedGroupedClient.total_monto)}</p>
              </div>
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <p className="text-xs text-blue-700 font-semibold uppercase">{t('salesCount' as any) || 'No. de Ventas'}</p>
                <p className="text-xl font-bold text-blue-800 mt-1">{selectedGroupedClient.record_count}</p>
              </div>
            </div>

            {/* Yearly Comparison Chart in Modal */}
            <div className="card p-4 bg-gray-50/30">
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">{t('yearlyComparison' as any) || 'Comparativa por Año'}</h4>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={
                      Object.entries(
                        selectedGroupedClient.sales.reduce((acc, curr) => {
                          const yr = curr.anio
                          acc[yr] = (acc[yr] || 0) + Number(curr.monto || 0)
                          return acc
                        }, {} as Record<number, number>)
                      )
                      .map(([year, value]) => ({ name: String(year), value }))
                      .sort((a, b) => a.name.localeCompare(b.name))
                    }
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={formatChartTick} />
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value), true)} />
                    <Bar dataKey="value" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sales Records List in Modal */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase">{t('salesHistory' as any) || 'Historial de Ventas'}</h4>
              <div className="border border-gray-150 rounded-2xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                      <th className="p-3">{t('period' as any) || 'Periodo'}</th>
                      <th className="p-3">{t('monto' as any) || 'Monto'}</th>
                      <th className="p-3 text-right">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {selectedGroupedClient.sales
                      .sort((a, b) => b.anio !== a.anio ? b.anio - a.anio : b.mes - a.mes)
                      .map(sale => (
                        <tr key={sale.id} className="hover:bg-gray-50/50">
                          <td className="p-3 font-medium text-gray-700">
                            {MONTH_NAMES[sale.mes - 1]} / {sale.anio}
                          </td>
                          <td className="p-3 font-semibold text-teal-650">
                            {formatCurrency(sale.monto)}
                          </td>
                          <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5">
                              <PermissionGuard section="ventas" action="edit">
                                <button
                                  onClick={() => {
                                    setIsDetailModalOpen(false)
                                    router.push(`/ventas/${sale.id}`)
                                  }}
                                  className="p-1 text-gray-400 hover:text-teal-650 hover:bg-teal-50 rounded-md transition-all"
                                  title={t('edit') as string}
                                >
                                  <Edit2 size={14} />
                                </button>
                              </PermissionGuard>
                              <PermissionGuard section="ventas" action="delete">
                                <button
                                  onClick={() => {
                                    setSelectedVenta(sale)
                                    setIsDeleteModalOpen(true)
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-650 hover:bg-red-50 rounded-md transition-all"
                                  title={t('delete') as string}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </PermissionGuard>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setIsDetailModalOpen(false)
                  setSelectedGroupedClient(null)
                }}
                className="btn-secondary text-sm"
              >
                {t('close' as any) || 'Cerrar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  )
}
