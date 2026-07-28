'use client'

import { useState, useEffect, use } from 'react'
import {
  FileText,
  Download,
  QrCode,
  ArrowLeft,
  Wrench,
  CheckCircle2,
  Calendar,
  Building,
  User,
  ExternalLink,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import QRCode from 'qrcode'
import AppShell from '@/components/AppShell'

interface ReporteDetailProps {
  params: Promise<{ id: string }>
}

export default function MantenimientoReporteDetailPage({ params }: ReporteDetailProps) {
  const { id } = use(params)
  const [reporte, setReporte] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    async function loadReporte() {
      try {
        setLoading(true)
        const res = await fetch(`/api/mantenimiento/reportes/${id}`)
        if (!res.ok) {
          throw new Error('Reporte no encontrado')
        }
        const data = await res.json()
        setReporte(data)

        // Generate QR code Data URL for display
        const url = window.location.href
        const qrUrl = await QRCode.toDataURL(url, { width: 300, margin: 1 })
        setQrDataUrl(qrUrl)
      } catch (err: any) {
        setError(err.message || 'Error al cargar el reporte')
      } finally {
        setLoading(false)
      }
    }
    loadReporte()
  }, [id])

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-96 items-center justify-center p-6">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-xs font-semibold text-gray-500">Cargando reporte de trazabilidad...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (error || !reporte) {
    return (
      <AppShell>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
            <h2 className="text-lg font-bold text-red-700">Reporte no encontrado</h2>
            <p className="text-xs text-red-600">{error || 'El reporte solicitado no existe o fue eliminado.'}</p>
            <Link
              href="/mantenimiento"
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 text-white px-4 py-2 text-xs font-semibold hover:bg-red-700 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver a Mantenimiento</span>
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  const pdfUrl = `/api/mantenimiento/reportes/${reporte.id}/pdf`

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/mantenimiento"
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a Mantenimiento</span>
          </Link>

          <div className="flex items-center gap-3">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
            >
              <Download className="h-4 w-4" />
              <span>Descargar PDF</span>
            </a>
          </div>
        </div>

        {/* Main Verification Card */}
        <div className="rounded-2xl bg-white p-6 shadow-xs border border-gray-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Documento Verificado
                </span>
                <span className="text-xs font-mono text-gray-500">{reporte.folio}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">{reporte.titulo}</h1>
              <p className="text-xs text-gray-500">Arthromed S.A. de C.V. — Trazabilidad Oficial</p>
            </div>

            {/* QR Code */}
            {qrDataUrl && (
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200 self-start sm:self-auto">
                <img src={qrDataUrl} alt="QR Code Trazabilidad" className="h-16 w-16 rounded" />
                <div className="text-[11px] text-gray-500">
                  <p className="font-bold text-gray-900">QR de Trazabilidad</p>
                  <p>Escanee para validar la autenticidad</p>
                </div>
              </div>
            )}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-100 text-xs">
            <div>
              <span className="text-gray-500 font-semibold block mb-0.5">Empresa / Remitente:</span>
              <span className="font-bold text-gray-900">{reporte.empresa}</span>
            </div>

            <div>
              <span className="text-gray-500 font-semibold block mb-0.5">Fabricante / Marca:</span>
              <span className="font-bold text-blue-700">{reporte.fabricante}</span>
            </div>

            <div>
              <span className="text-gray-500 font-semibold block mb-0.5">Periodo Evaluado:</span>
              <span className="font-medium text-gray-900">{reporte.periodo_evaluado}</span>
            </div>

            <div>
              <span className="text-gray-500 font-semibold block mb-0.5">Elaborado Por:</span>
              <span className="font-medium text-gray-900">{reporte.elaborado_por}</span>
            </div>
          </div>

          {/* Section: Linked Records */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-600" />
              <span>Piezas y Dispositivos Evaluados ({reporte.registros?.length || 0})</span>
            </h2>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                    <th className="p-3">#</th>
                    <th className="p-3">Producto / Modelo</th>
                    <th className="p-3">Serie / Lote</th>
                    <th className="p-3">Tipo de Falla</th>
                    <th className="p-3">Descripción Detallada</th>
                    <th className="p-3 text-center">Frecuencia</th>
                    <th className="p-3">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {reporte.registros?.map((reg: any, idx: number) => (
                    <tr key={reg.id} className="hover:bg-gray-50/50">
                      <td className="p-3 font-bold text-gray-900">{idx + 1}</td>
                      <td className="p-3 font-semibold text-gray-900">{reg.producto}</td>
                      <td className="p-3 font-mono text-gray-700">{reg.numero_serie_lote}</td>
                      <td className="p-3 font-medium text-red-700">{reg.tipo_falla}</td>
                      <td className="p-3 max-w-xs">{reg.descripcion_detalle}</td>
                      <td className="p-3 text-center font-bold">{reg.frecuencia || 1}</td>
                      <td className="p-3 text-gray-500">{reg.observaciones || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* General Analysis */}
          {(reporte.causas_posibles || reporte.acciones_tomadas) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4 text-xs">
              {reporte.causas_posibles && (
                <div className="bg-amber-50/50 border border-amber-200/60 p-4 rounded-xl space-y-1">
                  <h3 className="font-bold text-amber-900">Possible causes / Causas posibles:</h3>
                  <p className="text-amber-800 leading-relaxed">{reporte.causas_posibles}</p>
                </div>
              )}

              {reporte.acciones_tomadas && (
                <div className="bg-blue-50/50 border border-blue-200/60 p-4 rounded-xl space-y-1">
                  <h3 className="font-bold text-blue-900">Actions taken / Acciones tomadas:</h3>
                  <p className="text-blue-800 leading-relaxed">{reporte.acciones_tomadas}</p>
                </div>
              )}
            </div>
          )}

          {/* PDF Viewer Embed */}
          <div className="border-t border-gray-100 pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span>Vista Previa del Documento PDF</span>
              </h2>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
              >
                <span>Abrir PDF en pantalla completa</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="w-full h-[650px] rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                title="Reporte PDF"
              />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
