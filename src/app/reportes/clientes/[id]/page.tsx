'use client'
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, FileText, ShoppingBag, 
  Calendar, HelpCircle, Activity, User, Phone, Mail, MapPin, Briefcase
} from 'lucide-react'
import { useI18n } from '@/contexts/I18nContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import AppShell from '@/components/AppShell'
import StatCard from '@/components/StatCard'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts'

interface ClientInfo {
  id: string
  name: string
  rfc: string | null
  phone: string | null
  email: string | null
  salesperson: string
  states: string[]
}

interface ClientReportData {
  client: ClientInfo
  kpis: {
    salesPeriod: number
    salesPrevPeriod: number
    growthPercent: number
    orderCount: number
    aov: number
    firstPurchaseDate: string | null
  }
  salesTrends: { month: string; date: string; revenue: number; prevRevenue: number }[]
  breakdown: {
    topProducts: { name: string; value: number }[]
  }
  recentOrders: {
    id: string
    numero_factura: string
    fecha_expedicion: string
    subtotal: number
    iva: number
    total: number
    estado: string
    estado_surtido: string
    fecha_pago: string | null
  }[]
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

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pendiente: { label: 'Pendiente',  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100'  },
  pagada:    { label: 'Pagada',     bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  pagado:    { label: 'Pagado',     bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  parcial:   { label: 'Parcial',   bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100'   },
  completa:  { label: 'Completa',  bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-100'  },
  cancelada: { label: 'Cancelada', bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-100'   },
  anulado:   { label: 'Anulado',   bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-100'   },
  borrador:  { label: 'Borrador',  bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-100'  }
}

const ESTADO_SURTIDO_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  no_surtida: { label: 'No Surtida', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100' },
  parcial: { label: 'Parcial', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
  completa: { label: 'Completa', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  surtida: { label: 'Completa', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' }
}

export default function ClientReportPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const { t, locale } = useI18n()
  const { formatCurrency } = useCurrency()
  const [data, setData] = useState<ClientReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [deliveryDays] = useState<number>(25)

  // Date range filter state
  const [preset, setPreset] = useState('thisYear')
  const [startDate, setStartDate] = useState('2026-01-01')
  const [endDate, setEndDate] = useState('2026-12-31')

  useEffect(() => {
    async function loadReport() {
      if (!id) return
      setLoading(true)
      try {
        const res = await fetch(`/api/reports/clientes/${id}?startDate=${startDate}&endDate=${endDate}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (err) {
        console.error('Error loading client report:', err)
      } finally {
        setLoading(false)
      }
    }
    loadReport()
  }, [id, startDate, endDate])

  const handlePresetChange = (val: string) => {
    setPreset(val)
    if (val !== 'custom') {
      const dates = getPresetDates(val)
      setStartDate(dates.start)
      setEndDate(dates.end)
    }
  }

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

  // Local formatCurrency helper removed in favor of global useCurrency context helper

  const formatDate = (dateStr: string | Date) => {
    if (!dateStr) return '-'
    let date: Date
    if (typeof dateStr === 'string') {
      const parts = dateStr.split('T')[0].split('-')
      if (parts.length === 3) {
        date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0)
      } else {
        date = new Date(dateStr)
      }
    } else {
      date = new Date(dateStr)
    }

    if (isNaN(date.getTime())) return '-'
    return date.toLocaleDateString(locale === 'es' ? 'es-MX' : locale === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getLocalStatusLabel = (status: string) => {
    let statusLabel = STATUS_MAP[status]?.label || status
    if (locale === 'en') {
      if (status === 'pendiente') statusLabel = 'Pending'
      else if (['pagada', 'pagado'].includes(status)) statusLabel = 'Paid'
      else if (status === 'parcial') statusLabel = 'Partial'
      else if (status === 'completa') statusLabel = 'Complete'
      else if (status === 'cancelada' || status === 'anulado') statusLabel = 'Cancelled'
      else if (status === 'borrador') statusLabel = 'Draft'
    } else if (locale === 'zh') {
      if (status === 'pendiente') statusLabel = '待处理'
      else if (['pagada', 'pagado'].includes(status)) statusLabel = '已付款'
      else if (status === 'parcial') statusLabel = '部分'
      else if (status === 'completa') statusLabel = '已完成'
      else if (status === 'cancelada' || status === 'anulado') statusLabel = '已取消'
      else if (status === 'borrador') statusLabel = '草稿'
    }
    return statusLabel
  }

  const getLocalSurtidoLabel = (surtido: string) => {
    const key = (surtido === 'completa' || surtido === 'surtida') ? 'completed' : surtido === 'parcial' ? 'partial' : 'unfulfilled'
    return t(key as any) || ESTADO_SURTIDO_MAP[surtido || 'no_surtida']?.label || 'No Surtida'
  }

  const addBusinessDays = (startDateStr: string | Date, days: number): Date => {
    // Parse correctly without shifting
    let date: Date
    if (typeof startDateStr === 'string') {
      const parts = startDateStr.split('T')[0].split('-')
      if (parts.length === 3) {
        date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0)
      } else {
        date = new Date(startDateStr)
      }
    } else {
      date = new Date(startDateStr)
    }

    let count = 0
    while (count < days) {
      date.setDate(date.getDate() + 1)
      const dayOfWeek = date.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++
      }
    }
    return date
  }

  const getBusinessDaysDiff = (startDate: Date, endDate: Date): number => {
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    
    const end = new Date(endDate)
    end.setHours(0, 0, 0, 0)
    
    if (start.getTime() === end.getTime()) return 0
    const isNegative = start.getTime() > end.getTime()
    let count = 0
    const current = new Date(isNegative ? end : start)
    const target = new Date(isNegative ? start : end)
    while (current.getTime() < target.getTime()) {
      current.setDate(current.getDate() + 1)
      const dayOfWeek = current.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) count++
    }
    return isNegative ? -count : count
  }

  const renderDeliveryDays = (invoice: any) => {
    const isPaid = ['pagada', 'pagado'].includes(invoice.estado)
    if (!isPaid || !invoice.fecha_pago) {
      return <span className="text-gray-400 font-medium text-xs">-</span>
    }
    if (invoice.estado_surtido === 'completa' || invoice.estado_surtido === 'surtida') {
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
          Entregada
        </span>
      )
    }
    const deadline = addBusinessDays(invoice.fecha_pago, deliveryDays)
    const leftDays = getBusinessDaysDiff(new Date(), deadline)
    if (leftDays < 0) {
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100 animate-pulse">
          Atrasada ({leftDays} d)
        </span>
      )
    } else if (leftDays <= 5) {
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
          Urgente ({leftDays} d)
        </span>
      )
    } else {
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
          {leftDays} días
        </span>
      )
    }
  }

  const CARD_STYLE = { background: '#ffffff', border: '1px solid #d4e0ec' }
  const CHART_TOOLTIP = { background: '#ffffff', border: '1px solid #d4e0ec', borderRadius: 8, color: '#37383a' }

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

  const diffTime = Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
        
        {/* Back and Header with Date Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#d4e0ec]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/reportes/ventas')}
              className="p-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
              aria-label="Back to Reports"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#37383a' }}>
                <FileText className="text-[#0763a9]" size={26} />
                {t('clientReport' as any)}
              </h1>
              <p className="text-sm font-semibold mt-0.5 text-[#0763a9]">
                {data.client.name}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            {/* Preset Date selector */}
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
            
            <div className="flex flex-col text-xs pl-4 border-l border-[#e8f1f9] hidden sm:flex h-9 justify-center">
              <span className="text-[10px] uppercase font-bold text-[#8a8b8d] tracking-wider">{t('activeFilters' as any)}</span>
              <span className="font-semibold text-slate-700">{startDate} al {endDate}</span>
            </div>
          </div>
        </div>

        {/* Client Profile Card */}
        <div className="bg-white rounded-2xl p-6 border border-[#d4e0ec] grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-4 border-b pb-3 border-gray-100 flex items-center gap-2">
            <User size={18} className="text-[#0763a9]" />
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{t('clientProfile' as any)}</h3>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8a8b8d] tracking-wider block mb-1">{t('name')}</span>
            <span className="text-sm font-semibold text-gray-800">{data.client.name}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8a8b8d] tracking-wider block mb-1">{t('rfc')}</span>
            <span className="text-sm font-mono font-semibold text-gray-850 bg-[#f8fafd] px-2 py-0.5 border rounded border-gray-200">{data.client.rfc || '—'}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8a8b8d] tracking-wider block mb-1">{t('phone')}</span>
            <span className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <Phone size={13} className="text-[#8a8b8d]" />
              {data.client.phone || '—'}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8a8b8d] tracking-wider block mb-1">Email</span>
            <span className="text-sm font-semibold text-gray-800 truncate block max-w-full flex items-center gap-1.5" title={data.client.email || ''}>
              <Mail size={13} className="text-[#8a8b8d]" />
              {data.client.email || '—'}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8a8b8d] tracking-wider block mb-1">{t('assignedTo')}</span>
            <span className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <Briefcase size={13} className="text-[#8a8b8d]" />
              {data.client.salesperson}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8a8b8d] tracking-wider block mb-1">{t('state')}</span>
            <span className="text-sm font-semibold text-gray-850 flex items-center gap-1.5">
              <MapPin size={13} className="text-[#8a8b8d]" />
              {data.client.states?.join(', ') || '—'}
            </span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title={t('periodSales' as any)}
            value={formatCurrency(data.kpis.salesPeriod, true)}
            icon={<DollarSign size={20} />}
            color="green"
            subtitle={`${t('growthvsPrev')}: ${data.kpis.growthPercent >= 0 ? '+' : ''}${data.kpis.growthPercent.toFixed(1)}%`}
          />
          <StatCard
            title={t('growthVsPrevPeriod' as any)}
            value={`${data.kpis.growthPercent >= 0 ? '+' : ''}${data.kpis.growthPercent.toFixed(1)}%`}
            icon={data.kpis.growthPercent >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            color={data.kpis.growthPercent >= 0 ? 'green' : 'red'}
            subtitle={t('vsPreviousPeriod' as any)}
          />
          <StatCard
            title={t('totalOrders' as any)}
            value={data.kpis.orderCount}
            icon={<ShoppingBag size={20} />}
            color="blue"
            subtitle={`AOV: ${formatCurrency(data.kpis.aov, true)}`}
          />
          <StatCard
            title={t('firstPurchaseDate' as any)}
            value={data.kpis.firstPurchaseDate ? formatDate(data.kpis.firstPurchaseDate) : '—'}
            icon={<Calendar size={20} />}
            color="amber"
            subtitle="Fecha del primer registro"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart: Purchase Trend */}
          <div className="rounded-2xl p-5 bg-white space-y-4" style={CARD_STYLE}>
            <ChartHeader 
              title={t('salesTrend' as any)} 
              tooltipText="Tendencia histórica de facturación mensual o diaria de este cliente." 
            />
            <div className="h-64">
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
                  margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8f1f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#5a5b5d', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(val) => formatCurrency(val, true)} tick={{ fill: '#8a8b8d', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => formatCurrency(Number(value))} />
                  <Legend iconType="circle" />
                  <Line name={getPeriodLabel(startDate, endDate, false)} type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={3} activeDot={{ r: 6 }} />
                  <Line name={getPeriodLabel(startDate, endDate, true)} type="monotone" dataKey="prevRevenue" stroke="#9ca3af" strokeDasharray="5 5" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart: Top Products */}
          <div className="rounded-2xl p-5 bg-white space-y-4" style={CARD_STYLE}>
            <ChartHeader 
              title={t('topProductsPurchased' as any)} 
              tooltipText="Productos más comprados por volumen de ingresos acumulados en el periodo." 
            />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.breakdown.topProducts} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8f1f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={(val) => formatCurrency(val, true)} tick={{ fill: '#8a8b8d', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#5a5b5d', fontSize: 9 }} width={100} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="value" fill="#0763a9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Invoice List */}
        <div className="bg-white rounded-2xl border border-[#d4e0ec] overflow-hidden">
          <div className="p-5 border-b border-[#e8f1f9] flex justify-between items-center bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <span className="bg-[#0763a9] w-2 h-2 rounded-full"></span>
              {t('salesList' as any)}
            </h3>
            <span className="text-xs font-semibold text-gray-500 bg-white border px-2 py-0.5 rounded-full shadow-xs">
              {data.recentOrders.length} {data.recentOrders.length === 1 ? 'factura' : 'facturas'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-[#e8f1f9] text-xs font-semibold uppercase text-gray-500">
                  <th className="p-4 pl-6">Folio / Número</th>
                  <th className="p-4">Fecha Expedición</th>
                  <th className="p-4">{t('paymentDate')}</th>
                  <th className="p-4 text-right">Subtotal</th>
                  <th className="p-4 text-right">IVA</th>
                  <th className="p-4 text-right font-bold">Total</th>
                  <th className="p-4 text-center">Surtido</th>
                  <th className="p-4 text-center">Límite Entrega</th>
                  <th className="p-4 text-center">Días Restantes</th>
                  <th className="p-4 text-center">Estado Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8f1f9] text-sm">
                {data.recentOrders.map((invoice) => {
                  const status = STATUS_MAP[invoice.estado] || { label: invoice.estado, bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-100' }
                  const surtido = ESTADO_SURTIDO_MAP[invoice.estado_surtido] || ESTADO_SURTIDO_MAP['no_surtida']
                  return (
                    <tr
                      key={invoice.id}
                      onClick={() => router.push(`/facturas/${invoice.id}`)}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                    >
                      <td className="p-4 pl-6 font-semibold text-[#0763a9] group-hover:underline">
                        {invoice.numero_factura}
                      </td>
                      <td className="p-4 text-gray-600">
                        {formatDate(invoice.fecha_expedicion)}
                      </td>
                      <td className="p-4 text-gray-600 font-medium text-xs">
                        {invoice.fecha_pago ? formatDate(invoice.fecha_pago) : '-'}
                      </td>
                      <td className="p-4 text-right text-gray-600 font-mono text-xs">
                        {formatCurrency(invoice.subtotal)}
                      </td>
                      <td className="p-4 text-right text-gray-600 font-mono text-xs">
                        {formatCurrency(invoice.iva)}
                      </td>
                      <td className="p-4 text-right font-bold text-gray-900 font-mono">
                        {formatCurrency(invoice.total)}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${surtido.bg} ${surtido.text} ${surtido.border}`}>
                          {getLocalSurtidoLabel(invoice.estado_surtido)}
                        </span>
                      </td>
                      <td className="p-4 text-center text-gray-650 font-medium text-xs">
                        {(['pagada', 'pagado'].includes(invoice.estado)) && invoice.fecha_pago 
                          ? formatDate(addBusinessDays(invoice.fecha_pago, deliveryDays).toISOString())
                          : '-'
                        }
                      </td>
                      <td className="p-4 text-center">
                        {renderDeliveryDays(invoice)}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${status.bg} ${status.text} ${status.border}`}>
                          {getLocalStatusLabel(invoice.estado)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {data.recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-16 text-center text-gray-400 font-medium">
                      No hay registros de facturación para este periodo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppShell>
  )
}
