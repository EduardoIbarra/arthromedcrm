'use client'
import { useEffect, useState, useCallback } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import StatusBadge from '@/components/StatusBadge'
import { Client } from '@/types/database'
import { Search, Filter, Download, UserPlus, Phone, Mail, MapPin, ChevronRight, X, Users } from 'lucide-react'
import Link from 'next/link'
import { useDebounce } from '@/hooks/useDebounce'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const MEXICO_STATES = [
  'CDMX', 'Estado de México', 'Jalisco', 'Nuevo León', 'Puebla', 'Guanajuato',
  'Veracruz', 'Chihuahua', 'Sonora', 'Coahuila', 'Tamaulipas', 'Baja California',
  'Sinaloa', 'Yucatán', 'Quintana Roo', 'San Luis Potosí', 'Guerrero', 'Oaxaca',
  'Morelos', 'Querétaro', 'Aguascalientes', 'Durango', 'Zacatecas', 'Colima',
  'Nayarit', 'Hidalgo', 'Tlaxcala', 'Tabasco', 'Michoacán', 'Chiapas', 'Campeche',
]

const CARD = { background: '#ffffff', border: '1px solid #d4e0ec' }

function ClientsContent() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [isProspectFilter, setIsProspectFilter] = useState(false)
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const debouncedSearch = useDebounce(search, 350)

  useEffect(() => {
    const status = searchParams.get('status')
    const isProspect = searchParams.get('is_prospect') === 'true'
    if (status) {
      setStatusFilter(status)
      setShowFilters(true)
    }
    if (isProspect) {
      setIsProspectFilter(true)
      setStatusFilter('')
      setShowFilters(true)
    }
  }, [searchParams])

  const fetchClients = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page), pageSize: '20',
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(statusFilter && { status: statusFilter }),
      ...(stateFilter && { state: stateFilter }),
      ...(isProspectFilter && { is_prospect: 'true' }),
    })
    try {
      const res = await fetch(`/api/clients?${params}`)
      const json = await res.json()
      setClients(json.data || [])
      setTotal(json.count || 0)
    } finally { setLoading(false) }
  }, [debouncedSearch, statusFilter, stateFilter, isProspectFilter, page])

  useEffect(() => { fetchClients() }, [fetchClients])
  useEffect(() => { setPage(1) }, [debouncedSearch, statusFilter, stateFilter, isProspectFilter])

  const exportCsv = () => {
    const headers = ['Nombre', 'RFC', 'Teléfono', 'Email Contacto', 'Estados', 'Especialidades', 'Estatus']
    const rows = clients.map(c => [c.name, c.rfc, c.phone, c.email_contact, c.states?.join('; '), c.specialties?.join('; '), c.status])
    const csv = [headers, ...rows].map(r => r?.map(v => `"${v || ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'arthromed_clientes.csv'; a.click()
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#37383a' }}>{t('clients')}</h1>
            <p className="text-sm" style={{ color: '#5a5b5d' }}>{total} registros</p>
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <button onClick={exportCsv} className="btn-secondary text-sm"><Download size={15} /> {t('exportCsv')}</button>
            <Link href="/clients/new" className="btn-primary text-sm"><UserPlus size={15} /> {t('newClient')}</Link>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8a8b8d' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="erp-input pl-9" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8a8b8d' }}><X size={14} /></button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary text-sm flex-shrink-0 ${showFilters ? 'border-blue-400' : ''}`}
            style={showFilters ? { color: '#0763a9', borderColor: '#0763a9' } : {}}
          >
            <Filter size={15} /> {t('filter')}
            {(statusFilter || stateFilter || isProspectFilter) && (
              <span className="ml-1 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center" style={{ background: '#0763a9' }}>
                {[statusFilter, stateFilter, isProspectFilter].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 p-4 rounded-xl animate-fade-in bg-white" style={CARD}>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: '#5a5b5d' }}>{t('status')}</label>
              <select
                value={isProspectFilter ? '__prospects__' : statusFilter}
                onChange={e => {
                  const val = e.target.value
                  if (val === '__prospects__') {
                    setIsProspectFilter(true)
                    setStatusFilter('')
                  } else {
                    setIsProspectFilter(false)
                    setStatusFilter(val)
                  }
                }}
                className="erp-input text-sm py-1.5"
                style={{ minWidth: 140 }}
              >
                <option value="">{t('all')}</option>
                <option value="__prospects__">{t('prospects')}</option>
                <option value="Activo">{t('activo')}</option>
                <option value="Inactivo">{t('inactivo')}</option>
                <option value="Nuevo Prospecto">{t('nuevoProspecto')}</option>
                <option value="Contactado">{t('contactado')}</option>
                <option value="Calificado">{t('calificado')}</option>
                <option value="Negociación">{t('negociacion')}</option>
                <option value="Perdido">{t('perdido')}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: '#5a5b5d' }}>{t('state')}</label>
              <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} className="erp-input text-sm py-1.5" style={{ minWidth: 160 }}>
                <option value="">{t('all')}</option>
                {MEXICO_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {(statusFilter || stateFilter || isProspectFilter) && (
              <button onClick={() => { setStatusFilter(''); setStateFilter(''); setIsProspectFilter(false) }} className="btn-ghost text-xs self-end mb-0.5">
                <X size={13} /> Limpiar
              </button>
            )}
          </div>
        )}

        {/* Clients list */}
        <div className="rounded-2xl overflow-hidden bg-white" style={CARD}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0763a9', borderTopColor: 'transparent' }} />
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-16" style={{ color: '#8a8b8d' }}>
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p>{t('noResults')}</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e8f1f9' }}>
                      {['ID', t('name'), t('rfc'), t('phone'), t('state'), t('status'), ''].map(h => (
                        <th key={h} className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#8a8b8d' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id} className="group hover:bg-blue-50/40 transition-colors" style={{ borderBottom: '1px solid #f0f5fa' }}>
                        <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: client.distributor_id ? '#0763a9' : '#c4c5c7' }}>{client.distributor_id || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: '#e8f1f9', color: '#0763a9' }}>
                              {client.name.charAt(0)}
                            </div>
                            <span className="text-sm font-medium max-w-[200px] truncate" style={{ color: '#37383a' }}>{client.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono" style={{ color: '#5a5b5d' }}>{client.rfc || '—'}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#5a5b5d' }}>{client.phone || '—'}</td>
                        <td className="px-4 py-3 text-sm max-w-[150px] truncate" style={{ color: '#5a5b5d' }}>{client.states?.slice(0, 2).join(', ') || '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={client.status} size="sm" /></td>
                        <td className="px-4 py-3">
                          <Link href={`/clients/${client.id}`} className="btn-ghost p-1.5 opacity-0 group-hover:opacity-100"><ChevronRight size={16} /></Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="lg:hidden divide-y" style={{ borderColor: '#f0f5fa' }}>
                {clients.map((client) => (
                  <Link key={client.id} href={`/clients/${client.id}`} className="flex items-start gap-3 p-4 hover:bg-blue-50/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: '#e8f1f9', color: '#0763a9' }}>
                      {client.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold truncate" style={{ color: '#37383a' }}>{client.name}</p>
                        <StatusBadge status={client.status} size="sm" />
                      </div>
                      <p className="text-xs font-mono mt-0.5" style={{ color: client.distributor_id ? '#0763a9' : '#8a8b8d' }}>{client.distributor_id || client.rfc || '—'}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {client.phone && <span className="flex items-center gap-1 text-xs" style={{ color: '#5a5b5d' }}><Phone size={11} /> {client.phone}</span>}
                        {client.states && client.states.length > 0 && <span className="flex items-center gap-1 text-xs" style={{ color: '#5a5b5d' }}><MapPin size={11} /> {client.states[0]}</span>}
                        {client.email_contact && <span className="flex items-center gap-1 text-xs" style={{ color: '#5a5b5d' }}><Mail size={11} /> {client.email_contact}</span>}
                      </div>
                    </div>
                    <ChevronRight size={16} className="flex-shrink-0 mt-1" style={{ color: '#c4c5c7' }} />
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #e8f1f9' }}>
                  <p className="text-xs" style={{ color: '#8a8b8d' }}>
                    Mostrando {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} de {total}
                  </p>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">← Anterior</button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Siguiente →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

export default function ClientsPage() {
  return (
    <Suspense fallback={
      <AppShell>
        <div className="max-w-7xl mx-auto py-16 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0763a9', borderTopColor: 'transparent' }} />
        </div>
      </AppShell>
    }>
      <ClientsContent />
    </Suspense>
  )
}