'use client'
import { useState, useEffect, useRef } from 'react'
import {
  X, Wrench, ChevronRight, ChevronLeft, Plus, Trash2,
  Upload, CheckCircle2, Loader2, Building2, Calendar,
  Hash, User, ClipboardList, Camera, Search, ChevronDown
} from 'lucide-react'

interface NuevoMantenimientoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (id: string) => void
}

interface ClienteItem {
  id: string
  nombre: string
  rfc?: string
}

interface ProductoItem {
  id: string
  nombre: string
  nombreCompleto: string
  codigo?: string
}

interface Tarea {
  tarea: string
  descripcion_ot: string
  descripcion_reporte: string
  observacion_ot: string
  realizado: boolean
  evidencias: { url: string; caption: string }[]
}

const TAREAS_PRESET: { tarea: string; descripcion_ot: string; descripcion_reporte: string }[] = [
  {
    tarea: 'Inspección visual',
    descripcion_ot: 'Observación y conteo del dispositivo y accesorios. Revisión visual de la condición general.',
    descripcion_reporte: 'Se realizó una revisión visual del equipo, encontrándose en buen estado físico y sin signos evidentes de daño o desgaste.',
  },
  {
    tarea: 'Limpieza superficial',
    descripcion_ot: 'Limpieza y desinfección del dispositivo y los componentes con un paño húmedo en solución de etanol.',
    descripcion_reporte: 'Como medida preventiva, se efectuó una limpieza general utilizando desinfectante a base de etanol y herramientas adecuadas para equipos médicos, asegurando la correcta higiene sin comprometer los componentes.',
  },
  {
    tarea: 'Pruebas de funcionamiento',
    descripcion_ot: '1. Prueba de encendido del dispositivo.\n2. Prueba de detección de los accesorios.\n3. Prueba de funcionamiento de los accesorios.',
    descripcion_reporte: 'Se llevaron a cabo pruebas operativas, verificando exitosamente las funciones principales, así como el correcto desempeño de los accesorios conectados.',
  },
  {
    tarea: 'Inspección y limpieza de ventiladores',
    descripcion_ot: 'Revisión del estado de los ventiladores y sus conectores. Limpieza de polvo.',
    descripcion_reporte: 'Se realizó la limpieza del ventilador y una inspección de los componentes eléctricos internos, sin hallazgos de anomalías.',
  },
  {
    tarea: 'Inspección interna del cableado',
    descripcion_ot: 'Revisión de los conectores. Reemplazo y ajuste de conectores dañados.',
    descripcion_reporte: 'Se realizó una inspección interna del cableado, verificando la integridad de todos los conectores internos.',
  },
  {
    tarea: 'Mantenimiento de la estructura',
    descripcion_ot: 'Revisión y ajuste de sujetadores, tornillos y herrajes.',
    descripcion_reporte: 'Se revisaron y ajustaron todos los sujetadores, tornillos y herrajes del dispositivo.',
  },
  {
    tarea: 'Inspección de disipadores de calor',
    descripcion_ot: 'Revisión de los disipadores, y reemplazo de pasta térmica.',
    descripcion_reporte: 'Se inspeccionaron los disipadores de calor y se realizó el reemplazo de pasta térmica según corresponde.',
  },
]

const STEPS = ['Datos Generales', 'Tareas', 'Observaciones']

export default function NuevoMantenimientoModal({
  isOpen, onClose, onSuccess,
}: NuevoMantenimientoModalProps) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Clientes list & search state
  const [clientesList, setClientesList] = useState<ClienteItem[]>([])
  const [loadingClientes, setLoadingClientes] = useState(false)
  const [clienteSearch, setClienteSearch] = useState('')
  const [isClienteDropdownOpen, setIsClienteDropdownOpen] = useState(false)
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null)
  const [isOtroCliente, setIsOtroCliente] = useState(false)
  const clienteDropdownRef = useRef<HTMLDivElement>(null)

  // Productos list & search state
  const [productosList, setProductosList] = useState<ProductoItem[]>([])
  const [loadingProductos, setLoadingProductos] = useState(false)
  const [productoSearch, setProductoSearch] = useState('')
  const [isProductoDropdownOpen, setIsProductoDropdownOpen] = useState(false)
  const [isOtroProducto, setIsOtroProducto] = useState(false)
  const productoDropdownRef = useRef<HTMLDivElement>(null)

  // Step 1 fields
  const [cliente, setCliente] = useState('')
  const [producto, setProducto] = useState('')
  const [numeroSerie, setNumeroSerie] = useState('')
  const [fechaServicio, setFechaServicio] = useState(new Date().toISOString().split('T')[0])
  const [elaboradoPor, setElaboradoPor] = useState('Ing. Fernando Castro')
  const [revisadoPor, setRevisadoPor] = useState('Ing. Ricardo Puente Aranda')

  // Step 2 — tasks
  const [tareas, setTareas] = useState<Tarea[]>(() =>
    TAREAS_PRESET.map(p => ({ ...p, observacion_ot: '', realizado: true, evidencias: [] }))
  )
  const [newTareaName, setNewTareaName] = useState('')

  // Step 3
  const [observaciones, setObservaciones] = useState('')

  useEffect(() => {
    if (isOpen) {
      async function loadData() {
        setLoadingClientes(true)
        setLoadingProductos(true)
        try {
          const [resC, resP, resT] = await Promise.all([
            fetch('/api/clientes'),
            fetch('/api/products'),
            fetch('/api/mantenimiento/tareas-preset'),
          ])
          if (resC.ok) {
            const cData = await resC.json()
            const cItems = (Array.isArray(cData) ? cData : []).map((item: any) => ({
              id: item.id,
              nombre: item.nombre || item.name || '',
              rfc: item.rfc || '',
            })).filter((item: any) => Boolean(item.nombre))
            setClientesList(cItems)
          }
          if (resP.ok) {
            const pData = await resP.json()
            const rawList = Array.isArray(pData.data) ? pData.data : (Array.isArray(pData) ? pData : [])
            const items = rawList.map((item: any) => {
              const fullName = item.nombre || item.description || item.name || ''
              const listName = item.nombre_lista || item.nombre_corto || fullName
              return {
                id: item.id,
                nombre: listName,
                nombreCompleto: fullName,
                codigo: item.codigo || item.code || '',
              }
            }).filter((item: any) => Boolean(item.nombre))
            setProductosList(items)
          }
          if (resT.ok) {
            const tData = await resT.json()
            if (Array.isArray(tData) && tData.length > 0) {
              setTareas(tData.map((p: any) => ({
                tarea: p.tarea,
                descripcion_ot: p.descripcion_ot,
                descripcion_reporte: p.descripcion_reporte,
                observacion_ot: '',
                realizado: true,
                evidencias: [],
              })))
            }
          }
        } catch (e) {
          console.error('Error loading dropdown options & preset tasks:', e)
        } finally {
          setLoadingClientes(false)
          setLoadingProductos(false)
        }
      }
      loadData()
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clienteDropdownRef.current && !clienteDropdownRef.current.contains(event.target as Node)) {
        setIsClienteDropdownOpen(false)
      }
      if (productoDropdownRef.current && !productoDropdownRef.current.contains(event.target as Node)) {
        setIsProductoDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!isOpen) return null

  const filteredClientes = clientesList.filter(c =>
    (c.nombre || '').toLowerCase().includes((clienteSearch || '').toLowerCase()) ||
    (c.rfc && (c.rfc || '').toLowerCase().includes((clienteSearch || '').toLowerCase()))
  )

  const filteredProductos = productosList.filter(p =>
    (p.nombre || '').toLowerCase().includes((productoSearch || '').toLowerCase()) ||
    (p.nombreCompleto || '').toLowerCase().includes((productoSearch || '').toLowerCase()) ||
    (p.codigo && (p.codigo || '').toLowerCase().includes((productoSearch || '').toLowerCase()))
  )

  const handleSelectClienteItem = (c: ClienteItem) => {
    setCliente(c.nombre)
    setSelectedClienteId(c.id)
    setIsOtroCliente(false)
    setIsClienteDropdownOpen(false)
  }

  const handleSelectOtroCliente = () => {
    setIsOtroCliente(true)
    setSelectedClienteId(null)
    setCliente('')
    setIsClienteDropdownOpen(false)
  }

  const handleSelectProductoItem = (p: ProductoItem) => {
    setProducto(p.nombre)
    setIsOtroProducto(false)
    setIsProductoDropdownOpen(false)
  }

  const handleSelectOtroProducto = () => {
    setIsOtroProducto(true)
    setProducto('')
    setIsProductoDropdownOpen(false)
  }


  // ── Task helpers ──────────────────────────────────────────────────────────
  const updateTarea = (idx: number, field: keyof Tarea, value: any) => {
    setTareas(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t))
  }

  const addCustomTarea = () => {
    if (!newTareaName.trim()) return
    setTareas(prev => [...prev, {
      tarea: newTareaName.trim(),
      descripcion_ot: '',
      descripcion_reporte: '',
      observacion_ot: '',
      realizado: true,
      evidencias: [],
    }])
    setNewTareaName('')
  }

  const removeTarea = (idx: number) => {
    setTareas(prev => prev.filter((_, i) => i !== idx))
  }

  const handleFileUpload = (tareaIdx: number, files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const MAX_W = 900, MAX_H = 700
          let w = img.width, h = img.height
          if (w > MAX_W || h > MAX_H) {
            if (w / h > MAX_W / MAX_H) { h = Math.round(h * MAX_W / w); w = MAX_W }
            else { w = Math.round(w * MAX_H / h); h = MAX_H }
          }
          const canvas = document.createElement('canvas')
          canvas.width = w; canvas.height = h
          canvas.getContext('2d')?.drawImage(img, 0, 0, w, h)
          const url = canvas.toDataURL('image/jpeg', 0.78)
          setTareas(prev => prev.map((t, i) => i === tareaIdx
            ? { ...t, evidencias: [...t.evidencias, { url, caption: file.name.replace(/\.[^.]+$/, '') }] }
            : t
          ))
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    })
  }

  const removeEvidencia = (tareaIdx: number, evIdx: number) => {
    setTareas(prev => prev.map((t, i) => i === tareaIdx
      ? { ...t, evidencias: t.evidencias.filter((_, j) => j !== evIdx) }
      : t
    ))
  }

  // ── Step validation ───────────────────────────────────────────────────────
  const canNext = () => {
    if (step === 0) return cliente.trim() && producto.trim() && numeroSerie.trim() && fechaServicio && elaboradoPor.trim()
    if (step === 1) return tareas.length > 0
    return true
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/mantenimiento/preventivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente,
          cliente_id: selectedClienteId,
          producto,
          numero_serie: numeroSerie,
          fecha_servicio: fechaServicio,
          elaborado_por: elaboradoPor,
          revisado_por: revisadoPor,
          observaciones: observaciones.trim() || null,
          tareas,
          idioma: 'es',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear el reporte')
      onSuccess(data.id)
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl my-6">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Nuevo Reporte de Mantenimiento Preventivo</h2>
              <p className="text-xs text-gray-500">Paso {step + 1} de {STEPS.length}: <span className="font-semibold">{STEPS[step]}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step progress */}
        <div className="flex border-b border-gray-100">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => i < step && setStep(i)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors relative ${
                i === step ? 'text-blue-600' : i < step ? 'text-emerald-600 cursor-pointer' : 'text-gray-400 cursor-default'
              }`}
            >
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full mr-1.5 text-[10px] font-bold ${
                i < step ? 'bg-emerald-100 text-emerald-700' : i === step ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}>{i < step ? '✓' : i + 1}</span>
              {s}
              {i === step && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600 border border-red-100">{error}</div>
        )}

        {/* ── STEP 0: Datos Generales ── */}
        {step === 0 && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="relative" ref={clienteDropdownRef}>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Cliente <span className="text-red-500">*</span>
                  </span>
                  {isOtroCliente && (
                    <button
                      type="button"
                      onClick={() => { setIsOtroCliente(false); setCliente(''); }}
                      className="text-[10px] text-blue-600 hover:underline font-normal"
                    >
                      Seleccionar de lista
                    </button>
                  )}
                </label>

                {isOtroCliente ? (
                  <input
                    type="text"
                    value={cliente}
                    onChange={e => setCliente(e.target.value)}
                    placeholder="Escriba el nombre del cliente manualmente..."
                    className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                    autoFocus
                  />
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsClienteDropdownOpen(!isClienteDropdownOpen)}
                      className="w-full text-left rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none bg-white flex items-center justify-between"
                    >
                      <span className={cliente ? 'font-semibold text-gray-900' : 'text-gray-400'}>
                        {cliente || 'Seleccionar cliente...'}
                      </span>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </button>

                    {isClienteDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-60 overflow-y-auto rounded-xl bg-white border border-gray-200 shadow-xl p-1.5 space-y-1">
                        <div className="relative p-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                          <input
                            type="text"
                            value={clienteSearch}
                            onChange={e => setClienteSearch(e.target.value)}
                            placeholder="Buscar cliente por nombre o RFC..."
                            className="w-full rounded-lg border border-gray-200 pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:border-blue-500 outline-none"
                            autoFocus
                          />
                        </div>

                        <div className="divide-y divide-gray-50">
                          {loadingClientes ? (
                            <div className="p-3 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando clientes...
                            </div>
                          ) : filteredClientes.length > 0 ? (
                            filteredClientes.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleSelectClienteItem(c)}
                                className={`w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-between ${
                                  cliente === c.nombre ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-800'
                                }`}
                              >
                                <span className="truncate">{c.nombre}</span>
                                {c.rfc && <span className="text-[10px] text-gray-400 font-mono">{c.rfc}</span>}
                              </button>
                            ))
                          ) : (
                            <div className="p-2 text-center text-xs text-gray-400">No se encontraron clientes</div>
                          )}

                          <button
                            type="button"
                            onClick={handleSelectOtroCliente}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5 border-t border-gray-100"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Otro (ingresar manualmente)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="relative" ref={productoDropdownRef}>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Wrench className="h-3 w-3" /> Producto / Equipo <span className="text-red-500">*</span>
                  </span>
                  {isOtroProducto && (
                    <button
                      type="button"
                      onClick={() => { setIsOtroProducto(false); setProducto(''); }}
                      className="text-[10px] text-blue-600 hover:underline font-normal"
                    >
                      Seleccionar de lista
                    </button>
                  )}
                </label>

                {isOtroProducto ? (
                  <input
                    type="text"
                    value={producto}
                    onChange={e => setProducto(e.target.value)}
                    placeholder="Escriba el nombre del producto manualmente..."
                    className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                    autoFocus
                  />
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsProductoDropdownOpen(!isProductoDropdownOpen)}
                      className="w-full text-left rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none bg-white flex items-center justify-between"
                    >
                      <span className={producto ? 'font-semibold text-gray-900' : 'text-gray-400'}>
                        {producto || 'Seleccionar producto...'}
                      </span>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </button>

                    {isProductoDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-60 overflow-y-auto rounded-xl bg-white border border-gray-200 shadow-xl p-1.5 space-y-1">
                        <div className="relative p-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                          <input
                            type="text"
                            value={productoSearch}
                            onChange={e => setProductoSearch(e.target.value)}
                            placeholder="Buscar producto por nombre o código..."
                            className="w-full rounded-lg border border-gray-200 pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:border-blue-500 outline-none"
                            autoFocus
                          />
                        </div>

                        <div className="divide-y divide-gray-50">
                          {loadingProductos ? (
                            <div className="p-3 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando productos...
                            </div>
                          ) : filteredProductos.length > 0 ? (
                            filteredProductos.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                title={p.nombreCompleto}
                                onClick={() => handleSelectProductoItem(p)}
                                className={`w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-between ${
                                  producto === p.nombre ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-800'
                                }`}
                              >
                                <span className="truncate">{p.nombre}</span>
                                {p.codigo && <span className="text-[10px] text-gray-400 font-mono ml-2 shrink-0">{p.codigo}</span>}
                              </button>
                            ))
                          ) : (
                            <div className="p-2 text-center text-xs text-gray-400">No se encontraron productos</div>
                          )}

                          <button
                            type="button"
                            onClick={handleSelectOtroProducto}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5 border-t border-gray-100"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Otro (ingresar manualmente)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Hash className="h-3 w-3" /> No. Serie / Lote <span className="text-red-500">*</span>
                </label>
                <input type="text" value={numeroSerie} onChange={e => setNumeroSerie(e.target.value)}
                  placeholder="Ej: A7-2303015TM"
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Fecha de Servicio <span className="text-red-500">*</span>
                </label>
                <input type="date" value={fechaServicio} onChange={e => setFechaServicio(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <User className="h-3 w-3" /> Elaborado Por <span className="text-red-500">*</span>
                </label>
                <input type="text" value={elaboradoPor} onChange={e => setElaboradoPor(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <User className="h-3 w-3" /> Revisado Por
                </label>
                <input type="text" value={revisadoPor} onChange={e => setRevisadoPor(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none" />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 1: Tareas ── */}
        {step === 1 && (
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            <p className="text-xs text-gray-500">
              Configura las tareas realizadas. Puedes editar las descripciones, marcar como realizadas y agregar fotos de evidencia.
            </p>

            {tareas.map((tarea, idx) => (
              <div key={idx} className={`rounded-xl border p-4 space-y-3 transition-all ${
                tarea.realizado ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-gray-50/50'
              }`}>
                {/* Task header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <button
                      type="button"
                      onClick={() => updateTarea(idx, 'realizado', !tarea.realizado)}
                      className={`flex-shrink-0 h-5 w-5 rounded flex items-center justify-center border-2 transition-colors ${
                        tarea.realizado ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-gray-400'
                      }`}
                    >
                      {tarea.realizado && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </button>
                    <input
                      type="text"
                      value={tarea.tarea}
                      onChange={e => updateTarea(idx, 'tarea', e.target.value)}
                      className="flex-1 text-sm font-bold bg-transparent border-none outline-none text-gray-900"
                    />
                  </div>
                  <button type="button" onClick={() => removeTarea(idx)}
                    className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 pl-7">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Descripción OT (tabla de trabajo):</label>
                    <textarea rows={2} value={tarea.descripcion_ot}
                      onChange={e => updateTarea(idx, 'descripcion_ot', e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none resize-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Descripción Reporte (narrativa con fotos):</label>
                    <textarea rows={3} value={tarea.descripcion_reporte}
                      onChange={e => updateTarea(idx, 'descripcion_reporte', e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none resize-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Observación OT (campo de observaciones):</label>
                    <input type="text" value={tarea.observacion_ot}
                      onChange={e => updateTarea(idx, 'observacion_ot', e.target.value)}
                      placeholder="Ej: Realizado. / El dispositivo opera correctamente."
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none bg-white" />
                  </div>

                  {/* Photo evidence */}
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                      <Camera className="h-3 w-3" /> Fotos de evidencia
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {tarea.evidencias.map((ev, evIdx) => (
                        <div key={evIdx} className="relative group">
                          <img src={ev.url} alt={ev.caption}
                            className="h-16 w-20 object-cover rounded-lg border border-gray-200" />
                          <button type="button"
                            onClick={() => removeEvidencia(idx, evIdx)}
                            className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                      <label className="flex h-16 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                        <Upload className="h-4 w-4 mb-0.5" />
                        <span className="text-[9px] font-medium">Agregar</span>
                        <input type="file" accept="image/*" multiple className="hidden"
                          onChange={e => handleFileUpload(idx, e.target.files)} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add custom task */}
            <div className="flex gap-2">
              <input type="text" value={newTareaName}
                onChange={e => setNewTareaName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomTarea()}
                placeholder="Agregar tarea personalizada..."
                className="flex-1 rounded-xl border border-dashed border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" />
              <button type="button" onClick={addCustomTarea}
                className="flex items-center gap-1.5 rounded-xl bg-gray-100 hover:bg-blue-50 hover:text-blue-700 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors">
                <Plus className="h-4 w-4" /> Agregar
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Observaciones ── */}
        {step === 2 && (
          <div className="p-6 space-y-4">
            {/* Summary */}
            <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-4 space-y-2 text-xs">
              <h3 className="font-bold text-blue-900 flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" /> Resumen del Reporte
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-blue-800">
                <span><span className="font-semibold">Cliente:</span> {cliente}</span>
                <span><span className="font-semibold">Producto:</span> {producto}</span>
                <span><span className="font-semibold">No. Serie:</span> {numeroSerie}</span>
                <span><span className="font-semibold">Fecha:</span> {fechaServicio}</span>
                <span><span className="font-semibold">Tareas:</span> {tareas.length} ({tareas.filter(t => t.realizado).length} realizadas)</span>
                <span><span className="font-semibold">Fotos:</span> {tareas.reduce((sum, t) => sum + t.evidencias.length, 0)} total</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Observaciones Generales / Conclusión
              </label>
              <textarea rows={5} value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="Ej: La consola ARS 700 con NS: A7-2303015TM se encuentra en buenas condiciones. Tras la limpieza preventiva, la verificación interna y las pruebas de funcionamiento..."
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none resize-none" />
            </div>
          </div>
        )}

        {/* Footer navigation */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 0 ? 'Cancelar' : 'Anterior'}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => canNext() && setStep(step + 1)}
              disabled={!canNext()}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-sm font-semibold shadow-md shadow-blue-500/20 transition-all disabled:opacity-40"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 text-sm font-semibold shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span>Generar Reporte</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
