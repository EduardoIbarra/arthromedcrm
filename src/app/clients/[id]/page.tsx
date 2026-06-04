'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import StatusBadge from '@/components/StatusBadge'
import Modal from '@/components/Modal'
import { useI18n } from '@/contexts/I18nContext'
import { Client, ClientActivity } from '@/types/database'
import {
  Phone, Mail, MapPin, Building2, FileText, Edit3, Save, X,
  MessageCircle, Bot, ChevronLeft, Trash2, Plus, Tag, Loader2, CheckCircle, Upload, Calendar
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { es, enUS, zhCN } from 'date-fns/locale'
import { Locale } from '@/lib/i18n'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import PermissionGuard from '@/components/PermissionGuard'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const formatCurrency = (amount: number, compact = false) => {
  const num = typeof amount === 'number' ? amount : parseFloat(amount as any) || 0
  const absNum = Math.abs(num)
  if (compact && absNum >= 1000000) {
    return `${num < 0 ? '-' : ''}$${(absNum / 1000000).toFixed(2)}M`
  }
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(num)
}

const formatChartTick = (val: number) => {
  const absVal = Math.abs(val)
  if (absVal >= 1000000) {
    return `${val < 0 ? '-' : ''}$${(absVal / 1000000).toFixed(2)}M`
  }
  return `${val < 0 ? '-' : ''}$${(absVal / 1000).toFixed(0)}k`
}

const dfLocales: Record<Locale, typeof es> = { es, en: enUS, zh: zhCN }

const ACTIVITY_ICON: Record<string, string> = {
  whatsapp: '💬', llamada: '📞', email: '📧', nota: '📝', visita: '🤝', sistema: '⚙️'
}
const ACTIVITY_COLOR: Record<string, string> = {
  whatsapp: '#15803d', llamada: '#0763a9', email: '#b45309',
  nota: '#5a5b5d', visita: '#6d28d9', sistema: '#8a8b8d'
}

const WA_TEMPLATES = [
  { id: 'lead_generic_followup', label: 'Seguimiento General' },
  { id: 'lead_onboarding_distributor', label: 'Bienvenida Distribuidor' },
  { id: 'lead_referral_doctor', label: 'Referido por Doctor' },
]

const MEXICAN_STATES = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas',
  'Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Estado de México',
  'Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán','Morelos','Nayarit',
  'Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí',
  'Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas',
]

const CARD = { background: '#ffffff', border: '1px solid #d4e0ec' }

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t, locale } = useI18n()
  const dfLocale = dfLocales[locale] ?? es

  const [client, setClient] = useState<Client | null>(null)
  const [activities, setActivities] = useState<ClientActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<Client>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sales, setSales] = useState<any[]>([])
  const [loadingSales, setLoadingSales] = useState(true)

  const clientYearlyMap = sales.reduce((acc, curr) => {
    const yr = curr.anio
    acc[yr] = (acc[yr] || 0) + Number(curr.monto || 0)
    return acc
  }, {} as Record<number, number>)

  const clientYearlyData = Object.entries(clientYearlyMap).map(([year, value]) => ({
    name: String(year),
    value
  })).sort((a, b) => a.name.localeCompare(b.name))

  const [showWA, setShowWA] = useState(false)
  const [waTemplate, setWaTemplate] = useState(WA_TEMPLATES[0].id)
  const [waSending, setWaSending] = useState(false)
  const [waResult, setWaResult] = useState<'ok' | 'err' | null>(null)

  const [showNote, setShowNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteType, setNoteType] = useState('nota')
  const [addingNote, setAddingNote] = useState(false)

  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const [staffUsers, setStaffUsers] = useState<any[]>([])

  const [showCongressWA, setShowCongressWA] = useState(false)
  const [congressLink, setCongressLink] = useState('https://bonss.com.mx/catalogo')
  const [congressSenderName, setCongressSenderName] = useState('Equipo Arthromed')
  const [congressSending, setCongressSending] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setLoadingSales(true)
        const [cRes, aRes, sRes, staffRes] = await Promise.all([
          fetch(`/api/clients/${id}`),
          fetch(`/api/clients/${id}/activities`),
          fetch(`/api/ventas?cliente_id=${id}`),
          fetch('/api/users')
        ])
        const cJson = await cRes.json()
        const aJson = await aRes.json()
        const staffJson = await staffRes.json()
        
        setClient(cJson.data)
        setEditData(cJson.data)
        setActivities(aJson.data || [])
        setStaffUsers(staffJson.data || [])
        
        if (sRes.ok) {
          const sJson = await sRes.json()
          setSales(sJson.data || [])
        }
      } catch (err) {
        console.error('Error loading client detail data:', err)
      } finally { 
        setLoading(false)
        setLoadingSales(false)
      }
    }
    load()
  }, [id])

  const hasBeenContactedViaWA = activities.some(a => a.type === 'whatsapp')

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/clients/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editData) })
    const json = await res.json()
    setClient(json.data); setSaving(false); setEditing(false)
  }

  const sendWA = async () => {
    if (!client?.phone) return
    setWaSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: client.whatsapp_phone || client.phone, template: waTemplate }) })
      setWaResult(res.ok ? 'ok' : 'err')
      if (res.ok) {
        await fetch(`/api/clients/${id}/activities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'whatsapp', content: `Plantilla enviada: ${waTemplate}` }) })
        const aRes = await fetch(`/api/clients/${id}/activities`)
        setActivities((await aRes.json()).data || [])
      }
    } finally { setWaSending(false) }
  }

  const sendCongressWA = async () => {
    if (!client?.phone) return
    setCongressSending(true)
    try {
      const components: any[] = [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: client.name || 'Doctor' },
            { type: 'text', text: congressSenderName }
          ]
        }
      ]
      
      // Si decidieron usar un botón con URL dinámica en Meta, añadimos el componente del botón
      if (congressLink) {
        // Asumiendo que configuraron el botón como dinámico (ej. url base https:// y el resto es la variable)
        // Meta requiere que los botones dinámicos pasen su variable.
        // Si el botón es estático en Meta, esto podría sobrar o ser ignorado.
        components.push({
          type: 'buttons',
          buttons: [
            {
              type: 'url',
              text: 'Ver Información',
              url: 'https://erp.arthromed.com.mx/{{1}}',
              parameters: [
                { type: 'text', text: congressLink.split('/congresos/')[1] ? 'congresos/' + congressLink.split('/congresos/')[1].replace(/[()]/g, c => '%' + c.charCodeAt(0).toString(16)) : congressLink }
              ]
            }
          ]
        })
      }

      const res = await fetch('/api/whatsapp/send', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          to: client.whatsapp_phone || client.phone, 
          template: 'congress_welcome_custom', 
          components 
        }) 
      })
      if (res.ok) {
        await fetch(`/api/clients/${id}/activities`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ type: 'whatsapp', content: `Plantilla Bienvenida Congreso enviada` }) 
        })
        const aRes = await fetch(`/api/clients/${id}/activities`)
        setActivities((await aRes.json()).data || [])
        setShowCongressWA(false)
      } else {
        alert('Error al enviar mensaje')
      }
    } catch (e) {
      alert('Error al enviar mensaje')
    } finally { 
      setCongressSending(false) 
    }
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    setAddingNote(true)
    await fetch(`/api/clients/${id}/activities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: noteType, content: noteText }) })
    const aRes = await fetch(`/api/clients/${id}/activities`)
    setActivities((await aRes.json()).data || [])
    setNoteText(''); setShowNote(false); setAddingNote(false)
  }

  const getAI = async () => {
    setAiLoading(true); setShowAI(true)
    const res = await fetch('/api/ai/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: id }) })
    const json = await res.json()
    setAiSummary(json.summary || json.error); setAiLoading(false)
  }

  const deleteClient = async () => {
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    router.push('/clients')
  }

  const field = (key: keyof Client) => editing
    ? <input className="erp-input text-sm" value={(editData[key] as string) || ''} onChange={e => setEditData(p => ({ ...p, [key]: e.target.value }))} />
    : <p className="text-sm" style={{ color: '#37383a' }}>{(client?.[key] as string) || <span style={{ color: '#c4c5c7', fontStyle: 'italic' }}>—</span>}</p>

  const arrayField = (key: keyof Client) => {
    const val = (client?.[key] as string[])?.join(', ') || ''
    return editing
      ? <input className="erp-input text-sm" value={(editData[key] as string[])?.join(', ') || val} onChange={e => setEditData(p => ({ ...p, [key]: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
      : <p className="text-sm" style={{ color: '#37383a' }}>{val || <span style={{ color: '#c4c5c7', fontStyle: 'italic' }}>—</span>}</p>
  }

  const dateField = (key: keyof Client) => {
    const val = client?.[key] as string
    return editing
      ? <input type="date" className="erp-input text-sm" value={(editData[key] as string)?.split('T')[0] || ''} onChange={e => setEditData(p => ({ ...p, [key]: e.target.value }))} />
      : <p className="text-sm" style={{ color: '#37383a' }}>{val ? format(new Date(val), 'd MMM yyyy', { locale: dfLocale }) : <span style={{ color: '#c4c5c7', fontStyle: 'italic' }}>—</span>}</p>
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'pdf'
      const fileName = `carta_${id}_${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('documents').upload(`distribuidores/${fileName}`, file)
      if (error) throw error
      const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(data.path)
      setEditData(p => ({ ...p, letter_url: publicUrlData.publicUrl }))
    } catch (err) {
      console.error(err)
      alert('Error al subir el archivo. Asegúrate de que el bucket "documents" exista en Supabase y sea público.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return (
    <AppShell>
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0763a9', borderTopColor: 'transparent' }} />
      </div>
    </AppShell>
  )

  if (!client) return (
    <AppShell>
      <div className="text-center py-20" style={{ color: '#5a5b5d' }}>
        <p>Cliente no encontrado</p>
        <Link href="/clients" className="btn-secondary mt-4 inline-flex">{t('back')}</Link>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Back + Actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link href="/clients" className="btn-ghost text-sm"><ChevronLeft size={16} /> {t('back')}</Link>
          <div className="flex gap-2 flex-wrap">
            <button onClick={getAI} className="btn-secondary text-sm"><Bot size={15} /> {t('aiSummary')}</button>
            <PermissionGuard section="clients" action="edit">
              <button onClick={() => {
                const cId = client?.tags?.find((t: any) => typeof t === 'string' && t.startsWith('congreso:'))?.split(':')[1]
                const isDoctor = client?.tags?.some((t: any) => typeof t === 'string' && (t.toLowerCase() === 'médico' || t.toLowerCase() === 'medico'))
                const title = isDoctor ? 'Dr. ' : ''
                if (cId) {
                  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://arthromed.com'
                  setCongressLink(`${origin}/congresos/${cId}/landing?greeting=${encodeURIComponent('Hola ' + title + client.name)}`)
                }
                setShowCongressWA(true)
              }} className="btn-secondary text-sm" style={{ borderColor: '#0763a9', color: '#0763a9' }}>
                <MessageCircle size={15} /> Bienvenida Congreso
              </button>
              <button onClick={() => setShowWA(true)} className="btn-secondary text-sm">
                <MessageCircle size={15} /> {t('sendWhatsApp')}
              </button>
              <button onClick={() => setShowNote(true)} className="btn-secondary text-sm"><Plus size={15} /> {t('addNote')}</button>
            </PermissionGuard>
            {editing ? (
              <>
                <button onClick={save} disabled={saving} className="btn-primary text-sm">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {t('saveChanges')}
                </button>
                <button onClick={() => { setEditing(false); setEditData(client) }} className="btn-ghost text-sm"><X size={15} /> {t('cancel')}</button>
              </>
            ) : (
              <PermissionGuard section="clients" action="edit">
                <button onClick={() => setEditing(true)} className="btn-primary text-sm"><Edit3 size={15} /> {t('editClient')}</button>
              </PermissionGuard>
            )}
            <PermissionGuard section="clients" action="delete">
              <button onClick={() => setShowDelete(true)} className="btn-ghost text-sm" style={{ color: '#b91c1c' }}><Trash2 size={15} /></button>
            </PermissionGuard>
          </div>
        </div>

        {/* Hero */}
        <div className="rounded-2xl p-5 bg-white" style={CARD}>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow" style={{ background: '#0763a9' }}>
              {client.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              {editing
                ? <input className="erp-input text-lg font-bold mb-2" value={editData.name || ''} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} />
                : <h1 className="text-xl font-bold mb-1" style={{ color: '#37383a' }}>{client.name}</h1>
              }
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={editing ? (editData.status || client.status) : client.status} />
                {editing && (
                  <select value={editData.status || client.status} onChange={e => setEditData(p => ({ ...p, status: e.target.value as Client['status'] }))} className="erp-input text-sm py-1 w-auto">
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Nuevo Prospecto">Nuevo Prospecto</option>
                    <option value="Contactado">Contactado</option>
                    <option value="Calificado">Calificado</option>
                    <option value="Negociación">Negociación</option>
                    <option value="Perdido">Perdido</option>
                  </select>
                )}
                {client.distributor_id && (
                  <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg" style={{ background: '#e8f1f9', color: '#0763a9', border: '1px solid #c5d9ee' }}>
                    {client.distributor_id}
                  </span>
                )}
                {client.rfc && <span className="text-xs font-mono" style={{ color: '#8a8b8d' }}>{client.rfc}</span>}
                {client.registered_at && (
                  <span className="text-xs" style={{ color: '#c4c5c7' }}>
                    Registrado {formatDistanceToNow(new Date(client.registered_at), { addSuffix: true, locale: dfLocale })}
                  </span>
                )}
                {hasBeenContactedViaWA && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                    <CheckCircle size={12} /> Contactado por WhatsApp
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI Summary */}
        {showAI && (
          <div className="rounded-2xl p-4 animate-fade-in" style={{ background: '#e8f1f9', border: '1px solid #c5d9ee' }}>
            <div className="flex items-center gap-2 mb-2">
              <Bot size={16} style={{ color: '#0763a9' }} />
              <span className="text-sm font-semibold" style={{ color: '#0763a9' }}>{t('aiSummaryTitle')}</span>
            </div>
            {aiLoading
              ? <p className="text-sm" style={{ color: '#5a5b5d' }}>{t('generatingSummary')}</p>
              : <p className="text-sm leading-relaxed" style={{ color: '#37383a' }}>{aiSummary}</p>
            }
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoCard icon={<Phone size={15} />} iconColor="#0763a9" title={t('contactInfo')}>
            <InfoRow label={t('primaryPhone')}>{field('phone')}</InfoRow>
            <InfoRow label={t('whatsappPhone')}>{field('whatsapp_phone')}</InfoRow>
            <InfoRow label={t('primaryEmail')}>{field('email_primary')}</InfoRow>
            <InfoRow label={t('contactEmail')}>{field('email_contact')}</InfoRow>
            <InfoRow label={t('billingEmail')}>{field('email_billing')}</InfoRow>
          </InfoCard>

          <InfoCard icon={<FileText size={15} />} iconColor="#b45309" title={t('fiscalInfo')}>
            <InfoRow label={t('taxId')}>{field('rfc')}</InfoRow>
            <InfoRow label={t('taxRegime')}>{field('tax_regime')}</InfoRow>
            <InfoRow label="Origen (Source)">{field('source' as any)}</InfoRow>
            <InfoRow label={t('zipCode')}>{field('zip_code')}</InfoRow>
            <InfoRow label={t('fiscalAddress')}>{field('fiscal_address')}</InfoRow>
          </InfoCard>

          <div className="rounded-2xl p-5 space-y-4 md:col-span-2 bg-white" style={CARD}>
            <div className="flex items-center gap-2">
              <Calendar size={15} style={{ color: '#0763a9' }} />
              <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>Carta de Distribución</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InfoRow label="Fecha de Emisión">{dateField('letter_created_at')}</InfoRow>
              <InfoRow label="Fecha de Vencimiento">{dateField('letter_expires_at')}</InfoRow>
              <InfoRow label="Archivo Adjunto">
                {editing ? (
                  <div className="space-y-2">
                    {editData.letter_url && (
                      <a href={editData.letter_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline block truncate">
                        Ver archivo actual
                      </a>
                    )}
                    <label className="btn-secondary text-sm w-full justify-center cursor-pointer">
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {uploading ? 'Subiendo...' : (editData.letter_url ? 'Reemplazar Carta' : 'Subir Carta')}
                      <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: '#37383a' }}>
                    {client?.letter_url ? (
                      <a href={client.letter_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                        <FileText size={14} /> Ver Documento
                      </a>
                    ) : (
                      <span style={{ color: '#c4c5c7', fontStyle: 'italic' }}>—</span>
                    )}
                  </p>
                )}
              </InfoRow>
            </div>
          </div>

          <div className="rounded-2xl p-5 space-y-4 md:col-span-2 bg-white" style={CARD}>
            <div className="flex items-center gap-2">
              <Building2 size={15} style={{ color: '#15803d' }} />
              <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>{t('commercialInfo')}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InfoRow label={t('operatingStates')}>
                {editing ? (
                  <div className="max-h-32 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#9bbfdf] scrollbar-track-[#f0f5fa] border border-[#d4e0ec] rounded-lg p-1 bg-[#f8fafd] flex flex-col gap-1">
                    {MEXICAN_STATES.map(st => {
                      const isSelected = (editData.states || []).includes(st)
                      return (
                        <button
                          type="button"
                          key={st}
                          className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-all ${
                            isSelected 
                              ? 'bg-[#e8f1f9] text-[#0763a9] font-semibold border border-[#0763a9]' 
                              : 'text-[#37383a] hover:bg-[#e8f1f9] border border-transparent'
                          }`}
                          onClick={() => {
                            const current = editData.states || []
                            const next = isSelected ? current.filter(s => s !== st) : [...current, st]
                            setEditData(p => ({ ...p, states: next }))
                          }}
                        >
                          {st}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: '#37383a' }}>
                    {(client?.states as string[])?.join(', ') || <span style={{ color: '#c4c5c7', fontStyle: 'italic' }}>—</span>}
                  </p>
                )}
              </InfoRow>
              <InfoRow label={t('hospitalChains')}>{arrayField('hospitals')}</InfoRow>
              <InfoRow label={t('medicalSpecialties')}>{arrayField('specialties')}</InfoRow>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <InfoRow label={t('assignedTo')}>
                {editing
                  ? (
                    <select className="erp-input text-sm" value={editData.assigned_to || ''} onChange={e => setEditData(p => ({ ...p, assigned_to: e.target.value }))}>
                      <option value="">{t('none') || 'Sin asignar'}</option>
                      {staffUsers.map(user => (
                        <option key={user.id} value={user.id}>{user.email}</option>
                      ))}
                    </select>
                  )
                  : <p className="text-sm" style={{ color: '#37383a' }}>
                      {client?.assigned_to ? staffUsers.find(u => u.id === client.assigned_to)?.email || client.assigned_to : <span style={{ color: '#c4c5c7', fontStyle: 'italic' }}>—</span>}
                    </p>
                }
              </InfoRow>
              <InfoRow label={t('tags')}>
                {editing
                  ? <input className="erp-input text-sm" value={(editData.tags || []).join(', ')} onChange={e => setEditData(p => ({ ...p, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
                  : <div className="flex flex-wrap gap-1">
                      {client.tags?.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-full text-xs" style={{ background: '#e8f1f9', color: '#0763a9', border: '1px solid #c5d9ee' }}>
                          <Tag size={10} className="inline mr-1" />{tag}
                        </span>
                      )) || <span className="text-sm" style={{ color: '#c4c5c7', fontStyle: 'italic' }}>—</span>}
                    </div>
                }
              </InfoRow>
            </div>
            <InfoRow label={t('notes')}>
              {editing
                ? <textarea className="erp-input text-sm" rows={3} value={editData.notes || ''} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} />
                : <p className="text-sm whitespace-pre-wrap" style={{ color: '#37383a' }}>{client.notes || <span style={{ color: '#c4c5c7', fontStyle: 'italic' }}>—</span>}</p>
              }
            </InfoRow>
          </div>
        </div>

        {/* Sales History Card */}
        {!loadingSales && sales.length > 0 && (
          <div className="rounded-2xl p-5 space-y-6 bg-white" style={CARD}>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Building2 size={18} style={{ color: '#0d9488' }} />
                <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>
                  {t('salesHistory' as any) || 'Historial de Ventas'}
                </h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 font-mono">
                {t('totalSales' as any) || 'Total Ventas'}: {formatCurrency(sales.reduce((acc, curr) => acc + Number(curr.monto || 0), 0), true)}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart */}
              <div className="p-4 bg-gray-50/30 rounded-xl border border-gray-100 flex flex-col justify-between">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-4">
                  {t('yearlyComparison' as any) || 'Comparativa por Año'}
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clientYearlyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={formatChartTick} />
                      <Tooltip formatter={(value: any) => formatCurrency(Number(value), true)} />
                      <Bar dataKey="value" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase">
                  {t('transactions' as any) || 'Transacciones'}
                </h3>
                <div className="border border-gray-150 rounded-xl overflow-hidden bg-white max-h-56 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold sticky top-0">
                        <th className="p-3">{t('period' as any) || 'Periodo'}</th>
                        <th className="p-3">{t('monto' as any) || 'Monto'}</th>
                        <th className="p-3 text-right">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {sales
                        .sort((a, b) => b.anio !== a.anio ? b.anio - a.anio : b.mes - a.mes)
                        .map(sale => (
                          <tr key={sale.id} className="hover:bg-gray-50/50">
                            <td className="p-3 font-medium text-gray-700">
                              {MONTH_NAMES[sale.mes - 1]} / {sale.anio}
                            </td>
                            <td className="p-3 font-semibold text-teal-650">
                              {formatCurrency(sale.monto)}
                            </td>
                            <td className="p-3 text-right">
                              <Link
                                href={`/ventas/${sale.id}`}
                                className="inline-flex items-center text-teal-600 hover:underline hover:text-teal-700"
                              >
                                {t('edit') || 'Editar'}
                              </Link>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="rounded-2xl p-5 bg-white" style={CARD}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#37383a' }}>{t('timeline')}</h2>
          {activities.length === 0
            ? <p className="text-sm" style={{ color: '#c4c5c7', fontStyle: 'italic' }}>Sin actividad registrada</p>
            : (
              <div className="space-y-3">
                {activities.map((act) => (
                  <div key={act.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="text-base">{ACTIVITY_ICON[act.type] || '📌'}</span>
                      <div className="w-px flex-1 mt-1" style={{ background: '#e8f1f9' }} />
                    </div>
                    <div className="pb-3 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold uppercase" style={{ color: ACTIVITY_COLOR[act.type] || '#5a5b5d' }}>
                          {t(act.type as Parameters<typeof t>[0])}
                        </span>
                        <span className="text-xs" style={{ color: '#c4c5c7' }}>
                          {format(new Date(act.created_at), 'd MMM yyyy, HH:mm', { locale: dfLocale })}
                        </span>
                      </div>
                      <p className="text-sm mt-0.5" style={{ color: '#37383a' }}>{act.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>

      {/* WhatsApp modal */}
      <Modal open={showWA} onClose={() => { setShowWA(false); setWaResult(null) }} title={t('sendWhatsApp')}>
        <div className="space-y-4">
          {hasBeenContactedViaWA && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm flex gap-2 items-start">
              <span className="text-amber-500">⚠️</span>
              <p>Este cliente <strong>ya ha sido contactado por WhatsApp</strong> anteriormente. Verifica el historial para evitar duplicar mensajes.</p>
            </div>
          )}
          <p className="text-sm" style={{ color: '#5a5b5d' }}>Enviar a: <span style={{ color: '#37383a', fontWeight: 500 }}>{client.whatsapp_phone || client.phone}</span></p>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a5b5d' }}>{t('selectTemplate')}</label>
            {WA_TEMPLATES.map(tmpl => (
              <button key={tmpl.id} onClick={() => setWaTemplate(tmpl.id)}
                className="w-full text-left px-3 py-2 rounded-lg mb-1.5 text-sm transition-colors"
                style={waTemplate === tmpl.id
                  ? { background: '#e8f1f9', color: '#0763a9', border: '1px solid #c5d9ee' }
                  : { color: '#37383a', border: '1px solid transparent' }}>
                {tmpl.label}
              </button>
            ))}
          </div>
          {waResult === 'ok' && <p className="text-sm flex items-center gap-1" style={{ color: '#15803d' }}><CheckCircle size={14} /> Enviado correctamente</p>}
          {waResult === 'err' && <p className="text-sm" style={{ color: '#b91c1c' }}>Error al enviar. Verifica el número.</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowWA(false)} className="btn-secondary text-sm">{t('cancel')}</button>
            <button onClick={sendWA} disabled={waSending} className="btn-primary text-sm">
              {waSending ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />} {t('sendMessage')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Congress WhatsApp Modal */}
      <Modal open={showCongressWA} onClose={() => setShowCongressWA(false)} title="Enviar Bienvenida Congreso">
        <div className="space-y-4">
          {hasBeenContactedViaWA && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm flex gap-2 items-start">
              <span className="text-amber-500">⚠️</span>
              <p>Este cliente <strong>ya ha sido contactado por WhatsApp</strong> anteriormente. Verifica el historial para evitar duplicar mensajes.</p>
            </div>
          )}
          <p className="text-sm" style={{ color: '#5a5b5d' }}>Enviar a: <span style={{ color: '#37383a', fontWeight: 500 }}>{client.whatsapp_phone || client.phone}</span></p>
          <div className="p-3 bg-[#f8fafd] border border-[#d4e0ec] rounded-lg text-sm text-[#37383a] space-y-2">
            <p>Hola, <strong>{client.name}</strong>.</p>
            <p>Fue un gusto coincidir y saludarle en el reciente Congreso. Le escribo de parte del equipo de Arthromed/BONSS México</p>
            <p>Queremos ponernos a su disposición. Haga clic en el botón de abajo para revisar nuestros productos de la línea BONSS MEDICAL.</p>
            <p>Quedo a la orden para cualquier duda o cotización. ¡Que tenga un excelente día!</p>
            <p>Atentamente,<br/><strong>{congressSenderName}</strong><br/>Arthromed</p>
            <div className="mt-4 pt-3 border-t border-[#d4e0ec] flex justify-center">
              <a href={congressLink || '#'} target="_blank" rel="noreferrer" className="text-[#0763a9] font-semibold text-center w-full bg-white py-2 rounded-lg border border-[#c5d9ee] flex items-center justify-center gap-2 hover:bg-[#f0f5fa] transition-colors">
                🔗 Ver Catálogo
              </a>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a5b5d' }}>Link al catálogo (Ruta)</label>
            <input className="erp-input text-sm" value={congressLink} onChange={e => setCongressLink(e.target.value)} placeholder="Ej. bonss.com.mx/catalogo" />
            <p className="text-xs mt-1 text-[#8a8b8d]">Si configuraste el botón como estático en Meta, puedes dejar este campo vacío.</p>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a5b5d' }}>Remitente / Cargo</label>
            <input className="erp-input text-sm" value={congressSenderName} onChange={e => setCongressSenderName(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => setShowCongressWA(false)} className="btn-secondary text-sm">{t('cancel')}</button>
            <button onClick={sendCongressWA} disabled={congressSending} className="btn-primary text-sm">
              {congressSending ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />} Enviar Mensaje
            </button>
          </div>
        </div>
      </Modal>

      {/* Add note modal */}
      <Modal open={showNote} onClose={() => setShowNote(false)} title={t('addNote')}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a5b5d' }}>Tipo</label>
            <div className="flex flex-wrap gap-1.5">
              {(['nota','llamada','email','visita'] as const).map(type => (
                <button key={type} onClick={() => setNoteType(type)}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={noteType === type
                    ? { background: '#e8f1f9', color: '#0763a9', border: '1px solid #c5d9ee' }
                    : { color: '#5a5b5d', border: '1px solid #d4e0ec' }}>
                  {ACTIVITY_ICON[type]} {t(type)}
                </button>
              ))}
            </div>
          </div>
          <textarea className="erp-input text-sm" rows={4} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Escribe aquí..." />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNote(false)} className="btn-secondary text-sm">{t('cancel')}</button>
            <button onClick={addNote} disabled={addingNote || !noteText.trim()} className="btn-primary text-sm">
              {addingNote ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Eliminar cliente">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: '#37383a' }}>¿Estás seguro de que deseas eliminar <strong>{client.name}</strong>? Esta acción no se puede deshacer.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowDelete(false)} className="btn-secondary text-sm">{t('cancel')}</button>
            <button onClick={deleteClient} className="btn-primary text-sm" style={{ background: '#b91c1c', boxShadow: '0 2px 8px rgba(185,28,28,0.25)' }}>
              <Trash2 size={14} /> {t('delete')}
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}

function InfoCard({ icon, iconColor, title, children }: { icon: React.ReactNode; iconColor: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 space-y-4 bg-white" style={{ border: '1px solid #d4e0ec' }}>
      <div className="flex items-center gap-2">
        <span style={{ color: iconColor }}>{icon}</span>
        <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium mb-1" style={{ color: '#8a8b8d' }}>{label}</p>
      {children}
    </div>
  )
}
