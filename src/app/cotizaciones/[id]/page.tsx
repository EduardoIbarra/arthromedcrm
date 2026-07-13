'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, FileText, Calendar, DollarSign, User, FileSpreadsheet, 
  MessageSquare, Paperclip, Send, Upload, Loader2, Download, CheckCircle,
  Zap, RefreshCw, X
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import CotizacionPaymentPlan from '../_components/CotizacionPaymentPlan'
import { createClient } from '@/lib/supabase/client'

interface Comment {
  id: string
  comentario: string
  created_at: string
}

interface Document {
  id: string
  nombre: string
  url: string
  created_at: string
}

interface ProductItem {
  id: string
  producto_nombre: string
  producto_codigo: string | null
  cantidad: number
  precio_unitario: number
  importe: number
}

interface OptionItem {
  id: string
  descripcion: string
}

interface Client {
  nombre: string
  correo: string | null
  telefono: string | null
  rfc: string | null
  direccion: string | null
  regimen_fiscal?: string | null
}

interface Cotizacion {
  id: string
  alegra_id: string | null
  numero_cotizacion: string
  cliente_nombre: string
  cliente_rfc: string | null
  fecha_expedicion: string
  fecha_vencimiento: string | null
  estado: string
  subtotal: number
  iva: number
  total: number
  observaciones: string | null
  created_at: string
  updated_at: string
  cfdi_id: string | null
  metodo_pago_id: string | null
  forma_pago_id: string | null
  clientes?: Client | null
  cfdi?: OptionItem | null
  metodo_pago?: OptionItem | null
  forma_pago?: OptionItem | null
  productos: ProductItem[]
  comentarios: Comment[]
  documentos: Document[]
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pendiente: { label: 'Pendiente',  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100'  },
  aceptada:  { label: 'Aceptada',   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  rechazada: { label: 'Rechazada',  bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-100'   },
  cancelada: { label: 'Cancelada',  bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-100'  },
  billed:    { label: 'Facturado',    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  unbilled:  { label: 'No Facturado', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100'  },
  facturado: { label: 'Facturado',    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  'no facturado': { label: 'No Facturado', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
}

const REGIMENES_FISCALES = [
  { id: '601', descripcion: 'General de Ley Personas Morales' },
  { id: '603', descripcion: 'Personas Morales con Fines no Lucrativos' },
  { id: '605', descripcion: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { id: '606', descripcion: 'Arrendamiento' },
  { id: '607', descripcion: 'Régimen de Enajenación o Adquisición de Bienes' },
  { id: '608', descripcion: 'Demás ingresos' },
  { id: '610', descripcion: 'Residentes en el Extranjero sin Establecimiento Permanente en México' },
  { id: '611', descripcion: 'Ingresos por Dividendos (socios y accionistas)' },
  { id: '612', descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { id: '614', descripcion: 'Ingresos por intereses' },
  { id: '615', descripcion: 'Régimen de los ingresos por obtención de premios' },
  { id: '616', descripcion: 'Sin obligaciones fiscales' },
  { id: '620', descripcion: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos' },
  { id: '621', descripcion: 'Incorporación Fiscal' },
  { id: '622', descripcion: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { id: '623', descripcion: 'Opcional para Grupos de Sociedades' },
  { id: '624', descripcion: 'Coordinados' },
  { id: '625', descripcion: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { id: '626', descripcion: 'Régimen Simplificado de Confianza' },
]

export default function CotizacionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const supabase = createClient()

  const [quote, setQuote] = useState<Cotizacion | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Options state
  const [cfdiOptions, setCfdiOptions] = useState<OptionItem[]>([])
  const [metodoPagoOptions, setMetodoPagoOptions] = useState<OptionItem[]>([])
  const [formaPagoOptions, setFormaPagoOptions] = useState<OptionItem[]>([])
  const [savingOptions, setSavingOptions] = useState(false)

  // Comments state
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // Documents state
  const [uploadingDoc, setUploadingDoc] = useState(false)

  // Timbrar Modal State
  const [showTimbrarModal, setShowTimbrarModal] = useState(false)
  const [isTimbrando, setIsTimbrando] = useState(false)
  const [timbrarMetodo, setTimbrarMetodo] = useState('PUE')
  const [timbrarUso, setTimbrarUso] = useState('G03')
  const [timbrarForma, setTimbrarForma] = useState('01')
  const [timbrarRegimen, setTimbrarRegimen] = useState('')

  useEffect(() => {
    if (quote) {
      if (quote.metodo_pago_id) setTimbrarMetodo(quote.metodo_pago_id)
      if (quote.cfdi_id) setTimbrarUso(quote.cfdi_id)
      if (quote.forma_pago_id) setTimbrarForma(quote.forma_pago_id)
      
      if (quote.clientes && 'regimen_fiscal' in quote.clientes && quote.clientes.regimen_fiscal) {
        // Try to match the regimen
        const regimenStr = quote.clientes.regimen_fiscal.toLowerCase()
        const matched = REGIMENES_FISCALES.find(r => 
          regimenStr.includes(r.id) || regimenStr.includes(r.descripcion.toLowerCase())
        )
        if (matched) setTimbrarRegimen(matched.id)
      }
    }
  }, [quote])

  const fetchOptions = async () => {
    try {
      const res = await fetch('/api/cotizaciones/options')
      const json = await res.json()
      if (json.data) {
        setCfdiOptions(json.data.cfdi || [])
        setMetodoPagoOptions(json.data.metodo_pago || [])
        setFormaPagoOptions(json.data.forma_pago || [])
      }
    } catch (err) {
      console.error('Error fetching options:', err)
    }
  }

  const fetchQuoteDetails = async () => {
    try {
      const res = await fetch(`/api/cotizaciones/${id}`)
      const data = await res.json()
      if (data.data) {
        setQuote(data.data)
      } else {
        router.push('/cotizaciones')
      }
    } catch (err) {
      console.error('Error fetching quote details:', err)
      router.push('/cotizaciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      Promise.all([fetchOptions(), fetchQuoteDetails()])
    }
  }, [id])

  const handleOptionChange = async (field: 'cfdi_id' | 'metodo_pago_id' | 'forma_pago_id', value: string) => {
    if (!quote) return
    setSavingOptions(true)
    try {
      const res = await fetch(`/api/cotizaciones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      })
      const json = await res.json()
      if (json.data) {
        setQuote(prev => prev ? {
          ...prev,
          cfdi_id: json.data.cfdi_id,
          metodo_pago_id: json.data.metodo_pago_id,
          forma_pago_id: json.data.forma_pago_id,
          cfdi: json.data.cfdi,
          metodo_pago: json.data.metodo_pago,
          forma_pago: json.data.forma_pago
        } : null)
      }
    } catch (err) {
      console.error('Error updating quote option:', err)
    } finally {
      setSavingOptions(false)
    }
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return

    setSubmittingComment(true)
    try {
      const res = await fetch(`/api/cotizaciones/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comentario: commentText })
      })
      const data = await res.json()
      if (data.data) {
        setQuote(prev => prev ? {
          ...prev,
          comentarios: [data.data, ...prev.comentarios]
        } : null)
        setCommentText('')
      }
    } catch (err) {
      console.error('Error posting comment:', err)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingDoc(true)
    try {
      const ext = file.name.split('.').pop() || 'pdf'
      const timestamp = Date.now()
      const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`

      const { data, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(`cotizaciones/${id}/${fileName}`, file)

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(data.path)
      const fileUrl = publicUrlData.publicUrl

      const res = await fetch(`/api/cotizaciones/${id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: file.name, url: fileUrl })
      })
      const dbData = await res.json()
      if (dbData.data) {
        setQuote(prev => prev ? {
          ...prev,
          documentos: [dbData.data, ...prev.documentos]
        } : null)
      }
    } catch (err: any) {
      console.error('Error uploading document:', err)
      alert('Error al subir el archivo: ' + err.message)
    } finally {
      setUploadingDoc(false)
    }
  }

  const handleTimbrar = async () => {
    if (!quote) return
    setIsTimbrando(true)
    try {
      const res = await fetch(`/api/cotizaciones/${quote.id}/timbrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          metodo_pago: timbrarMetodo, 
          uso_cfdi: timbrarUso, 
          forma_pago: timbrarForma,
          regimen_fiscal: timbrarRegimen || undefined
        })
      })
      const data = await res.json()
      if (data.success) {
        alert('Cotización facturada y timbrada exitosamente.')
        setShowTimbrarModal(false)
        fetchQuoteDetails()
      } else {
        alert(data.error || 'Error al timbrar.')
      }
    } catch (err: any) {
      alert(err.message || 'Error de conexión.')
    } finally {
      setIsTimbrando(false)
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  }

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="animate-spin text-blue-600" size={36} />
          <span className="text-sm text-gray-400 font-medium">Cargando detalles de cotización...</span>
        </div>
      </AppShell>
    )
  }

  if (!quote) return null

  const statusObj = STATUS_MAP[quote.estado?.toLowerCase()] || {
    label: quote.estado,
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-100'
  }

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Back and actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/cotizaciones')}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition shadow-sm"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                Cotización: {quote.numero_cotizacion}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusObj.bg} ${statusObj.text} ${statusObj.border}`}>
                  {statusObj.label}
                </span>
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Folio único ERP / Integrado desde Alegra
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            {quote.estado?.toLowerCase() !== 'facturado' && quote.estado?.toLowerCase() !== 'billed' && (
              <button
                onClick={() => setShowTimbrarModal(true)}
                className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition gap-2 shadow-sm"
              >
                <Zap size={16} /> Timbrar
              </button>
            )}
            <a
              href={`/api/cotizaciones/${quote.id}/pdf`}
              download
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition gap-2 shadow-sm shrink-0"
            >
              <Download size={16} />
              Descargar PDF
            </a>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card Principal */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                  Información de la Cotización
                </h2>
                {savingOptions && (
                  <span className="text-xs text-blue-500 font-medium flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> Guardando...
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <User className="text-gray-400 mt-1 shrink-0" size={20} />
                  <div>
                    <p className="text-xs text-gray-400">Cliente</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{quote.cliente_nombre}</p>
                    {quote.cliente_rfc && (
                      <p className="text-xs text-gray-500 mt-0.5 font-mono">RFC: {quote.cliente_rfc}</p>
                    )}
                    {quote.clientes?.direccion && (
                      <p className="text-xs text-gray-400 mt-1">{quote.clientes.direccion}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="text-gray-400 mt-1 shrink-0" size={20} />
                  <div>
                    <p className="text-xs text-gray-400">Fechas</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      Expedición: <span className="font-semibold">{formatDate(quote.fecha_expedicion)}</span>
                    </p>
                    {quote.fecha_vencimiento && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Vence: {formatDate(quote.fecha_vencimiento)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Combobox selectors for CFDI and Payment */}
              <div className="border-t border-gray-100 pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Uso de CFDI
                  </label>
                  <select
                    value={quote.cfdi_id || ''}
                    onChange={e => handleOptionChange('cfdi_id', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  >
                    <option value="">Seleccionar Uso CFDI</option>
                    {cfdiOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>
                        {opt.id} - {opt.descripcion}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={quote.metodo_pago_id || ''}
                    onChange={e => handleOptionChange('metodo_pago_id', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  >
                    <option value="">Seleccionar Método</option>
                    {metodoPagoOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>
                        {opt.id} - {opt.descripcion}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Forma de Pago
                  </label>
                  <select
                    value={quote.forma_pago_id || ''}
                    onChange={e => handleOptionChange('forma_pago_id', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  >
                    <option value="">Seleccionar Forma</option>
                    {formaPagoOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>
                        {opt.id} - {opt.descripcion}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Financial values */}
              <div className="border-t border-gray-100 pt-6">
                <div className="grid grid-cols-3 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                  <div className="text-center md:text-left md:pl-4">
                    <p className="text-[10px] uppercase text-gray-400 tracking-wider font-semibold">Subtotal</p>
                    <p className="text-sm md:text-base font-semibold text-gray-700 mt-1">
                      {formatCurrency(Number(quote.subtotal || 0))}
                    </p>
                  </div>
                  <div className="text-center md:text-left md:pl-4 border-l border-gray-200">
                    <p className="text-[10px] uppercase text-gray-400 tracking-wider font-semibold">IVA</p>
                    <p className="text-sm md:text-base font-semibold text-gray-700 mt-1">
                      {formatCurrency(Number(quote.iva || 0))}
                    </p>
                  </div>
                  <div className="text-center md:text-left md:pl-4 border-l border-gray-200">
                    <p className="text-[10px] uppercase text-gray-400 tracking-wider font-semibold text-blue-600">Total</p>
                    <p className="text-base md:text-lg font-bold text-gray-900 mt-0.5">
                      {formatCurrency(Number(quote.total || 0))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes / Obs */}
              {quote.observaciones && (
                <div className="border-t border-gray-100 pt-6">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">
                    Observaciones (Alegra)
                  </p>
                  <div className="p-4 bg-amber-50/40 border border-amber-100 rounded-lg text-sm text-gray-600 italic">
                    "{quote.observaciones}"
                  </div>
                </div>
              )}
            </div>

            {/* Products sheet (Looks like invoice) */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50/30">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                  Conceptos / Partidas
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                      <th className="py-3 px-6">Código</th>
                      <th className="py-3 px-6">Descripción</th>
                      <th className="py-3 px-6 text-center">Cantidad</th>
                      <th className="py-3 px-6 text-right">Precio Unitario</th>
                      <th className="py-3 px-6 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {quote.productos && quote.productos.length > 0 ? (
                      quote.productos.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition">
                          <td className="py-4 px-6 font-mono text-xs text-gray-500">
                            {item.producto_codigo || '-'}
                          </td>
                          <td className="py-4 px-6 font-medium text-gray-900">
                            {item.producto_nombre}
                          </td>
                          <td className="py-4 px-6 text-center font-semibold">
                            {item.cantidad}
                          </td>
                          <td className="py-4 px-6 text-right">
                            {formatCurrency(Number(item.precio_unitario || 0))}
                          </td>
                          <td className="py-4 px-6 text-right font-bold text-gray-950">
                            {formatCurrency(Number(item.importe || 0))}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400 italic">
                          No se encontraron partidas para esta cotización. Sincronice de nuevo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Plan */}
            <CotizacionPaymentPlan quote={quote} onUpdate={fetchQuoteDetails} />

            {/* Comments Section */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <MessageSquare size={18} />
                Comentarios ({quote.comentarios.length})
              </h2>

              <form onSubmit={handlePostComment} className="flex gap-3">
                <input
                  type="text"
                  placeholder="Escribe un comentario..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  disabled={submittingComment}
                />
                <button
                  type="submit"
                  disabled={submittingComment || !commentText.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 shrink-0 flex items-center gap-2"
                >
                  {submittingComment ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Comentar
                </button>
              </form>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {quote.comentarios.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-6">
                    No hay comentarios en esta cotización.
                  </p>
                ) : (
                  quote.comentarios.map(c => (
                    <div key={c.id} className="p-4 bg-gray-50/70 border border-gray-100 rounded-lg space-y-1">
                      <p className="text-sm text-gray-800 font-medium leading-relaxed">
                        {c.comentario}
                      </p>
                      <p className="text-[10px] text-gray-400 font-normal text-right">
                        {formatDateTime(c.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar documents section */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <Paperclip size={18} />
                Documentos Adjuntos
              </h2>

              {/* Upload field */}
              <div className="relative">
                <input
                  type="file"
                  id="doc-upload"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploadingDoc}
                />
                <label
                  htmlFor="doc-upload"
                  className={`w-full py-4 border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-xl flex flex-col items-center justify-center cursor-pointer transition ${
                    uploadingDoc ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {uploadingDoc ? (
                    <Loader2 size={24} className="animate-spin text-blue-600 mb-2" />
                  ) : (
                    <Upload size={24} className="text-gray-400 mb-2" />
                  )}
                  <span className="text-xs font-semibold text-gray-700">
                    {uploadingDoc ? 'Subiendo...' : 'Adjuntar archivo'}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-1">
                    Cualquier formato (PDF, Imagen, Word)
                  </span>
                </label>
              </div>

              {/* File list */}
              <div className="space-y-3">
                {quote.documentos.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-4">
                    No se han adjuntado documentos.
                  </p>
                ) : (
                  quote.documentos.map(doc => (
                    <div
                      key={doc.id}
                      className="p-3 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-between gap-3 hover:bg-gray-100/70 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-800 truncate" title={doc.nombre}>
                          {doc.nombre}
                        </p>
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          {formatDateTime(doc.created_at)}
                        </p>
                      </div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-white border border-gray-200 text-gray-600 hover:text-blue-600 rounded-lg hover:border-blue-200 transition"
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Metadata */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider">
                Detalles del Sistema
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">UUID Interno:</span>
                  <span className="font-mono text-gray-700 select-all">{quote.id}</span>
                </div>
                {quote.alegra_id && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">ID Alegra:</span>
                    <span className="font-mono text-gray-700 select-all">{quote.alegra_id}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Creado en ERP:</span>
                  <span className="text-gray-700">{formatDateTime(quote.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Última Sincro:</span>
                  <span className="text-gray-700">{formatDateTime(quote.updated_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TIMBRAR MODAL */}
      <Modal
        open={showTimbrarModal}
        onClose={() => !isTimbrando && setShowTimbrarModal(false)}
        title="Timbrar Cotización"
        maxWidth="500px"
      >
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            Estás a punto de convertir la cotización <strong>{quote?.numero_cotizacion}</strong> en una Factura y timbrarla ante el SAT.
          </p>
          <div className="space-y-3 mt-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Uso de CFDI</label>
              <select
                value={timbrarUso}
                onChange={e => setTimbrarUso(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Seleccionar Uso CFDI</option>
                {cfdiOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.id} - {opt.descripcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Método de Pago</label>
              <select
                value={timbrarMetodo}
                onChange={e => setTimbrarMetodo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Seleccionar Método</option>
                {metodoPagoOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.id} - {opt.descripcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Forma de Pago</label>
              <select
                value={timbrarForma}
                onChange={e => setTimbrarForma(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Seleccionar Forma</option>
                {formaPagoOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.id} - {opt.descripcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Régimen Fiscal (Opcional - Llena si te da error el SAT)
              </label>
              <select
                value={timbrarRegimen}
                onChange={e => setTimbrarRegimen(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">No modificar / Ya está en Alegra</option>
                {REGIMENES_FISCALES.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.id} - {opt.descripcion}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowTimbrarModal(false)}
              disabled={isTimbrando}
              className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleTimbrar}
              disabled={isTimbrando}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition disabled:opacity-50"
            >
              {isTimbrando ? <RefreshCw className="animate-spin w-4 h-4" /> : <Zap size={16} />}
              Confirmar y Timbrar
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}
