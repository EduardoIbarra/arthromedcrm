'use client'
import { useState } from 'react'
import { X, Upload, Plus, Trash2, Loader2, Wrench } from 'lucide-react'

interface NuevoRegistroModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function NuevoRegistroModal({
  isOpen,
  onClose,
  onSuccess,
}: NuevoRegistroModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [producto, setProducto] = useState('')
  const [numeroSerieLote, setNumeroSerieLote] = useState('')
  const [tipoFalla, setTipoFalla] = useState('')
  const [descripcionDetalle, setDescripcionDetalle] = useState('')
  const [frecuencia, setFrecuencia] = useState(1)
  const [observaciones, setObservaciones] = useState('')
  const [fabricante, setFabricante] = useState('BONSS')
  const [periodoEvaluado, setPeriodoEvaluado] = useState('2025')
  
  // Evidencias fotográficas
  const [evidencias, setEvidencias] = useState<{ url: string; title: string; description: string }[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newUrl, setNewUrl] = useState('')

  if (!isOpen) return null

  const handleAddEvidencia = () => {
    if (!newUrl.trim()) return
    setEvidencias(prev => [
      ...prev,
      {
        url: newUrl.trim(),
        title: newTitle.trim() || 'Evidencia Fotográfica',
        description: newDesc.trim(),
      },
    ])
    setNewUrl('')
    setNewTitle('')
    setNewDesc('')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const MAX_WIDTH = 800
        const MAX_HEIGHT = 600
        let width = img.width
        let height = img.height

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width / height > MAX_WIDTH / MAX_HEIGHT) {
            height = Math.round((height * MAX_WIDTH) / width)
            width = MAX_WIDTH
          } else {
            width = Math.round((width * MAX_HEIGHT) / height)
            height = MAX_HEIGHT
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          // Compress to JPEG with 0.75 quality for optimal PDF rendering size
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.75)
          setNewUrl(optimizedDataUrl)
        } else if (event.target?.result) {
          setNewUrl(event.target.result as string)
        }
      }
      if (event.target?.result) {
        img.src = event.target.result as string
      }
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveEvidencia = (index: number) => {
    setEvidencias(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!producto.trim() || !numeroSerieLote.trim() || !tipoFalla.trim() || !descripcionDetalle.trim()) {
      setError('Por favor complete los campos obligatorios (*)')
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/mantenimiento/registros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto: producto.trim(),
          numero_serie_lote: numeroSerieLote.trim(),
          tipo_falla: tipoFalla.trim(),
          descripcion_detalle: descripcionDetalle.trim(),
          frecuencia,
          observaciones,
          fabricante,
          periodo_evaluado: periodoEvaluado,
          evidencias,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar registro')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al guardar el registro')
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
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Nuevo Registro de Falla / Mantenimiento</h2>
              <p className="text-xs text-gray-500">Capture la información de la pieza o equipo dañado</p>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Producto / Modelo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej. AJ120, Display 32HL710S, Sistema ARS600"
                value={producto}
                onChange={e => setProducto(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Número de Serie o Lote <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej. AJ220090217-S, 210NTJJ3T332"
                value={numeroSerieLote}
                onChange={e => setNumeroSerieLote(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Fabricante / Marca
              </label>
              <input
                type="text"
                placeholder="Ej. Arthromed, Arthrex"
                value={fabricante}
                onChange={e => setFabricante(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Periodo Evaluado
              </label>
              <input
                type="text"
                placeholder="Ej. 2024 - 2025"
                value={periodoEvaluado}
                onChange={e => setPeriodoEvaluado(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Tipo de Falla <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Problema de conexión al sistema ARS, Display resolution, Pedal intermitente"
              value={tipoFalla}
              onChange={e => setTipoFalla(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Descripción Detallada de la Falla <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Describa el problema detectado, inspección realizada y daños observados..."
              value={descripcionDetalle}
              onChange={e => setDescripcionDetalle(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Frecuencia de la Falla
              </label>
              <input
                type="number"
                min={1}
                value={frecuencia}
                onChange={e => setFrecuencia(parseInt(e.target.value) || 1)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Observaciones / Comentarios
              </label>
              <input
                type="text"
                placeholder="Ej. Solicitud de reemplazo de conexiones, Anexo 1"
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              />
            </div>
          </div>

          {/* Section: Evidencias Fotográficas */}
          <div className="border-t border-gray-100 pt-3">
            <label className="block text-xs font-bold text-gray-800 mb-2">
              Evidencias Fotográficas (Anexos)
            </label>

            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Título de la imagen (Ej. Conector doblado)"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 outline-none"
                />
                <input
                  type="text"
                  placeholder="Pie de foto / descripción corta"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="URL de imagen o seleccionar archivo..."
                  value={newUrl.startsWith('data:') ? '[Archivo de imagen cargado]' : newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 outline-none"
                />
                <label className="flex items-center gap-1 cursor-pointer rounded-lg bg-gray-200 hover:bg-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Subir</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAddEvidencia}
                  disabled={!newUrl.trim()}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Agregar</span>
                </button>
              </div>

              {/* Added Evidencias List */}
              {evidencias.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-200">
                  {evidencias.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg bg-white p-2 border border-gray-200 text-xs"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        {item.url && (
                          <img
                            src={item.url}
                            alt={item.title}
                            className="h-9 w-9 rounded object-cover border border-gray-200"
                          />
                        )}
                        <div className="truncate">
                          <span className="font-bold text-gray-900">{item.title}</span>
                          {item.description && (
                            <p className="text-gray-500 text-[11px] truncate">{item.description}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEvidencia(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Guardar Registro</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
