'use client'

import { useState, useEffect, use } from 'react'
import {
  Wrench, Download, ArrowLeft, CheckCircle2,
  Calendar, Building2, Hash, User, Loader2, ExternalLink,
  ClipboardList, FileText
} from 'lucide-react'
import Link from 'next/link'
import QRCode from 'qrcode'
import AppShell from '@/components/AppShell'

interface PreventivDetailProps {
  params: Promise<{ id: string }>
}

export default function MantenimientoPreventivDetailPage({ params }: PreventivDetailProps) {
  const { id } = use(params)
  const [record, setRecord] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const res = await fetch(`/api/mantenimiento/preventivo/${id}`)
        if (!res.ok) throw new Error('Registro no encontrado')
        const data = await res.json()
        setRecord(data)
        const qr = await QRCode.toDataURL(window.location.href, { width: 220, margin: 1 })
        setQrDataUrl(qr)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const formatDate = (d: string) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-xs font-semibold text-gray-500">Cargando reporte de mantenimiento...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (error || !record) {
    return (
      <AppShell>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
            <h2 className="text-lg font-bold text-red-700">Reporte no encontrado</h2>
            <p className="text-xs text-red-600">{error}</p>
            <Link href="/mantenimiento" className="inline-flex items-center gap-2 rounded-xl bg-red-600 text-white px-4 py-2 text-xs font-semibold hover:bg-red-700 transition-all">
              <ArrowLeft className="h-4 w-4" /> Volver a Mantenimiento
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  const pdfUrl = `/api/mantenimiento/preventivo/${record.id}/pdf`
  const tareas: any[] = Array.isArray(record.tareas) ? record.tareas : []

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Top navigation */}
        <div className="flex items-center justify-between">
          <Link href="/mantenimiento" className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Volver a Mantenimiento
          </Link>
          <div className="flex items-center gap-3">
            <a href={pdfUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold shadow-md shadow-blue-500/20 transition-all">
              <Download className="h-4 w-4" />
              <span>Descargar PDF</span>
            </a>
          </div>
        </div>

        {/* Main verification card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-200 space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-gray-100 pb-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Documento Verificado
                </span>
                <span className="text-xs font-mono text-gray-500">{record.folio}</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                  record.status === 'COMPLETADO'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {record.status}
                </span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Reporte de Mantenimiento Preventivo</h1>
              <p className="text-xs text-gray-500">Arthromed S.A. de C.V. — Servicio Técnico Certificado</p>
            </div>

            {qrDataUrl && (
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200 self-start">
                <img src={qrDataUrl} alt="QR Code" className="h-16 w-16 rounded" />
                <div className="text-[11px] text-gray-500">
                  <p className="font-bold text-gray-900">QR de Trazabilidad</p>
                  <p>Escanee para validar</p>
                </div>
              </div>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-100 text-xs">
            <div className="space-y-0.5">
              <span className="flex items-center gap-1 text-gray-500 font-semibold">
                <Building2 className="h-3 w-3" /> Cliente
              </span>
              <span className="font-bold text-gray-900">{record.cliente}</span>
            </div>
            <div className="space-y-0.5">
              <span className="flex items-center gap-1 text-gray-500 font-semibold">
                <Wrench className="h-3 w-3" /> Producto
              </span>
              <span className="font-bold text-gray-900">{record.producto}</span>
            </div>
            <div className="space-y-0.5">
              <span className="flex items-center gap-1 text-gray-500 font-semibold">
                <Hash className="h-3 w-3" /> No. Serie / Lote
              </span>
              <span className="font-mono font-bold text-gray-900">{record.numero_serie}</span>
            </div>
            <div className="space-y-0.5">
              <span className="flex items-center gap-1 text-gray-500 font-semibold">
                <Calendar className="h-3 w-3" /> Fecha de Servicio
              </span>
              <span className="font-bold text-gray-900">{formatDate(record.fecha_servicio)}</span>
            </div>
          </div>

          {/* Tasks list */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              Tareas de Mantenimiento ({tareas.length})
            </h2>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-3 text-left font-bold text-gray-600 w-8">#</th>
                    <th className="p-3 text-left font-bold text-gray-600">Tarea</th>
                    <th className="p-3 text-left font-bold text-gray-600">Descripción</th>
                    <th className="p-3 text-left font-bold text-gray-600">Observación OT</th>
                    <th className="p-3 text-center font-bold text-gray-600 w-20">Realizado</th>
                    <th className="p-3 text-center font-bold text-gray-600 w-20">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {tareas.map((t: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="p-3 font-bold text-gray-400">{idx + 1}</td>
                      <td className="p-3 font-semibold text-gray-900">{t.tarea}</td>
                      <td className="p-3 text-gray-700 max-w-xs leading-relaxed">{t.descripcion_reporte || t.descripcion_ot}</td>
                      <td className="p-3 text-gray-500 italic">{t.observacion_ot || '—'}</td>
                      <td className="p-3 text-center">
                        {t.realizado !== false
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                          : <span className="text-gray-400">○</span>}
                      </td>
                      <td className="p-3 text-center font-bold text-blue-600">
                        {(t.evidencias?.length || 0) > 0 ? t.evidencias.length : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Observations */}
          {record.observaciones && (
            <div className="bg-amber-50/50 border border-amber-200/60 p-4 rounded-xl">
              <h3 className="text-xs font-bold text-amber-900 mb-2 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Observaciones Generales
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed">{record.observaciones}</p>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-6 border-t border-gray-100 pt-4 text-xs">
            <div>
              <p className="text-gray-500 font-semibold mb-1">Elaborado por:</p>
              <p className="font-bold text-gray-900">{record.elaborado_por}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold mb-1">Revisado por:</p>
              <p className="font-bold text-gray-900">{record.revisado_por}</p>
            </div>
          </div>

          {/* PDF preview */}
          <div className="border-t border-gray-100 pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Vista Previa del Documento PDF
              </h2>
              <a href={pdfUrl} target="_blank" rel="noreferrer"
                className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">
                Abrir en pantalla completa <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="w-full h-[680px] rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
              <iframe src={pdfUrl} className="w-full h-full" title="Reporte PDF Mantenimiento Preventivo" />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
