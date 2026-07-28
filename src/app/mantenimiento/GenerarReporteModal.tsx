'use client'
import { useState } from 'react'
import { X, FileText, Loader2, CheckCircle2, Globe } from 'lucide-react'

interface GenerarReporteModalProps {
  isOpen: boolean
  onClose: () => void
  selectedRecordIds: string[]
  recordsCount: number
  onSuccess: (reporteId: string) => void
}

const IDIOMAS = [
  { value: 'es', label: 'Español', flag: '🇲🇽' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'zh', label: '中文', flag: '🇨🇳' },
]

export default function GenerarReporteModal({
  isOpen,
  onClose,
  selectedRecordIds,
  recordsCount,
  onSuccess,
}: GenerarReporteModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [idioma, setIdioma] = useState('en')
  const [titulo, setTitulo] = useState('PRODUCT FAILURE REPORTING')
  const [fabricante, setFabricante] = useState('BONSS')
  const [periodoEvaluado, setPeriodoEvaluado] = useState('2024 - 2025')
  const [elaboradoPor, setElaboradoPor] = useState('Ing. Fernando Castro')
  const [empresa, setEmpresa] = useState('Arthromed')
  const [causasPosibles, setCausasPosibles] = useState(
    'Algunos de los problemas son generados por el empaque debido a que no es lo suficientemente rígido y los equipos médicos están en movimiento constante. Al realizar mantenimiento, algunas piezas no se pueden reparar por lo que se requieren refacciones.'
  )
  const [accionesTomadas, setAccionesTomadas] = useState(
    'Se fabricaron estuches y maletines especiales para la protección de los equipos. Se procede al reemplazo de piezas y componentes dañados.'
  )

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!periodoEvaluado.trim() || !elaboradoPor.trim()) {
      setError('Por favor complete el periodo evaluado y el nombre de quien elabora el reporte')
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/mantenimiento/reportes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registro_ids: selectedRecordIds,
          titulo: titulo.trim(),
          fabricante: fabricante.trim(),
          periodo_evaluado: periodoEvaluado.trim(),
          elaborado_por: elaboradoPor.trim(),
          empresa: empresa.trim(),
          causas_posibles: causasPosibles.trim(),
          acciones_tomadas: accionesTomadas.trim(),
          idioma,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al generar el reporte')
      }

      onSuccess(data.id)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al generar el reporte')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Generar Reporte para Fabricante</h2>
              <p className="text-xs text-gray-500">
                Se consolidarán <span className="font-bold text-blue-600">{recordsCount}</span> registros de fallas en un reporte PDF institucional con QR.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600 border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Language Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-blue-500" />
              Idioma del Reporte PDF
            </label>
            <div className="flex gap-2">
              {IDIOMAS.map((lang) => (
                <button
                  key={lang.value}
                  type="button"
                  onClick={() => setIdioma(lang.value)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold border transition-all ${
                    idioma === lang.value
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-700'
                  }`}
                >
                  <span className="text-base">{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Título del Reporte
              </label>
              <input
                type="text"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Fabricante / Destinatario
              </label>
              <input
                type="text"
                value={fabricante}
                onChange={e => setFabricante(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Periodo Evaluado <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={periodoEvaluado}
                onChange={e => setPeriodoEvaluado(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Elaborado Por <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={elaboradoPor}
                onChange={e => setElaboradoPor(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Empresa / Remitente
            </label>
            <input
              type="text"
              value={empresa}
              onChange={e => setEmpresa(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            />
          </div>

          <div className="border-t border-gray-100 pt-3">
            <h3 className="text-xs font-bold text-gray-800 mb-2">
              Análisis General de Fallas (Sección Consolidada)
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Possible Causes / Causas Posibles:
                </label>
                <textarea
                  rows={2}
                  value={causasPosibles}
                  onChange={e => setCausasPosibles(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-xs text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Actions Taken / Acciones Tomadas:
                </label>
                <textarea
                  rows={2}
                  value={accionesTomadas}
                  onChange={e => setAccionesTomadas(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-xs text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-sm font-semibold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>Generar PDF Consolidado</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
