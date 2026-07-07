'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import StatusBadge from '@/components/StatusBadge'
import Modal from '@/components/Modal'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/contexts/I18nContext'
import { Client, ClientActivity } from '@/types/database'
import {
  Phone, Mail, MapPin, Building2, FileText, Edit3, Save, X,
  MessageCircle, Bot, ChevronLeft, Trash2, Plus, Tag, Loader2, CheckCircle, Upload, Calendar,
  HelpCircle, TrendingUp, TrendingDown, DollarSign, ShoppingBag, Activity
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { es, enUS, zhCN } from 'date-fns/locale'
import { Locale } from '@/lib/i18n'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import PermissionGuard from '@/components/PermissionGuard'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend } from 'recharts'
import StatCard from '@/components/StatCard'

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

const DhlLogo = () => (
  <span className="inline-flex items-center gap-0.5 bg-[#FFCC00] text-[#D00000] font-black italic tracking-tighter px-1.5 py-0.5 rounded text-[9px] select-none h-4 shadow-xs" style={{ fontFamily: "'Outfit', 'Inter', sans-serif" }}>
    DHL
  </span>
)

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

  const [activeTab, setActiveTab] = useState<'info' | 'cartas' | 'facturas' | 'analytics'>('info')
  const [cartasDistribucion, setCartasDistribucion] = useState<any[]>([])

  // Analytics/Reports Tab States
  const [reportData, setReportData] = useState<any | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [preset, setPreset] = useState('thisYear')
  const [startDate, setStartDate] = useState('2026-01-01')
  const [endDate, setEndDate] = useState('2026-12-31')

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
  const [noteAttachmentFile, setNoteAttachmentFile] = useState<File | null>(null)
  const [noteAttachmentUrl, setNoteAttachmentUrl] = useState<string>('')
  const [uploadingNoteFile, setUploadingNoteFile] = useState(false)

  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const [staffUsers, setStaffUsers] = useState<any[]>([])

  const [showCongressWA, setShowCongressWA] = useState(false)
  const [congressLink, setCongressLink] = useState('https://bonss.com.mx/catalogo')
  const [congressSenderName, setCongressSenderName] = useState('Equipo Arthromed')
  const [congressSending, setCongressSending] = useState(false)

  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [deletingCartaId, setDeletingCartaId] = useState<string | null>(null)
  const [removingActiveLetter, setRemovingActiveLetter] = useState(false)
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 4000)
  }

  // Letter generation states
  const [showGenerateLetterModal, setShowGenerateLetterModal] = useState(false)
  const [generatingLetter, setGeneratingLetter] = useState(false)
  const [letterInstitutionName, setLetterInstitutionName] = useState('')
  const [letterDistributorName, setLetterDistributorName] = useState('')
  const [letterRfc, setLetterRfc] = useState('')
  const [letterSelectedLines, setLetterSelectedLines] = useState<string[]>([])
  const [letterExpirationDate, setLetterExpirationDate] = useState('')
  const [letterCoverage, setLetterCoverage] = useState('')
  const [productLines, setProductLines] = useState<any[]>([])

  const getLastDayOfNextJanuary = () => {
    const now = new Date()
    const nextYear = now.getFullYear() + 1
    const lastDay = new Date(nextYear, 1, 0)
    const yyyy = lastDay.getFullYear()
    const mm = String(lastDay.getMonth() + 1).padStart(2, '0')
    const dd = String(lastDay.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const handleOpenGenerateLetterModal = () => {
    setLetterInstitutionName('')
    setLetterDistributorName(client?.name || '')
    setLetterRfc(client?.rfc || '')
    setLetterSelectedLines([])
    setLetterExpirationDate(getLastDayOfNextJanuary())
    setLetterCoverage('')
    setShowGenerateLetterModal(true)
  }

  const handleGenerateLetter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!letterInstitutionName || letterSelectedLines.length === 0) {
      showToast('Por favor selecciona la institución y al menos una línea de producto.', 'error')
      return
    }
    setGeneratingLetter(true)
    try {
      const res = await fetch(`/api/clients/${id}/letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionName: letterInstitutionName,
          distributorName: letterDistributorName,
          rfc: letterRfc,
          selectedLines: letterSelectedLines,
          expirationDate: letterExpirationDate,
          createdBy: null,
          coverage: letterCoverage
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al generar carta')
      }

      const resJson = await res.json()
      
      // Update local client states
      if (resJson.client) {
        setClient(resJson.client)
        setEditData(resJson.client)
      }

      // Download the PDF
      const pdfRes = await fetch(resJson.pdfUrl)
      const blob = await pdfRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Carta_Distribucion_${(letterDistributorName || client?.name || 'Distribuidor').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Reload client letters and activities
      const [cRes, aRes] = await Promise.all([
        fetch(`/api/clients/${id}`),
        fetch(`/api/clients/${id}/activities`)
      ])
      if (cRes.ok) {
        const cJson = await cRes.json()
        setCartasDistribucion(cJson.cartas || [])
      }
      if (aRes.ok) {
        const aJson = await aRes.json()
        setActivities(aJson.data || [])
      }

      setShowGenerateLetterModal(false)
    } catch (err: any) {
      console.error(err)
      showToast('Error: ' + err.message, 'error')
    } finally {
      setGeneratingLetter(false)
    }
  }

  const handleRemoveActiveLetter = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar la carta de distribución activa de este cliente?')) {
      return
    }
    setRemovingActiveLetter(true)
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          letter_url: null,
          letter_created_at: null,
          letter_expires_at: null
        })
      })
      if (!res.ok) {
        throw new Error('Error al actualizar el cliente')
      }
      const json = await res.json()
      setClient(json.data)
      setEditData(json.data)
      showToast('Carta de distribución activa eliminada correctamente.')
    } catch (err: any) {
      console.error(err)
      showToast('Error: ' + err.message, 'error')
    } finally {
      setRemovingActiveLetter(false)
    }
  }

  const handleDeleteCartaRecord = async (cartaId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar permanentemente este registro de carta de distribución de la base de datos?')) {
      return
    }
    setDeletingCartaId(cartaId)
    try {
      const res = await fetch(`/api/cartas/${cartaId}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        throw new Error('Error al eliminar la carta')
      }
      
      // Refresh database letters list
      const cRes = await fetch(`/api/clients/${id}`)
      if (cRes.ok) {
        const cJson = await cRes.json()
        setCartasDistribucion(cJson.cartas || [])
      }
      showToast('Registro de carta de distribución eliminado correctamente.')
    } catch (err: any) {
      console.error(err)
      showToast('Error: ' + err.message, 'error')
    } finally {
      setDeletingCartaId(null)
    }
  }


  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setLoadingSales(true)
        const [cRes, aRes, sRes, staffRes, linesRes] = await Promise.all([
          fetch(`/api/clients/${id}`),
          fetch(`/api/clients/${id}/activities`),
          fetch(`/api/ventas?cliente_id=${id}`),
          fetch('/api/users'),
          fetch('/api/catalogos/lineas')
        ])
        const cJson = await cRes.json()
        const aJson = await aRes.json()
        const staffJson = await staffRes.json()
        const linesJson = linesRes.ok ? await linesRes.json() : { data: [] }
        
        setClient(cJson.data)
        setEditData(cJson.data)
        setCartasDistribucion(cJson.cartas || [])
        setActivities(aJson.data || [])
        setStaffUsers(staffJson.data || [])
        setProductLines(linesJson.data || [])
        
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

  useEffect(() => {
    async function loadReport() {
      if (!id) return
      setLoadingReport(true)
      try {
        const res = await fetch(`/api/reports/clientes/${id}?startDate=${startDate}&endDate=${endDate}`)
        if (res.ok) {
          const json = await res.json()
          setReportData(json)
        }
      } catch (err) {
        console.error('Error loading client report:', err)
      } finally {
        setLoadingReport(false)
      }
    }
    loadReport()
  }, [id, startDate, endDate])

  const hasBeenContactedViaWA = activities.some(a => a.type === 'whatsapp')

  const handlePresetChange = (val: string) => {
    setPreset(val)
    if (val !== 'custom') {
      const dates = getPresetDates(val)
      setStartDate(dates.start)
      setEndDate(dates.end)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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
    const key = surtido === 'completa' ? 'completed' : surtido === 'parcial' ? 'partial' : 'unfulfilled'
    return t(key as any) || ESTADO_SURTIDO_MAP[surtido]?.label || surtido
  }

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
        showToast('Error al enviar mensaje', 'error')
      }
    } catch (e) {
      showToast('Error al enviar mensaje', 'error')
    } finally { 
      setCongressSending(false) 
    }
  }

  const uploadNoteFile = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'bin'
    const fileName = `note_${id}_${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('documents').upload(`clients/${id}/${fileName}`, file)
    if (error) throw error
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(data.path)
    return urlData.publicUrl
  }

  const addNote = async () => {
    if (!noteText.trim() && !noteAttachmentFile) return
    setAddingNote(true)
    try {
      let attachmentUrl = noteAttachmentUrl
      if (noteAttachmentFile && !noteAttachmentUrl) {
        attachmentUrl = await uploadNoteFile(noteAttachmentFile)
      }
      // Store content as JSON if there's an attachment, else plain text
      const content = attachmentUrl
        ? JSON.stringify({ text: noteText, attachmentUrl, attachmentName: noteAttachmentFile?.name || 'Archivo adjunto' })
        : noteText
      await fetch(`/api/clients/${id}/activities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: noteType, content }) })
      const aRes = await fetch(`/api/clients/${id}/activities`)
      setActivities((await aRes.json()).data || [])
      setNoteText('')
      setNoteAttachmentFile(null)
      setNoteAttachmentUrl('')
      setShowNote(false)
    } catch (err: any) {
      showToast('Error al guardar la nota: ' + err.message, 'error')
    } finally {
      setAddingNote(false)
    }
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
      showToast('Error al subir el archivo. Asegúrate de que el bucket "documents" exista en Supabase y sea público.', 'error')
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

        {/* Tab Navigation Bar */}
        <div className="flex items-center gap-2 border-b border-[#d4e0ec] overflow-x-auto no-scrollbar">
          <button
            type="button"
            className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'info'
                ? 'border-[#0763a9] text-[#0763a9]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('info')}
          >
            <Building2 size={16} /> Información General
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'cartas'
                ? 'border-[#0763a9] text-[#0763a9]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('cartas')}
          >
            <FileText size={16} /> Cartas de Distribución
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'facturas'
                ? 'border-[#0763a9] text-[#0763a9]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('facturas')}
          >
            <DollarSign size={16} /> Facturas
          </button>
          <button
            type="button"
            className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'border-[#0763a9] text-[#0763a9]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('analytics')}
          >
            <Activity size={16} /> Análisis / Reportes
          </button>
        </div>

        {/* Date Filters Header (Shared for Facturas & Analytics tabs) */}
        {(activeTab === 'facturas' || activeTab === 'analytics') && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#d4e0ec] animate-fade-in">
            <div>
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Filtro de Fecha</h3>
              <p className="text-xs text-gray-500 mt-0.5">Define el periodo para reportes y listado de facturas.</p>
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
                <span className="text-[10px] uppercase font-bold text-[#8a8b8d] tracking-wider">{t('activeFilters' as any) || 'Filtro Activo'}</span>
                <span className="font-semibold text-slate-700">{startDate} al {endDate}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: General Info */}
        {activeTab === 'info' && (
          <div className="space-y-5 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoCard icon={<Phone size={15} />} iconColor="#0763a9" title={t('contactInfo')}>
                <InfoRow label="Directivo / Rep. Legal">{field('legal_representative')}</InfoRow>
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

              {/* Direcciones de Entrega Adicionales */}
              <div className="rounded-2xl p-5 space-y-4 md:col-span-2 bg-white" style={CARD}>
                <div className="flex items-center gap-2">
                  <MapPin size={15} style={{ color: '#0763a9' }} />
                  <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>Direcciones de Entrega Adicionales</h2>
                </div>
                {editing ? (
                  <div className="space-y-4">
                    {/* List of current addresses to remove */}
                    {((editData.addresses || []) as any[]).length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {((editData.addresses || []) as any[]).map((addr, idx) => (
                          <div key={idx} className="p-3 bg-[#f8fafd] border border-[#e8f1f9] rounded-xl flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-[#0763a9]">{addr.name}</span>
                                {addr.is_dhl && <DhlLogo />}
                                {addr.zip_code && <span className="text-[10px] text-gray-500 font-mono">CP {addr.zip_code}</span>}
                              </div>
                              <p className="text-xs text-[#37383a] mt-1">{addr.address}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (editData.addresses || []).filter((_, i) => i !== idx)
                                setEditData(p => ({ ...p, addresses: updated }))
                              }}
                              className="text-[#b91c1c] hover:bg-[#fee2e2] p-1 rounded transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#8a8b8d] italic">No hay direcciones adicionales registradas.</p>
                    )}

                    {/* Form to add a new one */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-250 space-y-3">
                      <p className="text-xs font-bold text-[#5a5b5d] uppercase tracking-wider">Agregar Nueva Dirección</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <input
                          type="text"
                          className="erp-input text-xs"
                          placeholder="Alias (Ej. Sucursal GDL)"
                          id="new-addr-name-admin"
                        />
                        <input
                          type="text"
                          className="erp-input text-xs"
                          placeholder="Código Postal (Ej. 64000)"
                          id="new-addr-zip-admin"
                          maxLength={5}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nameEl = document.getElementById('new-addr-name-admin') as HTMLInputElement
                            const zipEl = document.getElementById('new-addr-zip-admin') as HTMLInputElement
                            const addrEl = document.getElementById('new-addr-val-admin') as HTMLInputElement
                            const dhlEl = document.getElementById('new-addr-dhl-admin') as HTMLInputElement
                            if (nameEl && addrEl && nameEl.value.trim() && addrEl.value.trim()) {
                              const newAddr = {
                                name: nameEl.value.trim(),
                                zip_code: zipEl ? zipEl.value.trim() : '',
                                address: addrEl.value.trim(),
                                is_dhl: dhlEl ? dhlEl.checked : false
                              }
                              const updated = [...(editData.addresses || []), newAddr]
                              setEditData(p => ({ ...p, addresses: updated }))
                              nameEl.value = ''
                              if (zipEl) zipEl.value = ''
                              addrEl.value = ''
                              if (dhlEl) dhlEl.checked = false
                            }
                          }}
                          className="btn-secondary text-xs flex justify-center py-2"
                        >
                          <Plus size={13} /> Agregar
                        </button>
                      </div>
                      <input
                        type="text"
                        className="erp-input text-xs w-full"
                        placeholder="Dirección Completa (Calle, Número, Colonia, Ciudad, Estado)"
                        id="new-addr-val-admin"
                      />
                      <div className="flex items-center gap-2 px-1">
                        <input
                          type="checkbox"
                          id="new-addr-dhl-admin"
                          className="w-4 h-4 text-[#0763a9] border-gray-300 rounded focus:ring-[#0763a9] cursor-pointer"
                        />
                        <label htmlFor="new-addr-dhl-admin" className="text-xs font-bold text-[#5a5b5d] cursor-pointer flex items-center gap-1.5 selection:bg-transparent">
                          Es una sucursal <DhlLogo /> Ocurre
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  ((client.addresses || []) as any[]).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {((client.addresses || []) as any[]).map((addr, idx) => (
                        <div key={idx} className="p-3.5 bg-[#f8fafd] border border-[#e8f1f9] rounded-2xl flex flex-col gap-1 hover:border-[#b4d2ed] transition-colors">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-[#0763a9]">{addr.name}</span>
                            {addr.is_dhl && <DhlLogo />}
                            {addr.zip_code && <span className="text-[10px] bg-[#e8f1f9] px-1.5 py-0.5 rounded text-gray-500 font-mono">CP {addr.zip_code}</span>}
                          </div>
                          <p className="text-sm text-[#37383a] mt-1">{addr.address}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm italic" style={{ color: '#c4c5c7' }}>Sin direcciones de entrega adicionales registradas.</p>
                  )
                )}
              </div>

              {/* Commercial Info */}
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
                          {(() => {
                            let parsed: { text?: string; attachmentUrl?: string; attachmentName?: string } | null = null
                            try { if (act.content?.startsWith('{')) parsed = JSON.parse(act.content) } catch {}
                            if (parsed) {
                              return (
                                <div className="mt-0.5 space-y-1.5">
                                  {parsed.text && <p className="text-sm" style={{ color: '#37383a' }}>{parsed.text}</p>}
                                  {parsed.attachmentUrl && (
                                    <a
                                      href={parsed.attachmentUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-medium hover:bg-blue-100 transition-colors"
                                    >
                                      <FileText size={12} />
                                      {parsed.attachmentName || 'Archivo adjunto'}
                                    </a>
                                  )}
                                </div>
                              )
                            }
                            return <p className="text-sm mt-0.5" style={{ color: '#37383a' }}>{act.content}</p>
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>
        )}

        {/* Tab 2: Cartas de Distribución */}
        {activeTab === 'cartas' && (
          <div className="space-y-5 animate-fade-in">
            {/* PDF Letter Card */}
            <div className="rounded-2xl p-5 space-y-4 bg-white" style={CARD}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Calendar size={15} style={{ color: '#0763a9' }} />
                  <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>Carta de Distribución (PDF)</h2>
                </div>
                <button
                  type="button"
                  onClick={handleOpenGenerateLetterModal}
                  className="btn-primary text-xs flex items-center gap-1 py-1.5 px-3 bg-[#0763a9] text-white hover:bg-[#064d85]"
                >
                  <Plus size={14} /> Generar Carta de Distribución
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InfoRow label="Fecha de Emisión">{dateField('letter_created_at')}</InfoRow>
                <InfoRow label="Fecha de Vencimiento">{dateField('letter_expires_at')}</InfoRow>
                <InfoRow label="Archivo Adjunto">
                  {editing ? (
                    <div className="space-y-2">
                      {editData.letter_url && (
                        <div className="flex items-center justify-between gap-2 border border-[#e8f1f9] rounded-xl p-2 bg-[#f8fafd]">
                          <a href={editData.letter_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline truncate max-w-[150px]">
                            Ver archivo actual
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setEditData(p => ({
                                ...p,
                                letter_url: null,
                                letter_created_at: null,
                                letter_expires_at: null
                              }))
                            }}
                            className="text-[#b91c1c] hover:bg-[#fee2e2] p-1 rounded transition-colors text-xs flex items-center gap-0.5"
                            title="Quitar Carta"
                          >
                            <Trash2 size={12} /> Quitar
                          </button>
                        </div>
                      )}
                      <label className="btn-secondary text-sm w-full justify-center cursor-pointer">
                        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        {uploading ? 'Subiendo...' : (editData.letter_url ? 'Reemplazar Carta' : 'Subir Carta')}
                        <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                      </label>
                    </div>
                  ) : (
                    <div className="text-sm" style={{ color: '#37383a' }}>
                      {client?.letter_url ? (
                        <div className="flex items-center gap-2">
                          <a href={client.letter_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 font-medium">
                            <FileText size={14} /> Ver Documento
                          </a>
                          <button
                            type="button"
                            onClick={handleRemoveActiveLetter}
                            disabled={removingActiveLetter}
                            className="text-[#b91c1c] hover:bg-[#fee2e2] p-1 rounded-lg transition-colors flex items-center gap-0.5 text-xs font-semibold ml-2 border border-transparent hover:border-[#fca5a5] disabled:opacity-50"
                            title="Eliminar Carta Activa"
                          >
                            {removingActiveLetter ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                            {removingActiveLetter ? 'Quitando...' : 'Quitar'}
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#c4c5c7', fontStyle: 'italic' }}>—</span>
                      )}
                    </div>
                  )}
                </InfoRow>
              </div>
            </div>

            {/* DB Cartas list */}
            <div className="bg-white rounded-2xl border border-[#d4e0ec] overflow-hidden">
              <div className="p-5 border-b border-[#e8f1f9] flex justify-between items-center bg-gray-50/50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="bg-[#0763a9] w-2 h-2 rounded-full"></span>
                  Cartas de Distribución Relacionadas (Base de Datos)
                </h3>
                <span className="text-xs font-semibold text-gray-500 bg-white border px-2 py-0.5 rounded-full shadow-xs">
                  {cartasDistribucion.length} {cartasDistribucion.length === 1 ? 'registro' : 'registros'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#e8f1f9] text-xs font-semibold uppercase text-gray-500">
                      <th className="p-4 pl-6">Código</th>
                      <th className="p-4">Destinatario</th>
                      <th className="p-4">Región / Estado</th>
                      <th className="p-4">Líneas de Producto</th>
                      <th className="p-4">Vigencia</th>
                      <th className="p-4 text-right pr-6">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e8f1f9] text-sm">
                    {cartasDistribucion.map((carta) => (
                      <tr key={carta.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="p-4 pl-6 font-semibold text-gray-900 font-mono">
                          {carta.codigo || '—'}
                        </td>
                        <td className="p-4 text-gray-700 font-medium">
                          {carta.destinatario || '—'}
                        </td>
                        <td className="p-4 text-gray-600">
                          {carta.estado_region || '—'}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {carta.lineas_producto?.map((linea: string) => (
                              <span key={linea} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e8f1f9] text-[#0763a9] border border-[#c5d9ee]">
                                {linea}
                              </span>
                            )) || <span className="text-xs text-gray-400 italic">—</span>}
                          </div>
                        </td>
                        <td className="p-4 text-gray-650">
                          {carta.vigencia ? formatDate(carta.vigencia) : '—'}
                        </td>
                        <td className="p-4 text-right pr-6">
                          <button
                            type="button"
                            onClick={() => handleDeleteCartaRecord(carta.id)}
                            disabled={deletingCartaId !== null}
                            className="text-[#b91c1c] hover:bg-[#fee2e2] p-1.5 rounded-lg transition-colors inline-flex items-center justify-center border border-transparent hover:border-[#fca5a5] disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Eliminar registro de base de datos"
                          >
                            {deletingCartaId === carta.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {cartasDistribucion.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-16 text-center text-gray-400 font-medium">
                          No hay cartas de distribución vinculadas a este cliente.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Facturas */}
        {activeTab === 'facturas' && (
          <div className="space-y-4 animate-fade-in">
            {loadingReport ? (
              <div className="flex items-center justify-center min-h-48">
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0763a9', borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#d4e0ec] overflow-hidden">
                <div className="p-5 border-b border-[#e8f1f9] flex justify-between items-center bg-gray-50/50">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="bg-[#0763a9] w-2 h-2 rounded-full"></span>
                    Listado de Facturas
                  </h3>
                  <span className="text-xs font-semibold text-gray-500 bg-white border px-2 py-0.5 rounded-full shadow-xs">
                    {reportData?.recentOrders?.length || 0} {reportData?.recentOrders?.length === 1 ? 'factura' : 'facturas'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-[#e8f1f9] text-xs font-semibold uppercase text-gray-500">
                        <th className="p-4 pl-6">Folio / Número</th>
                        <th className="p-4">Fecha Expedición</th>
                        <th className="p-4">{t('paymentDate') || 'Fecha Pago'}</th>
                        <th className="p-4 text-right">Subtotal</th>
                        <th className="p-4 text-right">IVA</th>
                        <th className="p-4 text-right font-bold">Total</th>
                        <th className="p-4 text-center">Surtido</th>
                        <th className="p-4 text-center">Estado Pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e8f1f9] text-sm">
                      {reportData?.recentOrders?.map((invoice: any) => {
                        const status = STATUS_MAP[invoice.estado] || { label: invoice.estado, bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-100' }
                        const surtido = ESTADO_SURTIDO_MAP[invoice.estado_surtido] || ESTADO_SURTIDO_MAP['no_surtida']
                        return (
                          <tr
                            key={invoice.id}
                            onClick={() => router.push(`/facturas/${invoice.id}`)}
                            className="hover:bg-[#f0f5fa] cursor-pointer transition-colors group"
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
                            <td className="p-4 text-center">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${status.bg} ${status.text} ${status.border}`}>
                                {getLocalStatusLabel(invoice.estado)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                      {(!reportData || reportData.recentOrders?.length === 0) && (
                        <tr>
                          <td colSpan={8} className="p-16 text-center text-gray-400 font-medium">
                            No hay registros de facturación para este periodo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Analytics */}
        {activeTab === 'analytics' && (
          <div className="space-y-5 animate-fade-in">
            {loadingReport ? (
              <div className="flex items-center justify-center min-h-48">
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0763a9', borderTopColor: 'transparent' }} />
              </div>
            ) : reportData ? (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    title={t('periodSales' as any) || 'Ventas del Periodo'}
                    value={formatCurrency(reportData.kpis.salesPeriod, true)}
                    icon={<DollarSign size={20} />}
                    color="green"
                    subtitle={`${t('growthvsPrev') || 'Crecimiento vs prev'}: ${reportData.kpis.growthPercent >= 0 ? '+' : ''}${reportData.kpis.growthPercent.toFixed(1)}%`}
                  />
                  <StatCard
                    title={t('growthVsPrevPeriod' as any) || 'Crecimiento vs Periodo Anterior'}
                    value={`${reportData.kpis.growthPercent >= 0 ? '+' : ''}${reportData.kpis.growthPercent.toFixed(1)}%`}
                    icon={reportData.kpis.growthPercent >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    color={reportData.kpis.growthPercent >= 0 ? 'green' : 'red'}
                    subtitle={t('vsPreviousPeriod' as any) || 'vs Periodo Anterior'}
                  />
                  <StatCard
                    title={t('totalOrders' as any) || 'Total Pedidos'}
                    value={reportData.kpis.orderCount}
                    icon={<ShoppingBag size={20} />}
                    color="blue"
                    subtitle={`AOV: ${formatCurrency(reportData.kpis.aov, true)}`}
                  />
                  <StatCard
                    title={t('firstPurchaseDate' as any) || 'Fecha de Primer Compra'}
                    value={reportData.kpis.firstPurchaseDate ? formatDate(reportData.kpis.firstPurchaseDate) : '—'}
                    icon={<Calendar size={20} />}
                    color="amber"
                    subtitle="Fecha del primer registro"
                  />
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Line Chart: Purchase Trend */}
                  <div className="rounded-2xl p-5 bg-white space-y-4" style={CARD}>
                    <ChartHeader 
                      title={t('salesTrend' as any) || 'Tendencia de Ventas'} 
                      tooltipText="Tendencia histórica de facturación mensual o diaria de este cliente." 
                    />
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart 
                          data={reportData.salesTrends.map((item: any) => {
                            if (!item.date) return item
                            const date = new Date(item.date)
                            const diffTime = Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime())
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1
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
                          <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #d4e0ec', borderRadius: 8, color: '#37383a' }} formatter={(value) => formatCurrency(Number(value))} />
                          <Legend iconType="circle" />
                          <Line name={getPeriodLabel(startDate, endDate, false)} type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={3} activeDot={{ r: 6 }} />
                          <Line name={getPeriodLabel(startDate, endDate, true)} type="monotone" dataKey="prevRevenue" stroke="#9ca3af" strokeDasharray="5 5" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Bar Chart: Top Products */}
                  <div className="rounded-2xl p-5 bg-white space-y-4" style={CARD}>
                    <ChartHeader 
                      title={t('topProductsPurchased' as any) || 'Productos Más Comprados'} 
                      tooltipText="Productos más comprados por volumen de ingresos acumulados en el periodo." 
                    />
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportData.breakdown.topProducts} layout="vertical" margin={{ left: 10, right: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e8f1f9" horizontal={false} />
                          <XAxis type="number" tickFormatter={(val) => formatCurrency(val, true)} tick={{ fill: '#8a8b8d', fontSize: 9 }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fill: '#5a5b5d', fontSize: 9 }} width={100} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #d4e0ec', borderRadius: 8, color: '#37383a' }} formatter={(value) => formatCurrency(Number(value))} />
                          <Bar dataKey="value" fill="#0763a9" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20 text-gray-500 border border-dashed rounded-2xl bg-white">
                No hay datos disponibles para este periodo.
              </div>
            )}
          </div>
        )}
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
      <Modal open={showNote} onClose={() => { setShowNote(false); setNoteAttachmentFile(null); setNoteAttachmentUrl('') }} title={t('addNote')}>
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

          {/* File attachment */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a5b5d' }}>Archivo adjunto (opcional)</label>
            {noteAttachmentFile ? (
              <div className="flex items-center gap-2 p-2 rounded-lg border border-blue-200 bg-blue-50">
                <FileText size={14} className="text-blue-600 flex-shrink-0" />
                <span className="text-xs text-blue-800 font-medium truncate flex-1">{noteAttachmentFile.name}</span>
                <button
                  onClick={() => { setNoteAttachmentFile(null); setNoteAttachmentUrl('') }}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
                {uploadingNoteFile && <Loader2 size={14} className="animate-spin text-blue-600" />}
              </div>
            ) : (
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Upload size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500">Seleccionar archivo...</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setNoteAttachmentFile(file)
                    // Pre-upload in background
                    setUploadingNoteFile(true)
                    try {
                      const url = await uploadNoteFile(file)
                      setNoteAttachmentUrl(url)
                    } catch (err) {
                      showToast('Error al subir archivo', 'error')
                      setNoteAttachmentFile(null)
                    } finally {
                      setUploadingNoteFile(false)
                    }
                  }}
                />
              </label>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowNote(false); setNoteAttachmentFile(null); setNoteAttachmentUrl('') }} className="btn-secondary text-sm">{t('cancel')}</button>
            <button onClick={addNote} disabled={addingNote || uploadingNoteFile || (!noteText.trim() && !noteAttachmentFile)} className="btn-primary text-sm">
              {addingNote ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* Generar Carta de Distribución Modal */}
      <Modal open={showGenerateLetterModal} onClose={() => !generatingLetter && setShowGenerateLetterModal(false)} title="Generar Carta de Distribución">
        <form onSubmit={handleGenerateLetter} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
              Institución / Destinatario *
            </label>
            <input
              required
              type="text"
              placeholder="Ej. OPERADORA DE HOSPITALES ANGELES."
              className="erp-input text-sm w-full font-medium"
              value={letterInstitutionName}
              onChange={e => setLetterInstitutionName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
              Cobertura (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Nuevo León, república mexicana, etc."
              className="erp-input text-sm w-full font-medium"
              value={letterCoverage}
              onChange={e => setLetterCoverage(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                Distribuidor (Nombre)
              </label>
              <input
                type="text"
                className="erp-input text-sm w-full font-medium"
                value={letterDistributorName}
                onChange={e => setLetterDistributorName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                RFC del Distribuidor
              </label>
              <input
                type="text"
                className="erp-input text-sm w-full font-medium font-mono"
                value={letterRfc}
                onChange={e => setLetterRfc(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider font-bold">
              Líneas de Producto *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              {productLines.map(line => {
                const isSelected = letterSelectedLines.includes(line.id)
                return (
                  <button
                    type="button"
                    key={line.id}
                    onClick={() => {
                      if (isSelected) {
                        setLetterSelectedLines(letterSelectedLines.filter(id => id !== line.id))
                      } else {
                        setLetterSelectedLines([...letterSelectedLines, line.id])
                      }
                    }}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-blue-50/50 border-blue-500 font-semibold'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-gray-200 flex-shrink-0"
                      style={{ backgroundColor: line.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 truncate">{line.name}</p>
                      {line.description && <p className="text-[10px] text-gray-500 truncate">{line.description}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
              Fecha de Vencimiento
            </label>
            <input
              type="date"
              className="erp-input text-sm w-full font-mono font-medium"
              value={letterExpirationDate}
              onChange={e => setLetterExpirationDate(e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-gray-100 mt-6">
            <button
              type="button"
              onClick={() => setShowGenerateLetterModal(false)}
              className="btn-secondary text-sm"
              disabled={generatingLetter}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary text-sm bg-[#0763a9] text-white hover:bg-[#064d85]"
              disabled={generatingLetter}
            >
              {generatingLetter ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Generando...
                </>
              ) : (
                <>Generar PDF</>
              )}
            </button>
          </div>
        </form>
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

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3.5 rounded-xl shadow-xl text-white font-semibold text-sm ${
              toast.type === 'error' ? 'bg-[#ef4444]' : 'bg-[#10b981]'
            }`}
          >
            {toast.type === 'error' ? <X size={18} /> : <CheckCircle size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
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
