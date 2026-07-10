'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import AppShell from '@/components/AppShell'
import {
  ArrowLeft, Package, FileText, User, CheckCircle2, AlertCircle,
  MessageSquare, Loader2, Tag, Calendar, Clock
} from 'lucide-react'
import Link from 'next/link'
import {
  calendarDaysDiff,
  computeDeliveryLimit,
  DELIVERY_REFERENCE_TOOLTIP,
} from '@/lib/delivery-limit'

function ShippingBadge({
  fechaPago,
  isReference,
}: {
  fechaPago: string | null
  isReference?: boolean
}) {
  if (!fechaPago) {
    return <span className="px-2 py-0.5 rounded text-[11px] bg-gray-100 text-gray-500">Sin primer pago</span>
  }
  const delivery = computeDeliveryLimit({
    primer_pago_fecha: fechaPago,
    primer_pago_monto: isReference ? 1 : 100,
    total: 100,
  })
  const limit = delivery.limitDate
  if (!limit) {
    return <span className="px-2 py-0.5 rounded text-[11px] bg-gray-100 text-gray-500">Sin límite</span>
  }
  const diffDays = calendarDaysDiff(new Date(), limit)
  const ref = isReference || delivery.isReferenceOnly
  if (ref) {
    return (
      <span
        className="px-2 py-0.5 rounded text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200"
        title={DELIVERY_REFERENCE_TOOLTIP}
      >
        Límite ref.: {limit.toLocaleDateString()} ({diffDays}d)
      </span>
    )
  }
  if (diffDays < 0) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-700 border border-red-200">
        Límite: {limit.toLocaleDateString()} (vencido {Math.abs(diffDays)}d)
      </span>
    )
  }
  if (diffDays <= 7) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
        Límite: {limit.toLocaleDateString()} ({diffDays}d restantes)
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-green-100 text-green-700 border border-green-200">
      Límite: {limit.toLocaleDateString()} ({diffDays}d restantes)
    </span>
  )
}

export default function ReparticionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notifying, setNotifying] = useState(false)
  const [notifyMsg, setNotifyMsg] = useState('')

  useEffect(() => {
    fetch(`/api/imports/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d.data)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleNotify = async () => {
    setNotifying(true)
    setNotifyMsg('')
    try {
      // Collect all affected invoices from allocations
      const allocations: any[] = []
      data?.importacion_items?.forEach((item: any) => {
        item.importacion_asignaciones?.forEach((asig: any) => {
          allocations.push({
            id: asig.factura_producto_id,
            allocatedQty: asig.cantidad_asignada
          })
        })
      })

      const res = await fetch('/api/imports/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations, repartitionId: id })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      setNotifyMsg('✅ Notificaciones enviadas exitosamente.')
    } catch (e: any) {
      setNotifyMsg('❌ Error: ' + e.message)
    } finally {
      setNotifying(false)
    }
  }

  const invoiceComments = (data?.comentarios_facturas || {}) as Record<string, string>
  const manualAllocations = (data?.asignaciones_manuales || []) as any[]

  // Group allocations by invoice folio
  const byInvoice: Record<string, { folio: string; clientName: string; fechaPago: string | null; items: any[] }> = {}
  data?.importacion_items?.forEach((item: any) => {
    item.importacion_asignaciones?.forEach((asig: any) => {
      const fp = asig.factura_productos
      if (!fp) return
      const fc = fp.facturas_cliente
      const folio = fc?.numero_factura || '—'
      if (!byInvoice[folio]) {
        byInvoice[folio] = {
          folio,
          clientName: fc?.cliente_nombre || '—',
          fechaPago: fc?.fecha_pago || null,
          items: []
        }
      }
      byInvoice[folio].items.push({
        producto: item.producto_nombre,
        cantidad: asig.cantidad_asignada,
        facturada: fp.cantidad_facturada ?? null,
        pendiente: fp.cantidad_pendiente ?? null,
        comentario: asig.comentario || null,
        ai_reasoning: asig.ai_reasoning,
        isManual: false,
      })
    })
  })

  for (const alloc of manualAllocations) {
    const folio = alloc.folio || '—'
    if (!byInvoice[folio]) {
      byInvoice[folio] = {
        folio,
        clientName: alloc.customerName || '—',
        fechaPago: alloc.paymentDate || null,
        items: []
      }
    }
    byInvoice[folio].items.push({
      producto: alloc.product,
      cantidad: alloc.allocatedQty || 0,
      facturada: alloc.facturadaQty ?? null,
      pendiente: alloc.requestedQty ?? null,
      comentario: alloc.comment || null,
      isManual: true,
    })
  }

  const invoiceGroups = Object.values(byInvoice).sort((a, b) => {
    if (!a.fechaPago && !b.fechaPago) return 0
    if (!a.fechaPago) return 1
    if (!b.fechaPago) return -1
    return new Date(a.fechaPago).getTime() - new Date(b.fechaPago).getTime()
  })

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </AppShell>
    )
  }

  if (error || !data) {
    return (
      <AppShell>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <p>{error || 'Repartición no encontrada'}</p>
          </div>
          <Link href="/imports/repartition" className="mt-4 inline-flex items-center gap-2 text-indigo-600 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Volver a Repartición
          </Link>
        </div>
      </AppShell>
    )
  }

  const totalAssigned = data.importacion_items?.reduce((s: number, item: any) =>
    s + item.importacion_asignaciones?.reduce((ss: number, a: any) => ss + (a.cantidad_asignada || 0), 0), 0) || 0

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/imports/repartition"
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Detalle de Repartición</h1>
              <p className="text-sm text-gray-500 font-mono mt-0.5">{id}</p>
            </div>
          </div>
          <button
            onClick={handleNotify}
            disabled={notifying}
            className="flex items-center gap-2 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm shadow-sm transition-all disabled:opacity-50"
          >
            {notifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            Notificar por WhatsApp
          </button>
        </div>

        {notifyMsg && (
          <div className={`p-3 rounded-lg text-sm font-medium ${notifyMsg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
            {notifyMsg}
          </div>
        )}

        {/* Meta cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">Fecha</p>
            <p className="font-semibold text-gray-900 text-sm">{new Date(data.created_at).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">Estado</p>
            <p className="font-semibold capitalize text-sm">
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">{data.status}</span>
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">Productos</p>
            <p className="font-semibold text-gray-900 text-sm">{data.importacion_items?.length || 0} sku</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">Total asignado</p>
            <p className="font-semibold text-indigo-700 text-sm">{totalAssigned} uds.</p>
          </div>
        </div>

        {/* Sources */}
        {data.importacion_fuentes?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500" /> Fuentes de inventario usadas
            </h2>
            <div className="flex flex-wrap gap-2">
              {data.importacion_fuentes.map((f: any) => (
                <span key={f.id} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${f.tipo_fuente === 'orden_compra' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {f.tipo_fuente === 'orden_compra' ? '📦 Orden: ' : '🏪 '}{f.numero_fuente}
                </span>
              ))}
            </div>
          </div>
        )}

        {data.comentarios && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Comentarios de la repartición
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.comentarios}</p>
          </div>
        )}

        {/* AI Reasoning */}
        {data.importacion_items?.[0]?.importacion_asignaciones?.[0]?.ai_reasoning && (
          <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 p-5 rounded-xl border border-violet-100 shadow-sm">
            <p className="text-xs font-semibold text-violet-500 uppercase tracking-wider mb-2">Razonamiento de la IA</p>
            <p className="text-violet-800 text-sm leading-relaxed whitespace-pre-wrap">
              {data.importacion_items[0].importacion_asignaciones[0].ai_reasoning}
            </p>
          </div>
        )}

        {/* Allocations by Invoice */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" /> Asignaciones por Factura
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {invoiceGroups.map(group => (
              <motion.div
                key={group.folio}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                      <FileText className="w-4 h-4 text-gray-400" />
                      Folio: {group.folio}
                      <ShippingBadge fechaPago={group.fechaPago} />
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> {group.clientName}
                    </p>
                    {invoiceComments[group.folio] && (
                      <p className="text-xs text-gray-600 mt-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 whitespace-pre-wrap">
                        <span className="font-medium">Comentario factura:</span> {invoiceComments[group.folio]}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {group.items.reduce((s, i) => s + i.cantidad, 0)} uds. asignadas
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left rounded-l-md">Producto</th>
                      <th className="px-4 py-2 text-center">Original</th>
                      <th className="px-4 py-2 text-center">Facturada</th>
                      <th className="px-4 py-2 text-center">Pendiente</th>
                      <th className="px-4 py-2 text-center">Asignado</th>
                      <th className="px-4 py-2 text-left rounded-r-md">Comentario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {group.items.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2 text-gray-700">
                          {item.producto}
                          {item.isManual && <span className="ml-1 text-[10px] text-indigo-600">(extra)</span>}
                        </td>
                        <td className="px-4 py-2 text-center font-mono text-gray-400">{(item.facturada ?? 0) + (item.pendiente ?? 0)}</td>
                        <td className="px-4 py-2 text-center font-mono text-gray-400">{item.facturada ?? '—'}</td>
                        <td className="px-4 py-2 text-center font-mono text-gray-500">{item.pendiente ?? '—'}</td>
                        <td className="px-4 py-2 text-center font-mono font-semibold text-indigo-700">{item.cantidad}</td>
                        <td className="px-4 py-2 text-gray-600 text-xs">{item.comentario || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            ))}

            {invoiceGroups.length === 0 && (
              <div className="p-10 text-center text-gray-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No hay asignaciones registradas.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
