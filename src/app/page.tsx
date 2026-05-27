'use client'
import { useEffect, useState } from 'react'
import {
  Users, CheckCircle2, XCircle, Sparkles, MapPin, Activity,
  Receipt, Calendar, DollarSign, Clock, ArrowUpRight, TrendingUp, Building2,
  Trophy, Award
} from 'lucide-react'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import StatCard from '@/components/StatCard'
import StatusBadge from '@/components/StatusBadge'
import { Client, Congreso, Gasto } from '@/types/database'
import { formatDistanceToNow } from 'date-fns'
import { es, enUS, zhCN } from 'date-fns/locale'
import { Locale } from '@/lib/i18n'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const dateFnsLocales: Record<Locale, typeof es> = { es, en: enUS, zh: zhCN }

interface GastoWithRels extends Gasto {
  congreso?: { name: string }
  category?: { name: string }
}

interface DashboardData {
  // Clients
  total: number
  active: number
  inactive: number
  prospects: number
  recentClients: Client[]
  byState: { state: string; count: number }[]
  bySpecialty: { specialty: string; count: number }[]
  // Gastos
  gastos: GastoWithRels[]
  totalSpent: number
  totalBillable: number
  pendingBilling: number
  gastosCount: number
  // Congresos
  congresos: Congreso[]
  // Ventas
  ventas: any[]
  totalSales: number
  salesCount: number
  averageSale: number
  clientsWithSalesCount: number
  topClientsSales: { name: string; value: number }[]
}

export default function DashboardPage() {
  const { t, locale } = useI18n()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [clientsRes, gastosRes, congresosRes, ventasRes] = await Promise.all([
          fetch('/api/clients?pageSize=200'),
          fetch('/api/gastos'),
          fetch('/api/congresos'),
          fetch('/api/ventas'),
        ])

        const clientsJson = await clientsRes.json()
        const gastosJson = await gastosRes.json()
        const congresosJson = await congresosRes.json()
        const ventasJson = await ventasRes.json()

        const clients: Client[] = clientsJson.data || []
        const gastos: GastoWithRels[] = gastosJson.data || []
        const congresos: Congreso[] = congresosJson.data || []
        const ventas: any[] = ventasJson.data || []

        // Client stats
        const active = clients.filter(c => c.status === 'Activo').length
        const inactive = clients.filter(c => c.status === 'Inactivo').length
        const prospects = clients.filter(c => !['Activo', 'Inactivo'].includes(c.status)).length

        const stateCount: Record<string, number> = {}
        clients.forEach(c => (c.states || []).forEach(s => {
          const clean = s.trim(); if (clean) stateCount[clean] = (stateCount[clean] || 0) + 1
        }))
        const byState = Object.entries(stateCount).sort((a, b) => b[1] - a[1]).slice(0, 8)
          .map(([state, count]) => ({ state: state.split(',')[0].trim().slice(0, 18), count }))

        const specCount: Record<string, number> = {}
        clients.forEach(c => (c.specialties || []).forEach(s => {
          const clean = s.trim(); if (clean) specCount[clean] = (specCount[clean] || 0) + 1
        }))
        const bySpecialty = Object.entries(specCount).sort((a, b) => b[1] - a[1]).slice(0, 6)
          .map(([specialty, count]) => ({ specialty: specialty.split(',')[0].trim().slice(0, 22), count }))

        // Gasto stats
        const totalSpent = gastos.reduce((acc, g) => acc + Number(g.total || 0), 0)
        const totalBillable = gastos.filter(g => g.is_billable).reduce((acc, g) => acc + Number(g.total || 0), 0)
        const pendingBilling = gastos.filter(g => g.is_billable && !g.is_billed).reduce((acc, g) => acc + Number(g.total || 0), 0)

        // Ventas stats
        const totalSales = ventas.reduce((acc, v) => acc + Number(v.monto || 0), 0)
        const salesCount = ventas.length
        const averageSale = salesCount > 0 ? totalSales / salesCount : 0

        const clientSalesMap: Record<string, number> = {}
        ventas.forEach(v => {
          const name = v.cliente_nombre || 'Sin Nombre'
          clientSalesMap[name] = (clientSalesMap[name] || 0) + Number(v.monto || 0)
        })

        const sortedClientSales = Object.entries(clientSalesMap).sort((a, b) => b[1] - a[1])
        const clientsWithSalesCount = sortedClientSales.length

        const topClientsSales = sortedClientSales
          .slice(0, 10)
          .map(([name, value]) => ({
            name,
            value
          }))

        setData({
          total: clients.length, active, inactive, prospects,
          recentClients: clients.slice(0, 5), byState, bySpecialty,
          gastos: gastos.slice(0, 5), totalSpent, totalBillable, pendingBilling, gastosCount: gastos.length,
          congresos,
          ventas: ventas.slice(0, 5),
          totalSales,
          salesCount,
          averageSale,
          clientsWithSalesCount,
          topClientsSales
        })
      } finally { setLoading(false) }
    }
    loadDashboard()
  }, [])

  const dfLocale = dateFnsLocales[locale] ?? es
  const CARD_STYLE = { background: '#ffffff', border: '1px solid #d4e0ec' }
  const CHART_TOOLTIP = { background: '#ffffff', border: '1px solid #d4e0ec', borderRadius: 8, color: '#37383a' }

  const formatCurrency = (amount: number | string, compact = false) => {
    const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0
    const absNum = Math.abs(num)
    if (compact && absNum >= 1000000) {
      return `${num < 0 ? '-' : ''}$${(absNum / 1000000).toFixed(2)}M`
    }
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num)
  }

  // Upcoming congresos (end_date >= today)
  const today = new Date()
  const upcomingCongresos = (data?.congresos ?? []).filter(c => new Date(c.end_date) >= today).slice(0, 4)
  const pastCongresos = (data?.congresos ?? []).filter(c => new Date(c.end_date) < today).slice(0, 2)

  if (loading) return (
    <AppShell>
      <div className="flex items-center justify-center min-h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0763a9', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#5a5b5d' }}>{t('loading')}</p>
        </div>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#37383a' }}>{t('dashboard')}</h1>
          <p className="text-sm mt-0.5" style={{ color: '#5a5b5d' }}>{t('overview')}</p>
        </div>

        {/* ═══════════════════════════════════════════
            SECTION 1: VENTAS (SALES WIDGETS)
        ═══════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#37383a' }}>
              <TrendingUp size={18} style={{ color: '#0d9488' }} />
              {t('ventas' as any) || 'Ventas'}
            </h2>
            <Link href="/ventas" className="text-xs font-semibold text-teal-600 hover:text-teal-700">Ver Dashboard de Ventas →</Link>
          </div>
          
          {/* Sales KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title={t('totalSales' as any) || 'Ventas Totales'}
              value={formatCurrency(data?.totalSales ?? 0, true)}
              icon={<DollarSign size={22} />}
              color="green"
              href="/ventas"
            />
            <StatCard
              title={t('salesCount' as any) || 'No. de Ventas'}
              value={data?.salesCount ?? 0}
              icon={<TrendingUp size={22} />}
              color="blue"
              href="/ventas"
            />
            <StatCard
              title={t('averageSale' as any) || 'Promedio'}
              value={formatCurrency(data?.averageSale ?? 0, true)}
              icon={<Activity size={22} />}
              color="amber"
              href="/ventas"
            />
            <StatCard
              title={t('clientsWithSales' as any) || 'Clientes con Ventas'}
              value={data?.clientsWithSalesCount ?? 0}
              icon={<Building2 size={22} />}
              color="blue"
              href="/ventas"
            />
          </div>

          {/* Recent Sales + Top Clients List */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Recent Sales */}
            <div className="rounded-2xl p-5 bg-white lg:col-span-2 flex flex-col h-[340px]" style={CARD_STYLE}>
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} style={{ color: '#0d9488' }} />
                  <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>{t('recentSales' as any) || 'Ventas Recientes'}</h2>
                </div>
                <Link href="/ventas" className="text-xs font-medium text-teal-600 hover:text-teal-700">{t('viewAll')} →</Link>
              </div>
              {(data?.ventas ?? []).length === 0 ? (
                <p className="text-sm py-8 text-center flex-1 flex items-center justify-center" style={{ color: '#8a8b8d' }}>No hay ventas registradas</p>
              ) : (
                <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1 space-y-0">
                  {(data?.ventas ?? []).map((venta, idx) => (
                    <Link
                      key={venta.id}
                      href={`/ventas/${venta.id}`}
                      className="flex items-center gap-3 py-3 hover:bg-teal-50/30 px-2 rounded-xl transition-colors group"
                      style={idx < (data?.ventas.length ?? 0) - 1 ? { borderBottom: '1px solid #f0f5fa' } : {}}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: '#e6f4f1', color: '#0d9488' }}
                      >
                        <Building2 size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#37383a' }}>
                          {venta.cliente_nombre}
                        </p>
                        <p className="text-xs truncate" style={{ color: '#8a8b8d' }}>
                          Periodo: {venta.mes}/{venta.anio}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className="text-sm font-bold text-teal-650">
                          {formatCurrency(venta.monto)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Ranking de Clientes List (Top 10) */}
            <div className="rounded-2xl p-5 bg-white flex flex-col h-[340px]" style={CARD_STYLE}>
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} style={{ color: '#7c3aed' }} />
                  <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>
                    {t('clientRanking' as any) || 'Ranking de Clientes'} (Top 10)
                  </h2>
                </div>
                <Trophy className="text-amber-500" size={16} />
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {(data?.topClientsSales ?? []).map((client, index) => {
                  const rank = index + 1
                  const maxVal = data?.topClientsSales[0]?.value || 1
                  const percent = (client.value / maxVal) * 100

                  // Styling for Top 3
                  let badgeClass = "bg-gray-100 text-gray-600"
                  let cardBorderClass = "border-transparent"
                  let TrophyIcon = null

                  if (rank === 1) {
                    badgeClass = "bg-amber-100 text-amber-800 ring-2 ring-amber-300"
                    cardBorderClass = "border-amber-100 bg-amber-50/10"
                    TrophyIcon = <Trophy className="text-amber-500 fill-amber-300" size={12} />
                  } else if (rank === 2) {
                    badgeClass = "bg-slate-200 text-slate-800 ring-2 ring-slate-300"
                    cardBorderClass = "border-slate-100 bg-slate-50/10"
                    TrophyIcon = <Award className="text-slate-400 fill-slate-200" size={12} />
                  } else if (rank === 3) {
                    badgeClass = "bg-orange-100 text-orange-850 ring-2 ring-orange-200"
                    cardBorderClass = "border-orange-100 bg-orange-50/10"
                    TrophyIcon = <Award className="text-orange-400 fill-orange-100" size={12} />
                  }

                  return (
                    <div 
                      key={client.name}
                      className={`
                        p-2 rounded-xl border text-left flex flex-col gap-1
                        ${cardBorderClass}
                        hover:border-gray-200 transition-colors
                      `}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${badgeClass}`}>
                            {rank}
                          </span>
                          <span className="font-semibold text-gray-900 text-xs truncate" title={client.name}>
                            {client.name}
                          </span>
                          {TrophyIcon}
                        </div>
                        <span className="font-bold text-teal-650 text-xs whitespace-nowrap">
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
                {(data?.topClientsSales ?? []).length === 0 && (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400 py-8">
                    No hay datos disponibles
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            SECTION 2: GASTOS & CONGRESOS
        ═══════════════════════════════════════════ */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#37383a' }}>
              <Receipt size={18} style={{ color: '#0763a9' }} />
              {t('gastos' as any) || 'Gastos'}
            </h2>
            <Link href="/gastos" className="text-xs font-semibold text-blue-650 hover:text-blue-700">Ver Dashboard de Gastos →</Link>
          </div>
          
          {/* Gastos KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title={t('totalSpent')}
              value={formatCurrency(data?.totalSpent ?? 0, true)}
              icon={<DollarSign size={22} />}
              color="blue"
              href="/gastos"
            />
            <StatCard
              title={t('totalBillable')}
              value={formatCurrency(data?.totalBillable ?? 0, true)}
              icon={<Receipt size={22} />}
              color="green"
              href="/gastos"
            />
            <StatCard
              title={t('totalPendingBilling')}
              value={formatCurrency(data?.pendingBilling ?? 0, true)}
              icon={<TrendingUp size={22} />}
              color="amber"
              href="/gastos"
            />
            <StatCard
              title={t('expensesCount')}
              value={data?.gastosCount ?? 0}
              icon={<Receipt size={22} />}
              color="red"
              href="/gastos"
            />
          </div>

          {/* Recent Gastos + Upcoming Congresos side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Gastos */}
            <div className="rounded-2xl p-5 bg-white" style={CARD_STYLE}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Receipt size={16} style={{ color: '#0763a9' }} />
                  <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>{t('recentExpenses')}</h2>
                </div>
                <Link href="/gastos" className="text-xs font-medium" style={{ color: '#0763a9' }}>{t('viewAll')} →</Link>
              </div>
              {(data?.gastos ?? []).length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: '#8a8b8d' }}>{t('noExpenses')}</p>
              ) : (
                <div className="space-y-0">
                  {(data?.gastos ?? []).map((gasto, idx) => (
                    <Link
                      key={gasto.id}
                      href={`/gastos/${gasto.id}`}
                      className="flex items-center gap-3 py-3 hover:bg-blue-50/50 -mx-2 px-2 rounded-xl transition-colors group"
                      style={idx < (data?.gastos.length ?? 0) - 1 ? { borderBottom: '1px solid #f0f5fa' } : {}}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: '#e8f1f9', color: '#0763a9' }}
                      >
                        <Receipt size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#37383a' }}>
                          {gasto.description || gasto.name}
                        </p>
                        <p className="text-xs truncate" style={{ color: '#8a8b8d' }}>
                          {gasto.congreso?.name ?? (gasto.category?.name || '')}
                          {gasto.expense_date && ` · ${new Date(gasto.expense_date).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className="text-sm font-bold" style={{ color: '#0763a9' }}>{formatCurrency(gasto.total)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Congresos */}
            <div className="rounded-2xl p-5 bg-white" style={CARD_STYLE}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar size={16} style={{ color: '#7c3aed' }} />
                  <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>{t('upcomingCongresos')}</h2>
                </div>
                <Link href="/congresos" className="text-xs font-medium" style={{ color: '#7c3aed' }}>{t('viewAll')} →</Link>
              </div>
              {upcomingCongresos.length === 0 && pastCongresos.length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: '#8a8b8d' }}>{t('noCongresos')}</p>
              ) : (
                <div className="space-y-0">
                  {upcomingCongresos.map((congreso, idx) => {
                    const startDate = new Date(congreso.start_date)
                    const endDate = new Date(congreso.end_date)
                    const isActive = today >= startDate && today <= endDate
                    const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

                    return (
                      <Link
                        key={congreso.id}
                        href={`/congresos/${congreso.id}/view`}
                        className="flex items-center gap-3 py-3 hover:bg-purple-50/50 -mx-2 px-2 rounded-xl transition-colors group"
                        style={idx < upcomingCongresos.length - 1 || pastCongresos.length > 0 ? { borderBottom: '1px solid #f0f5fa' } : {}}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            background: isActive ? '#f3e8ff' : '#ede9fe',
                            color: isActive ? '#7c3aed' : '#8b5cf6'
                          }}
                        >
                          <Calendar size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#37383a' }}>
                            {congreso.name}
                          </p>
                          <p className="text-xs truncate" style={{ color: '#8a8b8d' }}>
                            <MapPin size={10} className="inline mr-1" style={{ verticalAlign: 'middle' }} />
                            {congreso.location}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: '#dcfce7', color: '#15803d' }}>
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              En curso
                            </span>
                          ) : (
                            <div>
                              <p className="text-xs font-medium" style={{ color: '#7c3aed' }}>
                                {daysUntil > 0 ? `${daysUntil}d` : ''}
                              </p>
                              <p className="text-xs" style={{ color: '#c4c5c7' }}>
                                {startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                  {pastCongresos.map((congreso, idx) => (
                    <Link
                      key={congreso.id}
                      href={`/congresos/${congreso.id}/view`}
                      className="flex items-center gap-3 py-3 hover:bg-gray-50/50 -mx-2 px-2 rounded-xl transition-colors opacity-50"
                      style={idx < pastCongresos.length - 1 ? { borderBottom: '1px solid #f0f5fa' } : {}}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: '#f3f4f6', color: '#9ca3af' }}
                      >
                        <Calendar size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#6b7280' }}>
                          {congreso.name}
                        </p>
                        <p className="text-xs truncate" style={{ color: '#9ca3af' }}>
                          {congreso.location}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <p className="text-xs" style={{ color: '#d1d5db' }}>
                          {new Date(congreso.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            SECTION 3: CLIENTS
        ═══════════════════════════════════════════ */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#37383a' }}>
              <Users size={18} style={{ color: '#0763a9' }} />
              {t('clients' as any) || 'Clientes'}
            </h2>
            <Link href="/clients" className="text-xs font-semibold text-blue-650 hover:text-blue-700">Ver Dashboard de Clientes →</Link>
          </div>

          {/* Client KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={t('totalClients')} value={data?.total ?? 0} icon={<Users size={22} />} color="blue" href="/clients" />
            <StatCard title={t('activeClients')} value={data?.active ?? 0} icon={<CheckCircle2 size={22} />} color="green" href="/clients?status=Activo" />
            <StatCard title={t('inactiveClients')} value={data?.inactive ?? 0} icon={<XCircle size={22} />} color="red" href="/clients?status=Inactivo" />
            <StatCard title={t('prospects')} value={data?.prospects ?? 0} icon={<Sparkles size={22} />} color="amber" href="/clients?is_prospect=true" />
          </div>

          {/* Charts + Recent Clients */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Chart: By State */}
            <div className="rounded-2xl p-5 bg-white" style={CARD_STYLE}>
              <div className="flex items-center gap-2 mb-4">
                <MapPin size={16} style={{ color: '#0763a9' }} />
                <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>{t('clientsByState')}</h2>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.byState} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8f1f9" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#8a8b8d', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="state" tick={{ fill: '#5a5b5d', fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} cursor={{ fill: 'rgba(7,99,169,0.05)' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {data?.byState.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#0763a9' : `rgba(7,99,169,${0.85 - i * 0.08})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart: By Specialty */}
            <div className="rounded-2xl p-5 bg-white" style={CARD_STYLE}>
              <div className="flex items-center gap-2 mb-4">
                <Activity size={16} style={{ color: '#b45309' }} />
                <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>{t('clientsBySpecialty')}</h2>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.bySpecialty} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8f1f9" vertical={false} />
                  <XAxis dataKey="specialty" tick={{ fill: '#5a5b5d', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8a8b8d', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} cursor={{ fill: 'rgba(180,83,9,0.05)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data?.bySpecialty.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#b45309' : `rgba(180,83,9,${0.9 - i * 0.1})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Recent Clients */}
            <div className="rounded-2xl p-5 bg-white" style={CARD_STYLE}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>{t('recentActivity')}</h2>
                <Link href="/clients" className="text-xs font-medium" style={{ color: '#0763a9' }}>{t('viewAll')} →</Link>
              </div>
              <div className="space-y-0">
                {(data?.recentClients ?? []).map((client, idx) => (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    className="flex items-center gap-3 py-2.5 hover:bg-blue-50/50 -mx-2 px-2 rounded-xl transition-colors group"
                    style={idx < (data?.recentClients.length ?? 0) - 1 ? { borderBottom: '1px solid #f0f5fa' } : {}}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0"
                      style={{ background: '#e8f1f9', color: '#0763a9' }}
                    >
                      {client.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate transition-colors" style={{ color: '#37383a' }}>{client.name}</p>
                      <p className="text-xs truncate" style={{ color: '#8a8b8d' }}>{client.states?.slice(0, 2).join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={client.status} size="sm" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
