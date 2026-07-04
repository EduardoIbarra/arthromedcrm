'use client'
import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import StatusBadge from '@/components/StatusBadge'
import { Client, Congreso } from '@/types/database'
import { Search, Filter, Download, UserPlus, Phone, Mail, MapPin, ChevronRight, X, Users, UserCheck, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { useDebounce } from '@/hooks/useDebounce'
import { useRouter } from 'next/navigation'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import PermissionGuard from '@/components/PermissionGuard'
import { addMonths, differenceInDays, format } from 'date-fns'

const MEXICO_STATES = [
  'CDMX', 'Estado de México', 'Jalisco', 'Nuevo León', 'Puebla', 'Guanajuato',
  'Veracruz', 'Chihuahua', 'Sonora', 'Coahuila', 'Tamaulipas', 'Baja California',
  'Sinaloa', 'Yucatán', 'Quintana Roo', 'San Luis Potosí', 'Guerrero', 'Oaxaca',
  'Morelos', 'Querétaro', 'Aguascalientes', 'Durango', 'Zacatecas', 'Colima',
  'Nayarit', 'Hidalgo', 'Tlaxcala', 'Tabasco', 'Michoacán', 'Chiapas', 'Campeche',
]

const CARD = { background: '#ffffff', border: '1px solid #d4e0ec' }

const renderLetterIndicator = (client: any, isMobile = false) => {
  const hasLetter = client.distributor_id || client.letter_url || (client.cartas_count && client.cartas_count > 0)
  if (!hasLetter) {
    return isMobile ? null : <span className="text-gray-400">—</span>
  }

  if (!client.latest_payment_date) {
    return (
      <div className={`flex flex-col ${isMobile ? 'items-end' : ''}`}>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
          Revocada (Sin compras)
        </span>
      </div>
    )
  }

  const paymentDate = new Date(client.latest_payment_date)
  const revocationDate = addMonths(paymentDate, 3)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  revocationDate.setHours(0, 0, 0, 0)

  const daysRemaining = differenceInDays(revocationDate, today)

  if (daysRemaining <= 0) {
    return (
      <div className={`flex flex-col gap-0.5 ${isMobile ? 'items-end' : ''}`}>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100 w-fit">
          Revocada
        </span>
        {!isMobile && (
          <span className="text-[10px] text-gray-400">
            Desde: {format(revocationDate, 'dd/MM/yyyy')}
          </span>
        )}
      </div>
    )
  }

  if (daysRemaining < 30) {
    return (
      <div className={`flex flex-col gap-0.5 ${isMobile ? 'items-end' : ''}`}>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 w-fit animate-pulse">
          Revoca en {daysRemaining}d
        </span>
        {!isMobile && (
          <span className="text-[10px] text-gray-400">
            Límite: {format(revocationDate, 'dd/MM/yyyy')}
          </span>
        )}
      </div>
    )
  }

  const monthsRemaining = Math.floor(daysRemaining / 30)
  const remainingText = monthsRemaining > 0 
    ? `Revoca en ~${monthsRemaining}m`
    : `Revoca en ${daysRemaining}d`

  return (
    <div className={`flex flex-col gap-0.5 ${isMobile ? 'items-end' : ''}`}>
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 w-fit">
        {remainingText}
      </span>
      {!isMobile && (
        <span className="text-[10px] text-gray-400">
          Límite: {format(revocationDate, 'dd/MM/yyyy')}
        </span>
      )}
    </div>
  )
}

const renderPurchaseIndicator = (client: Client, isMobile = false) => {
  if (!client.last_purchase_date) {
    return isMobile ? null : <span className="text-gray-400">—</span>
  }

  const purchaseDate = new Date(client.last_purchase_date)
  const revocationDate = addMonths(purchaseDate, 3)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  revocationDate.setHours(0, 0, 0, 0)

  const daysRemaining = differenceInDays(revocationDate, today)

  let badge: ReactNode
  if (daysRemaining <= 0) {
    badge = (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100 w-fit">
        Revocada
      </span>
    )
  } else if (daysRemaining < 30) {
    badge = (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 w-fit animate-pulse">
        Revoca en {daysRemaining}d
      </span>
    )
  } else {
    const monthsRemaining = Math.floor(daysRemaining / 30)
    const remainingText = monthsRemaining > 0
      ? `Revoca en ~${monthsRemaining}m`
      : `Revoca en ${daysRemaining}d`
    badge = (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 w-fit">
        {remainingText}
      </span>
    )
  }

  return (
    <div className={`flex flex-col gap-0.5 ${isMobile ? 'items-end' : ''}`} onClick={e => e.stopPropagation()}>
      {client.last_factura_id ? (
        <Link
          href={`/facturas/${client.last_factura_id}`}
          className="text-sm font-medium hover:underline w-fit"
          style={{ color: '#0763a9' }}
        >
          {format(purchaseDate, 'dd/MM/yyyy')}
        </Link>
      ) : (
        <span className="text-sm font-medium" style={{ color: '#37383a' }}>
          {format(purchaseDate, 'dd/MM/yyyy')}
        </span>
      )}
      {badge}
      {client.last_factura_numero && (
        <span className="text-[10px] text-gray-400">
          {client.last_factura_numero}
        </span>
      )}
    </div>
  )
}

function ClientsContent() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [congresoFilter, setCongresoFilter] = useState('')
  const [isProspectFilter, setIsProspectFilter] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [congresos, setCongresos] = useState<Congreso[]>([])
  const [staffUsers, setStaffUsers] = useState<any[]>([])
  const [responsableFilter, setResponsableFilter] = useState('')
  const [withPurchasesFilter, setWithPurchasesFilter] = useState(false)
  const debouncedSearch = useDebounce(search, 350)

  useEffect(() => {
    const status = searchParams.get('status')
    const isProspect = searchParams.get('is_prospect') === 'true'
    const congreso = searchParams.get('congreso')
    const source = searchParams.get('source')
    if (status) {
      setStatusFilter(status)
      setShowFilters(true)
    }
    if (isProspect) {
      setIsProspectFilter(true)
      setStatusFilter('')
      setShowFilters(true)
    }
    if (congreso) {
      setCongresoFilter(congreso)
      setShowFilters(true)
    }
    if (source) {
      setSourceFilter(source)
      setShowFilters(true)
    }
  }, [searchParams])

  useEffect(() => {
    fetch('/api/congresos')
      .then(r => r.json())
      .then(json => setCongresos(json.data || []))
      .catch(() => {})
    fetch('/api/cirugias/usuarios')
      .then(r => r.json())
      .then(json => setStaffUsers(json.data || []))
      .catch(() => {})
  }, [])

  const fetchClients = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page), pageSize: '20',
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(statusFilter && { status: statusFilter }),
      ...(stateFilter && { state: stateFilter }),
      ...(congresoFilter && { congreso: congresoFilter }),
      ...(isProspectFilter && { is_prospect: 'true' }),
      ...(sourceFilter && { source: sourceFilter }),
      ...(responsableFilter && { assigned_to: responsableFilter }),
      ...(withPurchasesFilter && { with_purchases: 'true' }),
    })
    try {
      const res = await fetch(`/api/clients?${params}`)
      const json = await res.json()
      setClients(json.data || [])
      setTotal(json.count || 0)
    } finally { setLoading(false) }
  }, [debouncedSearch, statusFilter, stateFilter, congresoFilter, isProspectFilter, sourceFilter, responsableFilter, withPurchasesFilter, page])

  const handleAssigneeChange = async (clientId: string, newId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: newId || null }),
      })
      if (res.ok) {
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, assigned_to: newId || null } : c))
      } else {
        const err = await res.json()
        alert(`Error al asignar: ${err.error || 'error desconocido'}`)
      }
    } catch (e) {
      console.error(e)
      alert('Error de red al asignar')
    }
  }

  useEffect(() => { fetchClients() }, [fetchClients])
  useEffect(() => { setPage(1) }, [debouncedSearch, statusFilter, stateFilter, congresoFilter, isProspectFilter, sourceFilter, responsableFilter, withPurchasesFilter])

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
            <PermissionGuard section="clients" action="view">
              <button onClick={exportCsv} className="btn-secondary text-sm"><Download size={15} /> {t('exportCsv')}</button>
            </PermissionGuard>
            <PermissionGuard section="clients" action="create">
              <Link href="/clients/new" className="btn-primary text-sm"><UserPlus size={15} /> {t('newClient')}</Link>
            </PermissionGuard>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8a8b8d' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="erp-input pl-10" />
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
            {(statusFilter || stateFilter || congresoFilter || isProspectFilter || sourceFilter || responsableFilter || withPurchasesFilter) && (
              <span className="ml-1 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center" style={{ background: '#0763a9' }}>
                {[statusFilter, stateFilter, congresoFilter, isProspectFilter, sourceFilter, responsableFilter, withPurchasesFilter].filter(Boolean).length}
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
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: '#5a5b5d' }}>Congreso</label>
              <select value={congresoFilter} onChange={e => setCongresoFilter(e.target.value)} className="erp-input text-sm py-1.5" style={{ minWidth: 180 }}>
                <option value="">{t('all')}</option>
                {congresos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: '#5a5b5d' }}>Origen (Source)</label>
              <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="erp-input text-sm py-1.5" style={{ minWidth: 160 }}>
                <option value="">Todos</option>
                <option value="Formulario Público">Formulario Público</option>
              </select>
            </div>
            {staffUsers.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium flex items-center gap-1" style={{ color: '#5a5b5d' }}>
                  <UserCheck size={12} /> Responsable
                </label>
                <select value={responsableFilter} onChange={e => setResponsableFilter(e.target.value)} className="erp-input text-sm py-1.5" style={{ minWidth: 180 }}>
                  <option value="">Todos</option>
                  {staffUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium flex items-center gap-1" style={{ color: '#5a5b5d' }}>
                <ShoppingBag size={12} /> Compras
              </label>
              <label className="flex items-center gap-2 cursor-pointer self-start mt-1">
                <input
                  type="checkbox"
                  checked={withPurchasesFilter}
                  onChange={e => setWithPurchasesFilter(e.target.checked)}
                  className="rounded border-gray-300 text-[#0763a9] focus:ring-[#0763a9]"
                />
                <span className="text-sm" style={{ color: '#37383a' }}>Clientes con compras</span>
              </label>
            </div>
            {(statusFilter || stateFilter || congresoFilter || isProspectFilter || sourceFilter || responsableFilter || withPurchasesFilter) && (
              <button onClick={() => { setStatusFilter(''); setStateFilter(''); setCongresoFilter(''); setIsProspectFilter(false); setSourceFilter(''); setResponsableFilter(''); setWithPurchasesFilter(false) }} className="btn-ghost text-xs self-end mb-0.5">
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
                      {[
                        'ID', t('name'), t('rfc'), t('phone'), t('state'), 'Responsable',
                        ...(withPurchasesFilter ? ['Última compra'] : []),
                        'Carta', t('status'), '',
                      ].map(h => (
                        <th key={h} className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#8a8b8d' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr
                        key={client.id}
                        onClick={() => router.push(`/clients/${client.id}`)}
                        className="group hover:bg-blue-50/40 transition-colors cursor-pointer"
                        style={{ borderBottom: '1px solid #f0f5fa' }}
                      >
                        <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: client.distributor_id ? '#0763a9' : '#c4c5c7' }}>{client.distributor_id || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: '#e8f1f9', color: '#0763a9' }}>
                                {client.name.charAt(0)}
                              </div>
                              <span className="text-sm font-medium max-w-[200px] truncate" style={{ color: '#37383a' }}>{client.name}</span>
                            </div>
                            {client.tags && client.tags.some(t => typeof t === 'string' && t.startsWith('congreso:')) && (
                              <div className="flex flex-wrap gap-1 ml-11">
                                {client.tags.filter(t => typeof t === 'string' && t.startsWith('congreso:')).map(t => {
                                  const cId = t.split(':')[1]
                                  const cName = congresos.find(c => c.id === cId)?.name || 'Congreso'
                                  return (
                                    <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: '#fdf4ff', color: '#a21caf', border: '1px solid #f5d0fe' }}>
                                      {cName}
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono" style={{ color: '#5a5b5d' }}>{client.rfc || '—'}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#5a5b5d' }}>{client.phone || '—'}</td>
                        <td className="px-4 py-3 text-sm max-w-[150px] truncate" style={{ color: '#5a5b5d' }}>{client.states?.slice(0, 2).join(', ') || '—'}</td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <select
                            value={client.assigned_to || ''}
                            onChange={e => handleAssigneeChange(client.id, e.target.value)}
                            className="bg-transparent text-xs rounded-lg border border-[#d4e0ec] px-2 py-1 text-[#37383a] focus:outline-none focus:border-[#0763a9] cursor-pointer hover:bg-gray-50"
                            style={{ maxWidth: '140px' }}
                          >
                            <option value="">Sin asignar</option>
                            {staffUsers.map((u: any) => (
                              <option key={u.id} value={u.id}>
                                {u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email}
                              </option>
                            ))}
                          </select>
                        </td>
                        {withPurchasesFilter && (
                          <td className="px-4 py-3">{renderPurchaseIndicator(client)}</td>
                        )}
                        <td className="px-4 py-3">{renderLetterIndicator(client)}</td>
                        <td className="px-4 py-3"><StatusBadge status={client.status} size="sm" /></td>
                        <td className="px-4 py-3">
                          <span className="btn-ghost p-1.5 opacity-0 group-hover:opacity-100 inline-flex"><ChevronRight size={16} /></span>
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
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <StatusBadge status={client.status} size="sm" />
                          {withPurchasesFilter && renderPurchaseIndicator(client, true)}
                          {renderLetterIndicator(client, true)}
                        </div>
                      </div>
                      <p className="text-xs font-mono mt-0.5" style={{ color: client.distributor_id ? '#0763a9' : '#8a8b8d' }}>{client.distributor_id || client.rfc || '—'}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {client.phone && <span className="flex items-center gap-1 text-xs" style={{ color: '#5a5b5d' }}><Phone size={11} /> {client.phone}</span>}
                        {client.states && client.states.length > 0 && <span className="flex items-center gap-1 text-xs" style={{ color: '#5a5b5d' }}><MapPin size={11} /> {client.states[0]}</span>}
                        {client.email_contact && <span className="flex items-center gap-1 text-xs" style={{ color: '#5a5b5d' }}><Mail size={11} /> {client.email_contact}</span>}
                      </div>
                      {client.tags && client.tags.some(t => typeof t === 'string' && t.startsWith('congreso:')) && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {client.tags.filter(t => typeof t === 'string' && t.startsWith('congreso:')).map(t => {
                            const cId = t.split(':')[1]
                            const cName = congresos.find(c => c.id === cId)?.name || 'Congreso'
                            return (
                              <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: '#fdf4ff', color: '#a21caf', border: '1px solid #f5d0fe' }}>
                                {cName}
                              </span>
                            )
                          })}
                        </div>
                      )}
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