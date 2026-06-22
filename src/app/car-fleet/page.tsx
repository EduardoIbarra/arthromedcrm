'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Loader2, Car, Search, LayoutGrid, List, X, User } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { useI18n } from '@/contexts/I18nContext'
import { CarFleet } from '@/types/database'

export default function CarFleetPage() {
  const { t } = useI18n()
  const [cars, setCars] = useState<CarFleet[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    plate_number: '',
    color: '',
    status: 'available',
    notes: '',
    assigned_to_id: ''
  })

  const fetchCars = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/car-fleet')
      if (res.ok) {
        const { data } = await res.json()
        setCars(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/cirugias/usuarios')
      if (res.ok) {
        const { data } = await res.json()
        setUsers(data || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchCars()
    fetchUsers()
  }, [])

  const filteredCars = cars.filter(c =>
    c.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.plate_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.assigned_to &&
      (`${c.assigned_to.first_name || ''} ${c.assigned_to.last_name || ''} ${c.assigned_to.email}`)
        .toLowerCase()
        .includes(searchQuery.toLowerCase()))
  )

  const openNew = () => {
    setFormData({
      make: '',
      model: '',
      year: new Date().getFullYear(),
      plate_number: '',
      color: '',
      status: 'available',
      notes: '',
      assigned_to_id: ''
    })
    setIsEditing(false)
    setSelectedId(null)
    setIsModalOpen(true)
  }

  const openEdit = (car: CarFleet) => {
    setFormData({
      make: car.make,
      model: car.model,
      year: car.year,
      plate_number: car.plate_number,
      color: car.color || '',
      status: car.status,
      notes: car.notes || '',
      assigned_to_id: car.assigned_to_id || ''
    })
    setIsEditing(true)
    setSelectedId(car.id)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este vehículo del sistema?')) return
    try {
      const res = await fetch(`/api/car-fleet/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCars(cars.filter(c => c.id !== id))
      } else {
        const err = await res.json()
        alert('Error: ' + err.error)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.make || !formData.model || !formData.year || !formData.plate_number) return
    setIsSaving(true)
    try {
      const url = isEditing ? `/api/car-fleet/${selectedId}` : '/api/car-fleet'
      const method = isEditing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setIsModalOpen(false)
        fetchCars()
      } else {
        const err = await res.json()
        alert('Error: ' + err.error)
      }
    } catch (err) {
      console.error(err)
      alert('Error al guardar vehículo')
    } finally {
      setIsSaving(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'in_use':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'maintenance':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available':
        return t('available') || 'Disponible'
      case 'in_use':
        return t('in_use') || 'En Uso'
      case 'maintenance':
        return t('maintenance') || 'Mantenimiento'
      default:
        return status
    }
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Car className="text-[#0763a9]" size={28} />
              {t('carFleet') || 'Flota Vehicular'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('appName')} / {t('carFleet') || 'Flota Vehicular'}
            </p>
          </div>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> {t('createCar') || 'Registrar Vehículo'}
          </button>
        </header>

        <div className="card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
            <Search size={20} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar por marca, modelo, placas o conductor..."
              className="w-full bg-transparent border-none focus:outline-none text-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-white shadow-sm text-[#0763a9]' : 'text-gray-500 hover:text-gray-700'}`}
              title="Vista de Tarjetas"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-[#0763a9]' : 'text-gray-500 hover:text-gray-700'}`}
              title="Vista de Tabla"
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 size={32} className="animate-spin text-[#0763a9]" />
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCars.map(car => (
              <div key={car.id} className="card p-5 hover:border-blue-200 transition-colors group flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getStatusBadgeColor(car.status)}`}>
                        {getStatusLabel(car.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(car)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(car.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </div>

                  <h3 className="font-bold text-lg text-gray-900 leading-tight">
                    {car.make} {car.model}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Año: {car.year} | Placas: <span className="font-mono text-gray-700 font-bold">{car.plate_number}</span></p>
                  
                  {car.color && (
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border border-gray-300 inline-block" style={{ backgroundColor: car.color.toLowerCase() }} />
                      Color: {car.color}
                    </p>
                  )}

                  {car.notes && (
                    <p className="text-xs text-gray-500 mt-3 bg-gray-50 p-2 rounded-lg italic">
                      {car.notes}
                    </p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-2">
                  <User size={16} className="text-gray-400" />
                  <div className="text-xs">
                    {car.assigned_to ? (
                      <div>
                        <span className="font-semibold text-gray-800">
                          {car.assigned_to.first_name || car.assigned_to.last_name
                            ? `${car.assigned_to.first_name || ''} ${car.assigned_to.last_name || ''}`.trim()
                            : car.assigned_to.email}
                        </span>
                        {car.assigned_to.position && (
                          <span className="text-gray-400 block text-[10px]">{car.assigned_to.position}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">No asignado</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredCars.length === 0 && (
              <div className="col-span-full text-center p-12 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                No se encontraron vehículos registrados.
              </div>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('make') || 'Marca'} / {t('model') || 'Modelo'}</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('plateNumber') || 'Placas'}</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('status') || 'Estatus'}</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Asignado a</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCars.map(car => (
                    <tr key={car.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="p-4">
                        <div className="font-semibold text-gray-900">{car.make} {car.model}</div>
                        <div className="text-xs text-gray-500">Año: {car.year} {car.color && `| Color: ${car.color}`}</div>
                      </td>
                      <td className="p-4 font-mono font-bold text-sm text-gray-700">{car.plate_number}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold border ${getStatusBadgeColor(car.status)}`}>
                          {getStatusLabel(car.status)}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {car.assigned_to ? (
                          <div>
                            <div className="font-medium text-gray-900">
                              {car.assigned_to.first_name || car.assigned_to.last_name
                                ? `${car.assigned_to.first_name || ''} ${car.assigned_to.last_name || ''}`.trim()
                                : car.assigned_to.email}
                            </div>
                            {car.assigned_to.position && (
                              <div className="text-[10px] text-gray-400">{car.assigned_to.position}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">No asignado</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(car)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"><Edit size={16} /></button>
                          <button onClick={() => handleDelete(car.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCars.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">
                        No se encontraron vehículos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? 'Editar Vehículo' : 'Registrar Vehículo'}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{t('make') || 'Marca'} *</label>
                <input required type="text" className="erp-input w-full" value={formData.make} onChange={e => setFormData({ ...formData, make: e.target.value })} placeholder="Ej. Toyota" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{t('model') || 'Modelo'} *</label>
                <input required type="text" className="erp-input w-full" value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} placeholder="Ej. Hilux" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{t('year') || 'Año'} *</label>
                <input required type="number" min="1900" max="2100" className="erp-input w-full" value={formData.year} onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{t('plateNumber') || 'Placas'} *</label>
                <input required type="text" className="erp-input w-full font-mono uppercase" value={formData.plate_number} onChange={e => setFormData({ ...formData, plate_number: e.target.value.toUpperCase() })} placeholder="Ej. ABC-123-D" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{t('color') || 'Color'}</label>
                <input type="text" className="erp-input w-full" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} placeholder="Ej. Blanco" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{t('status') || 'Estatus'}</label>
                <select className="erp-input w-full" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                  <option value="available">Disponible</option>
                  <option value="in_use">En Uso</option>
                  <option value="maintenance">Mantenimiento</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Asignar a Conductor (Staff)</label>
              <select className="erp-input w-full" value={formData.assigned_to_id} onChange={e => setFormData({ ...formData, assigned_to_id: e.target.value })}>
                <option value="">-- No asignado --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email} {u.position ? `(${u.position})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Notas (Opcional)</label>
              <textarea rows={3} className="erp-input w-full" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Detalles sobre seguro, mantenimiento, resguardo, etc." />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary px-4">Cancelar</button>
              <button type="submit" disabled={isSaving} className="btn-primary">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : (isEditing ? 'Guardar Cambios' : 'Registrar Vehículo')}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  )
}
