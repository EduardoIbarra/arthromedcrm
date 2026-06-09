'use client'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, TrendingDown, DollarSign, FileText, Users, ShoppingBag, 
  Target, BarChart2, UserCheck, MapPin, ArrowRight, Activity, Calendar, HelpCircle
} from 'lucide-react'
import { useI18n } from '@/contexts/I18nContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import AppShell from '@/components/AppShell'
import StatCard from '@/components/StatCard'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, ReferenceLine
} from 'recharts'

interface ReportData {
  kpis: {
    salesToday: number
    salesMonth: number
    salesYear: number
    growthPercent: number
    orderCount: number
    newClientsCount: number
    aov: number
    goalProgress: number
    goalTarget?: number
  }
  salesTrends: {
    month: string
    date?: string
    revenue: number
    prevRevenue: number
  }[]
  breakdown: {
    topProducts: { name: string; value: number }[]
    salesByCategory: { name: string; value: number }[]
    salesBySalesperson: { name: string; value: number }[]
    salesByRegion: { name: string; value: number }[]
  }
  customerInsights: {
    newRevenue: number
    returningRevenue: number
    topCustomers: { name: string; value: number; crmClientId: string | null }[]
  }
  fulfillmentRates: { name: string; value: number }[]
  paymentMethods: { name: string; value: number }[]
  congressRoi: { name: string; expenses: number; sales: number; roi: number }[]
  forecast: number
  forecasts: {
    currentMonth: number
    nextMonth: number
    currentMonthName: string
    nextMonthName: string
    elapsedDays: number
    daysInCurrentMonth: number
  }
  recentOrders: {
    date: string
    customer: string
    amount: number
    crmClientId: string | null
  }[]
  trendLabels?: {
    current: string
    previous: string
  }
  unitSalesByProduct: {
    name: string
    current: number
    ly: number
    delta: number
    growth: number
  }[]
  unitSalesYears: {
    current: number
    prev: number
  }
  unitSalesByLine: {
    linea: string
    fullPrev: number
    current: number
    ly: number
    growth: number
  }[]
  totalSalesByLine: {
    linea: string
    fullPrev: number
    current: number
    ly: number
  }[]
  lineYears?: {
    prev: number
    current: number
  }
}

const ChartHeader = ({ title, tooltipText }: { title: string; tooltipText: string }) => (
  <div className="flex items-center gap-2 mb-4 flex-shrink-0">
    <h2 className="text-sm font-semibold text-[#37383a]">{title}</h2>
    <div className="group relative cursor-pointer">
      <HelpCircle size={14} className="text-gray-400 hover:text-gray-650 transition-colors" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-slate-800 text-white text-[11px] p-2.5 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 leading-normal font-normal">
        {tooltipText}
      </div>
    </div>
  </div>
)

// Official brand colors per product line
const LINE_COLORS: Record<string, string> = {
  'SPORTS MEDICINE': '#F8CBAD',
  'UBE':            '#33CCCC',
  'SPINE':          '#C6E0B4',
  'ENT':            '#BDD7EE',
  'URO & GYN':      '#FFE699',
  'SHAVER&BUR':     '#D5D5D5',
  'VISION':         '#E2D5F8',
  'OTHER':          '#E8ECF0',
}

const getPresetDates = (preset: string) => {
  const today = new Date('2026-06-08')
  let start = new Date('2026-01-01')
  let end = new Date('2026-12-31')

  switch (preset) {
    case 'thisMonth':
      start = new Date('2026-06-01')
      end = new Date('2026-06-30')
      break
    case 'lastMonth':
      start = new Date('2026-05-01')
      end = new Date('2026-05-31')
      break
    case 'last30Days':
      start = new Date('2026-05-09')
      end = new Date('2026-06-08')
      break
    case 'thisYear':
      start = new Date('2026-01-01')
      end = new Date('2026-12-31')
      break
    case 'lastYear':
      start = new Date('2025-01-01')
      end = new Date('2025-12-31')
      break
    default:
      break
  }
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  }
}

export default function VentasReportPage() {
  const { t, locale } = useI18n()
  const { formatCurrency, formatChartTick } = useCurrency()
  const router = useRouter()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [animate, setAnimate] = useState(false)

  // Date range filter state
  const [preset, setPreset] = useState('thisYear')
  const [startDate, setStartDate] = useState('2026-01-01')
  const [endDate, setEndDate] = useState('2026-12-31')

  const getLocalizedMonthName = (monthNameES: string) => {
    const monthsMap: Record<string, string> = {
      'Enero': 'monthJan', 'Febrero': 'monthFeb', 'Marzo': 'monthMar', 'Abril': 'monthApr',
      'Mayo': 'monthMay', 'Junio': 'monthJun', 'Julio': 'monthJul', 'Agosto': 'monthAug',
      'Septiembre': 'monthSep', 'Octubre': 'monthOct', 'Noviembre': 'monthNov', 'Diciembre': 'monthDec'
    }
    const key = monthsMap[monthNameES]
    return key ? t(key as any) : monthNameES
  }

  const getPeriodLabel = (startStr: string, endStr: string, isPrev = false) => {
    const start = new Date(startStr)
    const end = new Date(endStr)
    if (isPrev) {
      start.setFullYear(start.getFullYear() - 1)
      end.setFullYear(end.getFullYear() - 1)
    }
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      const monthStr = start.toLocaleDateString(locale === 'es' ? 'es-MX' : locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short' })
      return `${monthStr.charAt(0).toUpperCase()}${monthStr.slice(1)} ${start.getFullYear()}`
    }
    if (start.getFullYear() === end.getFullYear()) {
      return `${start.getFullYear()}`
    }
    return `${start.getFullYear()} - ${end.getFullYear()}`
  }

  useEffect(() => {
    async function loadReport() {
      setLoading(true)
      setAnimate(false)
      try {
        const res = await fetch(`/api/reports/ventas?startDate=${startDate}&endDate=${endDate}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
          // Trigger entry transitions for bullet bars
          setTimeout(() => setAnimate(true), 150)
        }
      } catch (err) {
        console.error('Error loading sales report:', err)
      } finally {
        setLoading(false)
      }
    }
    loadReport()
  }, [startDate, endDate])

  const handlePresetChange = (val: string) => {
    setPreset(val)
    if (val !== 'custom') {
      const dates = getPresetDates(val)
      setStartDate(dates.start)
      setEndDate(dates.end)
    }
  }

  const CARD_STYLE = { background: '#ffffff', border: '1px solid #d4e0ec' }
  const CHART_TOOLTIP = { background: '#ffffff', border: '1px solid #d4e0ec', borderRadius: 8, color: '#37383a' }
  const COLORS = ['#0763a9', '#0d9488', '#b45309', '#7c3aed', '#db2777', '#ea580c']

  // Local formatCurrency helper removed in favor of global useCurrency context helper

  const diffTime = Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1

  if (loading || !data) return (
    <AppShell>
      <div className="flex items-center justify-center min-h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0763a9', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#5a5b5d' }}>{t('loading')}</p>
        </div>
      </div>
    </AppShell>
  )

  const newVsReturningData = [
    { name: t('newClients' as any) || 'Nuevos Clientes', value: data.customerInsights.newRevenue },
    { name: t('recurringClients' as any) || 'Clientes Recurrentes', value: data.customerInsights.returningRevenue }
  ]

  // Map database status values to translated strings
  const getFulfillmentName = (name: string) => {
    if (name === 'completa') return t('completed')
    if (name === 'parcial') return t('partial')
    return t('unfulfilled')
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Header with Date Range Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#d4e0ec]">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#37383a' }}>{t('reports')}</h1>
            <p className="text-sm mt-0.5" style={{ color: '#5a5b5d' }}>{t('ventas')}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            {/* Preset selector */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-[#8a8b8d] tracking-wider">{t('period' as any) || 'Periodo'}</span>
              <select
                value={preset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="text-xs font-semibold px-3 py-2 bg-[#f0f5fa] border border-[#d4e0ec] rounded-lg text-slate-700 outline-none focus:border-[#0763a9] transition-colors cursor-pointer"
              >
                <option value="thisMonth">{t('thisMonthPreset' as any) || 'Este Mes'}</option>
                <option value="lastMonth">{t('lastMonthPreset' as any) || 'Mes Anterior'}</option>
                <option value="last30Days">{t('last30DaysPreset' as any) || 'Últimos 30 días'}</option>
                <option value="thisYear">{t('thisYearPreset' as any) || 'Este Año'}</option>
                <option value="lastYear">{t('lastYearPreset' as any) || 'Año Anterior'}</option>
                <option value="custom">{t('customPreset' as any) || 'Personalizado'}</option>
              </select>
            </div>

            {/* Custom Dates */}
            {preset === 'custom' && (
              <div className="flex flex-row items-center gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-[#8a8b8d] tracking-wider">{t('fromLabel' as any) || 'Desde'}</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs font-semibold px-2 py-1.5 bg-[#f0f5fa] border border-[#d4e0ec] rounded-lg text-slate-700 outline-none focus:border-[#0763a9] transition-colors cursor-pointer"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-[#8a8b8d] tracking-wider">{t('toLabel' as any) || 'Hasta'}</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs font-semibold px-2 py-1.5 bg-[#f0f5fa] border border-[#d4e0ec] rounded-lg text-slate-700 outline-none focus:border-[#0763a9] transition-colors cursor-pointer"
                  />
                </div>
              </div>
            )}
            
            {/* Active range display */}
            <div className="flex flex-col text-xs pl-4 border-l border-[#e8f1f9] hidden sm:flex h-9 justify-center">
              <span className="text-[10px] uppercase font-bold text-[#8a8b8d] tracking-wider">{t('status' as any) || 'Estatus'}</span>
              <span className="font-semibold text-slate-700">{startDate} al {endDate}</span>
            </div>
          </div>
        </div>

        {/* 1. Executive KPIs (Exactly 3 columns per row) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title={t('periodSales' as any) || 'Ventas del Periodo'}
            value={formatCurrency(data.kpis.salesMonth, true)}
            icon={<DollarSign size={20} />}
            color="green"
            subtitle={`${t('todayLabel' as any) || 'Hoy'}: ${formatCurrency(data.kpis.salesToday)}`}
          />
          <StatCard
            title={t('growthVsPrevPeriod' as any) || 'Crecimiento vs Periodo Anterior'}
            value={`${data.kpis.growthPercent >= 0 ? '+' : ''}${data.kpis.growthPercent.toFixed(1)}%`}
            icon={data.kpis.growthPercent >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            color={data.kpis.growthPercent >= 0 ? 'green' : 'red'}
            subtitle={t('vsPreviousPeriod' as any) || 'vs periodo anterior'}
          />
          <StatCard
            title={t('ordersInPeriod' as any) || 'Órdenes (Periodo)'}
            value={data.kpis.orderCount}
            icon={<ShoppingBag size={20} />}
            color="blue"
            subtitle={`AOV: ${formatCurrency(data.kpis.aov, true)}`}
          />
          <StatCard
            title={t('newClientsPeriod' as any) || 'Nuevos Clientes (Periodo)'}
            value={data.kpis.newClientsCount}
            icon={<Users size={20} />}
            color="blue"
            subtitle={t('registeredInPeriod' as any) || 'Registrados en el periodo'}
          />
          <StatCard
            title={t('averageSale') || 'Ticket Promedio (AOV)'}
            value={formatCurrency(data.kpis.aov, true)}
            icon={<Activity size={20} />}
            color="amber"
            subtitle={t('averageOrderValueSub' as any) || 'Valor promedio de orden'}
          />
          <StatCard
            title={t('salesTarget' as any) || 'Meta de Ventas'}
            value={`${data.kpis.goalProgress.toFixed(1)}%`}
            icon={<Target size={20} />}
            color="green"
            subtitle={`${t('targetForPeriod' as any) || 'Meta del periodo'}: ${formatCurrency(data.kpis.goalTarget || 500000, true)}`}
          />
        </div>

        {/* Full-width widgets row — Unit Sales by Product */}
        <div className="grid grid-cols-1 gap-6">
          {/* Unit Sales by Product Table */}
          <div className="rounded-2xl p-5 bg-white flex flex-col h-[480px]" style={CARD_STYLE}>
            <ChartHeader
              title={t('unitSalesByProductTitle' as any)}
              tooltipText={t('unitSalesByProductDesc' as any).replace('{currentYear}', String(data.unitSalesYears?.current ?? '')).replace('{prevYear}', String(data.unitSalesYears?.prev ?? ''))}
            />
            <div className="overflow-y-auto max-h-[380px] rounded-lg border border-[#e8f1f9] text-xs">
              <table className="min-w-full divide-y divide-[#e8f1f9]">
                <thead className="sticky top-0 bg-[#f0f5fa] z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-[#5a5b5d] w-[38%]">{t('colNombre' as any)}</th>
                    <th className="px-3 py-2 text-right font-semibold text-[#5a5b5d]">Units {data.unitSalesYears?.current ?? ''}</th>
                    <th className="px-3 py-2 text-right font-semibold text-[#5a5b5d]">Units LY YTD</th>
                    <th className="px-3 py-2 text-right font-semibold text-[#5a5b5d]">{t('colDeltaUnits' as any)}</th>
                    <th className="px-3 py-2 text-right font-semibold text-[#5a5b5d]">{t('colUnitsGrowth' as any)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f5fa] bg-white">
                  {(data.unitSalesByProduct ?? []).map((row) => {
                    const isPositive = row.delta >= 0
                    const isStrongGrowth = row.growth >= 50
                    const isStrongDecline = row.growth <= -50
                    const growthBg = isStrongGrowth
                      ? 'bg-[#dcfce7] text-[#15803d]'
                      : isStrongDecline
                      ? 'bg-[#fee2e2] text-[#b91c1c]'
                      : row.growth > 0
                      ? 'bg-[#f0fdf4] text-[#16a34a]'
                      : row.growth < 0
                      ? 'bg-[#fff7f7] text-[#dc2626]'
                      : 'bg-[#f8fafc] text-[#64748b]'
                    return (
                      <tr key={row.name} className="hover:bg-[#f8fafc] transition-colors">
                        <td className="px-3 py-2 font-medium text-[#37383a] truncate max-w-[160px]" title={row.name}>{row.name}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[#37383a]">{row.current.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-[#8a8b8d]">{row.ly.toLocaleString()}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${isPositive ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                          {isPositive ? '+' : ''}{row.delta.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${growthBg}`}>
                            {row.ly === 0 ? (row.current > 0 ? t('newLabel' as any) : '—') : `${row.growth >= 0 ? '+' : ''}${row.growth.toFixed(2)}%`}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals row */}
                  {(() => {
                    const rows = data.unitSalesByProduct ?? []
                    const totalCurrent = rows.reduce((s, r) => s + r.current, 0)
                    const totalLy = rows.reduce((s, r) => s + r.ly, 0)
                    const totalDelta = totalCurrent - totalLy
                    const totalGrowth = totalLy > 0 ? ((totalDelta / totalLy) * 100) : 0
                    const isPos = totalDelta >= 0
                    return (
                      <tr className="font-bold bg-[#f0f5fa] border-t-2 border-[#d4e0ec]">
                        <td className="px-3 py-2 text-[#37383a]">{t('rowTotal' as any)}</td>
                        <td className="px-3 py-2 text-right text-[#37383a]">{totalCurrent.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-[#8a8b8d]">{totalLy.toLocaleString()}</td>
                        <td className={`px-3 py-2 text-right ${isPos ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                          {isPos ? '+' : ''}{totalDelta.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${isPos ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                            {totalGrowth >= 0 ? '+' : ''}{totalGrowth.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Línea widgets — Units Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Unidades Vendidas por Línea */}
          <div className="rounded-2xl p-5 bg-white flex flex-col h-[480px]" style={CARD_STYLE}>
            <ChartHeader
              title={t('unitSalesByLineTitle' as any)}
              tooltipText={t('unitSalesByLineDesc' as any)}
            />
            <div className="overflow-y-auto max-h-[380px] rounded-lg border border-[#e8f1f9] text-xs">
              <table className="min-w-full divide-y divide-[#e8f1f9]">
                <thead className="sticky top-0 bg-[#f0f5fa] z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-[#5a5b5d] w-[32%]">{t('colLinea' as any)}</th>
                    <th className="px-3 py-2 text-right font-semibold text-[#5a5b5d]">Units {data.lineYears?.prev ?? ''}</th>
                    <th className="px-3 py-2 text-right font-semibold text-[#5a5b5d]">Units {data.lineYears?.current ?? ''}</th>
                    <th className="px-3 py-2 text-right font-semibold text-[#5a5b5d]">LY YTD</th>
                    <th className="px-3 py-2 text-right font-semibold text-[#5a5b5d]">{t('colGrowthPct' as any)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f5fa] bg-white">
                  {(data.unitSalesByLine ?? []).map((row) => {
                    const color = LINE_COLORS[row.linea] ?? LINE_COLORS['OTHER']
                    const isPos = row.growth >= 0
                    const growthBg = row.ly === 0
                      ? 'bg-[#f8fafc] text-[#64748b]'
                      : isPos ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]'
                    return (
                      <tr key={row.linea} className="hover:brightness-95 transition-all" style={{ backgroundColor: color + '22' }}>
                        <td className="px-3 py-2 font-semibold" style={{ borderLeft: `3px solid ${color}`, color: '#37383a' }}>{row.linea}</td>
                        <td className="px-3 py-2 text-right text-[#8a8b8d]">{row.fullPrev.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[#37383a]">{row.current.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-[#8a8b8d]">{row.ly.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${growthBg}`}>
                            {row.ly === 0 ? (row.current > 0 ? t('newLabel' as any) : '—') : `${isPos ? '+' : ''}${row.growth.toFixed(2)}%`}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {(() => {
                    const rows = data.unitSalesByLine ?? []
                    const totFP = rows.reduce((s, r) => s + r.fullPrev, 0)
                    const totC  = rows.reduce((s, r) => s + r.current, 0)
                    const totLY = rows.reduce((s, r) => s + r.ly, 0)
                    const totG  = totLY > 0 ? ((totC - totLY) / totLY) * 100 : 0
                    return (
                      <tr className="font-bold bg-[#f0f5fa] border-t-2 border-[#d4e0ec]">
                        <td className="px-3 py-2 text-[#37383a]">{t('rowTotal' as any)}</td>
                        <td className="px-3 py-2 text-right text-[#8a8b8d]">{totFP.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-[#37383a]">{totC.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-[#8a8b8d]">{totLY.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${totG >= 0 ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                            {totG >= 0 ? '+' : ''}{totG.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráfica de Bala de Unidades por Línea */}
          <div className="rounded-2xl p-5 bg-white flex flex-col h-[480px]" style={CARD_STYLE}>
            <ChartHeader
              title={t('bulletUnitsTitle' as any)}
              tooltipText={t('bulletUnitsDesc' as any)}
            />

            {(() => {
              const rows = data?.unitSalesByLine ?? []
              const maxVal = Math.max(
                ...rows.map(r => Math.max(r.fullPrev, r.current, r.ly)),
                10 // safeguard
              )
              // We scale up to 82% of the container to leave 18% for labels and markers
              const scale = 82 / maxVal
              
              // Generate 5 tick values
              const tickPercentages = [0, 25, 50, 75, 100]
              const ticks = tickPercentages.map(p => Math.round((maxVal * p) / 100))

              return (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-5 text-[10px] sm:text-xs font-semibold text-[#5a5b5d]">
                    <div className="flex items-center gap-1">
                      <span className="w-3.5 h-2 rounded bg-slate-400 opacity-40" />
                      <span>{t('legendLYYTD' as any)} ({data?.lineYears?.prev ?? 2025} YTD)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-3.5 h-2 rounded bg-slate-600" />
                      <span>{t('legendActual' as any)} ({data?.lineYears?.current ?? 2026})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex items-center">
                        <span className="w-5 h-[1.5px] bg-slate-400" />
                        <span className="w-[1.5px] h-2.5 bg-slate-400 -ml-[1.5px]" />
                      </div>
                      <span>{t('legendTotalPrev' as any)} {data?.lineYears?.prev ?? 2025}</span>
                    </div>
                  </div>

                  {/* Chart Body */}
                  <div className="flex-1 overflow-y-auto pr-1 relative min-h-0">
                    {/* Gridlines Background */}
                    <div className="absolute top-0 bottom-6 left-24 right-0 pointer-events-none">
                      {tickPercentages.map((pct, idx) => {
                        const tickVal = ticks[idx]
                        return (
                          <div 
                            key={pct} 
                            className="absolute top-0 bottom-0 border-l border-dashed border-slate-200/50"
                            style={{ left: `${pct * 0.82}%` }}
                          >
                            <span className="absolute bottom-0 -translate-x-1/2 translate-y-full text-[9px] font-bold text-slate-400">
                              {tickVal >= 1000 ? `${(tickVal / 1000).toFixed(1).replace('.0', '')}K` : tickVal}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Rows */}
                    <div className="relative z-10 space-y-3 pb-8">
                      {rows.map((row) => {
                        const color = LINE_COLORS[row.linea] ?? LINE_COLORS['OTHER']
                        const lyPct = row.ly * scale
                        const currentPct = row.current * scale
                        const fullPrevPct = row.fullPrev * scale

                        return (
                          <div key={row.linea} className="group flex items-center gap-2 h-9 hover:bg-[#f8fafc]/55 rounded p-0.5 transition-colors">
                            {/* Label */}
                            <div className="w-24 font-bold text-slate-655 text-[10px] sm:text-xs truncate text-right pr-1" title={row.linea}>
                              {row.linea}
                            </div>
                            
                            {/* Bullet Graph Track */}
                            <div className="flex-1 h-full relative flex flex-col justify-center gap-0.5">
                              {/* Thin gray benchmark line for Total Prev Year */}
                              {row.fullPrev > 0 && (
                                <div className="absolute inset-0 pointer-events-none flex items-center">
                                  <div className="relative w-full h-[1.5px]">
                                    {/* Line */}
                                    <div 
                                      className="absolute h-[1.5px] bg-slate-300 top-1/2 -translate-y-1/2 left-0 transition-all duration-1000 ease-out" 
                                      style={{ width: `${animate ? fullPrevPct : 0}%` }}
                                    />
                                    {/* Tick marker */}
                                    <div 
                                      className="absolute w-[1.5px] h-3 bg-slate-400 top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out"
                                      style={{ left: `${animate ? fullPrevPct : 0}%` }}
                                    />
                                    {/* Tick Label */}
                                    <span 
                                      className="absolute text-[8px] font-bold text-slate-500 -top-3.5 -translate-x-1/2 transition-all duration-1000 ease-out bg-white px-0.5 rounded shadow-sm border border-slate-105/50"
                                      style={{ left: `${animate ? fullPrevPct : 0}%` }}
                                    >
                                      {row.fullPrev.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Bar 1: LY YTD */}
                              <div className="relative flex items-center h-2.5">
                                <div 
                                  className="h-1.5 rounded-sm transition-all duration-1000 ease-out"
                                  style={{ 
                                    width: `${animate ? lyPct : 0}%`, 
                                    backgroundColor: color,
                                    opacity: 0.45
                                  }}
                                />
                                {row.ly > 0 && (
                                  <span className="ml-1 text-[8px] font-semibold text-slate-500 whitespace-nowrap">
                                    {row.ly.toLocaleString()}
                                  </span>
                                )}
                              </div>

                              {/* Bar 2: Current */}
                              <div className="relative flex items-center h-2.5">
                                <div 
                                  className="h-1.5 rounded-sm transition-all duration-1000 ease-out"
                                  style={{ 
                                    width: `${animate ? currentPct : 0}%`, 
                                    backgroundColor: color
                                  }}
                                />
                                {row.current > 0 && (
                                  <span className="ml-1 text-[8px] font-bold text-slate-800 whitespace-nowrap">
                                    {row.current.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Línea widgets — Sales Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Total de Ventas por Línea */}
          <div className="rounded-2xl p-5 bg-white flex flex-col h-[480px]" style={CARD_STYLE}>
            <ChartHeader
              title={t('totalSalesByLineTitle' as any)}
              tooltipText={t('totalSalesByLineDesc' as any)}
            />
            <div className="overflow-y-auto max-h-[380px] rounded-lg border border-[#e8f1f9] text-xs">
              <table className="min-w-full divide-y divide-[#e8f1f9]">
                <thead className="sticky top-0 bg-[#f0f5fa] z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-[#5a5b5d] w-[32%]">{t('colLinea' as any)}</th>
                    <th className="px-3 py-2 text-right font-semibold text-[#5a5b5d]">Sales {data.lineYears?.prev ?? ''}</th>
                    <th className="px-3 py-2 text-right font-semibold text-[#5a5b5d]">Sales {data.lineYears?.current ?? ''}</th>
                    <th className="px-3 py-2 text-right font-semibold text-[#5a5b5d]">Sales LY YTD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f5fa] bg-white">
                  {(data.totalSalesByLine ?? []).map((row) => {
                    const color = LINE_COLORS[row.linea] ?? LINE_COLORS['OTHER']
                    return (
                      <tr key={row.linea} className="hover:brightness-95 transition-all" style={{ backgroundColor: color + '22' }}>
                        <td className="px-3 py-2 font-semibold" style={{ borderLeft: `3px solid ${color}`, color: '#37383a' }}>{row.linea}</td>
                        <td className="px-3 py-2 text-right text-[#8a8b8d]">{formatCurrency(row.fullPrev)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[#37383a]">{formatCurrency(row.current)}</td>
                        <td className="px-3 py-2 text-right text-[#8a8b8d]">{formatCurrency(row.ly)}</td>
                      </tr>
                    )
                  })}
                  {(() => {
                    const rows = data.totalSalesByLine ?? []
                    const totFP = rows.reduce((s, r) => s + r.fullPrev, 0)
                    const totC  = rows.reduce((s, r) => s + r.current, 0)
                    const totLY = rows.reduce((s, r) => s + r.ly, 0)
                    return (
                      <tr className="font-bold bg-[#f0f5fa] border-t-2 border-[#d4e0ec]">
                        <td className="px-3 py-2 text-[#37383a]">{t('rowTotal' as any)}</td>
                        <td className="px-3 py-2 text-right text-[#8a8b8d]">{formatCurrency(totFP)}</td>
                        <td className="px-3 py-2 text-right text-[#37383a]">{formatCurrency(totC)}</td>
                        <td className="px-3 py-2 text-right text-[#8a8b8d]">{formatCurrency(totLY)}</td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráfica de Bala de Ventas por Línea */}
          <div className="rounded-2xl p-5 bg-white flex flex-col h-[480px]" style={CARD_STYLE}>
            <ChartHeader
              title={t('bulletSalesTitle' as any)}
              tooltipText={t('bulletSalesDesc' as any)}
            />

            {(() => {
              const rows = data?.totalSalesByLine ?? []
              const maxVal = Math.max(
                ...rows.map(r => Math.max(r.fullPrev, r.current, r.ly)),
                10000 // safeguard
              )
              // We scale up to 82% of the container to leave 18% for labels and markers
              const scale = 82 / maxVal
              
              // Generate 5 tick values
              const tickPercentages = [0, 25, 50, 75, 100]
              const ticks = tickPercentages.map(p => Math.round((maxVal * p) / 100))

              return (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-5 text-[10px] sm:text-xs font-semibold text-[#5a5b5d]">
                    <div className="flex items-center gap-1">
                      <span className="w-3.5 h-2 rounded bg-slate-400 opacity-40" />
                      <span>{t('legendLYYTD' as any)} ({data?.lineYears?.prev ?? 2025} YTD)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-3.5 h-2 rounded bg-slate-600" />
                      <span>{t('legendActual' as any)} ({data?.lineYears?.current ?? 2026})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex items-center">
                        <span className="w-5 h-[1.5px] bg-slate-400" />
                        <span className="w-[1.5px] h-2.5 bg-slate-400 -ml-[1.5px]" />
                      </div>
                      <span>{t('legendTotalPrev' as any)} {data?.lineYears?.prev ?? 2025}</span>
                    </div>
                  </div>

                  {/* Chart Body */}
                  <div className="flex-1 overflow-y-auto pr-1 relative min-h-0">
                    {/* Gridlines Background */}
                    <div className="absolute top-0 bottom-6 left-24 right-0 pointer-events-none">
                      {tickPercentages.map((pct, idx) => {
                        const tickVal = ticks[idx]
                        return (
                          <div 
                            key={pct} 
                            className="absolute top-0 bottom-0 border-l border-dashed border-slate-200/50"
                            style={{ left: `${pct * 0.82}%` }}
                          >
                            <span className="absolute bottom-0 -translate-x-1/2 translate-y-full text-[9px] font-bold text-slate-400 whitespace-nowrap">
                              {formatChartTick(tickVal)}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Rows */}
                    <div className="relative z-10 space-y-3 pb-8">
                      {rows.map((row) => {
                        const color = LINE_COLORS[row.linea] ?? LINE_COLORS['OTHER']
                        const lyPct = row.ly * scale
                        const currentPct = row.current * scale
                        const fullPrevPct = row.fullPrev * scale

                        return (
                          <div key={row.linea} className="group flex items-center gap-2 h-9 hover:bg-[#f8fafc]/55 rounded p-0.5 transition-colors">
                            {/* Label */}
                            <div className="w-24 font-bold text-slate-650 text-[10px] sm:text-xs truncate text-right pr-1" title={row.linea}>
                              {row.linea}
                            </div>
                            
                            {/* Bullet Graph Track */}
                            <div className="flex-1 h-full relative flex flex-col justify-center gap-0.5">
                              {/* Thin gray benchmark line for Total Prev Year */}
                              {row.fullPrev > 0 && (
                                <div className="absolute inset-0 pointer-events-none flex items-center">
                                  <div className="relative w-full h-[1.5px]">
                                    {/* Line */}
                                    <div 
                                      className="absolute h-[1.5px] bg-slate-300 top-1/2 -translate-y-1/2 left-0 transition-all duration-1000 ease-out" 
                                      style={{ width: `${animate ? fullPrevPct : 0}%` }}
                                    />
                                    {/* Tick marker */}
                                    <div 
                                      className="absolute w-[1.5px] h-3 bg-slate-400 top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out"
                                      style={{ left: `${animate ? fullPrevPct : 0}%` }}
                                    />
                                    {/* Tick Label */}
                                    <span 
                                      className="absolute text-[8px] font-bold text-slate-500 -top-3.5 -translate-x-1/2 transition-all duration-1000 ease-out bg-white px-0.5 rounded shadow-sm border border-slate-105/50 whitespace-nowrap"
                                      style={{ left: `${animate ? fullPrevPct : 0}%` }}
                                    >
                                      {formatCurrency(row.fullPrev, true)}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Bar 1: LY YTD */}
                              <div className="relative flex items-center h-2.5">
                                <div 
                                  className="h-1.5 rounded-sm transition-all duration-1000 ease-out"
                                  style={{ 
                                    width: `${animate ? lyPct : 0}%`, 
                                    backgroundColor: color,
                                    opacity: 0.45
                                  }}
                                />
                                {row.ly > 0 && (
                                  <span className="ml-1 text-[8px] font-semibold text-slate-500 whitespace-nowrap">
                                    {formatCurrency(row.ly, true)}
                                  </span>
                                )}
                              </div>

                              {/* Bar 2: Current */}
                              <div className="relative flex items-center h-2.5">
                                <div 
                                  className="h-1.5 rounded-sm transition-all duration-1000 ease-out"
                                  style={{ 
                                    width: `${animate ? currentPct : 0}%`, 
                                    backgroundColor: color
                                  }}
                                />
                                {row.current > 0 && (
                                  <span className="ml-1 text-[8px] font-bold text-slate-800 whitespace-nowrap">
                                    {formatCurrency(row.current, true)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Current Month Forecast */}
          <div className="rounded-2xl p-5 bg-white flex flex-col justify-between" style={CARD_STYLE}>
            <div className="space-y-4">
              <ChartHeader 
                title={t('forecastCurrentMonth' as any)?.replace('{month}', getLocalizedMonthName(data.forecasts.currentMonthName)) || `Pronóstico de Cierre - ${getLocalizedMonthName(data.forecasts.currentMonthName)}`}
                tooltipText={t('forecastDesc' as any) || 'Ventas proyectadas al final del mes actual basándose en la tasa de facturación diaria del periodo actual.'}
              />
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-800">
                  {formatCurrency(data.forecasts.currentMonth)}
                </span>
                <span className="text-xs font-semibold text-[#0d9488] bg-[#f0f9f6] px-2 py-0.5 rounded-full">
                  {t('daysElapsedLabel' as any) || 'días transcurridos'}: {data.forecasts.elapsedDays} / {data.forecasts.daysInCurrentMonth}
                </span>
              </div>
              
              {/* Progress bar of the month elapsed days */}
              <div className="space-y-1">
                <div className="w-full bg-[#f0f5fa] rounded-full h-3 border border-[#d4e0ec] overflow-hidden">
                  <div 
                    className="bg-[#0763a9] h-full rounded-full transition-all duration-500" 
                    style={{ width: `${(data.forecasts.elapsedDays / data.forecasts.daysInCurrentMonth) * 100}%` }} 
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#8a8b8d] font-semibold">
                  <span>1 {getLocalizedMonthName(data.forecasts.currentMonthName)}</span>
                  <span>{data.forecasts.daysInCurrentMonth} {getLocalizedMonthName(data.forecasts.currentMonthName)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Next Month Forecast */}
          <div className="rounded-2xl p-5 bg-white flex flex-col justify-between" style={CARD_STYLE}>
            <div className="space-y-4 flex-1">
              <ChartHeader 
                title={t('forecastNextMonth' as any)?.replace('{month}', getLocalizedMonthName(data.forecasts.nextMonthName)) || `Pronóstico de Cierre - ${getLocalizedMonthName(data.forecasts.nextMonthName)}`}
                tooltipText={t('forecastNextMonthDesc' as any)}
              />
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-extrabold text-slate-800">
                  {formatCurrency(data.forecasts.nextMonth)}
                </span>
                <span className="text-xs font-semibold text-slate-500 bg-[#f1f5f9] px-2 py-0.5 rounded-full">
                  {t('daysInMonthLabel' as any) || 'días del mes'}: {getLocalizedMonthName(data.forecasts.nextMonthName) === 'Julio' || getLocalizedMonthName(data.forecasts.nextMonthName) === 'July' ? 31 : 30}
                </span>
              </div>
              
              <p className="text-xs text-[#5a5b5d] leading-relaxed">
                {t('forecastNextMonthDesc' as any)}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Sales Trends */}
        <div className="rounded-2xl p-5 bg-white space-y-4" style={CARD_STYLE}>
          <ChartHeader 
            title={t('revenueTrend' as any) || 'Tendencia de Ingresos'} 
            tooltipText={t('revenueTrendDesc' as any) || 'Muestra los ingresos mensuales facturados del año en curso comparados con el año anterior.'} 
          />
          {(() => {
            const todayDate = new Date()
            const trendDataRaw = data.salesTrends ?? []

            // For current period: average to date (exclude months in the future relative to today)
            const currentTrendPoints = trendDataRaw.filter(item => {
              if (!item.date) return true
              const itemDate = new Date(item.date)
              return itemDate <= todayDate
            })
            
            const currentAverage = currentTrendPoints.length > 0
              ? currentTrendPoints.reduce((sum, item) => sum + (item.revenue || 0), 0) / currentTrendPoints.length
              : 0

            // For previous period: average of the whole selected range (since it's in the past)
            const prevAverage = trendDataRaw.length > 0
              ? trendDataRaw.reduce((sum, item) => sum + (item.prevRevenue || 0), 0) / trendDataRaw.length
              : 0

            return (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={data.salesTrends.map(item => {
                      if (!item.date) return item
                      const date = new Date(item.date)
                      const monthLabel = diffDays <= 31
                        ? date.toLocaleDateString(locale === 'es' ? 'es-MX' : locale === 'zh' ? 'zh-CN' : 'en-US', { day: 'numeric', month: 'short' })
                        : date.toLocaleDateString(locale === 'es' ? 'es-MX' : locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', year: '2-digit' })
                      return { ...item, month: monthLabel }
                    })} 
                    margin={{ top: 15, right: 30, left: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8f1f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: '#5a5b5d', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(val) => formatCurrency(val, true)} tick={{ fill: '#8a8b8d', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => formatCurrency(Number(value))} />
                    <Legend iconType="circle" />
                    
                    {currentAverage > 0 && (
                      <ReferenceLine 
                        y={currentAverage} 
                        stroke="#0d9488" 
                        strokeDasharray="3 3" 
                        strokeWidth={1.5}
                        label={{ 
                          value: `${t('averageLabel' as any)}: ${formatCurrency(currentAverage, true)}`, 
                          position: 'top', 
                          fill: '#0d9488',
                          fontSize: 9,
                          fontWeight: 'bold'
                        }} 
                      />
                    )}
                    {prevAverage > 0 && (
                      <ReferenceLine 
                        y={prevAverage} 
                        stroke="#9ca3af" 
                        strokeDasharray="3 3" 
                        strokeWidth={1.5}
                        label={{ 
                          value: `${t('averageLYLabel' as any)}: ${formatCurrency(prevAverage, true)}`, 
                          position: 'top', 
                          fill: '#5a5b5d',
                          fontSize: 9,
                          fontWeight: 'bold'
                        }} 
                      />
                    )}

                    <Line name={getPeriodLabel(startDate, endDate, false)} type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={3} activeDot={{ r: 8 }} />
                    <Line name={getPeriodLabel(startDate, endDate, true)} type="monotone" dataKey="prevRevenue" stroke="#9ca3af" strokeDasharray="5 5" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
          })()}
        </div>

        {/* 3. Breakdown Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products Horizontal Bar Chart */}
          <div className="rounded-2xl p-5 bg-white space-y-4" style={CARD_STYLE}>
            <ChartHeader 
              title={t('topProducts' as any) || 'Top 5 Productos'} 
              tooltipText={t('topProductsDesc2' as any) || 'Muestra los 5 productos con mayores ingresos por facturación.'} 
            />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.breakdown.topProducts} layout="vertical" margin={{ left: 15, right: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8f1f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={(val) => formatCurrency(val, true)} tick={{ fill: '#8a8b8d', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#5a5b5d', fontSize: 10 }} width={120} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="value" fill="#0763a9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sales by Category Pie Chart */}
          <div className="rounded-2xl p-5 bg-white space-y-4" style={CARD_STYLE}>
            <ChartHeader 
              title={t('categoryDistribution' as any) || 'Distribución por Categorías'} 
              tooltipText={t('categoryDistributionDesc' as any) || 'Muestra el porcentaje de ingresos generado por cada categoría de producto.'} 
            />
            <div className="h-64 flex flex-col md:flex-row items-center justify-around gap-4">
              <div className="w-full md:w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.breakdown.salesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {data.breakdown.salesByCategory.map((_, idx) => (
                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2 space-y-2 overflow-y-auto max-h-56 pr-2">
                {data.breakdown.salesByCategory.map((cat, idx) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="font-medium text-gray-700 truncate max-w-[120px]" title={cat.name}>{cat.name}</span>
                    </div>
                    <span className="font-bold text-gray-900">{formatCurrency(cat.value, true)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>



        {/* 4. Customer Insights & New widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Adquisición vs Retención */}
          <div className="rounded-2xl p-5 bg-white flex flex-col h-[360px]" style={CARD_STYLE}>
            <ChartHeader 
              title={t('acquisitionVsRetention' as any) || 'Adquisición vs Retención'} 
              tooltipText={t('acquisitionVsRetentionDesc' as any) || 'Muestra la proporción de ingresos provenientes de nuevos clientes vs clientes recurrentes.'} 
            />
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-full h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={newVsReturningData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2}>
                      <Cell fill="#0d9488" />
                      <Cell fill="#0763a9" />
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full grid grid-cols-2 gap-2 mt-4 text-center text-xs border-t pt-3">
                <div>
                  <p className="text-[#8a8b8d]">{t('newClients' as any) || 'Nuevos Clientes'}</p>
                  <p className="font-bold text-gray-800 text-sm mt-0.5">{formatCurrency(data.customerInsights.newRevenue, true)}</p>
                </div>
                <div>
                  <p className="text-[#8a8b8d]">{t('recurringClients' as any) || 'Clientes Recurrentes'}</p>
                  <p className="font-bold text-gray-800 text-sm mt-0.5">{formatCurrency(data.customerInsights.returningRevenue, true)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Customers Rank */}
          <div className="rounded-2xl p-5 bg-white flex flex-col h-[360px] lg:col-span-2" style={CARD_STYLE}>
            <ChartHeader 
              title={t('clientRanking' as any) || 'Ranking de Clientes'} 
              tooltipText={t('customerRankingDesc2' as any) || 'Listado de clientes con mayor volumen de compras acumuladas.'} 
            />
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {data.customerInsights.topCustomers.map((client, index) => {
                const rank = index + 1
                const maxVal = data.customerInsights.topCustomers[0]?.value || 1
                const percent = (client.value / maxVal) * 100
                return (
                  <div 
                    key={client.name}
                    onClick={() => client.crmClientId && router.push(`/reportes/clientes/${client.crmClientId}`)}
                    className={`p-2 rounded-xl border border-gray-100 flex flex-col gap-1 hover:border-gray-250 transition-all ${client.crmClientId ? 'cursor-pointer hover:bg-slate-50 hover:border-teal-500' : ''}`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-[10px]">
                          {rank}
                        </span>
                        <span className="font-semibold text-gray-850 truncate" title={client.name}>{client.name}</span>
                      </div>
                      <span className="font-bold text-teal-650">{formatCurrency(client.value)}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                      <div className="bg-teal-650 h-full rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 5. NEW WIDGETS: Fulfillment & Payment Methods */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fulfillment Status Widget */}
          <div className="rounded-2xl p-5 bg-white flex flex-col h-[340px]" style={CARD_STYLE}>
            <ChartHeader 
              title={t('fulfillmentRate' as any) || 'Fulfillment de Entregas'} 
              tooltipText={t('fulfillmentRateDesc' as any) || 'Muestra la tasa de surtido de las facturas de clientes (Completa, Parcial, No Surtida).'} 
            />
            <div className="flex-1 flex flex-col md:flex-row items-center justify-around gap-4">
              <div className="w-full md:w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.fulfillmentRates} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2}>
                      {data.fulfillmentRates.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.name === 'completa' ? '#0d9488' : entry.name === 'parcial' ? '#b45309' : '#b91c1c'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2 space-y-3">
                {data.fulfillmentRates.map((entry) => (
                  <div key={entry.name} className="flex justify-between items-center text-xs">
                    <span className="font-medium text-gray-700 capitalize">{getFulfillmentName(entry.name)}</span>
                    <span className="font-bold text-gray-900">{formatCurrency(entry.value, true)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Method Distribution */}
          <div className="rounded-2xl p-5 bg-white flex flex-col h-[340px]" style={CARD_STYLE}>
            <ChartHeader 
              title={t('paymentMethods' as any) || 'Métodos de Pago'} 
              tooltipText={t('paymentMethodsDesc' as any) || 'Distribución de ingresos por método de pago registrado en las facturas.'} 
            />
            <div className="flex-1 flex flex-col justify-around">
              {data.paymentMethods.map((method, idx) => {
                const maxVal = data.paymentMethods[0]?.value || 1
                const percent = (method.value / maxVal) * 100
                return (
                  <div key={method.name} className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-gray-700">{method.name}</span>
                      <span className="text-[#0763a9]">{formatCurrency(method.value)}</span>
                    </div>
                    <div className="w-full bg-gray-150 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#f0f5fa' }}>
                      <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 6. NEW WIDGET: Congress Sales ROI Dashboard */}
        <div className="rounded-2xl p-5 bg-white flex flex-col" style={CARD_STYLE}>
          <ChartHeader 
            title={t('congressRoiTitle' as any) || 'Retorno de Inversión (ROI) de Congresos'} 
            tooltipText={t('congressRoiDesc' as any) || 'Compara los gastos totales realizados para cada congreso contra las ventas facturadas a los clientes que asistieron a sus talleres.'} 
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">{t('congresos')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">{t('spentByCongress' as any)}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">{t('salesGenerated' as any) || 'Ventas Generadas'}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">ROI (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {data.congressRoi.map((cong, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-800">{cong.name}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{formatCurrency(cong.expenses)}</td>
                    <td className="px-4 py-3 text-right text-teal-600 font-bold">{formatCurrency(cong.sales)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${cong.roi >= 100 ? 'text-green-600' : 'text-amber-600'}`}>
                      {cong.roi > 0 ? `${cong.roi.toFixed(1)}%` : '0.0%'}
                    </td>
                  </tr>
                ))}
                {data.congressRoi.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                      {t('noCongressesForAnalysis' as any) || 'No hay congresos registrados para análisis'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 7. Funnel, budget, and recent orders row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Funnel */}
          <div className="rounded-2xl p-5 bg-white flex flex-col justify-between" style={CARD_STYLE}>
            <ChartHeader 
              title={t('salesFunnel' as any) || 'Embudo de Ventas'} 
              tooltipText={t('salesFunnelDesc' as any) || 'Muestra la conversión de prospectos a través de las etapas del proceso comercial.'} 
            />
            <div className="space-y-3">
              {[
                { stage: t('prospects'), count: 180, val: '$5.4M', pct: 100, color: 'bg-blue-600' },
                { stage: t('opportunities' as any) || 'Oportunidades', count: 110, val: '$3.2M', pct: 61, color: 'bg-indigo-600' },
                { stage: t('quotations' as any) || 'Cotizaciones', count: 68, val: '$1.9M', pct: 37, color: 'bg-purple-600' },
                { stage: t('closedSales' as any) || 'Ventas Cerradas', count: 34, val: '$1.2M', pct: 18, color: 'bg-[#0d9488]' }
              ].map((step) => (
                <div key={step.stage} className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold text-gray-750">
                    <span>{step.stage} ({step.count})</span>
                    <span>{step.val} ({step.pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-150 h-4 rounded-lg overflow-hidden relative" style={{ backgroundColor: '#f0f5fa' }}>
                    <div className={`h-full ${step.color} transition-all duration-500`} style={{ width: `${step.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Goal tracker */}
          <div className="rounded-2xl p-5 bg-white flex flex-col" style={CARD_STYLE}>
            <div className="space-y-4">
              <ChartHeader 
                title={t('budgetControl' as any) || 'Control de Presupuesto'} 
                tooltipText={t('budgetControlDesc' as any) || 'Monitorea el avance de la facturación mensual contra la meta establecida de la empresa.'} 
              />
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{t('monthlyTarget' as any) || 'Meta Mensual'}:</span>
                  <span className="font-bold text-gray-800">$500,000.00</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{t('accumulatedSales' as any) || 'Ventas Acumuladas'}:</span>
                  <span className="font-bold text-teal-650">{formatCurrency(data.kpis.salesMonth)}</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden border border-gray-200">
                  <div 
                    className="bg-[#0d9488] h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(data.kpis.goalProgress, 100)}%` }} 
                  />
                </div>
                <p className="text-[11px] text-[#8a8b8d] font-semibold text-right">
                  {t('progress' as any) || 'Progreso'}: {data.kpis.goalProgress.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Recent Orders List */}
          <div className="rounded-2xl p-5 bg-white flex flex-col h-[300px] justify-between" style={CARD_STYLE}>
            <ChartHeader 
              title={t('lastSales' as any) || 'Últimas Ventas'} 
              tooltipText={t('lastSalesDesc' as any) || 'Muestra los 15 registros de facturación más recientes del sistema.'} 
            />
            <div className="flex-1 overflow-y-auto pr-1 space-y-0.5">
              {data.recentOrders.map((order, idx) => {
                const orderDateStr = order.date ? new Date(order.date).toLocaleDateString(locale === 'es' ? 'es-MX' : locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' }) : '-'
                return (
                  <div 
                    key={idx}
                    onClick={() => order.crmClientId && router.push(`/reportes/clientes/${order.crmClientId}`)}
                    className={`flex items-center justify-between text-xs py-2 border-b border-gray-50 transition-colors ${order.crmClientId ? 'cursor-pointer hover:bg-slate-50 px-1 rounded hover:text-teal-600' : ''}`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-semibold text-gray-850 truncate">{order.customer}</p>
                      <p className="text-[10px] text-[#8a8b8d]">{orderDateStr}</p>
                    </div>
                    <span className="font-bold text-[#0d9488]">{formatCurrency(order.amount)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
