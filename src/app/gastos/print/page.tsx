'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Receipt, Printer, XCircle, FileText, ClipboardList, RefreshCw } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useI18n } from '@/contexts/I18nContext'

interface GastoWithCongreso {
  id: string
  name: string
  description?: string
  amount: number
  iva: number
  total: number
  is_billable: boolean
  is_billed: boolean
  card?: string
  comments?: string
  folio_fiscal?: string
  created_at: string
  expense_date?: string
  congreso?: {
    name: string
  }
  category?: {
    name: string
  }
}

// Color palette matching the main page
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#64748b']

function GastoPrintContent() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''
  const categoryFilter = searchParams.get('category') || ''
  const congresoFilter = searchParams.get('congreso') || ''
  const searchTerm = searchParams.get('search') || ''

  const [gastos, setGastos] = useState<GastoWithCongreso[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch gastos based on date query parameters
  useEffect(() => {
    const fetchGastos = async () => {
      try {
        setIsLoading(true)
        const params = new URLSearchParams()
        if (startDate) params.append('startDate', startDate)
        if (endDate) params.append('endDate', endDate)
        
        const res = await fetch('/api/gastos?' + params.toString())
        if (!res.ok) {
          throw new Error('Failed to fetch gastos')
        }
        const { data } = await res.json()
        setGastos(data || [])
      } catch (err) {
        console.error('Error fetching gastos for print:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchGastos()
  }, [startDate, endDate])

  // Custom filters matching the list view filtering
  const searchFilter = (g: GastoWithCongreso) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    const matchesDescription = g.description?.toLowerCase().includes(term) || false
    const matchesName = g.name?.toLowerCase().includes(term) || false
    const matchesCategory = g.category?.name?.toLowerCase().includes(term) || false
    const matchesCongreso = g.congreso?.name?.toLowerCase().includes(term) || false
    const matchesCard = g.card?.toLowerCase().includes(term) || false
    const matchesComments = g.comments?.toLowerCase().includes(term) || false
    const matchesFolio = g.folio_fiscal?.toLowerCase().includes(term) || false
    const matchesAmount = g.amount !== undefined && g.amount !== null ? String(g.amount).includes(term) : false
    const matchesTotal = g.total !== undefined && g.total !== null ? String(g.total).includes(term) : false
    return matchesDescription || matchesName || matchesCategory || matchesCongreso || matchesCard || matchesComments || matchesFolio || matchesAmount || matchesTotal
  }

  const filteredGastos = gastos.filter((g: GastoWithCongreso) => {
    if (!searchFilter(g)) return false
    if (categoryFilter) {
      const catName = g.category?.name || 'Sin Categoría'
      if (catName !== categoryFilter) return false
    }
    if (congresoFilter) {
      const congresoName = g.congreso?.name || 'Sin Congreso'
      if (congresoName !== congresoFilter) return false
    }
    return true
  })

  // Auto trigger browser print window after charts mount fully (animations disabled)
  useEffect(() => {
    if (!isLoading && filteredGastos.length > 0) {
      const timer = setTimeout(() => {
        window.print()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isLoading, filteredGastos.length])

  // Currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount)
  }

  // Active filters display string
  const getActiveFiltersString = () => {
    const filters = []
    if (startDate) filters.push(`Inicio: ${startDate}`)
    if (endDate) filters.push(`Fin: ${endDate}`)
    if (categoryFilter) filters.push(`Categoría: ${categoryFilter}`)
    if (congresoFilter) filters.push(`Congreso: ${congresoFilter}`)
    if (searchTerm) filters.push(`Búsqueda: "${searchTerm}"`)
    return filters.length > 0 ? filters.join(' | ') : 'Ninguno (Todos los registros)'
  }

  // Pre-calculate sums and chart records
  const categoryMap = filteredGastos.reduce((acc, curr) => {
    const catName = curr.category?.name || 'Sin Categoría'
    acc[catName] = (acc[catName] || 0) + Number(curr.amount || 0)
    return acc
  }, {} as Record<string, number>)
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }))

  const congresoMap = filteredGastos.reduce((acc, curr) => {
    const congresoName = curr.congreso?.name || 'Sin Congreso'
    acc[congresoName] = (acc[congresoName] || 0) + Number(curr.amount || 0)
    return acc
  }, {} as Record<string, number>)
  const congresoData = Object.entries(congresoMap).map(([name, value]) => ({ name, value }))

  const billableAmount = filteredGastos.filter(g => g.is_billable).reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
  const nonBillableAmount = filteredGastos.filter(g => !g.is_billable).reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
  const billableData = [
    { name: t('billable') || 'Facturable', value: billableAmount },
    { name: t('nonFacturable') || 'No Facturable', value: nonBillableAmount }
  ].filter(d => d.value > 0)

  const billedAmount = filteredGastos.filter(g => g.is_billable && g.is_billed).reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
  const unbilledAmount = filteredGastos.filter(g => g.is_billable && !g.is_billed).reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
  const pendingData = [
    { name: t('billed') || 'Facturado', value: billedAmount },
    { name: t('unbilled') || 'Pendiente', value: unbilledAmount }
  ].filter(d => d.value > 0)

  const kpiTotalSpent = filteredGastos.reduce((acc, curr) => acc + Number(curr.total || 0), 0)
  const kpiTotalBillable = filteredGastos.filter(g => g.is_billable).reduce((acc, curr) => acc + Number(curr.total || 0), 0)
  const kpiTotalPendingBilling = filteredGastos.filter(g => g.is_billable && !g.is_billed).reduce((acc, curr) => acc + Number(curr.total || 0), 0)
  const kpiExpensesCount = filteredGastos.length

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 gap-4">
        <RefreshCw className="animate-spin text-blue-600" size={32} />
        <p className="text-gray-500 font-medium text-sm">Generando reporte y cargando datos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 gap-4 text-center">
        <XCircle className="text-red-500" size={48} />
        <h1 className="text-xl font-bold text-gray-800">Error al cargar el reporte</h1>
        <p className="text-gray-500 text-sm max-w-md">{error}</p>
        <button onClick={() => window.close()} className="btn-secondary !py-2 !px-4 mt-2">
          Cerrar ventana
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100/50 p-0 md:p-8 font-sans antialiased text-gray-900">
      
      {/* Dynamic styles to override body background and hide UI controls during print */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }
          .chart-box {
            border: 1px solid #e2e8f0 !important;
            page-break-inside: avoid !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
          @page {
            size: portrait;
            margin: 15mm;
          }
        }
      `}} />

      {/* FLOATING ACTION BAR (Hidden during printing) */}
      <div className="no-print bg-white border-b border-gray-200 sticky top-0 z-50 px-6 py-4 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-6xl mx-auto rounded-xl mt-0 md:mt-2">
        <div className="flex items-center gap-3">
          <FileText className="text-blue-600" size={24} />
          <div>
            <h1 className="font-bold text-gray-900">Vista Previa del Reporte PDF</h1>
            <p className="text-xs text-gray-500">
              Esta es una vista previa lista para impresión.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => window.print()} 
            className="btn-primary !py-2 !px-4 text-sm flex items-center gap-2"
          >
            <Printer size={16} /> Imprimir / Guardar PDF
          </button>
          <button 
            onClick={() => window.close()} 
            className="btn-secondary !py-2 !px-4 text-sm flex items-center gap-2"
          >
            <XCircle size={16} /> Cerrar
          </button>
        </div>
      </div>

      {/* REPORT WRAPPER */}
      <div className="print-container bg-white border border-gray-200 shadow-md max-w-6xl mx-auto p-8 md:p-12 rounded-xl">
        
        {/* HEADER BRANDING */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-blue-500 pb-6 mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-blue-900 flex items-center gap-2">
              <span className="bg-blue-600 text-white p-1.5 rounded-lg"><Receipt size={22} /></span>
              ARTHROMED
            </h2>
            <p className="text-xs text-gray-500 font-semibold tracking-wider uppercase mt-1">
              Equipo Médico de Alto Rendimiento
            </p>
          </div>
          <div className="text-left sm:text-right">
            <h1 className="text-xl font-bold text-gray-800">Reporte Ejecutivo de Gastos</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Generado el {new Date().toLocaleString('es-MX')}
            </p>
          </div>
        </div>

        {/* METADATA & FILTERS */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-8 text-sm grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <span className="font-semibold text-gray-700 block">Filtros Activos:</span>
            <span className="text-gray-600 font-mono text-xs">{getActiveFiltersString()}</span>
          </div>
          <div className="md:text-right">
            <span className="font-semibold text-gray-700 block">Estado del Reporte:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-150 text-green-700 border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>
              Reporte Consolidado
            </span>
          </div>
        </div>

        {/* SUMMARY KPIs CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="chart-box bg-white border border-gray-150 rounded-xl p-4 flex flex-col justify-center border-l-4 border-l-blue-500">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{t('totalSpent') || 'Total Gastado'}</span>
            <span className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(kpiTotalSpent)}</span>
          </div>
          <div className="chart-box bg-white border border-gray-150 rounded-xl p-4 flex flex-col justify-center border-l-4 border-l-green-500">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{t('totalBillable') || 'Total Facturable'}</span>
            <span className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(kpiTotalBillable)}</span>
          </div>
          <div className="chart-box bg-white border border-gray-150 rounded-xl p-4 flex flex-col justify-center border-l-4 border-l-yellow-500">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{t('totalPendingBilling') || 'Pendiente Factura'}</span>
            <span className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(kpiTotalPendingBilling)}</span>
          </div>
          <div className="chart-box bg-white border border-gray-150 rounded-xl p-4 flex flex-col justify-center border-l-4 border-l-purple-500">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{t('expensesCount') || 'Transacciones'}</span>
            <span className="text-xl font-bold text-gray-900 mt-1">{kpiExpensesCount}</span>
          </div>
        </div>

        {/* CHARTS CONTAINER (2x2 Grid) */}
        {filteredGastos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            
            {/* Category Chart */}
            {categoryData.length > 0 && (
              <div className="chart-box bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center">
                <h3 className="text-sm font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2 w-full text-center">
                  {t('spendingsByCategory') || 'Gastos por Categoría'}
                </h3>
                <div className="h-44 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={categoryData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={30} 
                        outerRadius={55} 
                        paddingAngle={2} 
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* List Legend values on bottom to avoid messy visual */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-3 text-xs w-full">
                  {categoryData.map((entry, index) => (
                    <span key={entry.name} className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                      <span className="text-gray-600 font-medium">{entry.name}:</span>
                      <span className="font-bold text-gray-800">{formatCurrency(entry.value)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Congreso Chart */}
            {congresoData.length > 0 && (
              <div className="chart-box bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center">
                <h3 className="text-sm font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2 w-full text-center">
                  {t('spendingsByCongreso') || 'Gastos por Congreso'}
                </h3>
                <div className="h-44 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={congresoData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={30} 
                        outerRadius={55} 
                        paddingAngle={2} 
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {congresoData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-3 text-xs w-full">
                  {congresoData.map((entry, index) => (
                    <span key={entry.name} className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                      <span className="text-gray-600 font-medium">{entry.name}:</span>
                      <span className="font-bold text-gray-800">{formatCurrency(entry.value)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Billable Chart */}
            {billableData.length > 0 && (
              <div className="chart-box bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center">
                <h3 className="text-sm font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2 w-full text-center">
                  {t('facturableVsNon') || 'Facturable vs No Facturable'}
                </h3>
                <div className="h-44 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={billableData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={30} 
                        outerRadius={55} 
                        paddingAngle={2} 
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        <Cell fill="#3b82f6" />
                        <Cell fill="#94a3b8" />
                      </Pie>
                      <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-3 text-xs w-full">
                  {billableData.map((entry, index) => (
                    <span key={entry.name} className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: index === 0 ? '#3b82f6' : '#94a3b8' }}></span>
                      <span className="text-gray-600 font-medium">{entry.name}:</span>
                      <span className="font-bold text-gray-800">{formatCurrency(entry.value)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Billing Chart */}
            {pendingData.length > 0 && (
              <div className="chart-box bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center">
                <h3 className="text-sm font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2 w-full text-center">
                  {t('pendingBilling') || 'Pendiente de Facturación'}
                </h3>
                <div className="h-44 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={pendingData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={30} 
                        outerRadius={55} 
                        paddingAngle={2} 
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                      <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-3 text-xs w-full">
                  {pendingData.map((entry, index) => (
                    <span key={entry.name} className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: index === 0 ? '#10b981' : '#f59e0b' }}></span>
                      <span className="text-gray-600 font-medium">{entry.name}:</span>
                      <span className="font-bold text-gray-800">{formatCurrency(entry.value)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DETAILED DATA TABLE */}
        <div className="mt-8">
          <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-150 pb-2">
            <ClipboardList size={18} className="text-blue-600" />
            Desglose de Gastos
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-150 border-b border-gray-300 font-bold text-gray-700 uppercase tracking-wider text-[10px]">
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Descripción</th>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Categoría</th>
                  <th className="p-3">Congreso</th>
                  <th className="p-3">Facturable</th>
                  <th className="p-3 text-right">Monto</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredGastos.map(g => (
                  <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-3 whitespace-nowrap text-gray-500 font-mono">
                      {g.expense_date ? new Date(g.expense_date).toLocaleDateString() : new Date(g.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 font-semibold text-gray-900 max-w-[200px] truncate">{g.description || '-'}</td>
                    <td className="p-3 text-gray-600 max-w-[150px] truncate">{g.name}</td>
                    <td className="p-3 text-gray-600 font-medium">{g.category?.name || 'Sin Categoría'}</td>
                    <td className="p-3 text-gray-500 max-w-[150px] truncate">{g.congreso?.name || '-'}</td>
                    <td className="p-3 whitespace-nowrap">
                      {g.is_billable ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${g.is_billed ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-750 border border-yellow-250'}`}>
                          {g.is_billed ? 'Facturado' : 'Pendiente'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                          No Facturable
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right text-gray-600 font-mono whitespace-nowrap">{formatCurrency(g.amount)}</td>
                    <td className="p-3 text-right font-bold text-gray-900 font-mono whitespace-nowrap">{formatCurrency(g.total)}</td>
                  </tr>
                ))}
                
                {/* Summary row */}
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-300 text-sm">
                  <td colSpan={6} className="p-4 text-right text-gray-700 uppercase tracking-wider text-xs">Total General</td>
                  <td className="p-4 text-right font-mono text-gray-700 text-xs">
                    {formatCurrency(filteredGastos.reduce((acc, curr) => acc + Number(curr.amount || 0), 0))}
                  </td>
                  <td className="p-4 text-right font-mono text-blue-800 text-xs">
                    {formatCurrency(kpiTotalSpent)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SIGNATURE BLOCK */}
        <div className="grid grid-cols-2 gap-8 mt-16 pt-10 border-t border-gray-200 text-center text-xs text-gray-400 max-w-2xl mx-auto">
          <div>
            <div className="border-b border-gray-300 w-44 mx-auto mb-2 h-10"></div>
            <p className="font-semibold text-gray-500">Preparado Por</p>
            <p className="text-[10px] text-gray-400">Departamento de Finanzas</p>
          </div>
          <div>
            <div className="border-b border-gray-300 w-44 mx-auto mb-2 h-10"></div>
            <p className="font-semibold text-gray-500">Autorizado Por</p>
            <p className="text-[10px] text-gray-400">Dirección General</p>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function GastoPrintPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 gap-4">
        <RefreshCw className="animate-spin text-blue-600" size={32} />
        <p className="text-gray-500 font-medium text-sm">Cargando reporte de gastos...</p>
      </div>
    }>
      <GastoPrintContent />
    </Suspense>
  )
}
