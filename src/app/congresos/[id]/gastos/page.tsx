'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { 
  ArrowLeft, DollarSign, HandCoins, Calendar, MapPin, 
  TrendingUp, TrendingDown, PieChart, BarChart3, Plus, 
  Search, Filter, Receipt, FileText, CheckCircle2, AlertCircle, Edit2, ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import PermissionGuard from '@/components/PermissionGuard'

interface CongresoDetails {
  id: string
  name: string
  start_date: string
  end_date: string
  location: string
  global_budget?: number | null
  congreso_gastos_estimados?: {
    id: string
    category_id: string
    amount: number | string
    catalog_spending_categories?: {
      id: string
      name: string
    }
  }[]
}

interface GastoReal {
  id: string
  name: string
  description?: string
  amount: number | string
  iva: number | string
  total: number | string
  expense_date: string
  category_id?: string
  category?: {
    id: string
    name: string
  }
  card?: string
  folio_fiscal?: string
  invoice_url?: string
}

interface CategoryComparison {
  categoryId: string
  categoryName: string
  estimatedAmount: number
  actualTotal: number
  diff: number // estimated - actual (positive = under budget, negative = over budget)
  percentSpent: number
}

export default function CongresoGastosPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const router = useRouter()

  const [congreso, setCongreso] = useState<CongresoDetails | null>(null)
  const [gastosReales, setGastosReales] = useState<GastoReal[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const [congresoRes, gastosRes, categoriesRes] = await Promise.all([
          fetch(`/api/congresos/${id}`),
          fetch(`/api/gastos?congress_id=${id}`),
          fetch('/api/gastos/categories')
        ])

        if (!congresoRes.ok) throw new Error('No se pudo cargar la información del congreso')
        
        const congresoData = await congresoRes.json()
        const gastosData = await gastosRes.json()
        const categoriesData = await categoriesRes.json()

        setCongreso(congresoData.data)
        setGastosReales(gastosData.data || [])
        setCategories(categoriesData.data || [])
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Error al cargar datos de gastos')
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      loadData()
    }
  }, [id])

  // Calculations
  const totalEstimadoCategories = useMemo(() => {
    if (!congreso?.congreso_gastos_estimados) return 0
    return congreso.congreso_gastos_estimados.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  }, [congreso])

  const presupuestoGlobal = useMemo(() => {
    return Number(congreso?.global_budget) || 0
  }, [congreso])

  const totalGastoReal = useMemo(() => {
    return gastosReales.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0)
  }, [gastosReales])

  const totalGastoSubtotal = useMemo(() => {
    return gastosReales.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  }, [gastosReales])

  const totalGastoIva = useMemo(() => {
    return gastosReales.reduce((acc, curr) => acc + (Number(curr.iva) || 0), 0)
  }, [gastosReales])

  // Comparison per category
  const categoryComparisons = useMemo<CategoryComparison[]>(() => {
    const map = new Map<string, { categoryName: string; estimated: number; actual: number }>()

    // Initialize with categories
    categories.forEach(cat => {
      map.set(cat.id, { categoryName: cat.name, estimated: 0, actual: 0 })
    })

    // Add estimated
    congreso?.congreso_gastos_estimados?.forEach(ge => {
      const catId = ge.category_id
      const catName = ge.catalog_spending_categories?.name || 'Sin Categoría'
      const current = map.get(catId) || { categoryName: catName, estimated: 0, actual: 0 }
      current.estimated += Number(ge.amount) || 0
      map.set(catId, current)
    })

    // Add actual expenses
    gastosReales.forEach(g => {
      const catId = g.category_id || 'uncategorized'
      const catName = g.category?.name || 'Sin Categoría'
      const current = map.get(catId) || { categoryName: catName, estimated: 0, actual: 0 }
      current.actual += Number(g.total) || 0
      map.set(catId, current)
    })

    const results: CategoryComparison[] = []
    map.forEach((val, key) => {
      if (val.estimated > 0 || val.actual > 0) {
        const estimatedAmount = val.estimated
        const actualTotal = val.actual
        const diff = estimatedAmount - actualTotal
        const percentSpent = estimatedAmount > 0 ? (actualTotal / estimatedAmount) * 100 : 100
        results.push({
          categoryId: key,
          categoryName: val.categoryName,
          estimatedAmount,
          actualTotal,
          diff,
          percentSpent
        })
      }
    })

    // Sort by largest spending / estimated
    return results.sort((a, b) => Math.max(b.actualTotal, b.estimatedAmount) - Math.max(a.actualTotal, a.estimatedAmount))
  }, [categories, congreso, gastosReales])

  // Filtered actual expenses list
  const filteredGastos = useMemo(() => {
    return gastosReales.filter(g => {
      const matchesSearch = searchQuery === '' || 
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (g.card && g.card.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (g.folio_fiscal && g.folio_fiscal.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesCat = selectedCategory === 'all' || g.category_id === selectedCategory

      return matchesSearch && matchesCat
    })
  }, [gastosReales, searchQuery, selectedCategory])

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 flex justify-center items-center h-64">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      </AppShell>
    )
  }

  if (error || !congreso) {
    return (
      <AppShell>
        <div className="p-6 md:p-8 max-w-6xl mx-auto">
          <div className="card p-8 text-center text-red-500 bg-red-50 border-red-100">
            {error || 'Congreso no encontrado'}
          </div>
        </div>
      </AppShell>
    )
  }

  // Budget difference calculation
  const targetBudget = presupuestoGlobal > 0 ? presupuestoGlobal : totalEstimadoCategories
  const budgetDiff = targetBudget - totalGastoReal
  const budgetSpentPercent = targetBudget > 0 ? Math.min(100, Math.round((totalGastoReal / targetBudget) * 100)) : 0

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
        
        {/* Header Navigation */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="flex items-center gap-4">
            <Link 
              href={`/congresos/${id}/view`} 
              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
              title={t('back')}
            >
              <ArrowLeft size={24} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-100 text-amber-800 font-medium text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <HandCoins size={12} /> Control de Gastos
                </span>
                <span className="text-xs text-gray-400 font-mono">ID: {id.slice(0, 8)}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
                {congreso.name}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <Link 
              href={`/congresos/${id}?tab=gastos`} 
              className="btn-secondary bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            >
              <Edit2 size={16} /> Editar Gastos Estimados
            </Link>
            <PermissionGuard section="gastos" action="create">
              <Link 
                href={`/gastos/new?congress_id=${id}`} 
                className="btn-primary"
              >
                <Plus size={18} /> Registrar Nuevo Gasto
              </Link>
            </PermissionGuard>
          </div>
        </header>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Presupuesto Configurado */}
          <div className="card p-5 bg-white border border-gray-100 shadow-sm rounded-2xl relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Presupuesto Configurado</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <DollarSign size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              ${targetBudget.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {presupuestoGlobal > 0 ? 'Presupuesto Global Definido' : 'Suma de Gastos Estimados'}
            </p>
          </div>

          {/* Gasto Real Total */}
          <div className="card p-5 bg-white border border-gray-100 shadow-sm rounded-2xl relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Gastado Real</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Receipt size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              ${totalGastoReal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
              <span>Subtotal: ${totalGastoSubtotal.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span>
              <span>IVA: ${totalGastoIva.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          {/* Estado del Presupuesto */}
          <div className={`card p-5 border shadow-sm rounded-2xl relative overflow-hidden ${budgetDiff >= 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Variación Presupuestal</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${budgetDiff >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {budgetDiff >= 0 ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
              </div>
            </div>
            <p className={`text-2xl font-bold ${budgetDiff >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {budgetDiff >= 0 ? '+' : ''}${budgetDiff.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs font-medium mt-1 flex items-center gap-1">
              {budgetDiff >= 0 ? (
                <span className="text-emerald-700 flex items-center gap-1"><CheckCircle2 size={13} /> Dentro del presupuesto</span>
              ) : (
                <span className="text-red-700 flex items-center gap-1"><AlertCircle size={13} /> Exceso de presupuesto</span>
              )}
            </p>
          </div>

          {/* Porcentaje Ejecutado */}
          <div className="card p-5 bg-white border border-gray-100 shadow-sm rounded-2xl relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Ejecución del Gasto</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <PieChart size={18} />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-bold text-gray-900">{budgetSpentPercent}%</p>
              <span className="text-xs text-gray-500 font-medium">{gastosReales.length} registros</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${budgetSpentPercent > 100 ? 'bg-red-500' : budgetSpentPercent > 85 ? 'bg-amber-500' : 'bg-blue-600'}`}
                style={{ width: `${Math.min(100, budgetSpentPercent)}%` }}
              />
            </div>
          </div>

        </div>

        {/* Section 1: Comparison Matrix (Gastos Estimados vs Real) */}
        <section className="card p-6 border border-gray-100 shadow-sm rounded-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 size={20} className="text-blue-600" />
                Comparativa: Gastos Estimados vs Real por Categoría
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Desglose comparativo entre lo planificado en la edición del congreso y los comprobantes reales ingresados.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Estimado</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> Real Gastado</span>
            </div>
          </div>

          {categoryComparisons.length > 0 ? (
            <div className="space-y-5">
              {categoryComparisons.map(cat => {
                const isOverBudget = cat.actualTotal > cat.estimatedAmount && cat.estimatedAmount > 0
                const maxVal = Math.max(cat.estimatedAmount, cat.actualTotal, 1)
                const estBarWidth = Math.min(100, Math.round((cat.estimatedAmount / maxVal) * 100))
                const actBarWidth = Math.min(100, Math.round((cat.actualTotal / maxVal) * 100))

                return (
                  <div key={cat.categoryId} className="p-4 bg-gray-50/70 hover:bg-gray-50 rounded-xl border border-gray-100 transition-colors space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">{cat.categoryName}</span>
                        {isOverBudget && (
                          <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertCircle size={10} /> Sobrepasado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-6 text-sm font-mono">
                        <div>
                          <span className="text-xs text-gray-400 uppercase font-sans mr-1">Est:</span>
                          <strong className="text-gray-700">${cat.estimatedAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div>
                          <span className="text-xs text-gray-400 uppercase font-sans mr-1">Real:</span>
                          <strong className={isOverBudget ? 'text-red-600 font-bold' : 'text-amber-600 font-bold'}>
                            ${cat.actualTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div className="w-24 text-right">
                          <span className={`text-xs font-bold font-sans ${cat.diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {cat.diff >= 0 ? `-$${cat.diff.toLocaleString('es-MX', { maximumFractionDigits: 0 })}` : `+$${Math.abs(cat.diff).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Visual Bars */}
                    <div className="space-y-1.5">
                      {/* Estimated Bar */}
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-400 font-medium w-14">Estimado</span>
                        <div className="flex-1 bg-gray-200/70 rounded-full h-2 overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full transition-all duration-300" style={{ width: `${estBarWidth}%` }} />
                        </div>
                      </div>
                      {/* Actual Bar */}
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-400 font-medium w-14">Real</span>
                        <div className="flex-1 bg-gray-200/70 rounded-full h-2 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-300 ${isOverBudget ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${actBarWidth}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              No hay gastos ni estimaciones registradas en este congreso.
            </div>
          )}
        </section>

        {/* Section 2: Detailed List of Real Expenses */}
        <section className="card p-6 border border-gray-100 shadow-sm rounded-2xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Receipt size={20} className="text-amber-600" />
                Listado Detallado de Gastos Reales ({filteredGastos.length})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Comprobantes y egresos asignados específicamente a {congreso.name}.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Buscar gastos..."
                  className="erp-input pl-9 pr-3 py-1.5 text-xs w-48 sm:w-64"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="relative">
                <select
                  className="erp-input py-1.5 text-xs pr-8"
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                >
                  <option value="all">Todas las Categorías</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {filteredGastos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="pb-3 px-2">Concepto / Nombre</th>
                    <th className="pb-3 px-2">Categoría</th>
                    <th className="pb-3 px-2">Fecha</th>
                    <th className="pb-3 px-2">Tarjeta / Método</th>
                    <th className="pb-3 px-2 text-right">Subtotal</th>
                    <th className="pb-3 px-2 text-right">IVA</th>
                    <th className="pb-3 px-2 text-right">Total</th>
                    <th className="pb-3 px-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredGastos.map(g => (
                    <tr key={g.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="py-3.5 px-2">
                        <div className="font-semibold text-gray-900">{g.name}</div>
                        {g.description && (
                          <div className="text-xs text-gray-400 line-clamp-1">{g.description}</div>
                        )}
                        {g.folio_fiscal && (
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">Folio: {g.folio_fiscal}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-lg inline-block">
                          {g.category?.name || 'Sin Categoría'}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-xs text-gray-500 whitespace-nowrap">
                        {g.expense_date ? new Date(g.expense_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </td>
                      <td className="py-3.5 px-2 text-xs text-gray-500">
                        {g.card || '-'}
                      </td>
                      <td className="py-3.5 px-2 text-right font-mono text-gray-600">
                        ${Number(g.amount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-2 text-right font-mono text-gray-500 text-xs">
                        ${Number(g.iva).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-2 text-right font-mono font-bold text-gray-900">
                        ${Number(g.total).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {g.invoice_url && (
                            <a 
                              href={g.invoice_url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Ver Factura"
                            >
                              <ExternalLink size={15} />
                            </a>
                          )}
                          <Link 
                            href={`/gastos/${g.id}`}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Editar Gasto"
                          >
                            <Edit2 size={15} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card p-8 text-center text-gray-400 bg-gray-50/50">
              No se encontraron gastos reales que coincidan con la búsqueda o filtro.
            </div>
          )}
        </section>

      </div>
    </AppShell>
  )
}
