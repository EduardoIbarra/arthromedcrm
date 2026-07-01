'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import { useUser } from '@/contexts/UserContext'
import {
  Plus, X, GripVertical, MessageSquare, Clock, User, ChevronRight,
  Loader2, Send, Pencil, Check, Trash2, Users, LayoutGrid
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KanbanColumn {
  id: string
  name: string
  position: number
  color: string
}

interface KanbanClient {
  id: string
  name: string
  phone: string | null
  email_contact: string | null
  status: string
  assigned_to: string | null
  last_contact_at: string | null
  avatar_url: string | null
  states: string[]
  specialties: string[]
  kanban_column_id: string | null
}

interface HistoryEntry {
  id: string
  from_column_name: string | null
  to_column_name: string
  moved_by_name: string | null
  note: string | null
  created_at: string
}

interface Comment {
  id: string
  author_name: string | null
  content: string
  created_at: string
}

interface StaffUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  'Activo': '#10b981',
  'Inactivo': '#ef4444',
  'Nuevo Prospecto': '#6366f1',
  'Contactado': '#3b82f6',
  'Calificado': '#f59e0b',
  'Negociación': '#f97316',
  'Perdido': '#6b7280',
}

const COLUMN_COLORS = [
  '#6366f1', '#3b82f6', '#0763a9', '#10b981',
  '#f59e0b', '#f97316', '#ef4444', '#8b5cf6',
]

function Avatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  if (url) return <img src={url} alt={name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-white"
      style={{ width: size, height: size, background: '#0763a9', fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  )
}

// ─── Card Slide-Over ──────────────────────────────────────────────────────────

function ClientSlideOver({
  client,
  columns,
  staffUsers,
  onClose,
  currentUserId,
  currentUserName,
  onUpdateClient,
}: {
  client: KanbanClient
  columns: KanbanColumn[]
  staffUsers: StaffUser[]
  onClose: () => void
  currentUserId: string
  currentUserName: string
  onUpdateClient: (clientId: string, updates: Partial<KanbanClient>) => void
}) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [posting, setPosting] = useState(false)
  const [tab, setTab] = useState<'history' | 'comments'>('history')
  const commentEndRef = useRef<HTMLDivElement>(null)

  const [assigneeId, setAssigneeId] = useState(client.assigned_to || '')
  const [updatingAssignee, setUpdatingAssignee] = useState(false)

  const handleAssigneeChange = async (newId: string) => {
    setAssigneeId(newId)
    setUpdatingAssignee(true)
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: newId || null }),
      })
      if (res.ok) {
        onUpdateClient(client.id, { assigned_to: newId || null })
      } else {
        const err = await res.json()
        alert(`Error al asignar: ${err.error || 'error desconocido'}`)
      }
    } catch (e) {
      console.error(e)
      alert('Error de red al asignar')
    } finally {
      setUpdatingAssignee(false)
    }
  }

  useEffect(() => {
    fetch(`/api/kanban/clients/${client.id}/column`)
      .then(r => r.json()).then(j => setHistory(j.data || []))
    fetch(`/api/kanban/comments?client_id=${client.id}`)
      .then(r => r.json()).then(j => setComments(j.data || []))
  }, [client.id])

  const postComment = async () => {
    if (!newComment.trim()) return
    setPosting(true)
    try {
      const res = await fetch('/api/kanban/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          author_id: currentUserId,
          author_name: currentUserName,
          content: newComment.trim(),
        }),
      })
      const json = await res.json()
      if (json.data) {
        setComments(prev => [...prev, json.data])
        setNewComment('')
        setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } finally {
      setPosting(false)
    }
  }

  const currentColumn = columns.find(c => c.id === client.kanban_column_id)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col shadow-2xl animate-slide-left" style={{ background: '#ffffff', borderLeft: '1px solid #d4e0ec' }}>
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-[#d4e0ec]">
          <Avatar name={client.name} url={client.avatar_url} size={40} />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-[#37383a] truncate text-base">{client.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              {currentColumn && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                  style={{ background: currentColumn.color }}
                >
                  {currentColumn.name}
                </span>
              )}
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: `${STATUS_COLORS[client.status] || '#6b7280'}20`,
                  color: STATUS_COLORS[client.status] || '#6b7280',
                }}
              >
                {client.status}
              </span>
            </div>
          </div>
          <Link href={`/clients/${client.id}`} target="_blank">
            <button className="btn-ghost p-1.5" title="Abrir perfil">
              <ChevronRight size={18} />
            </button>
          </Link>
          <button className="btn-ghost p-1.5" onClick={onClose} title="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Quick info */}
        <div className="px-5 py-3 border-b border-[#d4e0ec] grid grid-cols-2 gap-2 text-sm">
          {client.phone && (
            <div>
              <div className="text-[10px] font-medium text-[#8a8b8d] uppercase tracking-wide">Teléfono</div>
              <div className="text-[#37383a] font-medium truncate">{client.phone}</div>
            </div>
          )}
          {client.email_contact && (
            <div>
              <div className="text-[10px] font-medium text-[#8a8b8d] uppercase tracking-wide">Email</div>
              <div className="text-[#37383a] font-medium truncate">{client.email_contact}</div>
            </div>
          )}
          {client.last_contact_at && (
            <div>
              <div className="text-[10px] font-medium text-[#8a8b8d] uppercase tracking-wide">Último contacto</div>
              <div className="text-[#37383a] font-medium">{format(new Date(client.last_contact_at), 'dd MMM yyyy', { locale: es })}</div>
            </div>
          )}
          {client.states?.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-[#8a8b8d] uppercase tracking-wide">Estado</div>
              <div className="text-[#37383a] font-medium truncate">{client.states.join(', ')}</div>
            </div>
          )}
          <div>
            <div className="text-[10px] font-medium text-[#8a8b8d] uppercase tracking-wide">Asignado a</div>
            <select
              value={assigneeId}
              onChange={e => handleAssigneeChange(e.target.value)}
              disabled={updatingAssignee}
              className="bg-transparent text-xs rounded-lg border border-[#d4e0ec] px-2 py-1 text-[#37383a] focus:outline-none focus:border-[#0763a9] cursor-pointer hover:bg-gray-50 mt-1 w-full"
            >
              <option value="">Sin asignar</option>
              {staffUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#d4e0ec]">
          {(['history', 'comments'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                tab === t ? 'text-[#0763a9] border-b-2 border-[#0763a9]' : 'text-[#5a5b5d] hover:text-[#0763a9]'
              }`}
            >
              {t === 'history' ? <Clock size={14} /> : <MessageSquare size={14} />}
              {t === 'history' ? 'Historial' : `Comentarios (${comments.length})`}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'history' ? (
            history.length === 0 ? (
              <div className="text-center py-10 text-[#8a8b8d] text-sm">
                <Clock size={32} className="mx-auto mb-2 opacity-30" />
                Sin movimientos registrados
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-3.5 top-0 bottom-0 w-px bg-[#d4e0ec]" />
                <div className="space-y-4">
                  {history.map((entry, i) => (
                    <div key={entry.id} className="flex gap-3 relative">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${i === 0 ? 'bg-[#0763a9]' : 'bg-[#e8f1f9]'}`}>
                        <Clock size={12} className={i === 0 ? 'text-white' : 'text-[#0763a9]'} />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="text-sm text-[#37383a]">
                          {entry.from_column_name ? (
                            <>
                              Movido de <span className="font-semibold">{entry.from_column_name}</span>
                              {' → '}
                              <span className="font-semibold">{entry.to_column_name}</span>
                            </>
                          ) : (
                            <>Añadido a <span className="font-semibold">{entry.to_column_name}</span></>
                          )}
                        </div>
                        {entry.note && (
                          <div className="text-xs text-[#5a5b5d] mt-0.5 italic">"{entry.note}"</div>
                        )}
                        <div className="text-[11px] text-[#8a8b8d] mt-1 flex items-center gap-1">
                          <User size={10} />
                          {entry.moved_by_name || 'Sistema'}
                          <span className="mx-1">·</span>
                          {format(new Date(entry.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="space-y-4">
              {comments.length === 0 && (
                <div className="text-center py-8 text-[#8a8b8d] text-sm">
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                  Sin comentarios todavía
                </div>
              )}
              {comments.map(c => (
                <div key={c.id} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-xs" style={{ background: '#0763a9' }}>
                    {(c.author_name || 'U')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-[#37383a]">{c.author_name || 'Usuario'}</span>
                      <span className="text-[10px] text-[#8a8b8d]">{format(new Date(c.created_at), 'dd MMM HH:mm', { locale: es })}</span>
                    </div>
                    <div className="mt-0.5 text-sm text-[#37383a] bg-[#f0f5fa] rounded-xl rounded-tl-none px-3 py-2 leading-relaxed">
                      {c.content}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={commentEndRef} />
            </div>
          )}
        </div>

        {/* Comment input (only on comments tab) */}
        {tab === 'comments' && (
          <div className="p-4 border-t border-[#d4e0ec] flex gap-2">
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment()
              }}
              placeholder="Escribe un comentario… (⌘+Enter para enviar)"
              className="erp-input resize-none text-sm"
              rows={2}
              style={{ flex: 1, fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
            />
            <button
              onClick={postComment}
              disabled={posting || !newComment.trim()}
              className="btn-primary px-3 self-end"
              style={{ padding: '0.5rem 0.75rem' }}
            >
              {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Add Column Modal ─────────────────────────────────────────────────────────

function AddColumnModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (col: KanbanColumn) => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLUMN_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/kanban/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color }),
      })
      const json = await res.json()
      if (json.error) { setError(json.error); return }
      onAdd(json.data)
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={onClose} />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in"
        style={{ background: '#ffffff', border: '1px solid #d4e0ec' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-[#37383a] text-lg">Nueva columna</h3>
          <button className="btn-ghost p-1.5" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#5a5b5d] mb-1.5 uppercase tracking-wide">Nombre</label>
            <input
              autoFocus
              className="erp-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="Ej. Seguimiento, Propuesta…"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5a5b5d] mb-1.5 uppercase tracking-wide">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLUMN_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                  style={{ background: c, border: color === c ? `3px solid ${c}` : '3px solid transparent', outline: color === c ? '2px solid white' : 'none', outlineOffset: '1px' }}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
        <div className="flex gap-2 mt-6">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
          <button className="btn-primary flex-1" onClick={submit} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Crear columna
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Client Card ──────────────────────────────────────────────────────────────

function ClientCard({
  client,
  onDragStart,
  onDragEnd,
  onClick,
  isDragging,
  showAssignee,
  assigneeName,
}: {
  client: KanbanClient
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onClick: () => void
  isDragging: boolean
  showAssignee?: boolean
  assigneeName?: string | null
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="card card-hover cursor-grab active:cursor-grabbing select-none"
      style={{
        padding: '0.875rem',
        opacity: isDragging ? 0.4 : 1,
        transition: 'opacity 0.15s, box-shadow 0.15s, transform 0.15s',
      }}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={client.name} url={client.avatar_url} size={32} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[#37383a] text-sm leading-tight truncate">{client.name}</div>
          {client.phone && (
            <div className="text-xs text-[#5a5b5d] mt-0.5 truncate">{client.phone}</div>
          )}
          {client.email_contact && (
            <div className="text-xs text-[#8a8b8d] truncate">{client.email_contact}</div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: `${STATUS_COLORS[client.status] || '#6b7280'}18`,
            color: STATUS_COLORS[client.status] || '#6b7280',
          }}
        >
          {client.status}
        </span>
        {showAssignee && assigneeName && (
          <span className="text-[10px] text-[#0763a9] font-medium bg-[#e8f1f9] px-2 py-0.5 rounded-full truncate max-w-[120px]" title={`Responsable: ${assigneeName}`}>
            {assigneeName}
          </span>
        )}
        {client.last_contact_at && !showAssignee && (
          <span className="text-[10px] text-[#8a8b8d] flex items-center gap-0.5">
            <Clock size={9} />
            {format(new Date(client.last_contact_at), 'dd MMM', { locale: es })}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

function KanbanColumnComponent({
  column,
  clients,
  allColumns,
  draggedClientId,
  draggedColumnId,
  onCardDragStart,
  onCardDragEnd,
  onColumnDragStart,
  onColumnDragEnd,
  onDrop,
  onCardClick,
  onColumnDragOver,
  onRenameColumn,
  onDeleteColumn,
  showAssignee,
  staffUsers,
}: {
  column: KanbanColumn
  clients: KanbanClient[]
  allColumns: KanbanColumn[]
  draggedClientId: string | null
  draggedColumnId: string | null
  onCardDragStart: (clientId: string) => void
  onCardDragEnd: () => void
  onColumnDragStart: (colId: string) => void
  onColumnDragEnd: () => void
  onDrop: (columnId: string) => void
  onCardClick: (client: KanbanClient) => void
  onColumnDragOver: (e: React.DragEvent) => void
  onRenameColumn: (col: KanbanColumn) => void
  onDeleteColumn: (col: KanbanColumn) => void
  showAssignee?: boolean
  staffUsers?: StaffUser[]
}) {
  const [isOver, setIsOver] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState(column.name)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedClientId) setIsOver(true)
    if (draggedColumnId) onColumnDragOver(e)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(false)
    if (draggedClientId) onDrop(column.id)
  }

  const saveName = () => {
    if (editName.trim() && editName.trim() !== column.name) {
      onRenameColumn({ ...column, name: editName.trim() })
    }
    setEditingName(false)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      className="flex-shrink-0 flex flex-col rounded-2xl"
      style={{
        width: 280,
        background: isOver ? '#e8f1f9' : '#f0f5fa',
        border: `2px solid ${isOver ? column.color : 'transparent'}`,
        transition: 'border-color 0.15s, background 0.15s',
        opacity: draggedColumnId === column.id ? 0.5 : 1,
      }}
    >
      {/* Column header */}
      <div
        draggable
        onDragStart={e => { e.stopPropagation(); onColumnDragStart(column.id) }}
        onDragEnd={onColumnDragEnd}
        className="flex items-center gap-2 px-3 py-3 cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={14} className="text-[#8a8b8d] flex-shrink-0" />
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: column.color }}
        />
        {editingName ? (
          <input
            autoFocus
            className="flex-1 text-sm font-bold bg-white border border-[#0763a9] rounded-lg px-2 py-0.5 text-[#37383a] min-w-0"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setEditName(column.name); setEditingName(false) } }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm font-bold text-[#37383a] truncate">{column.name}</span>
        )}
        <span className="text-xs font-semibold text-[#8a8b8d] bg-white rounded-full px-2 py-0.5 flex-shrink-0">
          {clients.length}
        </span>
        <button
          className="btn-ghost p-1 opacity-0 group-hover:opacity-100 text-[#8a8b8d] hover:text-[#0763a9]"
          style={{ padding: '0.2rem', opacity: 0.5 }}
          onClick={e => { e.stopPropagation(); setEditingName(true) }}
          title="Renombrar"
        >
          <Pencil size={12} />
        </button>
        <button
          className="btn-ghost p-1 text-[#8a8b8d] hover:text-red-500"
          style={{ padding: '0.2rem', opacity: 0.5 }}
          onClick={e => { e.stopPropagation(); onDeleteColumn(column) }}
          title="Eliminar columna"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 px-2 pb-3 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        {clients.length === 0 && (
          <div
            className="flex items-center justify-center rounded-xl border-2 border-dashed text-xs text-[#8a8b8d] py-8"
            style={{ borderColor: isOver ? column.color : '#d4e0ec' }}
          >
            Arrastra una tarjeta aquí
          </div>
        )}
        {clients.map(client => (
          <ClientCard
            key={client.id}
            client={client}
            isDragging={draggedClientId === client.id}
            onDragStart={e => { e.dataTransfer.setData('text/plain', client.id); onCardDragStart(client.id) }}
            onDragEnd={onCardDragEnd}
            onClick={() => onCardClick(client)}
            showAssignee={showAssignee}
            assigneeName={staffUsers?.find(u => u.id === client.assigned_to)?.first_name || 'Sin asignar'}
          />
        )) }
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClientesKanban() {
  const { profile } = useUser()
  const isSuperAdmin = profile?.role === 'superadmin'

  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [clients, setClients] = useState<KanbanClient[]>([])
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)

  const [draggedClientId, setDraggedClientId] = useState<string | null>(null)
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null)
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null)

  const [selectedClient, setSelectedClient] = useState<KanbanClient | null>(null)
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [showAllClients, setShowAllClients] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<string>('')

  // Load columns and staff users
  useEffect(() => {
    fetch('/api/kanban/columns')
      .then(r => r.json())
      .then(j => setColumns(j.data || []))
    fetch('/api/cirugias/usuarios')
      .then(r => r.json())
      .then(j => setStaffUsers(j.data || []))
  }, [])

  // Load clients
  const fetchClients = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (showAllClients && isSuperAdmin) {
        params.set('all', 'true')
        if (selectedStaff) params.set('assigned_to', selectedStaff)
      } else {
        params.set('assigned_to', profile.id)
      }
      const res = await fetch(`/api/kanban/clients?${params}`)
      const json = await res.json()
      setClients(json.data || [])
    } finally {
      setLoading(false)
    }
  }, [profile, showAllClients, selectedStaff, isSuperAdmin])

  useEffect(() => { fetchClients() }, [fetchClients])

  // ── Card drag & drop ──
  const handleCardDrop = async (targetColumnId: string) => {
    if (!draggedClientId) return

    const targetId = draggedClientId
    setDraggedClientId(null) // clear immediately to fix transparency stuck bug

    const client = clients.find(c => c.id === targetId)
    if (!client || client.kanban_column_id === targetColumnId) return

    // Optimistic update
    setClients(prev =>
      prev.map(c => c.id === targetId ? { ...c, kanban_column_id: targetColumnId } : c)
    )

    // Persist
    await fetch(`/api/kanban/clients/${targetId}/column`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        column_id: targetColumnId,
        moved_by: profile?.id,
        moved_by_name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email,
      }),
    })

    // Refresh selected client if open
    if (selectedClient?.id === targetId) {
      setSelectedClient(prev => prev ? { ...prev, kanban_column_id: targetColumnId } : null)
    }
  }

  // ── Column drag & drop ──
  const handleColumnDrop = async (targetColumnId: string) => {
    if (!draggedColumnId || draggedColumnId === targetColumnId) return

    const dragged = columns.find(c => c.id === draggedColumnId)
    const target = columns.find(c => c.id === targetColumnId)
    if (!dragged || !target) return

    // Reorder: swap positions
    const newCols = columns.map(c => {
      if (c.id === draggedColumnId) return { ...c, position: target.position }
      if (c.id === targetColumnId) return { ...c, position: dragged.position }
      return c
    }).sort((a, b) => a.position - b.position)

    setColumns(newCols)

    await fetch('/api/kanban/columns/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: newCols.map(c => ({ id: c.id, position: c.position })) }),
    })
  }

  // ── Rename column ──
  const handleRenameColumn = async (col: KanbanColumn) => {
    setColumns(prev => prev.map(c => c.id === col.id ? { ...c, name: col.name } : c))
    await fetch(`/api/kanban/columns/${col.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: col.name }),
    })
  }

  // ── Delete column ──
  const handleDeleteColumn = async (col: KanbanColumn) => {
    const count = clients.filter(c => c.kanban_column_id === col.id).length
    if (count > 0) {
      alert(`No se puede eliminar: hay ${count} cliente(s) en esta columna.`)
      return
    }
    if (!confirm(`¿Eliminar la columna "${col.name}"?`)) return
    const res = await fetch(`/api/kanban/columns/${col.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.error) { alert(json.error); return }
    setColumns(prev => prev.filter(c => c.id !== col.id))
  }

  // Group clients by column (unassigned → first column)
  const firstColumn = columns[0]
  const clientsByColumn: Record<string, KanbanClient[]> = {}
  columns.forEach(col => { clientsByColumn[col.id] = [] })
  clients.forEach(client => {
    const colId = client.kanban_column_id || firstColumn?.id
    if (colId && clientsByColumn[colId] !== undefined) {
      clientsByColumn[colId].push(client)
    }
  })

  const currentUserName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || 'Usuario'

  return (
    <AppShell>
      <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - 100px)' }}>
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <LayoutGrid size={20} className="text-[#0763a9]" />
              <h1 className="text-2xl font-bold" style={{ color: '#37383a' }}>Kanban Clientes</h1>
            </div>
            <p className="text-sm text-[#5a5b5d] mt-0.5">
              {clients.length} cliente{clients.length !== 1 ? 's' : ''} · {columns.length} columna{columns.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
            {/* Superadmin controls */}
            {isSuperAdmin && (
              <>
                <button
                  onClick={() => setShowAllClients(v => !v)}
                  className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                    showAllClients
                      ? 'bg-[#0763a9] text-white border-[#0763a9]'
                      : 'bg-white text-[#5a5b5d] border-[#d4e0ec] hover:border-[#0763a9] hover:text-[#0763a9]'
                  }`}
                >
                  <Users size={14} />
                  {showAllClients ? 'Todos los clientes' : 'Mis clientes'}
                </button>
                {showAllClients && (
                  <select
                    value={selectedStaff}
                    onChange={e => setSelectedStaff(e.target.value)}
                    className="erp-input text-sm"
                    style={{ width: 'auto', padding: '0.4rem 0.75rem' }}
                  >
                    <option value="">Todos los staff</option>
                    {staffUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}

            <button
              onClick={() => setShowAddColumn(true)}
              className="btn-primary text-sm"
              style={{ padding: '0.5rem 1rem' }}
            >
              <Plus size={15} />
              Nueva columna
            </button>
          </div>
        </div>

        {/* ── Board ── */}
        {loading ? (
          <div className="flex items-center justify-center flex-1 py-20">
            <Loader2 size={32} className="animate-spin text-[#0763a9]" />
          </div>
        ) : (
          <div
            className="flex gap-4 overflow-x-auto pb-6 flex-1"
            style={{ alignItems: 'flex-start' }}
          >
             {columns.map(col => (
              <KanbanColumnComponent
                key={col.id}
                column={col}
                allColumns={columns}
                clients={clientsByColumn[col.id] || []}
                draggedClientId={draggedClientId}
                draggedColumnId={draggedColumnId}
                onCardDragStart={setDraggedClientId}
                onCardDragEnd={() => setDraggedClientId(null)}
                onColumnDragStart={setDraggedColumnId}
                onColumnDragEnd={() => { setDraggedColumnId(null); setDragOverColumnId(null) }}
                onDrop={handleCardDrop}
                onCardClick={setSelectedClient}
                onColumnDragOver={e => {
                  if (draggedColumnId && draggedColumnId !== col.id) {
                    handleColumnDrop(col.id)
                  }
                }}
                onRenameColumn={handleRenameColumn}
                onDeleteColumn={handleDeleteColumn}
                showAssignee={showAllClients}
                staffUsers={staffUsers}
              />
            ))}

            {/* Add column ghost */}
            <button
              onClick={() => setShowAddColumn(true)}
              className="flex-shrink-0 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#d4e0ec] text-[#8a8b8d] hover:border-[#0763a9] hover:text-[#0763a9] transition-colors"
              style={{ width: 200, minHeight: 120, background: 'transparent' }}
            >
              <Plus size={20} />
              <span className="text-sm font-medium">Agregar columna</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Slide-over ── */}
      {selectedClient && (
        <ClientSlideOver
          client={selectedClient}
          columns={columns}
          staffUsers={staffUsers}
          onClose={() => setSelectedClient(null)}
          currentUserId={profile?.id || ''}
          currentUserName={currentUserName}
          onUpdateClient={(clientId, updates) => setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...updates } : c))}
        />
      )}

      {/* ── Add column modal ── */}
      {showAddColumn && (
        <AddColumnModal
          onClose={() => setShowAddColumn(false)}
          onAdd={col => setColumns(prev => [...prev, col].sort((a, b) => a.position - b.position))}
        />
      )}
    </AppShell>
  )
}
