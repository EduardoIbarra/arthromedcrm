'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Scissors,
  ArrowLeft,
  Save,
  User,
  Users,
  Package,
  DollarSign,
  Plus,
  Trash2,
  Search,
  X,
  CheckCircle2,
  Info,
  ChevronDown,
  Flame,
  RefreshCw,
  Recycle,
  ShoppingCart,
  RotateCcw,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import DoctorSelector from '@/components/DoctorSelector'

interface Props {
  cirugiaId: string | null
}

// ─── Types ───────────────────────────────────────────────────────────────────

type UserProfile = { id: string; email: string }

type ProductoStock = {
  id: string
  nombre: string
  categoria: string | null
  tipo: string | null
  activo: boolean | null
  stock_actual: number
  precio_unitario: number
}

type EquipoItem = {
  user_id: string
  rol: string
  _email?: string
}

type ProductoItem = {
  producto_id: string
  cantidad: number
  es_consumible: boolean
  tipo_uso: 'venta' | 'renta'
  precio_unitario: string
  _nombre?: string
  _precio_base?: number
}

type ConceptoItem = {
  concepto: string
  cantidad: string
  precio_unitario: string
  subtotal: string
}

type ItinerarioItem = {
  activity: string
  date: string
  time: string
  notes: string
}

const ESTADOS = [
  { value: 'programada', label: 'Programada' },
  { value: 'en_curso', label: 'En Curso' },
  { value: 'completada', label: 'Completada' },
  { value: 'cancelada', label: 'Cancelada' },
]

const SECTION_IDS = ['info', 'equipo', 'productos', 'itinerario', 'precios'] as const
type SectionId = typeof SECTION_IDS[number]

// ─── Component ───────────────────────────────────────────────────────────────

export default function CirugiaDetailContent({ cirugiaId }: Props) {
  const router = useRouter()
  const isNew = cirugiaId === null

  // ── Form state ──
  const [nombre, setNombre] = useState('')
  const [medico, setMedico] = useState('')
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('08:00')
  const [estado, setEstado] = useState('programada')
  const [notas, setNotas] = useState('')

  const [equipo, setEquipo] = useState<EquipoItem[]>([])
  const [productos, setProductos] = useState<ProductoItem[]>([])
  const [conceptos, setConceptos] = useState<ConceptoItem[]>([])
  const [itinerarios, setItinerarios] = useState<ItinerarioItem[]>([])

  // ── Reference data ──
  const [usuarios, setUsuarios] = useState<UserProfile[]>([])
  const [stockItems, setStockItems] = useState<ProductoStock[]>([])

  // ── UI state ──
  const [activeSection, setActiveSection] = useState<SectionId>('info')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(!isNew)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [prodSearch, setProdSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')

  // ── Load reference data ──
  useEffect(() => {
    Promise.all([
      fetch('/api/cirugias/usuarios').then(r => r.json()),
      fetch('/api/inventario').then(r => r.json()),
    ]).then(([u, inv]) => {
      setUsuarios(u.data || [])
      setStockItems(inv.data || [])
    })
  }, [])

  // ── Load existing surgery if editing ──
  useEffect(() => {
    if (isNew || !cirugiaId) return
    setIsLoading(true)
    fetch(`/api/cirugias/${cirugiaId}`)
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) return
        setNombre(data.nombre)
        setMedico(data.medico)
        setDoctorId(data.doctor_id)
        setDescripcion(data.descripcion || '')
        const d = new Date(data.fecha)
        setFecha(d.toISOString().slice(0, 10))
        setHora(d.toTimeString().slice(0, 5))
        setEstado(data.estado)
        setNotas(data.notas || '')
        setEquipo(
          data.cirugia_equipo.map((e: any) => ({
            user_id: e.user_id,
            rol: e.rol || '',
            _email: e.user_id,
          }))
        )
        setProductos(
          data.cirugia_productos.map((p: any) => ({
            producto_id: p.producto_id,
            cantidad: p.cantidad,
            es_consumible: p.es_consumible,
            tipo_uso: p.tipo_uso,
            precio_unitario: p.precio_unitario != null ? String(p.precio_unitario) : '',
            _nombre: p.productos?.nombre,
            _precio_base: Number(p.productos?.precio_unitario),
          }))
        )
        setConceptos(
          data.cirugia_conceptos.map((c: any) => ({
            concepto: c.concepto,
            cantidad: String(c.cantidad),
            precio_unitario: String(c.precio_unitario),
            subtotal: String(c.subtotal),
          }))
        )
        setItinerarios(
          data.cirugia_itinerarios?.map((i: any) => ({
            activity: i.activity,
            date: new Date(i.date).toISOString().slice(0, 10),
            time: i.time || '',
            notes: i.notes || '',
          })) || []
        )
      })
      .finally(() => setIsLoading(false))
  }, [cirugiaId, isNew])

  // ── Derived ──
  const totalProductos = productos.reduce((sum, p) => {
    const price = parseFloat(p.precio_unitario) || p._precio_base || 0
    return sum + price * p.cantidad
  }, 0)

  const totalConceptos = conceptos.reduce((sum, c) => {
    return sum + (parseFloat(c.subtotal) || 0)
  }, 0)

  const totalGeneral = totalProductos + totalConceptos

  // ── Handlers ──
  const addEquipoMember = (user: UserProfile) => {
    if (equipo.find(e => e.user_id === user.id)) return
    setEquipo(prev => [...prev, { user_id: user.id, rol: '', _email: user.email }])
    setUserSearch('')
  }

  const removeEquipoMember = (userId: string) => {
    setEquipo(prev => prev.filter(e => e.user_id !== userId))
  }

  const addProducto = (prod: ProductoStock) => {
    if (productos.find(p => p.producto_id === prod.id)) return
    setProductos(prev => [
      ...prev,
      {
        producto_id: prod.id,
        cantidad: 1,
        es_consumible: false,
        tipo_uso: 'venta',
        precio_unitario: '',
        _nombre: prod.nombre,
        _precio_base: Number(prod.precio_unitario),
      },
    ])
    setProdSearch('')
  }

  const removeProducto = (id: string) => {
    setProductos(prev => prev.filter(p => p.producto_id !== id))
  }

  const updateProducto = <K extends keyof ProductoItem>(
    id: string,
    key: K,
    value: ProductoItem[K]
  ) => {
    setProductos(prev =>
      prev.map(p => {
        if (p.producto_id !== id) return p
        const updated = { ...p, [key]: value }
        return updated
      })
    )
  }

  const addConcepto = () => {
    setConceptos(prev => [
      ...prev,
      { concepto: '', cantidad: '1', precio_unitario: '0', subtotal: '0' },
    ])
  }

  const removeConcepto = (idx: number) => {
    setConceptos(prev => prev.filter((_, i) => i !== idx))
  }

  const updateConcepto = (idx: number, key: keyof ConceptoItem, value: string) => {
    setConceptos(prev =>
      prev.map((c, i) => {
        if (i !== idx) return c
        const updated = { ...c, [key]: value }
        const qty = parseFloat(updated.cantidad) || 0
        const price = parseFloat(updated.precio_unitario) || 0
        updated.subtotal = (qty * price).toFixed(2)
        return updated
      })
    )
  }

  const addItinerario = () => {
    setItinerarios(prev => [
      ...prev,
      { activity: '', date: fecha || new Date().toISOString().slice(0, 10), time: '08:00', notes: '' },
    ])
  }

  const removeItinerario = (idx: number) => {
    setItinerarios(prev => prev.filter((_, i) => i !== idx))
  }

  const updateItinerario = (idx: number, key: keyof ItinerarioItem, value: string) => {
    setItinerarios(prev =>
      prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it))
    )
  }

  const handleSave = useCallback(async () => {
    setSaveError(null)
    if (!nombre.trim()) { setSaveError('El nombre de la cirugía es requerido.'); return }
    if (!medico.trim()) { setSaveError('El médico es requerido.'); return }
    if (!fecha) { setSaveError('La fecha es requerida.'); return }

    const fechaISO = new Date(`${fecha}T${hora}:00`).toISOString()

    const payload = {
      nombre: nombre.trim(),
      medico: medico.trim() || 'N/A',
      doctor_id: doctorId,
      descripcion: descripcion.trim() || null,
      fecha: fechaISO,
      estado,
      notas: notas.trim() || null,
      equipo: equipo.map(e => ({ user_id: e.user_id, rol: e.rol || null })),
      productos: productos.map(p => ({
        producto_id: p.producto_id,
        cantidad: Number(p.cantidad),
        es_consumible: p.es_consumible,
        tipo_uso: p.tipo_uso,
        precio_unitario: p.precio_unitario !== '' ? parseFloat(p.precio_unitario) : null,
      })),
      conceptos: conceptos.map(c => ({
        concepto: c.concepto,
        cantidad: parseFloat(c.cantidad) || 1,
        precio_unitario: parseFloat(c.precio_unitario) || 0,
        subtotal: parseFloat(c.subtotal) || 0,
      })),
      itinerarios: itinerarios.map(i => ({
        activity: i.activity.trim(),
        date: i.date,
        time: i.time.trim() || null,
        notes: i.notes.trim() || null,
      })),
    }

    setIsSaving(true)
    try {
      const url = isNew ? '/api/cirugias' : `/api/cirugias/${cirugiaId}`
      const method = isNew ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      router.push('/cirugias')
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setIsSaving(false)
    }
  }, [nombre, medico, doctorId, descripcion, fecha, hora, estado, notas, equipo, productos, conceptos, itinerarios, isNew, cirugiaId, router])

  // ── Filtered lists for pickers ──
  const filteredUsers = usuarios.filter(u =>
    !equipo.find(e => e.user_id === u.id) &&
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  )

  const filteredStock = stockItems.filter(s =>
    !productos.find(p => p.producto_id === s.id) &&
    s.nombre.toLowerCase().includes(prodSearch.toLowerCase())
  )

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AppShell>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">

        {/* ── Header ── */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/cirugias"
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Scissors size={22} style={{ color: '#0763a9' }} />
                {isNew ? 'Nueva Cirugía' : 'Editar Cirugía'}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {isNew ? 'Registra una nueva cirugía' : nombre || '…'}
              </p>
            </div>
          </div>
          <button
            id="btn-save-cirugia"
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary self-start sm:self-auto flex items-center gap-2"
          >
            <Save size={16} />
            {isSaving ? 'Guardando…' : 'Guardar Cirugía'}
          </button>
        </header>

        {saveError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <X size={15} className="shrink-0" />
            {saveError}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-200 gap-1 overflow-x-auto">
          {([
            { id: 'info' as SectionId, label: 'Info General', icon: Info, badge: undefined as number | undefined },
            { id: 'equipo' as SectionId, label: 'Equipo', icon: Users, badge: equipo.length },
            { id: 'productos' as SectionId, label: 'Productos', icon: Package, badge: productos.length },
            { id: 'itinerario' as SectionId, label: 'Itinerario', icon: CheckCircle2, badge: itinerarios.length },
            { id: 'precios' as SectionId, label: 'Precios', icon: DollarSign, badge: conceptos.length },
          ]).map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              id={`tab-${id}`}
              onClick={() => setActiveSection(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeSection === id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={15} />
              {label}
              {badge !== undefined && badge > 0 && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: INFO GENERAL
        ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === 'info' && (
          <div className="card p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Info size={16} style={{ color: '#0763a9' }} />
              Información General
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nombre */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Nombre de la Cirugía <span className="text-red-500">*</span>
                </label>
                <input
                  id="cirugia-nombre"
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej. Artroscopia de rodilla derecha"
                  className="erp-input w-full"
                />
              </div>

              {/* Médico */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Médico (Doctor) <span className="text-red-500">*</span>
                </label>
                <DoctorSelector 
                  selectedIds={doctorId ? [doctorId] : []} 
                  onChange={ids => setDoctorId(ids[0] || null)} 
                  multiple={false} 
                />
                {!doctorId && <p className="text-xs text-orange-500 mt-1">Por favor selecciona o crea un doctor.</p>}
              </div>

              {/* Estado */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Estado
                </label>
                <select
                  id="cirugia-estado"
                  value={estado}
                  onChange={e => setEstado(e.target.value)}
                  className="erp-input w-full"
                >
                  {ESTADOS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <input
                  id="cirugia-fecha"
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  className="erp-input w-full"
                />
              </div>

              {/* Hora */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Hora
                </label>
                <input
                  id="cirugia-hora"
                  type="time"
                  value={hora}
                  onChange={e => setHora(e.target.value)}
                  className="erp-input w-full"
                />
              </div>

              {/* Descripción */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Descripción
                </label>
                <textarea
                  id="cirugia-descripcion"
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="Descripción del procedimiento…"
                  rows={3}
                  className="erp-input w-full resize-none"
                />
              </div>

              {/* Notas */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Notas
                </label>
                <textarea
                  id="cirugia-notas"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Observaciones adicionales, indicaciones especiales…"
                  rows={3}
                  className="erp-input w-full resize-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveSection('equipo')}
                className="btn-primary text-sm flex items-center gap-2"
              >
                Siguiente: Equipo
                <ChevronDown size={15} className="-rotate-90" />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: EQUIPO
        ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === 'equipo' && (
          <div className="space-y-4">
            <div className="card p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Users size={16} style={{ color: '#0763a9' }} />
                Equipo Asistente
              </h2>
              <p className="text-sm text-gray-500">
                Selecciona los miembros de tu equipo que asistirán en esta cirugía.
              </p>

              {/* User search */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="equipo-user-search"
                  type="text"
                  placeholder="Buscar usuario del sistema…"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="erp-input w-full"
                  style={{ paddingLeft: '2.25rem' }}
                />
              </div>

              {/* User dropdown */}
              {userSearch && filteredUsers.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm max-h-48 overflow-y-auto">
                  {filteredUsers.slice(0, 10).map(u => (
                    <button
                      key={u.id}
                      onClick={() => addEquipoMember(u)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                    >
                      <span className="text-sm font-medium text-gray-700">{u.email.split('@')[0]}</span>
                      <span className="text-xs text-gray-400">({u.email})</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Equipo list */}
              {equipo.length > 0 ? (
                <div className="space-y-2">
                  {equipo.map((member, idx) => {
                    const userInfo = usuarios.find(u => u.id === member.user_id)
                    const displayEmail = userInfo?.email || member._email || member.user_id
                    return (
                      <div key={member.user_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-1/3 min-w-[100px] sm:w-48 shrink-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{displayEmail.split('@')[0]}</p>
                        </div>
                        <input
                          type="text"
                          placeholder="Rol (ej. Instrumentista)"
                          value={member.rol}
                          onChange={e => setEquipo(prev => prev.map((m, i) => i === idx ? { ...m, rol: e.target.value } : m))}
                          className="erp-input text-sm flex-1 min-w-0"
                        />
                        <button
                          onClick={() => removeEquipoMember(member.user_id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-gray-400">
                  No has agregado miembros al equipo aún. Busca usuarios arriba.
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setActiveSection('info')} className="btn-secondary text-sm">
                ← Info General
              </button>
              <button onClick={() => setActiveSection('productos')} className="btn-primary text-sm flex items-center gap-2">
                Siguiente: Productos <ChevronDown size={15} className="-rotate-90" />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: PRODUCTOS
        ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === 'productos' && (
          <div className="space-y-4">
            <div className="card p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Package size={16} style={{ color: '#0763a9' }} />
                Productos Necesarios
              </h2>
              <p className="text-sm text-gray-500">
                Selecciona los productos del inventario que se utilizarán. Marca si son consumibles y el tipo de uso.
              </p>

              {/* Product search */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="productos-search"
                  type="text"
                  placeholder="Buscar producto del inventario…"
                  value={prodSearch}
                  onChange={e => setProdSearch(e.target.value)}
                  className="erp-input w-full"
                  style={{ paddingLeft: '2.25rem' }}
                />
              </div>

              {/* Product dropdown */}
              {prodSearch && filteredStock.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm max-h-52 overflow-y-auto">
                  {filteredStock.slice(0, 12).map(prod => (
                    <button
                      key={prod.id}
                      onClick={() => addProducto(prod)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{prod.nombre}</p>
                        <p className="text-xs text-gray-400">{prod.categoria || '—'} · Stock: {prod.stock_actual}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-700 shrink-0">
                        ${Number(prod.precio_unitario).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Product list */}
              {productos.length > 0 ? (
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="hidden sm:grid grid-cols-[1fr_80px_auto_auto_120px_36px] gap-3 px-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <span>Producto</span>
                    <span>Cant.</span>
                    <span>Tipo</span>
                    <span>Uso</span>
                    <span>Precio Override</span>
                    <span />
                  </div>
                  {productos.map(p => {
                    const stockItem = stockItems.find(s => s.id === p.producto_id)
                    return (
                      <div key={p.producto_id} className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-3 sm:space-y-0 sm:grid sm:grid-cols-[1fr_80px_auto_auto_120px_36px] sm:gap-3 sm:items-center">
                        {/* Nombre */}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {p._nombre || stockItem?.nombre || p.producto_id}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Base: ${((p._precio_base || Number(stockItem?.precio_unitario)) ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </p>
                        </div>

                        {/* Cantidad */}
                        <input
                          type="number"
                          min="1"
                          value={p.cantidad}
                          onChange={e => updateProducto(p.producto_id, 'cantidad', parseInt(e.target.value) || 1)}
                          className="erp-input text-sm text-center w-full"
                        />

                        {/* Consumible toggle */}
                        <button
                          id={`toggle-consumible-${p.producto_id}`}
                          onClick={() => updateProducto(p.producto_id, 'es_consumible', !p.es_consumible)}
                          title={p.es_consumible ? 'Consumible' : 'No consumible'}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                            p.es_consumible
                              ? 'bg-orange-100 text-orange-700 border border-orange-200'
                              : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-orange-50'
                          }`}
                        >
                          <Flame size={12} />
                          {p.es_consumible ? 'Consumible' : 'No consumi.'}
                        </button>

                        {/* Venta / Renta toggle */}
                        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                          <button
                            id={`tipo-venta-${p.producto_id}`}
                            onClick={() => updateProducto(p.producto_id, 'tipo_uso', 'venta')}
                            className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                              p.tipo_uso === 'venta'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-500 hover:bg-blue-50'
                            }`}
                          >
                            <ShoppingCart size={11} />
                            Venta
                          </button>
                          <button
                            id={`tipo-renta-${p.producto_id}`}
                            onClick={() => updateProducto(p.producto_id, 'tipo_uso', 'renta')}
                            className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                              p.tipo_uso === 'renta'
                                ? 'bg-purple-600 text-white'
                                : 'bg-white text-gray-500 hover:bg-purple-50'
                            }`}
                          >
                            <RotateCcw size={11} />
                            Renta
                          </button>
                        </div>

                        {/* Override price */}
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={p.precio_unitario}
                            onChange={e => updateProducto(p.producto_id, 'precio_unitario', e.target.value)}
                            placeholder={String(p._precio_base || '')}
                            className="erp-input text-sm w-full"
                            style={{ paddingLeft: '1.5rem' }}
                          />
                        </div>

                        {/* Remove */}
                        <button
                          onClick={() => removeProducto(p.producto_id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors justify-self-end"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )
                  })}

                  {/* Subtotal */}
                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-500">Subtotal productos:</span>
                    <span className="text-base font-bold text-gray-800">
                      ${totalProductos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-gray-400">
                  No hay productos agregados. Busca un producto arriba para añadirlo.
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setActiveSection('equipo')} className="btn-secondary text-sm">
                ← Equipo
              </button>
              <button onClick={() => setActiveSection('itinerario')} className="btn-primary text-sm flex items-center gap-2">
                Siguiente: Itinerario <ChevronDown size={15} className="-rotate-90" />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: ITINERARIO
        ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === 'itinerario' && (
          <div className="space-y-4">
            <div className="card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <CheckCircle2 size={16} style={{ color: '#0763a9' }} />
                  Itinerario y Actividades
                </h2>
                <button
                  id="btn-add-itinerario"
                  onClick={addItinerario}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Plus size={14} />
                  Agregar Actividad
                </button>
              </div>

              {itinerarios.length > 0 ? (
                <div className="space-y-3">
                  <div className="hidden sm:grid grid-cols-[1fr_120px_100px_1fr_36px] gap-3 px-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <span>Actividad</span>
                    <span>Fecha</span>
                    <span>Hora</span>
                    <span>Descripción</span>
                    <span />
                  </div>
                  {itinerarios.map((it, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_120px_100px_1fr_36px] sm:gap-3 sm:items-center">
                      <input
                        type="text"
                        placeholder="Ej. Entrada a quirófano"
                        value={it.activity}
                        onChange={e => updateItinerario(idx, 'activity', e.target.value)}
                        className="erp-input text-sm w-full"
                      />
                      <input
                        type="date"
                        value={it.date}
                        onChange={e => updateItinerario(idx, 'date', e.target.value)}
                        className="erp-input text-sm w-full"
                      />
                      <input
                        type="time"
                        value={it.time}
                        onChange={e => updateItinerario(idx, 'time', e.target.value)}
                        className="erp-input text-sm w-full"
                      />
                      <input
                        type="text"
                        placeholder="Notas adicionales..."
                        value={it.notes}
                        onChange={e => updateItinerario(idx, 'notes', e.target.value)}
                        className="erp-input text-sm w-full"
                      />
                      <button
                        onClick={() => removeItinerario(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors justify-self-end"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                  No hay actividades registradas. Haz clic en "Agregar Actividad" para añadir una al itinerario.
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setActiveSection('productos')} className="btn-secondary text-sm">
                ← Productos
              </button>
              <button onClick={() => setActiveSection('precios')} className="btn-primary text-sm flex items-center gap-2">
                Siguiente: Precios <ChevronDown size={15} className="-rotate-90" />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION: PRECIOS
        ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === 'precios' && (
          <div className="space-y-4">
            <div className="card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <DollarSign size={16} style={{ color: '#0763a9' }} />
                  Conceptos de Precio
                </h2>
                <button
                  id="btn-add-concepto"
                  onClick={addConcepto}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Plus size={14} />
                  Agregar Concepto
                </button>
              </div>

              {/* Products summary */}
              {productos.length > 0 && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Productos del Inventario
                  </p>
                  {productos.map(p => {
                    const stockItem = stockItems.find(s => s.id === p.producto_id)
                    const price = parseFloat(p.precio_unitario) || p._precio_base || Number(stockItem?.precio_unitario) || 0
                    const sub = price * p.cantidad
                    return (
                      <div key={p.producto_id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                            p.es_consumible ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {p.es_consumible ? '🔥' : '♻️'}
                          </span>
                          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                            p.tipo_uso === 'renta' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {p.tipo_uso === 'renta' ? 'Renta' : 'Venta'}
                          </span>
                          <span className="text-gray-700 truncate">
                            {p._nombre || stockItem?.nombre} × {p.cantidad}
                          </span>
                        </div>
                        <span className="font-semibold text-gray-800 shrink-0">
                          ${sub.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-sm font-semibold">
                    <span className="text-gray-600">Subtotal productos</span>
                    <span style={{ color: '#0763a9' }}>
                      ${totalProductos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              {/* Custom concepts */}
              {conceptos.length > 0 ? (
                <div className="space-y-3">
                  {/* Header */}
                  <div className="hidden sm:grid grid-cols-[1fr_80px_120px_120px_36px] gap-3 px-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <span>Concepto</span>
                    <span>Cantidad</span>
                    <span>Precio Unitario</span>
                    <span>Subtotal</span>
                    <span />
                  </div>
                  {conceptos.map((c, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_80px_120px_120px_36px] sm:gap-3 sm:items-center">
                      <input
                        type="text"
                        placeholder="Descripción del concepto"
                        value={c.concepto}
                        onChange={e => updateConcepto(idx, 'concepto', e.target.value)}
                        className="erp-input text-sm w-full"
                      />
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={c.cantidad}
                        onChange={e => updateConcepto(idx, 'cantidad', e.target.value)}
                        className="erp-input text-sm text-center w-full"
                      />
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={c.precio_unitario}
                          onChange={e => updateConcepto(idx, 'precio_unitario', e.target.value)}
                          className="erp-input text-sm w-full"
                          style={{ paddingLeft: '1.5rem' }}
                        />
                      </div>
                      <div className="text-sm font-semibold text-gray-800 px-1">
                        ${(parseFloat(c.subtotal) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </div>
                      <button
                        onClick={() => removeConcepto(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors justify-self-end"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                  No hay conceptos adicionales. Haz clic en "Agregar Concepto" para añadir líneas de cobro.
                </div>
              )}

              {/* Grand total */}
              <div className="pt-4 border-t-2 border-gray-200">
                <div className="flex flex-col items-end gap-2">
                  {conceptos.length > 0 && (
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <span>Subtotal conceptos</span>
                      <span className="font-semibold w-32 text-right">
                        ${totalConceptos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {productos.length > 0 && (
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <span>Subtotal productos</span>
                      <span className="font-semibold w-32 text-right">
                        ${totalProductos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-6 pt-2 border-t border-gray-200 mt-1">
                    <span className="text-base font-bold text-gray-800">Total General</span>
                    <span
                      className="text-2xl font-bold w-32 text-right"
                      style={{ color: '#0763a9' }}
                    >
                      ${totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Save footer */}
            <div className="flex justify-between">
              <button onClick={() => setActiveSection('itinerario')} className="btn-secondary text-sm">
                ← Itinerario
              </button>
              <button
                id="btn-save-cirugia-final"
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary flex items-center gap-2"
              >
                <Save size={16} />
                {isSaving ? 'Guardando…' : 'Guardar Cirugía'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
