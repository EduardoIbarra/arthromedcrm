'use client'

import { useEffect, useState, useMemo, use } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Hospital, Product, HospitalPrice } from '@/types/database'
import { useI18n } from '@/contexts/I18nContext'
import { Building, ArrowLeft, Search, ArrowUpDown, AlertCircle, Edit2, Download, Ban, ExternalLink, RefreshCw, GripVertical, FilePlus2 } from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** Official price-list section names (must match PDF headers) */
const PRICE_LIST_LINES = [
  'SPORTS MEDICINE (ARTROSCOPIA)',
  'UBE (ENDOSCOPIA BIPORTAL UNILATERAL)',
  'SPINE (COLUMNA)',
  'ENT (OTORRINOLARINGOLOGIA)',
  'URO&GYN (UROLOGIA Y GINECOLOGIA)',
  'UBE KIT (INSTRUMENTAL ENDOSCOPIA BIPORTAL UNILATERAL)',
  'SHAVER SYSTEM',
  'PINZAS ENDOSCOPICAS',
  'SHAVER & BUR',
] as const

type PriceRow = Product & {
  hospital_price: number | null
  price_id: string | null
  pending: boolean
}

export default function HospitalPricesPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { t } = useI18n()
  
  const [hospital, setHospital] = useState<Hospital | null>(null)
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<keyof PriceRow>('sort_order' as any)
  const [sortAsc, setSortAsc] = useState(true)

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState<{
    product_id: string
    description: string
    price_id: string | null
    price: number | ''
    pending: boolean
    line: string
  }>({
    product_id: '',
    description: '',
    price_id: null,
    price: '',
    pending: false,
    line: '',
  })
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)

  // PDF export options (defaults match official letter / reference price list)
  const todayInputValue = () => {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const defaultVigencia = () => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [pdfOptions, setPdfOptions] = useState({
    date: todayInputValue(),
    vigencia: defaultVigencia(),
    includeIva: false,
    currency: 'MXN',
    minPurchase: '72500',
    deliveryTime: '15 días hábiles',
  })

  type PublicationRow = {
    id: string
    document_date: string
    vigencia: string
    status: string
    effective_status: 'active' | 'revoked' | 'expired'
    revoked_at: string | null
    revoke_reason: string | null
    currency: string
    include_iva: boolean
    created_at: string
  }
  const [publications, setPublications] = useState<PublicationRow[]>([])
  const [loadingPubs, setLoadingPubs] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const fetchPublications = async () => {
    try {
      setLoadingPubs(true)
      const res = await fetch(`/api/prices/publications?hospitalId=${resolvedParams.id}`)
      const json = await res.json()
      if (res.ok) setPublications(json.publications || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingPubs(false)
    }
  }

  const fetchProperData = async () => {
    try {
      setIsLoading(true)
      const { data: hData, error: hErr } = await supabase
        .from('hospitals')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()
        
      if (hErr) throw hErr
      setHospital(hData as Hospital)

      // Fetch products and filter to only those in the PDF list (having sort_order)
      const { data: productsData, error: pErr } = await supabase
        .from('products')
        .select('*')
        .not('sort_order', 'is', null)
        
      if (pErr) throw pErr

      // Fetch prices for this hospital
      const { data: pricesData, error: hpErr } = await supabase
        .from('hospital_prices')
        .select('*')
        .eq('hospital_id', resolvedParams.id)

      if (hpErr) throw hpErr

      const priceMap = new Map<string, HospitalPrice>()
      pricesData.forEach((hp: any) => {
        priceMap.set(hp.product_id, hp as HospitalPrice)
      })

      const combined: PriceRow[] = productsData.map((p: any) => {
        const hp = priceMap.get(p.id)
        // Prefer hospital-specific price; fall back to base list price from the official PDF
        const basePrice =
          p.base_hospital_price !== null && p.base_hospital_price !== undefined
            ? Number(p.base_hospital_price)
            : null
        return {
          ...p,
          description: p.description || p.nombre || '',
          hospital_price: hp ? Number(hp.price) : basePrice,
          price_id: hp ? hp.id : null,
          pending: hp ? hp.pending : false
        }
      })

      // Fetch catalog lines for colors
      const { data: linesData, error: linesErr } = await supabase
        .from('catalog_lines')
        .select('*')
      if (linesErr) throw linesErr

      const colorMap: Record<string, string> = {}
      linesData?.forEach((l: any) => {
        if (l.color) colorMap[l.name.toUpperCase()] = l.color
      })
      setLineColors(colorMap)

      // Sort by sort_order ascending
      combined.sort((a, b) => (a.sort_order || 9999) - (b.sort_order || 9999))

      setPrices(combined)

    } catch (err: any) {
      console.error('Error fetching data:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const [lineColors, setLineColors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchProperData()
    fetchPublications()
  }, [resolvedParams.id])

  const handleOpenEdit = (item: PriceRow) => {
    setEditForm({
      product_id: item.id,
      description: [item.description, item.model, item.order_code].filter(Boolean).join(' - '),
      price_id: item.price_id,
      price: item.hospital_price !== null ? item.hospital_price : '',
      pending: item.pending,
      line: item.line || '',
    })
    setIsEditModalOpen(true)
  }

  const handleSavePrice = async () => {
    if (!editForm.product_id) return
    setIsSaving(true)
    try {
      // Update product line (section) on the master product
      if (editForm.line) {
        const { error: lineErr } = await supabase
          .from('products')
          .update({
            line: editForm.line,
            category: editForm.line,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editForm.product_id)
        if (lineErr) throw lineErr
      }

      if (editForm.price === '') {
        // Delete custom price
        if (editForm.price_id) {
          const { error } = await supabase
            .from('hospital_prices')
            .delete()
            .eq('id', editForm.price_id)
          if (error) throw error
        }
      } else {
        // Upsert custom price
        const payload = {
          product_id: editForm.product_id,
          hospital_id: resolvedParams.id,
          price: Number(editForm.price),
          pending: editForm.pending
        }
        
        if (editForm.price_id) {
          const { error } = await supabase
            .from('hospital_prices')
            .update(payload)
            .eq('id', editForm.price_id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('hospital_prices')
            .insert(payload)
          if (error) throw error
        }
      }
      
      setIsEditModalOpen(false)
      fetchProperData()
    } catch (err: any) {
      console.error('Error saving specific price:', err)
      alert(t('error') + ': ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredAndSorted = useMemo(() => {
    let result = prices

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p => 
        (p.description?.toLowerCase() || '').includes(q) ||
        (p.model?.toLowerCase() || '').includes(q) ||
        (p.order_code?.toLowerCase() || '').includes(q) ||
        (p.line?.toLowerCase() || '').includes(q)
      )
    }

    // When searching or using a non-default sort, allow column sort; otherwise keep sort_order for DnD
    const useColumnSort = !!search || sortField !== ('sort_order' as any)
    result = [...result].sort((a, b) => {
      if (!useColumnSort) {
        return (a.sort_order || 9999) - (b.sort_order || 9999)
      }
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (aVal === bVal) return 0
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1
      
      const comparison = (aVal as any) < (bVal as any) ? -1 : 1
      return sortAsc ? comparison : -comparison
    })

    return result
  }, [prices, search, sortField, sortAsc])

  const canDrag = !search && sortField === ('sort_order' as any)

  const persistSortOrder = async (ordered: PriceRow[]) => {
    setIsReordering(true)
    try {
      // Optimistic UI already applied; write sort_order 1..n
      await Promise.all(
        ordered.map((p, idx) =>
          supabase
            .from('products')
            .update({ sort_order: idx + 1, updated_at: new Date().toISOString() })
            .eq('id', p.id)
        )
      )
    } catch (e: any) {
      console.error(e)
      alert(t('error') + ': ' + (e.message || 'No se pudo guardar el orden'))
      fetchProperData()
    } finally {
      setIsReordering(false)
    }
  }

  const handleRowDragStart = (e: React.DragEvent, id: string) => {
    if (!canDrag) return
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleRowDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault()
    if (!canDrag || !draggedId || draggedId === overId) return

    setPrices((prev) => {
      const ordered = [...prev].sort((a, b) => (a.sort_order || 9999) - (b.sort_order || 9999))
      const from = ordered.findIndex((p) => p.id === draggedId)
      const to = ordered.findIndex((p) => p.id === overId)
      if (from < 0 || to < 0 || from === to) return prev
      const next = [...ordered]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next.map((p, idx) => ({ ...p, sort_order: idx + 1 }))
    })
  }

  const handleRowDragEnd = () => {
    if (!draggedId) return
    const ordered = [...prices].sort((a, b) => (a.sort_order || 9999) - (b.sort_order || 9999))
    setDraggedId(null)
    void persistSortOrder(ordered)
  }

  const latestActivePublication = useMemo(
    () => publications.find((p) => p.effective_status === 'active') || publications[0] || null,
    [publications]
  )

  const downloadPublicationPdf = (publicationId: string) => {
    const params = new URLSearchParams({
      hospitalId: resolvedParams.id,
      publicationId,
    })
    window.open(`/api/prices/export?${params.toString()}`, '_blank')
  }

  const exportToExcel = () => {
    const headers = [t('description'), t('model'), t('orderCode'), t('baseHospitalPrice'), t('price'), t('pending')]
    const rows = filteredAndSorted.map(p => [
      p.description,
      p.model || '',
      p.order_code || '',
      p.base_hospital_price !== null ? p.base_hospital_price : '',
      p.hospital_price !== null ? p.hospital_price : '',
      p.pending ? 'Sí' : 'No'
    ])
    
    // Convert to CSV
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
      
    // Add BOM for Excel UTF-8 support
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const hospitalName = hospital ? hospital.name.replace(/\s+/g, '_').toLowerCase() : 'hospital'
    a.download = `precios_${hospitalName}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const handleSort = (field: keyof PriceRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const formatCurrency = (val: number | null) => {
    if (val === null) return '-'
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/hospitals"
          className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Building className="text-blue-600" size={28} />
            {hospital ? hospital.name : t('loading')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('hospitals')} / {t('hospitalPrices')}
          </p>
        </div>
        <button 
          onClick={exportToExcel} 
          className="btn-secondary text-sm ml-auto"
          disabled={prices.length === 0}
        >
          <Download size={16} /> {t('exportExcel')}
        </button>
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={!latestActivePublication || prices.length === 0}
          title={
            latestActivePublication
              ? 'Descarga el PDF de la última publicación (mismo QR, sin crear versión nueva)'
              : 'Aún no hay una publicación. Genera un PDF nuevo primero.'
          }
          onClick={() => {
            if (!latestActivePublication) return
            downloadPublicationPdf(latestActivePublication.id)
          }}
        >
          <Download size={16} /> Descargar última PDF
        </button>
        <button 
          onClick={() => {
            setPdfOptions({
              date: todayInputValue(),
              vigencia: defaultVigencia(),
              includeIva: false,
              currency: 'MXN',
              minPurchase: '72500',
              deliveryTime: '15 días hábiles',
            })
            setIsPdfModalOpen(true)
          }}
          className="btn-primary text-sm"
          disabled={prices.length === 0}
        >
          <FilePlus2 size={16} /> Generar nueva PDF
        </button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder={t('searchProducts')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="erp-input pl-10"
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      </div>

      {/* Published lists (QR / vigencia / revoke) */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Listas publicadas (QR)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              “Generar nueva PDF” crea una versión con QR público. “Descargar última” reutiliza la misma sin nueva versión.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchPublications}
            className="btn-secondary text-xs"
            disabled={loadingPubs}
          >
            <RefreshCw size={14} className={loadingPubs ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2.5 font-semibold">Fecha doc.</th>
                <th className="px-4 py-2.5 font-semibold">Vigencia</th>
                <th className="px-4 py-2.5 font-semibold">Estado</th>
                <th className="px-4 py-2.5 font-semibold">Enlace público</th>
                <th className="px-4 py-2.5 font-semibold">PDF</th>
                <th className="px-4 py-2.5 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {publications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                    {loadingPubs
                      ? 'Cargando…'
                      : 'Aún no hay listas publicadas. Genera un PDF para crear el primer QR.'}
                  </td>
                </tr>
              ) : (
                publications.map((pub) => {
                  const statusLabel =
                    pub.effective_status === 'active'
                      ? 'Vigente'
                      : pub.effective_status === 'revoked'
                        ? 'Revocada'
                        : 'Vencida'
                  const statusClass =
                    pub.effective_status === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : pub.effective_status === 'revoked'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-800'
                  const docDate = String(pub.document_date).slice(0, 10)
                  const vigDate = String(pub.vigencia).slice(0, 10)
                  const publicUrl = `/lista-precios/${pub.id}`
                  return (
                    <tr key={pub.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-800">{docDate}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-800">{vigDate}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-md ${statusClass}`}>
                          {statusLabel}
                        </span>
                        {pub.revoke_reason && (
                          <p className="text-xs text-gray-500 mt-1 max-w-[200px] truncate" title={pub.revoke_reason}>
                            {pub.revoke_reason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs font-medium"
                        >
                          Ver página <ExternalLink size={12} />
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                          onClick={() => downloadPublicationPdf(pub.id)}
                        >
                          <Download size={12} /> Descargar
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {pub.effective_status === 'active' ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                            disabled={revokingId === pub.id}
                            onClick={async () => {
                              const reason = window.prompt(
                                'Motivo de revocación (opcional):',
                                'Lista de precios revocada por el emisor'
                              )
                              if (reason === null) return
                              try {
                                setRevokingId(pub.id)
                                const res = await fetch(`/api/prices/publications/${pub.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'revoke', reason }),
                                })
                                if (!res.ok) {
                                  const err = await res.json().catch(() => ({}))
                                  throw new Error(err.error || 'No se pudo revocar')
                                }
                                await fetchPublications()
                              } catch (e: any) {
                                alert(e.message || 'Error al revocar')
                              } finally {
                                setRevokingId(null)
                              }
                            }}
                          >
                            <Ban size={14} />
                            {revokingId === pub.id ? '…' : 'Revocar'}
                          </button>
                        ) : pub.status === 'revoked' ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                            disabled={revokingId === pub.id}
                            onClick={async () => {
                              if (!confirm('¿Reactivar esta lista de precios?')) return
                              try {
                                setRevokingId(pub.id)
                                const res = await fetch(`/api/prices/publications/${pub.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'reactivate' }),
                                })
                                if (!res.ok) throw new Error('No se pudo reactivar')
                                await fetchPublications()
                              } catch (e: any) {
                                alert(e.message || 'Error')
                              } finally {
                                setRevokingId(null)
                              }
                            }}
                          >
                            Reactivar
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-12 flex justify-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="card p-8 text-center text-red-500 bg-red-50 border-red-100">
          {error}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {!canDrag && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
              Arrastra filas para reordenar cuando no hay búsqueda y el orden es por lista (sort). Limpia la búsqueda para reordenar.
            </div>
          )}
          {isReordering && (
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
              Guardando orden…
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="p-3 w-10" title="Arrastrar para reordenar" />
                  {[
                    { key: 'model', label: 'PRODUCTO' },
                    { key: 'order_code', label: 'REFERENCIA' },
                    { key: 'line', label: 'LÍNEA' },
                    { key: 'description', label: 'DESCRIPCIÓN' },
                    { key: 'hospital_price', label: 'IMPORTE' },
                    { key: 'pending', label: t('pending') },
                  ].map((col) => (
                    <th 
                      key={col.key}
                      onClick={() => handleSort(col.key as keyof PriceRow)}
                      className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        {col.label}
                        <ArrowUpDown size={14} className={sortField === col.key ? 'text-blue-600' : 'text-gray-300'} />
                      </div>
                    </th>
                  ))}
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap w-16">
                    {t('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAndSorted.map(item => {
                  // Row tint matches official PDF palette (incl. SHAVER & BUR handpiece families)
                  const lineU = (item.line || item.category || '').toUpperCase()
                  const modelU = (item.model || '').toUpperCase()
                  const codeU = (item.order_code || '').toUpperCase()
                  const blob = `${modelU} ${codeU}`
                  let customBg: string | undefined
                  if (lineU.includes('SPORTS MEDICINE')) customBg = lineColors['SPORTS MEDICINE'] || '#F8CBAD'
                  else if (lineU.includes('UBE KIT')) customBg = lineColors['UBE'] || '#33CCCC'
                  else if (lineU.includes('UBE')) customBg = lineColors['UBE'] || '#33CCCC'
                  else if (lineU.includes('SPINE')) customBg = lineColors['SPINE'] || '#C6E0B4'
                  else if (lineU.startsWith('ENT') || lineU.includes('ENT (')) customBg = lineColors['ENT'] || '#BDD7EE'
                  else if (lineU.includes('URO')) customBg = lineColors['URO & GYN'] || '#FFE699'
                  else if (lineU.includes('PINZAS')) customBg = lineColors['PINZAS'] || lineColors['SPINE'] || '#C6E0B4'
                  else if (lineU.includes('SHAVER SYSTEM')) customBg = lineColors['SHAVER SYSTEM'] || lineColors['Systems'] || '#D0D0D0'
                  else if (lineU.includes('SHAVER') && lineU.includes('BUR')) {
                    if (blob.includes('SHB0') || codeU.startsWith('BDJ')) customBg = '#F8CBAD'
                    else if (blob.includes('SHA0') || codeU.startsWith('BDA')) customBg = '#BDD7EE'
                    else if (blob.includes('MMD0') || codeU.includes('10510')) customBg = '#BDD7EE'
                    else if (
                      blob.includes('MMA0') ||
                      codeU === 'DGB30UA290' ||
                      codeU.includes('UA209') ||
                      codeU.includes('UA290')
                    ) {
                      customBg = '#C6E0B4'
                    } else if (blob.includes('MMB0') || codeU.startsWith('DGB') || codeU.startsWith('DG-')) {
                      customBg = '#33CCCC'
                    } else customBg = '#F8CBAD'
                  } else if (lineU.includes('SHAVER') || lineU.includes('BUR')) {
                    customBg = lineColors['Systems'] || '#D0D0D0'
                  }
                  const isDragging = draggedId === item.id
                  
                  return (
                    <tr 
                      key={item.id}
                      draggable={canDrag}
                      onDragStart={(e) => handleRowDragStart(e, item.id)}
                      onDragOver={(e) => handleRowDragOver(e, item.id)}
                      onDragEnd={handleRowDragEnd}
                      className={`transition-colors ${
                        isDragging ? 'opacity-50 ring-2 ring-blue-300' : ''
                      } ${item.pending ? 'bg-amber-50/40 hover:bg-amber-50/80' : 'hover:bg-blue-50/30'} ${
                        canDrag ? 'cursor-grab active:cursor-grabbing' : ''
                      }`}
                      style={customBg ? { backgroundColor: `${customBg}99` } : {}}
                    >
                      <td className="p-2 text-gray-300">
                        <GripVertical size={16} className={canDrag ? 'text-gray-400' : 'text-gray-200'} />
                      </td>
                      <td className="p-4 text-sm font-bold text-gray-900 whitespace-nowrap">{item.model || '-'}</td>
                      <td className="p-4 text-sm font-mono text-gray-600 whitespace-nowrap">{item.order_code || '-'}</td>
                      <td className="p-4 text-xs text-gray-600 max-w-[140px]">
                        <span className="line-clamp-2" title={item.line || ''}>
                          {item.line || '-'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-600">{item.description || '-'}</td>
                      <td className="p-4 font-bold text-gray-900 whitespace-nowrap">
                        {formatCurrency(item.hospital_price)}
                      </td>
                    <td className="p-4">
                      {item.pending ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          <AlertCircle size={14} />
                          {t('pending')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                          -
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title={t('editSpecificPrice')}
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
                {filteredAndSorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      {t('noResults')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-gray-100 bg-gray-50/30 text-xs text-gray-500 flex justify-between">
            <span>
              {canDrag
                ? 'Arrastra las filas (icono ⋮⋮) para cambiar el orden de la lista / PDF.'
                : 'Quita la búsqueda para reordenar por arrastre.'}
            </span>
            <span>
              {filteredAndSorted.length} {t('products').toLowerCase()}
            </span>
          </div>
        </div>
      )}

      {/* PDF export options */}
      <Modal
        open={isPdfModalOpen}
        onClose={() => !isExportingPdf && setIsPdfModalOpen(false)}
        title="Opciones de lista de precios"
        maxWidth="520px"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Crea una <strong>nueva versión</strong> con QR público. Para re-descargar la actual sin nueva versión usa “Descargar última PDF”.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del documento</label>
              <input
                type="date"
                value={pdfOptions.date}
                onChange={(e) => setPdfOptions({ ...pdfOptions, date: e.target.value })}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vigencia (hasta)</label>
              <input
                type="date"
                value={pdfOptions.vigencia}
                onChange={(e) => setPdfOptions({ ...pdfOptions, vigencia: e.target.value })}
                className="erp-input w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Por defecto 1 año. El QR validará esta fecha.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
            <select
              value={pdfOptions.currency}
              onChange={(e) => setPdfOptions({ ...pdfOptions, currency: e.target.value })}
              className="erp-input w-full"
            >
              <option value="MXN">MXN — Peso mexicano</option>
              <option value="USD">USD — Dólar estadounidense</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={pdfOptions.includeIva}
              onChange={(e) => setPdfOptions({ ...pdfOptions, includeIva: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Precios incluyen IVA</span>
              <p className="text-xs text-gray-500 mt-0.5">
                {pdfOptions.includeIva
                  ? 'Se mostrará: “Precios con IVA incluido.”'
                  : 'Se mostrará: “Precios sin IVA incluido.” (por defecto)'}
              </p>
            </div>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Compra mínima ({pdfOptions.currency})
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={pdfOptions.minPurchase}
              onChange={(e) => setPdfOptions({ ...pdfOptions, minPurchase: e.target.value })}
              className="erp-input w-full"
              placeholder="72500"
            />
            <p className="text-xs text-gray-500 mt-1">Por defecto 72,500.00 {pdfOptions.currency} (IVA incluido).</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tiempo de entrega</label>
            <input
              type="text"
              value={pdfOptions.deliveryTime}
              onChange={(e) => setPdfOptions({ ...pdfOptions, deliveryTime: e.target.value })}
              className="erp-input w-full"
              placeholder="15 días hábiles"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsPdfModalOpen(false)}
              className="btn-secondary"
              disabled={isExportingPdf}
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={isExportingPdf || !pdfOptions.date}
              onClick={() => {
                try {
                  setIsExportingPdf(true)
                  const params = new URLSearchParams({
                    hospitalId: resolvedParams.id,
                    date: pdfOptions.date,
                    vigencia: pdfOptions.vigencia || defaultVigencia(),
                    includeIva: pdfOptions.includeIva ? 'true' : 'false',
                    currency: pdfOptions.currency || 'MXN',
                    minPurchase: pdfOptions.minPurchase || '72500',
                    deliveryTime: pdfOptions.deliveryTime || '15 días hábiles',
                  })
                  window.open(`/api/prices/export?${params.toString()}`, '_blank')
                  setIsPdfModalOpen(false)
                  // Refresh publications shortly after export creates a new one
                  setTimeout(() => fetchPublications(), 1500)
                } catch (err) {
                  console.error(err)
                } finally {
                  setIsExportingPdf(false)
                }
              }}
            >
              <FilePlus2 size={16} className="inline mr-1" />
              {isExportingPdf ? t('loading') : 'Generar nueva versión'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Specific Price Modal */}
      <Modal 
        open={isEditModalOpen} 
        onClose={() => !isSaving && setIsEditModalOpen(false)}
        title={t('editSpecificPrice')}
      >
        <div className="space-y-5">
          <p className="text-sm font-medium text-gray-900">{editForm.description}</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Línea / sección del PDF
            </label>
            <select
              value={editForm.line}
              onChange={(e) => setEditForm({ ...editForm, line: e.target.value })}
              className="erp-input w-full"
            >
              <option value="">— Seleccionar —</option>
              {PRICE_LIST_LINES.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
              {/* Keep current value if it's custom / not in the official list */}
              {editForm.line &&
                !(PRICE_LIST_LINES as readonly string[]).includes(editForm.line) && (
                  <option value={editForm.line}>{editForm.line}</option>
                )}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Define en qué encabezado aparece el producto en la lista y el PDF.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('price')}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={editForm.price}
              onChange={(e) => setEditForm({ ...editForm, price: e.target.value === '' ? '' : Number(e.target.value) })}
              className="erp-input w-full"
              placeholder="Dejar en blanco para eliminar el precio específico..."
            />
            <p className="text-xs text-gray-500 mt-1">Si dejas este campo en blanco, se eliminará el precio personalizado y se usará el precio base.</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={editForm.pending}
              onChange={(e) => setEditForm({ ...editForm, pending: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">{t('pending')}</span>
          </label>

          <div className="flex justify-end gap-3 mt-6">
            <button 
              onClick={() => setIsEditModalOpen(false)} 
              className="btn-secondary"
              disabled={isSaving}
            >
              {t('cancel')}
            </button>
            <button 
              onClick={handleSavePrice} 
              className="btn-primary"
              disabled={isSaving}
            >
              {isSaving ? t('loading') : t('saveChanges')}
            </button>
          </div>
        </div>
      </Modal>

    </div>
    </AppShell>
  )
}
