'use client'
import { useEffect, useState } from 'react'
import { Users, CheckCircle2, XCircle, Sparkles, MapPin, Activity } from 'lucide-react'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import StatCard from '@/components/StatCard'
import StatusBadge from '@/components/StatusBadge'
import { Client } from '@/types/database'
import { formatDistanceToNow } from 'date-fns'
import { es, enUS, zhCN } from 'date-fns/locale'
import { Locale } from '@/lib/i18n'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const dateFnsLocales: Record<Locale, typeof es> = { es, en: enUS, zh: zhCN }

interface DashboardData {
  total: number
  active: number
  inactive: number
  prospects: number
  recentClients: Client[]
  byState: { state: string; count: number }[]
  bySpecialty: { specialty: string; count: number }[]
}

export default function DashboardPage() {
  const { t, locale } = useI18n()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch('/api/clients?pageSize=200')
        const json = await res.json()
        const clients: Client[] = json.data || []

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

        setData({ total: clients.length, active, inactive, prospects, recentClients: clients.slice(0, 6), byState, bySpecialty })
      } finally { setLoading(false) }
    }
    loadDashboard()
  }, [])

  const dfLocale = dateFnsLocales[locale] ?? es
  const CARD_STYLE = { background: '#ffffff', border: '1px solid #d4e0ec' }
  const CHART_TOOLTIP = { background: '#ffffff', border: '1px solid #d4e0ec', borderRadius: 8, color: '#37383a' }

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
          <p className="text-sm mt-0.5" style={{ color: '#5a5b5d' }}>{t('tagline')}</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title={t('totalClients')} value={data?.total ?? 0} icon={<Users size={22} />} color="blue" href="/clients" />
          <StatCard title={t('activeClients')} value={data?.active ?? 0} icon={<CheckCircle2 size={22} />} color="green" href="/clients?status=Activo" />
          <StatCard title={t('inactiveClients')} value={data?.inactive ?? 0} icon={<XCircle size={22} />} color="red" href="/clients?status=Inactivo" />
          <StatCard title={t('prospects')} value={data?.prospects ?? 0} icon={<Sparkles size={22} />} color="amber" href="/clients?is_prospect=true" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                className="flex items-center gap-3 py-3 hover:bg-blue-50/50 -mx-2 px-2 rounded-xl transition-colors group"
                style={idx < (data?.recentClients.length ?? 0) - 1 ? { borderBottom: '1px solid #f0f5fa' } : {}}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
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
                  <span className="text-xs hidden sm:block" style={{ color: '#c4c5c7' }}>
                    {client.registered_at
                      ? formatDistanceToNow(new Date(client.registered_at), { addSuffix: true, locale: dfLocale })
                      : ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
