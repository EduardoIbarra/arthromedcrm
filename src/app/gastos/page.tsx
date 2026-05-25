'use client'

import { useEffect, useState } from 'react'
import { Gasto } from '@/types/database'
import { useI18n } from '@/contexts/I18nContext'
import { Receipt, Plus, Edit2, Trash2, Calendar, DollarSign, MessageSquare, Tag, LayoutGrid, List, Filter, Download, Sparkles, PlusCircle, MinusCircle, Check, Loader2, Building2, XCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import PermissionGuard from '@/components/PermissionGuard'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

interface GastoWithCongreso extends Gasto {
  congreso?: {
    name: string
  }
  category?: {
    name: string
  }
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#64748b']

export default function GastosPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [gastos, setGastos] = useState<GastoWithCongreso[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [congresos, setCongresos] = useState<{ id: string; name: string }[]>([])
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null)
  const [selectedCongresoFilter, setSelectedCongresoFilter] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedGasto, setSelectedGasto] = useState<GastoWithCongreso | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)


  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [importPreview, setImportPreview] = useState<any[]>([])
  const [isSavingImport, setIsSavingImport] = useState(false)


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
      setGastos(data)
    } catch (err: any) {
      console.error('Error fetching gastos:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const { data, error } = await fetch('/api/gastos/categories').then(res => res.json())
      if (error) throw new Error(error)
      setCategories(data || [])
    } catch (err) {
      console.error('Error fetching categories:', err)
      // Fallback: try to get them from Supabase directly if the API is not ready
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase.from('catalog_spending_categories').select('id, name').order('name')
      if (data) setCategories(data)
    }
  }

  const fetchCongresos = async () => {
    try {
      const res = await fetch('/api/congresos')
      const { data } = await res.json()
      if (data) setCongresos(data.map((c: any) => ({ id: c.id, name: c.name })))
    } catch (err) {
      console.error('Error fetching congresos:', err)
    }
  }

  useEffect(() => {
    fetchGastos()
    fetchCategories()
    fetchCongresos()
  }, [startDate, endDate])

  const handleDelete = async () => {
    if (!selectedGasto) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/gastos/${selectedGasto.id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete')
      
      setIsDeleteModalOpen(false)
      fetchGastos()
    } catch (err: any) {
      console.error('Error deleting gasto:', err)
      alert(t('error') + ': ' + err.message)
    } finally {
      setIsDeleting(false)
    }
  }


  const handleExportExcel = () => {
    if (filteredGastos.length === 0) return
    const dataToExport = filteredGastos.map(g => ({
      Fecha: g.expense_date ? new Date(g.expense_date).toLocaleDateString() : new Date(g.created_at).toLocaleDateString(),
      Descripción: g.description,
      Nombre: g.name,
      Categoría: g.category?.name || 'Sin Categoría',
      Congreso: g.congreso?.name || '-',
      Monto: g.amount,
      IVA: g.iva,
      Total: g.total,
      'Facturable': g.is_billable ? 'Sí' : 'No',
      'Facturado': g.is_billed ? 'Sí' : 'No'
    }))
    
    const worksheet = XLSX.utils.json_to_sheet(dataToExport)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Gastos')
    XLSX.writeFile(workbook, 'Reporte_Gastos.xlsx')
  }

  const handleAnalyzeText = async () => {
    if (!importText.trim()) return
    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/gastos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: importText })
      })
      if (!res.ok) throw new Error('Failed to analyze text')
      const { spendings } = await res.json()
      setImportPreview(spendings || [])
    } catch (err: any) {
      console.error(err)
      alert('Error analyzing text: ' + err.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSaveImport = async () => {
    if (importPreview.length === 0) return
    setIsSavingImport(true)
    try {
      const dataToSave = importPreview.map(item => ({
        ...item,
        card: item.card || '',
        category_id: item.category_id || null
      }))

      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      })
      if (!res.ok) throw new Error('Failed to save imported spendings')
      
      setIsImportModalOpen(false)
      setImportText('')
      setImportPreview([])
      fetchGastos()
    } catch (err: any) {
      console.error(err)
      alert('Error saving spendings: ' + err.message)
    } finally {
      setIsSavingImport(false)
    }
  }

  const handleDeletePreviewRow = (index: number) => {
    setImportPreview(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddPreviewRow = () => {
    setImportPreview(prev => [...prev, { expense_date: new Date().toISOString(), description: '', name: '', amount: 0, total: 0, card: '', category_id: '' }])
  }

  const updatePreviewRow = (index: number, field: string, value: any) => {
    setImportPreview(prev => prev.map((item, i) => {
      if (i === index) {
        const updated = { ...item, [field]: value }
        if (field === 'amount') {
          updated.total = value
        }
        return updated
      }
      return item
    }))
  }

  const formatCurrency = (amount: number) => {

    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount)
  }

  // 1. Filtered lists for cross-filtering and rendering
  const gastosForCategoryChart = gastos.filter(g => {
    if (selectedCongresoFilter) {
      const congresoName = g.congreso?.name || 'Sin Congreso'
      return congresoName === selectedCongresoFilter
    }
    return true
  })

  const gastosForCongresoChart = gastos.filter(g => {
    if (selectedCategoryFilter) {
      const catName = g.category?.name || 'Sin Categoría'
      return catName === selectedCategoryFilter
    }
    return true
  })

  const filteredGastos = gastos.filter(g => {
    if (selectedCategoryFilter) {
      const catName = g.category?.name || 'Sin Categoría'
      if (catName !== selectedCategoryFilter) return false
    }
    if (selectedCongresoFilter) {
      const congresoName = g.congreso?.name || 'Sin Congreso'
      if (congresoName !== selectedCongresoFilter) return false
    }
    return true
  })

  // 2. Analytics Data Preparation
  const categoryMap = gastosForCategoryChart.reduce((acc, curr) => {
    const catName = curr.category?.name || 'Sin Categoría'
    acc[catName] = (acc[catName] || 0) + Number(curr.amount || 0)
    return acc
  }, {} as Record<string, number>)
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }))

  const congresoMap = gastosForCongresoChart.reduce((acc, curr) => {
    const congresoName = curr.congreso?.name || 'Sin Congreso'
    acc[congresoName] = (acc[congresoName] || 0) + Number(curr.amount || 0)
    return acc
  }, {} as Record<string, number>)
  const congresoData = Object.entries(congresoMap).map(([name, value]) => ({ name, value }))

  const billableAmount = filteredGastos.filter(g => g.is_billable).reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
  const nonBillableAmount = filteredGastos.filter(g => !g.is_billable).reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
  const billableData = [
    { name: t('billable'), value: billableAmount },
    { name: t('nonFacturable'), value: nonBillableAmount }
  ].filter(d => d.value > 0)

  const billedAmount = filteredGastos.filter(g => g.is_billable && g.is_billed).reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
  const unbilledAmount = filteredGastos.filter(g => g.is_billable && !g.is_billed).reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
  const pendingData = [
    { name: t('billed'), value: billedAmount },
    { name: t('unbilled'), value: unbilledAmount }
  ].filter(d => d.value > 0)

  const kpiTotalSpent = filteredGastos.reduce((acc, curr) => acc + Number(curr.total || 0), 0)
  const kpiTotalBillable = filteredGastos.filter(g => g.is_billable).reduce((acc, curr) => acc + Number(curr.total || 0), 0)
  const kpiTotalPendingBilling = filteredGastos.filter(g => g.is_billable && !g.is_billed).reduce((acc, curr) => acc + Number(curr.total || 0), 0)
  const kpiExpensesCount = filteredGastos.length

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-8">
        
        {/* HEADER */}
        <header className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Receipt className="text-blue-600" size={28} />
                {t('gastos')}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {t('appName')} / {t('gastos')}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <PermissionGuard section="gastos" action="create">
                <button onClick={handleExportExcel} className="btn-secondary whitespace-nowrap">
                  <Download size={18} /> Exportar
                </button>
                <button onClick={() => setIsImportModalOpen(true)} className="btn-secondary whitespace-nowrap !bg-purple-50 !text-purple-600 !border-purple-200 hover:!bg-purple-100">
                  <Sparkles size={18} /> Importar AI
                </button>
                <Link href="/gastos/new" className="btn-primary whitespace-nowrap">
                  <Plus size={18} /> {t('newGasto')}
                </Link>
              </PermissionGuard>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
              <Filter size={18} className="text-gray-400 ml-2" />
              <input 
                type="date" 
                className="erp-input !py-1.5 !px-3 text-sm"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                title={t('startDate') as string}
              />
              <span className="text-gray-400">-</span>
              <input 
                type="date" 
                className="erp-input !py-1.5 !px-3 text-sm"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                title={t('endDate') as string}
              />
            </div>

            {/* Active Filter Badges */}
            {(selectedCategoryFilter || selectedCongresoFilter) && (
              <div className="flex flex-wrap items-center gap-2">
                {selectedCategoryFilter && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                    <span>{t('categoryFilter')}: {selectedCategoryFilter}</span>
                    <button 
                      onClick={() => setSelectedCategoryFilter(null)}
                      className="hover:bg-blue-100 p-0.5 rounded-full transition-colors"
                      title="Quitar filtro"
                    >
                      <XCircle size={14} className="text-blue-500 hover:text-blue-700" />
                    </button>
                  </span>
                )}
                {selectedCongresoFilter && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                    <span>{t('congresoFilter')}: {selectedCongresoFilter}</span>
                    <button 
                      onClick={() => setSelectedCongresoFilter(null)}
                      className="hover:bg-purple-100 p-0.5 rounded-full transition-colors"
                      title="Quitar filtro"
                    >
                      <XCircle size={14} className="text-purple-500 hover:text-purple-700" />
                    </button>
                  </span>
                )}
                <button 
                  onClick={() => {
                    setSelectedCategoryFilter(null)
                    setSelectedCongresoFilter(null)
                  }}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {t('cleanFilters')}
                </button>
              </div>
            )}

            {/* View Toggle */}
            <div className="flex items-center p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                title={t('gridView') as string}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                title={t('listView') as string}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* KPIS */}
        {!isLoading && !error && gastos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4 flex flex-col justify-center border-l-4 border-l-blue-500">
              <span className="text-sm text-gray-500 font-medium">{t('totalSpent')}</span>
              <span className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(kpiTotalSpent)}</span>
            </div>
            <div className="card p-4 flex flex-col justify-center border-l-4 border-l-green-500">
              <span className="text-sm text-gray-500 font-medium">{t('totalBillable')}</span>
              <span className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(kpiTotalBillable)}</span>
            </div>
            <div className="card p-4 flex flex-col justify-center border-l-4 border-l-yellow-500">
              <span className="text-sm text-gray-500 font-medium">{t('totalPendingBilling')}</span>
              <span className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(kpiTotalPendingBilling)}</span>
            </div>
            <div className="card p-4 flex flex-col justify-center border-l-4 border-l-purple-500">
              <span className="text-sm text-gray-500 font-medium">{t('expensesCount')}</span>
              <span className="text-2xl font-bold text-gray-900 mt-1">{kpiExpensesCount}</span>
            </div>
          </div>
        )}

        {/* ANALYTICS CHARTS */}
        {!isLoading && !error && gastos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('spendingsByCategory')}</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={categoryData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={40} 
                      outerRadius={70} 
                      paddingAngle={2} 
                      dataKey="value"
                      onClick={(data) => {
                        if (data && typeof data.name === 'string') {
                          const name = data.name
                          setSelectedCategoryFilter(prev => prev === name ? null : name)
                        }
                      }}
                      style={{ cursor: 'pointer', outline: 'none' }}
                    >
                      {categoryData.map((entry, index) => {
                        const isSelected = selectedCategoryFilter === entry.name
                        const isAnySelected = selectedCategoryFilter !== null
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[index % COLORS.length]} 
                            opacity={isAnySelected ? (isSelected ? 1.0 : 0.3) : 1.0}
                            stroke={isSelected ? '#3b82f6' : '#fff'}
                            strokeWidth={isSelected ? 2 : 1}
                          />
                        )
                      })}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('facturableVsNon')}</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={billableData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                      <Cell fill="#3b82f6" />
                      <Cell fill="#94a3b8" />
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('pendingBilling')}</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pendingData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('spendingsByCongreso')}</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={congresoData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={40} 
                      outerRadius={70} 
                      paddingAngle={2} 
                      dataKey="value"
                      onClick={(data) => {
                        if (data && typeof data.name === 'string') {
                          const name = data.name
                          setSelectedCongresoFilter(prev => prev === name ? null : name)
                        }
                      }}
                      style={{ cursor: 'pointer', outline: 'none' }}
                    >
                      {congresoData.map((entry, index) => {
                        const isSelected = selectedCongresoFilter === entry.name
                        const isAnySelected = selectedCongresoFilter !== null
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[index % COLORS.length]} 
                            opacity={isAnySelected ? (isSelected ? 1.0 : 0.3) : 1.0}
                            stroke={isSelected ? '#3b82f6' : '#fff'}
                            strokeWidth={isSelected ? 2 : 1}
                          />
                        )
                      })}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* CONTENT */}
        {isLoading ? (
          <div className="card p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-red-500 bg-red-50 border-red-100">
            {error}
          </div>
        ) : gastos.length === 0 ? (
          <div className="card p-12 text-center text-gray-500">
            {t('noResults')}
          </div>
        ) : filteredGastos.length === 0 ? (
          <div className="card p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
            <p className="font-medium text-gray-600">{t('noFilteredResults')}</p>
            <button 
              onClick={() => {
                setSelectedCategoryFilter(null)
                setSelectedCongresoFilter(null)
              }}
              className="btn-secondary !py-1.5 !px-4 text-xs animate-pulse"
            >
              {t('cleanFilters')}
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGastos.map(gasto => (
              <div 
                key={gasto.id} 
                className="card p-6 flex flex-col items-start gap-4 hover:border-blue-300 hover:shadow-md transition-all group relative overflow-hidden h-full cursor-pointer"
                onClick={() => router.push(`/gastos/${gasto.id}`)}
              >
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <PermissionGuard section="gastos" action="edit">
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/gastos/${gasto.id}`) }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title={t('editGasto') as string}
                    >
                      <Edit2 size={16} />
                    </button>
                  </PermissionGuard>
                  <PermissionGuard section="gastos" action="delete">
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedGasto(gasto); setIsDeleteModalOpen(true); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title={t('delete') as string}
                    >
                      <Trash2 size={16} />
                    </button>
                  </PermissionGuard>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 group-hover:bg-blue-100 transition-all duration-300">
                  <Receipt size={24} />
                </div>
                
                <div className="flex-1 w-full">
                  <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-2">{gasto.description || gasto.name}</h3>
                  <p className="text-sm text-gray-500 truncate">{gasto.description ? gasto.name : ''}</p>
                  
                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400 uppercase font-semibold">{t('total')}</span>
                      <span className="text-lg font-bold text-blue-600">{formatCurrency(gasto.total)}</span>
                    </div>
                    
                    <div className="pt-2 space-y-1.5 border-t border-gray-50">
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <Calendar size={12} className="text-blue-400" />
                        {gasto.expense_date ? new Date(gasto.expense_date).toLocaleDateString() : new Date(gasto.created_at).toLocaleDateString()}
                      </p>
                      {gasto.category && (
                        <p className="text-xs text-blue-600 font-semibold flex items-center gap-2">
                          <Tag size={12} />
                          {gasto.category.name}
                        </p>
                      )}
                      {gasto.congreso && (
                        <p className="text-xs text-gray-500 flex items-center gap-2">
                          <Calendar size={12} className="text-purple-400" />
                          <span className="truncate">{gasto.congreso.name}</span>
                        </p>
                      )}
                      <p className="text-xs text-gray-400 flex items-center gap-2">
                        <DollarSign size={12} />
                        {t('amount')}: {formatCurrency(gasto.amount)} | {t('iva')}: {formatCurrency(gasto.iva)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            ))}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-600">
                    <th className="p-4">{t('expenseDate')}</th>
                    <th className="p-4">Descripción / Nombre</th>
                    <th className="p-4">{t('category')}</th>
                    <th className="p-4">{t('billable')}</th>
                    <th className="p-4">{t('amount')}</th>
                    <th className="p-4">{t('total')}</th>
                    <th className="p-4 text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredGastos.map(gasto => (
                    <tr 
                      key={gasto.id} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/gastos/${gasto.id}`)}
                    >
                      <td className="p-4 text-sm text-gray-500 whitespace-nowrap">
                        {gasto.expense_date ? new Date(gasto.expense_date).toLocaleDateString() : new Date(gasto.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-900 truncate max-w-xs">{gasto.description || gasto.name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-xs">{gasto.description ? gasto.name : ''}</div>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {gasto.category ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {gasto.category.name}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {gasto.is_billable ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${gasto.is_billed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {gasto.is_billed ? t('billed') : t('unbilled')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {t('nonFacturable')}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-gray-500 whitespace-nowrap">{formatCurrency(gasto.amount)}</td>
                      <td className="p-4 text-sm font-bold text-blue-600 whitespace-nowrap">{formatCurrency(gasto.total)}</td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <PermissionGuard section="gastos" action="edit">
                            <button 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/gastos/${gasto.id}`) }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                          </PermissionGuard>
                          <PermissionGuard section="gastos" action="delete">
                            <button 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedGasto(gasto); setIsDeleteModalOpen(true); }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
        )}

        
        {/* Delete Confirmation Modal */}
        <Modal 
          open={isDeleteModalOpen} 
          onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
          title={t('delete') as string}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              {t('deleteGastoDesc')}
              <br/><br/>
              <strong>{selectedGasto?.description || selectedGasto?.name}</strong>
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

        {/* Import AI Modal */}
        <Modal 
          open={isImportModalOpen} 
          onClose={() => !isAnalyzing && !isSavingImport && setIsImportModalOpen(false)}
          title="Importar Gastos con Inteligencia Artificial"
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6">
            {!importPreview.length ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Pega aquí los mensajes de WhatsApp o el texto con los gastos. La IA se encargará de extraer la fecha, descripción, nombre y monto.</p>
                <div className="relative group overflow-hidden rounded-xl">
                  <textarea 
                    className={`erp-input min-h-[200px] transition-all duration-500 ${isAnalyzing ? 'opacity-50 blur-[1px] bg-purple-50/30' : ''}`} 
                    placeholder="05/05/2026, 9:42 a. m. - Ricardo Puente: 3850 Hotel Safi 2 noches Tarjeta 8841..."
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    disabled={isAnalyzing}
                  />
                  {isAnalyzing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
                      <div className="w-full h-full absolute top-0 left-0 ai-scan-line"></div>
                      <div className="bg-white/80 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border border-purple-100 flex items-center gap-3 animate-bounce ai-glow">
                        <Sparkles className="text-purple-600 animate-pulse" size={24} />
                        <span className="text-purple-700 font-bold text-lg tracking-tight">IA ANALIZANDO...</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setIsImportModalOpen(false)} className="btn-secondary" disabled={isAnalyzing}>Cancelar</button>
                  <button 
                    onClick={handleAnalyzeText} 
                    className={`btn-primary !bg-purple-600 hover:!bg-purple-700 !border-purple-600 relative overflow-hidden group transition-all duration-500 ${isAnalyzing ? '!pr-12' : ''}`}
                    disabled={isAnalyzing || !importText.trim()}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {isAnalyzing ? 'Procesando Inteligencia...' : 'Analizar con IA'} 
                      {!isAnalyzing && <Sparkles size={16} />}
                    </span>
                    {isAnalyzing && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 size={20} className="animate-spin text-white" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">Vista previa de gastos extraídos</h3>
                  <button onClick={handleAddPreviewRow} className="text-blue-600 text-sm flex items-center hover:underline">
                    <PlusCircle size={16} className="mr-1" /> Añadir fila
                  </button>
                </div>
                <div className="max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-600">
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Descripción</th>
                        <th className="p-3">Nombre</th>
                        <th className="p-3">Categoría</th>
                        <th className="p-3">Tarjeta / Pago</th>
                        <th className="p-3">Monto / Total</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {importPreview.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-2 w-32">
                            <input 
                              type="date" 
                              className="erp-input !py-1 !px-2 text-sm w-full" 
                              value={item.expense_date?.split('T')[0] || ''}
                              onChange={e => updatePreviewRow(index, 'expense_date', e.target.value)}
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="text" 
                              className="erp-input !py-1 !px-2 text-sm w-full" 
                              value={item.description || ''}
                              onChange={e => updatePreviewRow(index, 'description', e.target.value)}
                            />
                          </td>
                          <td className="p-2 w-48">
                            <input 
                              type="text" 
                              className="erp-input !py-1 !px-2 text-sm w-full" 
                              value={item.name || ''}
                              onChange={e => updatePreviewRow(index, 'name', e.target.value)}
                            />
                          </td>
                          <td className="p-2 w-48">
                            <select 
                              className="erp-input !py-1 !px-2 text-sm w-full" 
                              value={item.category_id || ''}
                              onChange={e => updatePreviewRow(index, 'category_id', e.target.value)}
                            >
                              <option value="">-- Sin Categoría --</option>
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 w-48">
                            <input 
                              type="text" 
                              className="erp-input !py-1 !px-2 text-sm w-full" 
                              value={item.card || ''}
                              onChange={e => updatePreviewRow(index, 'card', e.target.value)}
                              placeholder="Ej. Tarjeta 8841"
                            />
                          </td>
                          <td className="p-2 w-32">
                            <input 
                              type="number" 
                              className="erp-input !py-1 !px-2 text-sm w-full" 
                              value={item.amount || 0}
                              onChange={e => updatePreviewRow(index, 'amount', Number(e.target.value))}
                            />
                          </td>
                          <td className="p-2 w-10 text-center">
                            <button onClick={() => handleDeletePreviewRow(index)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                              <MinusCircle size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <button onClick={() => { setImportPreview([]); setImportText(''); }} className="btn-secondary text-red-600 hover:bg-red-50">
                    Descartar y volver
                  </button>
                  <button 
                    onClick={handleSaveImport} 
                    className="btn-primary bg-green-600 hover:bg-green-700 border-green-600"
                    disabled={isSavingImport}
                  >
                    {isSavingImport ? 'Guardando...' : `Guardar ${importPreview.length} gastos`} <Check size={16} className="ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>


      </div>
    </AppShell>
  )
}
