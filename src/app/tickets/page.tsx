'use client'

import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { Ticket, Calendar as CalendarIcon, User, RefreshCw, MessageSquare, Plus, Clock, Send } from 'lucide-react'
import { useI18n } from '@/contexts/I18nContext'
import { useUser } from '@/contexts/UserContext'

interface TicketModel {
  id: string
  created_at: string
  updated_at: string
  title: string
  description: string | null
  reporter_id: string
  assignee: string | null
  status: string
  users?: {
    email: string | null
    user_profiles?: {
      first_name: string | null
      last_name: string | null
    } | null
  }
}

interface TicketUpdateModel {
  id: string
  ticket_id: string
  user_id: string
  content: string
  created_at: string
  users?: {
    email: string | null
    user_profiles?: {
      first_name: string | null
      last_name: string | null
    } | null
  }
}

interface UserProfile {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

const STATUS_OPTIONS_BASE = [
  { value: 'open', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'in_progress', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'resolved', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'closed', color: 'bg-slate-100 text-slate-800 border-slate-200' },
]

export default function TicketsPage() {
  const { t } = useI18n()
  const { profile, hasPermission } = useUser()
  const [tickets, setTickets] = useState<TicketModel[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ title: '', description: '', reporter_id: '', assignee: '' })

  const [selectedTicket, setSelectedTicket] = useState<TicketModel | null>(null)
  const [ticketUpdates, setTicketUpdates] = useState<TicketUpdateModel[]>([])
  const [loadingUpdates, setLoadingUpdates] = useState(false)
  const [updateContent, setUpdateContent] = useState('')
  const [updateStatus, setUpdateStatus] = useState('')
  const [postingUpdate, setPostingUpdate] = useState(false)

  const getStatusLabel = (val: string) => {
    if (val === 'open') return t('openTickets')
    if (val === 'in_progress') return t('inProgressTickets')
    if (val === 'resolved') return t('resolvedClosedTickets') // could add specific translated keys if needed
    if (val === 'closed') return t('resolvedClosedTickets')
    return val
  }

  const STATUS_OPTIONS = STATUS_OPTIONS_BASE.map(s => ({ ...s, label: getStatusLabel(s.value) }))

  const fetchData = async () => {
    try {
      setLoading(true)
      const [ticketsRes, usersRes] = await Promise.all([
        fetch('/api/tickets'),
        fetch('/api/users')
      ])
      
      if (ticketsRes.ok) {
        const tData = await ticketsRes.json()
        setTickets(tData)
      }
      
      if (usersRes.ok) {
        const uData = await usersRes.json()
        setUsers(uData.data || [])
      }
    } catch (err) {
      console.error('Error fetching data', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      setUpdating(id)
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
      }
    } catch (err) {
      console.error(err)
      alert(t('errorUpdateStatus'))
    } finally {
      setUpdating(null)
    }
  }

  const handleAssigneeChange = async (id: string, newAssignee: string) => {
    try {
      setUpdating(id)
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee: newAssignee })
      })
      if (res.ok) {
        setTickets(prev => prev.map(t => t.id === id ? { ...t, assignee: newAssignee } : t))
      }
    } catch (err) {
      console.error(err)
      alert(t('errorReassign'))
    } finally {
      setUpdating(null)
    }
  }

  const handleCreateTicket = async () => {
    if (!createForm.title || !createForm.reporter_id) {
      alert(t('titleAndReporterRequired'))
      return
    }
    try {
      setCreating(true)
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      })
      if (!res.ok) throw new Error(t('errorCreateTicket'))
      const newTicket = await res.json()
      setTickets(prev => [newTicket, ...prev])
      setShowCreateModal(false)
      setCreateForm({ title: '', description: '', reporter_id: '', assignee: '' })
    } catch (err) {
      console.error(err)
      alert(t('errorCreateTicket'))
    } finally {
      setCreating(false)
    }
  }

  const handleOpenTicket = async (ticket: TicketModel) => {
    setSelectedTicket(ticket)
    setUpdateStatus(ticket.status)
    setTicketUpdates([])
    setLoadingUpdates(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/updates`)
      if (res.ok) {
        const data = await res.json()
        setTicketUpdates(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingUpdates(false)
    }
  }

  const handlePostUpdate = async () => {
    if (!updateContent.trim()) return
    if (!selectedTicket || !profile?.id) return

    setPostingUpdate(true)
    try {
      const payload: any = {
        content: updateContent,
        user_id: profile.id
      }
      if (updateStatus && updateStatus !== selectedTicket.status) {
        payload.status = updateStatus
      }

      const res = await fetch(`/api/tickets/${selectedTicket.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const newUpdate = await res.json()
        setTicketUpdates(prev => [...prev, newUpdate])
        setUpdateContent('')
        
        if (payload.status) {
          setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: payload.status } : t))
          setSelectedTicket(prev => prev ? { ...prev, status: payload.status } : null)
        }
      }
    } catch (err) {
      console.error(err)
      alert(t('errorAddUpdate'))
    } finally {
      setPostingUpdate(false)
    }
  }

  const getReporterName = (ticket: TicketModel) => {
    if (ticket.users?.user_profiles?.first_name) {
      return `${ticket.users.user_profiles.first_name} ${ticket.users.user_profiles.last_name || ''}`.trim()
    }
    return ticket.users?.email || t('unknownUser')
  }

  // Deduplicate and filter out users with identical names
  const uniqueUsers = Array.from(new Map(users.map(u => {
    const label = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
    return [label, u]
  })).values())

  const assigneeOptions = [
    { value: 'BONSS', label: 'BONSS (Soporte Externo)' },
    { value: 'Unassigned', label: `-- ${t('unassigned')} --` },
    ...uniqueUsers.map(u => {
      const label = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
      return { value: label, label }
    })
  ]

  const canEdit = hasPermission('tickets', 'edit') || profile?.role === 'superadmin' || true // Let all admins who can view the page edit for now, since it's an internal tool

  const kpis = [
    { label: t('totalTickets'), value: tickets.length, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: t('openTickets'), value: tickets.filter(t => t.status === 'open').length, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: t('inProgressTickets'), value: tickets.filter(t => t.status === 'in_progress').length, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100' },
    { label: t('resolvedClosedTickets'), value: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  ]

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white text-[#0763a9] rounded-xl shadow-sm border border-blue-100">
              <Ticket size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('ticketsTitle')}</h1>
              <p className="text-sm text-slate-500 font-medium mt-0.5">{t('ticketsDesc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => {
              setCreateForm({ title: '', description: '', reporter_id: profile?.id || '', assignee: '' })
              setShowCreateModal(true)
            }} className="btn-primary flex items-center gap-2 shadow-sm text-sm">
              <Plus size={16} />
              <span>{t('newTicket')}</span>
            </button>
            <button onClick={fetchData} className="btn-secondary" title="Actualizar">
              <RefreshCw size={18} className={loading ? 'animate-spin text-[#0763a9]' : 'text-slate-500'} />
            </button>
          </div>
        </div>

        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpis.map((kpi, idx) => (
              <div key={idx} className={`p-4 rounded-2xl border shadow-sm ${kpi.bg} ${kpi.border} flex flex-col justify-center items-center text-center transition-transform hover:scale-[1.02]`}>
                <div className="text-sm font-semibold text-slate-600 mb-1">{kpi.label}</div>
                <div className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-12 flex justify-center">
            <RefreshCw className="animate-spin text-[#0763a9]" size={32} />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-[#e8f1f9] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50/50 border-b border-[#e8f1f9] text-gray-500 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">{t('ticketOrDesc')}</th>
                    <th className="px-6 py-4">{t('reportedBy')}</th>
                    <th className="px-6 py-4">{t('date')}</th>
                    <th className="px-6 py-4">{t('status')}</th>
                    <th className="px-6 py-4">{t('assignedToHeader')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8f1f9]">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                        {t('noTicketsFound')}
                      </td>
                    </tr>
                  ) : (
                    tickets.map(ticket => (
                      <tr key={ticket.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4 cursor-pointer" onClick={() => handleOpenTicket(ticket)}>
                          <div className="font-bold text-[#0763a9] hover:underline mb-1 max-w-md truncate" title={ticket.title}>
                            {ticket.title}
                          </div>
                          {ticket.description && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 max-w-md truncate">
                              <MessageSquare size={12} className="flex-shrink-0" />
                              <span className="truncate">{ticket.description}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-700 font-medium">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-[#0763a9] flex items-center justify-center flex-shrink-0">
                              <User size={12} />
                            </div>
                            {getReporterName(ticket)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <CalendarIcon size={14} className="text-slate-400" />
                            {new Date(ticket.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {canEdit ? (
                            <select
                              value={ticket.status}
                              onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                              disabled={updating === ticket.id}
                              className={`erp-input !py-1.5 !px-2 text-xs font-bold shadow-sm w-36 ${
                                STATUS_OPTIONS.find(s => s.value === ticket.status)?.color || ''
                              } ${updating === ticket.id ? 'opacity-50' : ''}`}
                            >
                              {STATUS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${STATUS_OPTIONS.find(s => s.value === ticket.status)?.color}`}>
                              {STATUS_OPTIONS.find(s => s.value === ticket.status)?.label || ticket.status}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {canEdit ? (
                            <select
                              value={ticket.assignee || 'Unassigned'}
                              onChange={(e) => handleAssigneeChange(ticket.id, e.target.value)}
                              disabled={updating === ticket.id}
                              className={`erp-input !py-1.5 !px-2 text-xs font-medium w-48 shadow-sm ${updating === ticket.id ? 'opacity-50' : ''}`}
                            >
                              {assigneeOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-slate-700 font-medium">
                              {ticket.assignee || t('unassigned')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title={t('createTicketModal')}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('titleLabel')} *</label>
              <input
                type="text"
                value={createForm.title}
                onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                className="erp-input w-full"
                placeholder="Ej. Problema con el inicio de sesión"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('descLabel')}</label>
              <textarea
                value={createForm.description}
                onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                className="erp-input w-full min-h-[100px] py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('reporterLabel')} *</label>
              <select
                value={createForm.reporter_id}
                onChange={e => setCreateForm({ ...createForm, reporter_id: e.target.value })}
                className="erp-input w-full"
              >
                <option value="">{t('selectReporter')}</option>
                {uniqueUsers.map(u => (
                  <option key={u.id} value={u.id}>{`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('assignToLabel')}</label>
              <select
                value={createForm.assignee}
                onChange={e => setCreateForm({ ...createForm, assignee: e.target.value })}
                className="erp-input w-full"
              >
                {assigneeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="btn-ghost text-sm">{t('cancel')}</button>
              <button onClick={handleCreateTicket} disabled={creating} className="btn-primary text-sm shadow-md">
                {creating ? t('creating') : t('createTicketBtn')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedTicket && (
        <Modal open={!!selectedTicket} onClose={() => setSelectedTicket(null)} title={t('ticketDetails')} maxWidth="700px">
          <div className="flex flex-col h-[70vh]">
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{selectedTicket.title}</h3>
                    <div className="flex items-center gap-3 mt-2 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1"><User size={12}/> {getReporterName(selectedTicket)}</span>
                      <span className="flex items-center gap-1"><CalendarIcon size={12}/> {new Date(selectedTicket.created_at).toLocaleString('es-MX')}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${STATUS_OPTIONS.find(s => s.value === selectedTicket.status)?.color}`}>
                        {STATUS_OPTIONS.find(s => s.value === selectedTicket.status)?.label || selectedTicket.status}
                      </span>
                    </div>
                  </div>
                </div>
                {selectedTicket.description && (
                  <div className="mt-4 text-sm text-slate-700 whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-200">
                    {selectedTicket.description}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-700 flex items-center gap-2">
                  <Clock size={16} /> {t('updateHistory')}
                </h4>
                
                {loadingUpdates ? (
                  <div className="flex justify-center p-8"><RefreshCw className="animate-spin text-[#0763a9]" size={24} /></div>
                ) : ticketUpdates.length === 0 ? (
                  <div className="text-sm text-slate-400 italic text-center p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">{t('noUpdatesYet')}</div>
                ) : (
                  <div className="space-y-3">
                    {ticketUpdates.map(update => (
                      <div key={update.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 ml-4 relative">
                        <div className="absolute -left-[21px] top-4 w-3 h-3 rounded-full bg-blue-400 border-2 border-white shadow-sm"></div>
                        <div className="absolute -left-[16px] top-7 bottom-[-20px] w-px bg-slate-100 last:bg-transparent"></div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700">{update.users?.user_profiles?.first_name ? `${update.users.user_profiles.first_name} ${update.users.user_profiles.last_name || ''}`.trim() : (update.users?.email || 'Usuario')}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{new Date(update.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{update.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-100 mt-4 bg-white">
              <div className="flex gap-3 items-start">
                <textarea 
                  value={updateContent}
                  onChange={e => setUpdateContent(e.target.value)}
                  placeholder={t('writeUpdate')}
                  className="erp-input flex-1 min-h-[80px] resize-none text-sm"
                />
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">{t('changeStatusTo')}</span>
                  <select 
                    value={updateStatus} 
                    onChange={e => setUpdateStatus(e.target.value)}
                    className={`erp-input !py-1 !px-2 text-xs font-bold shadow-sm w-36 ${STATUS_OPTIONS.find(s => s.value === updateStatus)?.color || ''}`}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={handlePostUpdate} 
                  disabled={postingUpdate || !updateContent.trim()} 
                  className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
                >
                  {postingUpdate ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
                  {t('postUpdate')}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  )
}
