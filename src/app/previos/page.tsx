'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import {
  Search, ChevronRight, X, ClipboardList, FileDown,
  Plus, Trash2, Star, ChevronLeft, CheckCircle,
  AlertCircle, ArrowRight, Loader2, User, Package
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'

const CARD = { background: '#ffffff', border: '1px solid #d4e0ec' }
const IVA_DEFAULT = 16

// ─── Types ───────────────────────────────────────────────────────────────────

interface Previo {
  id: string
  folio: string
  fecha: string
  cliente_nombre: string | null
  total_sin_descuento: number
  total_con_descuento: number
  pdf_url: string | null
}

interface Client {
  id: string
  name: string
  rfc?: string | null
}

interface Product {
  id: string
  nombre: string
  precio_unitario: number
  categoria: string | null
  tipo: string | null
  consecutivo_alg: string | null
  alegra_id: string | null
  frequency?: number
}

interface LineItem {
  producto_id: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  iva_porcentaje: number
  descuento_porcentaje: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcLine(item: LineItem) {
  const importe        = item.cantidad * item.precio_unitario
  const descuentoMonto = importe * (item.descuento_porcentaje / 100)
  const neto           = importe - descuentoMonto
  const ivaMonto       = neto * (item.iva_porcentaje / 100)
  return { importe, descuentoMonto, ivaMonto, subtotal: neto + ivaMonto }
}

function fmt(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Nueva Línea vacía ────────────────────────────────────────────────────────

function emptyLine(): LineItem {
  return { producto_id: null, descripcion: '', cantidad: 1, precio_unitario: 0, iva_porcentaje: IVA_DEFAULT, descuento_porcentaje: 0 }
}

// ─── Templates ───────────────────────────────────────────────────────────────

interface TemplateItem {
  producto_id: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  iva_porcentaje: number
  descuento_porcentaje: number
}

interface Template {
  name: string
  description: string
  items: TemplateItem[]
}

const TEMPLATES: Template[] = [
  {
    name: "Torre Bonss UBE",
    description: "Plantilla para cotización de Torre Bonss UBE",
    items: [
      {
        producto_id: "39a02175-5593-4c40-a06c-eb819d57c4a5", // Sistema de vision WEYO
        descripcion: "Sistema de Visión Weyo 4K BONSS\n- Monitor 4K 32”\n- Procesador de video 4K\n- Fuente de luz fría\n- Guía de luz de fibra óptica\n- Cabezal de cámara endoscópica\n- Carro de torre endoscópica",
        cantidad: 1,
        precio_unitario: 1527960.00,
        iva_porcentaje: 16,
        descuento_porcentaje: 0
      },
      {
        producto_id: "f0f5897d-7a97-45f7-9c00-d6bded28abfb", // Sistema Shaver RIC11
        descripcion: "Sistema Shaver BONSS\n- Sistema RIC11\n- Interruptor de piso",
        cantidad: 1,
        precio_unitario: 230000.00,
        iva_porcentaje: 16,
        descuento_porcentaje: 0
      },
      {
        producto_id: "2417eea3-b0be-498c-acad-b21458145bb3", // Pieza de Mano Shaver MMB0
        descripcion: "Pieza de mano MMB0",
        cantidad: 1,
        precio_unitario: 145800.00,
        iva_porcentaje: 16,
        descuento_porcentaje: 0
      },
      {
        producto_id: "c54b85d5-9286-445f-b3c6-26a3c6d3e641", // Sistema BONSS ARS600
        descripcion: "Sistema de radiofrecuencia BONSS\n- Sistema ARS600\n- Interruptor de piso",
        cantidad: 1,
        precio_unitario: 137500.00,
        iva_porcentaje: 16,
        descuento_porcentaje: 0
      },
      {
        producto_id: "dbe6325e-b49a-4009-a259-586f2a20631b", // INSTRUMENTAL BONSS UBE KIT AX + BX
        descripcion: "BONSS UBE Kit AX+BX\n-Charola de esterilización-Kit instrumental de dilatadores y retractores-Kit de osteotomía endoscópica",
        cantidad: 1,
        precio_unitario: 253000.00,
        iva_porcentaje: 16,
        descuento_porcentaje: 0
      },
      {
        producto_id: "747889a1-99a9-4563-8c5b-36075789abef", // INSTRUMENTAL BONSS UBE KIT CX
        descripcion: "BONSS UBE Kit CX-Charola de esterilización\n- Kit de pinzas endoscópicas y Kerrison",
        cantidad: 1,
        precio_unitario: 128975.00,
        iva_porcentaje: 16,
        descuento_porcentaje: 0
      },
      {
        producto_id: "d0ad4064-1d45-4d55-95e6-ed98f40d4148", // INSTRUMENTAL BONSS UBE Kit EX 0°
        descripcion: "BONSS UBE Kit EX\n-Charola de esterilización\n-Dilatador-Cánula de endoscopio\n-Lente 0º o 30º",
        cantidad: 1,
        precio_unitario: 49500.00,
        iva_porcentaje: 16,
        descuento_porcentaje: 0
      }
    ]
  }
]


// ─── Product Picker ───────────────────────────────────────────────────────────

function ProductPicker({
  suggested,
  all,
  onSelect,
  onClose,
}: {
  suggested: Product[]
  all: Product[]
  onSelect: (p: Product) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')

  const filtered = q.trim()
    ? all.filter((p) =>
        p.nombre.toLowerCase().includes(q.toLowerCase()) ||
        (p.consecutivo_alg || '').toLowerCase().includes(q.toLowerCase())
      )
    : all

  const suggestedIds = new Set(suggested.map((p) => p.id))

  return (
    <div className="flex flex-col" style={{ minHeight: '400px' }}>
      {/* Search */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          autoFocus
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto..."
          className="erp-input pl-9 w-full text-sm"
        />
      </div>

      <div className="-mx-1 px-1">
        {/* Suggested section */}
        {!q && suggested.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 px-1" style={{ color: '#8a8b8d' }}>
              ⭐ Productos frecuentes de este cliente
            </p>
            {suggested.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-50 transition-colors text-left mb-0.5"
              >
                <Star size={13} className="shrink-0 text-amber-400 fill-amber-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#37383a' }}>{p.nombre}</p>
                </div>
                <span className="text-xs font-mono shrink-0" style={{ color: '#0763a9' }}>
                  ${fmt(p.precio_unitario)}
                </span>
              </button>
            ))}
            <div className="border-t my-3" style={{ borderColor: '#e8f1f9' }} />
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 px-1" style={{ color: '#8a8b8d' }}>
              Todos los productos
            </p>
          </div>
        )}

        {!q && suggested.length === 0 && (
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 px-1" style={{ color: '#8a8b8d' }}>
            Productos
          </p>
        )}

        {filtered.map((p) => {
          const wasBought = suggestedIds.has(p.id)
          const freq      = suggested.find((s) => s.id === p.id)?.frequency ?? 0
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-50 transition-colors text-left mb-0.5"
            >
              {wasBought
                ? <Star size={13} className="shrink-0 text-amber-400 fill-amber-400" />
                : <Package size={13} className="shrink-0 text-gray-300" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#37383a' }}>{p.nombre}</p>
                  {wasBought && (
                    <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: '#fef3c7', color: '#92400e' }}>
                      {freq}×
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs font-mono shrink-0" style={{ color: '#0763a9' }}>
                ${fmt(p.precio_unitario)}
              </span>
            </button>
          )
        })}

        {filtered.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: '#8a8b8d' }}>
            No se encontraron productos.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function PreviosContent() {
  const { t } = useI18n()
  const router = useRouter()

  // ── List state ──
  const [previos, setPrevios] = useState<Previo[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(search, 350)

  // ── Creator wizard state ──
  const [showCreator, setShowCreator] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  // Step 1: client
  const [clientSearch, setClientSearch] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const debouncedClientSearch = useDebounce(clientSearch, 300)

  // Step 2: products
  const [suggested, setSuggested] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [lines, setLines] = useState<LineItem[]>([emptyLine()])
  const [showPicker, setShowPicker] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Convert to cotización state ──
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [convertResult, setConvertResult] = useState<{
    folio: string
    success: boolean
    message: string
    cotizacion_id?: string
    numero?: string
  } | null>(null)

  // ── Fetch previos list ──
  const fetchPrevios = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '20',
      ...(debouncedSearch && { search: debouncedSearch }),
    })
    try {
      const res = await fetch(`/api/previos?${params}`)
      const json = await res.json()
      setPrevios(json.data || [])
      setTotal(json.count || 0)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page])

  useEffect(() => { fetchPrevios() }, [fetchPrevios])
  useEffect(() => { setPage(1) }, [debouncedSearch])

  // ── Fetch clients for step 1 ──
  useEffect(() => {
    if (!showCreator || step !== 1) return
    setClientsLoading(true)
    const params = new URLSearchParams({ pageSize: '30' })
    if (debouncedClientSearch) params.set('search', debouncedClientSearch)
    fetch(`/api/clients?${params}`)
      .then((r) => r.json())
      .then((d) => setClients(d.data || []))
      .catch(console.error)
      .finally(() => setClientsLoading(false))
  }, [showCreator, step, debouncedClientSearch])

  // ── Fetch products for step 2 ──
  useEffect(() => {
    if (step !== 2) return
    setProductsLoading(true)
    const params = new URLSearchParams()
    if (selectedClient) params.set('cliente_id', selectedClient.id)
    fetch(`/api/previos/client-products?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setSuggested(d.suggested || [])
        setAllProducts(d.all || [])

        // Pre-populate lines with template items if chosen, otherwise suggested products (top 5 max)
        if (selectedTemplate) {
          setLines(selectedTemplate.items.map((item) => ({ ...item })))
        } else {
          const top = (d.suggested as Product[]).slice(0, 5)
          if (top.length > 0) {
            setLines(top.map((p) => ({
              producto_id:          p.id,
              descripcion:          p.nombre,
              cantidad:             1,
              precio_unitario:      p.precio_unitario,
              iva_porcentaje:       IVA_DEFAULT,
              descuento_porcentaje: 0,
            })))
          } else {
            setLines([emptyLine()])
          }
        }
      })
      .catch(console.error)
      .finally(() => setProductsLoading(false))
  }, [step, selectedClient, selectedTemplate])

  // ── Open / reset creator ──
  function openCreator() {
    setSelectedTemplate(null)
    setStep(1)
    setSelectedClient(null)
    setClientSearch('')
    setLines([emptyLine()])
    setSaveError(null)
    setShowCreator(true)
  }

  function openCreatorWithTemplate(template: Template) {
    setSelectedTemplate(template)
    setStep(1)
    setSelectedClient(null)
    setClientSearch('')
    setLines(template.items.map((item) => ({ ...item })))
    setSaveError(null)
    setShowCreator(true)
  }

  function closeCreator() {
    setShowCreator(false)
  }

  // ── Line helpers ──
  function updateLine(index: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  function addEmptyLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function pickProduct(index: number, p: Product) {
    updateLine(index, {
      producto_id:     p.id,
      descripcion:     p.nombre,
      precio_unitario: p.precio_unitario,
    })
    setShowPicker(null)
  }

  // ── Totals ──
  const totals = lines.reduce(
    (acc, l) => {
      const c = calcLine(l)
      return {
        sinDescuento: acc.sinDescuento + c.importe,
        conDescuento: acc.conDescuento + c.subtotal,
        descuento:    acc.descuento + c.descuentoMonto,
      }
    },
    { sinDescuento: 0, conDescuento: 0, descuento: 0 }
  )

  // ── Save previo ──
  async function savePrevio() {
    if (!selectedClient && step === 2) {
      setSaveError('Selecciona un cliente antes de guardar.')
      return
    }
    const valid = lines.filter((l) => l.descripcion.trim() && l.precio_unitario > 0)
    if (valid.length === 0) {
      setSaveError('Agrega al menos un producto con precio.')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/previos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id:     selectedClient?.id || null,
          cliente_nombre: selectedClient?.name || '',
          items: valid.map((l) => ({
            producto_id:          l.producto_id,
            descripcion:          l.descripcion,
            cantidad:             l.cantidad,
            precio_unitario:      l.precio_unitario,
            iva_porcentaje:       l.iva_porcentaje,
            descuento_porcentaje: l.descuento_porcentaje,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al guardar')
      closeCreator()
      fetchPrevios()
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Convert previo to cotización ──
  async function convertToCotizacion(previo: Previo) {
    setConvertingId(previo.id)
    try {
      const res = await fetch(`/api/previos/${previo.id}/to-cotizacion`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        setConvertResult({
          folio: previo.folio,
          success: true,
          message: `Cotización ${data.numero} creada exitosamente en Alegra.`,
          cotizacion_id: data.cotizacion_id,
          numero: data.numero,
        })
      } else {
        setConvertResult({
          folio: previo.folio,
          success: false,
          message: data.error || 'No se pudo crear la cotización.',
        })
      }
    } catch (e: any) {
      setConvertResult({
        folio: previo.folio,
        success: false,
        message: e.message || 'Error de conexión.',
      })
    } finally {
      setConvertingId(null)
      setTimeout(() => setConvertResult(null), 8000)
    }
  }

  const totalPages = Math.ceil(total / 20)

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-4">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#37383a' }}>Previos</h1>
            <p className="text-sm" style={{ color: '#5a5b5d' }}>{total} registros</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="relative">
              <select
                onChange={(e) => {
                  const val = e.target.value
                  if (val === 'torre-bonss-ube') {
                    openCreatorWithTemplate(TEMPLATES[0])
                  }
                  e.target.value = ''
                }}
                className="btn-secondary text-sm font-medium py-2 px-3 pr-8 rounded-xl border border-gray-300 appearance-none focus:outline-none cursor-pointer"
                defaultValue=""
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.5rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em',
                  paddingRight: '2rem'
                }}
              >
                <option value="" disabled>Crear desde Plantilla...</option>
                <option value="torre-bonss-ube">Torre Bonss UBE</option>
              </select>
            </div>
            <button
              id="btn-nuevo-previo"
              onClick={openCreator}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              Nuevo Previo
            </button>
          </div>
        </div>

        {/* ── Convert result toast ── */}
        {convertResult && (
          <div className={`p-4 rounded-xl flex items-start gap-3 border transition-all ${
            convertResult.success
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
              : 'bg-rose-50 border-rose-100 text-rose-800'
          }`}>
            {convertResult.success
              ? <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              : <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="text-sm font-medium">{convertResult.message}</p>
              {convertResult.success && convertResult.cotizacion_id && (
                <Link
                  href={`/cotizaciones/${convertResult.cotizacion_id}`}
                  className="text-xs mt-1 inline-flex items-center gap-1 underline"
                >
                  Ver cotización <ArrowRight size={12} />
                </Link>
              )}
            </div>
            <button onClick={() => setConvertResult(null)} className="btn-ghost p-1">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Search ── */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8a8b8d' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por folio, cliente o total..."
            className="erp-input pl-9 w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8a8b8d' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── List ── */}
        <div className="rounded-2xl overflow-hidden bg-white" style={CARD}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0763a9', borderTopColor: 'transparent' }} />
            </div>
          ) : previos.length === 0 ? (
            <div className="text-center py-16" style={{ color: '#8a8b8d' }}>
              <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
              <p>{t('noResults' as any) || 'No se encontraron resultados.'}</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e8f1f9' }}>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#8a8b8d' }}>Folio</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#8a8b8d' }}>Fecha</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#8a8b8d' }}>Cliente</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#8a8b8d' }}>Total (Sin Desc)</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#8a8b8d' }}>Total (Con Desc)</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#8a8b8d' }}>PDF</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#8a8b8d' }}>Acciones</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {previos.map((previo) => (
                      <tr key={previo.id} className="group hover:bg-blue-50/40 transition-colors" style={{ borderBottom: '1px solid #f0f5fa' }}>
                        <td className="px-4 py-3 text-sm font-mono font-bold" style={{ color: '#0763a9' }}>{previo.folio}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#5a5b5d' }}>{new Date(previo.fecha).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: '#37383a' }}>{previo.cliente_nombre || '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono" style={{ color: '#5a5b5d' }}>
                          ${previo.total_sin_descuento ? previo.total_sin_descuento.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold" style={{ color: '#0763a9' }}>
                          ${previo.total_con_descuento ? previo.total_con_descuento.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </td>
                        <td className="px-4 py-3">
                          <a href={`/api/previos/${previo.id}/pdf`} target="_blank" rel="noopener noreferrer" className="btn-ghost p-1.5 inline-flex" style={{ color: '#0763a9' }}>
                            <FileDown size={16} />
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            id={`btn-convert-${previo.id}`}
                            disabled={convertingId === previo.id}
                            onClick={() => convertToCotizacion(previo)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
                            style={{ background: '#edf4fb', color: '#0763a9' }}
                            title="Convertir a Cotización en Alegra"
                          >
                            {convertingId === previo.id
                              ? <Loader2 size={13} className="animate-spin" />
                              : <ArrowRight size={13} />}
                            Cotización
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/previos/${previo.id}`} className="btn-ghost p-1.5 opacity-0 group-hover:opacity-100">
                            <ChevronRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="lg:hidden divide-y" style={{ borderColor: '#f0f5fa' }}>
                {previos.map((previo) => (
                  <div key={previo.id} className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-semibold font-mono" style={{ color: '#0763a9' }}>{previo.folio}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#5a5b5d' }}>{previo.cliente_nombre || '—'}</p>
                        <p className="text-xs" style={{ color: '#8a8b8d' }}>{new Date(previo.fecha).toLocaleDateString()}</p>
                      </div>
                      <span className="text-sm font-mono font-semibold" style={{ color: '#0763a9' }}>
                        ${previo.total_con_descuento ? previo.total_con_descuento.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={convertingId === previo.id}
                        onClick={() => convertToCotizacion(previo)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
                        style={{ background: '#edf4fb', color: '#0763a9' }}
                      >
                        {convertingId === previo.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                        Cotización
                      </button>
                      <Link href={`/previos/${previo.id}`} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium btn-secondary">
                        Ver <ChevronRight size={12} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #e8f1f9' }}>
                  <p className="text-xs" style={{ color: '#8a8b8d' }}>
                    Mostrando {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} de {total}
                  </p>
                  <div className="flex gap-1">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">← Anterior</button>
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Siguiente →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          CREATOR MODAL
      ══════════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={showCreator}
        onClose={closeCreator}
        title={step === 1 ? 'Nuevo Previo — Seleccionar Cliente' : `Nuevo Previo — ${selectedClient?.name || 'Productos'}`}
        maxWidth="860px"
      >
        {/* ─── Step 1: Client Selection ─── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Buscar cliente por nombre o RFC..."
                className="erp-input pl-9 w-full"
              />
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e8f1f9', maxHeight: 380, overflowY: 'auto' }}>
              {clientsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin" style={{ color: '#0763a9' }} />
                </div>
              ) : clients.length === 0 ? (
                <div className="text-center py-12" style={{ color: '#8a8b8d' }}>
                  <User size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No se encontraron clientes.</p>
                </div>
              ) : (
                clients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedClient(c); setStep(2) }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left"
                    style={{ borderBottom: '1px solid #f0f5fa' }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm"
                      style={{ background: '#edf4fb', color: '#0763a9' }}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#37383a' }}>{c.name}</p>
                      {c.rfc && <p className="text-xs font-mono" style={{ color: '#8a8b8d' }}>{c.rfc}</p>}
                    </div>
                    <ChevronRight size={16} style={{ color: '#c4c5c7' }} />
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={closeCreator} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        )}

        {/* ─── Step 2: Product Lines ─── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Client badge */}
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#edf4fb' }}>
              <button type="button" onClick={() => setStep(1)} className="btn-ghost p-1">
                <ChevronLeft size={15} />
              </button>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: '#0763a9', color: '#fff' }}>
                {selectedClient?.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#37383a' }}>{selectedClient?.name}</p>
                {selectedClient?.rfc && <p className="text-xs font-mono" style={{ color: '#5a5b5d' }}>{selectedClient.rfc}</p>}
              </div>
              {productsLoading && <Loader2 size={14} className="animate-spin ml-auto" style={{ color: '#0763a9' }} />}
            </div>

            {/* Lines table */}
            <div className="rounded-xl overflow-hidden overflow-x-auto border border-[#e8f1f9]">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr style={{ background: '#fafbfc', borderBottom: '1px solid #e8f1f9' }}>
                    <th className="text-left px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[280px]">Producto</th>
                    <th className="text-right px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Cant.</th>
                    <th className="text-right px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">Precio</th>
                    <th className="text-right px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">IVA %</th>
                    <th className="text-right px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Desc %</th>
                    <th className="text-right px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Subtotal</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const { subtotal } = calcLine(line)
                    const isSuggested  = suggested.some((s) => s.id === line.producto_id)
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f5fa' }}>
                        <td className="px-2 py-2">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowPicker(showPicker === i ? null : i)}
                              className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 hover:bg-blue-50 transition-colors min-h-[36px]"
                              style={{ border: '1px solid #e8f1f9' }}
                            >
                              {isSuggested && <Star size={11} className="shrink-0 text-amber-400 fill-amber-400" />}
                              <span className={`flex-1 min-w-0 text-sm truncate ${line.producto_id || line.descripcion ? '' : 'text-gray-400'}`}
                                style={{ color: line.producto_id || line.descripcion ? '#37383a' : undefined }}>
                                {allProducts.find((p) => p.id === line.producto_id)?.nombre || line.descripcion || 'Seleccionar producto...'}
                              </span>
                              <Package size={12} className="shrink-0 text-gray-300" />
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min="1" value={line.cantidad}
                            onChange={(e) => updateLine(i, { cantidad: Number(e.target.value) })}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="erp-input w-full text-right text-sm no-spin"
                            style={{ padding: '6px 8px' }} />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min="0" step="0.01" value={line.precio_unitario}
                            onChange={(e) => updateLine(i, { precio_unitario: Number(e.target.value) })}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="erp-input w-full text-right text-sm font-mono no-spin"
                            style={{ padding: '6px 8px' }} />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min="0" max="100" value={line.iva_porcentaje}
                            onChange={(e) => updateLine(i, { iva_porcentaje: Number(e.target.value) })}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="erp-input w-full text-right text-sm no-spin"
                            style={{ padding: '6px 8px' }} />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min="0" max="100" value={line.descuento_porcentaje}
                            onChange={(e) => updateLine(i, { descuento_porcentaje: Number(e.target.value) })}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="erp-input w-full text-right text-sm no-spin"
                            style={{ padding: '6px 8px' }} />
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-semibold text-sm" style={{ color: '#0763a9' }}>
                          ${fmt(subtotal)}
                        </td>
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => removeLine(i)}
                            className="btn-ghost p-1 text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <button type="button" onClick={addEmptyLine}
              className="btn-ghost flex items-center gap-1.5 text-sm" style={{ color: '#0763a9' }}>
              <Plus size={15} /> Agregar línea
            </button>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="rounded-xl p-4 space-y-1.5 text-sm min-w-60" style={{ background: '#f5f9fd', border: '1px solid #d4e0ec' }}>
                <div className="flex justify-between gap-8">
                  <span style={{ color: '#5a5b5d' }}>Subtotal (sin desc.):</span>
                  <span className="font-mono" style={{ color: '#37383a' }}>${fmt(totals.sinDescuento)}</span>
                </div>
                {totals.descuento > 0 && (
                  <div className="flex justify-between gap-8">
                    <span style={{ color: '#5a5b5d' }}>Descuento:</span>
                    <span className="font-mono text-red-600">-${fmt(totals.descuento)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-8 pt-1.5 border-t font-bold" style={{ borderColor: '#d4e0ec' }}>
                  <span style={{ color: '#37383a' }}>Total:</span>
                  <span className="font-mono text-base" style={{ color: '#0763a9' }}>${fmt(totals.conDescuento)}</span>
                </div>
              </div>
            </div>

            {saveError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-sm">
                <AlertCircle size={15} /> {saveError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={closeCreator} disabled={saving} className="btn-secondary">Cancelar</button>
              <button
                id="btn-guardar-previo"
                onClick={savePrevio}
                disabled={saving}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                {saving ? 'Guardando...' : 'Guardar Previo'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Product Picker Modal — renders in a portal, not clipped by overflow */}
      <Modal
        open={showPicker !== null}
        onClose={() => setShowPicker(null)}
        title="Seleccionar Producto"
        maxWidth="520px"
      >
        {showPicker !== null && (
          <ProductPicker
            suggested={suggested}
            all={allProducts}
            onSelect={(p) => pickProduct(showPicker, p)}
            onClose={() => setShowPicker(null)}
          />
        )}
      </Modal>
    </AppShell>
  )
}

export default function PreviosPage() {
  return (
    <Suspense fallback={
      <AppShell>
        <div className="max-w-7xl mx-auto py-16 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0763a9', borderTopColor: 'transparent' }} />
        </div>
      </AppShell>
    }>
      <PreviosContent />
    </Suspense>
  )
}
