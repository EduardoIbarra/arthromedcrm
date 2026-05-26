'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { ArrowLeft, Save, TrendingUp, Loader2 } from 'lucide-react'
import Link from 'next/link'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function NewVentaPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingClients, setIsLoadingClients] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const clientDropdownRef = useRef<HTMLDivElement>(null)
  
  const [formData, setFormData] = useState({
    cliente_id: '',
    cliente_nombre: '',
    anio: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    monto: ''
  })

  useEffect(() => {
    const fetchClients = async () => {
      try {
        setIsLoadingClients(true)
        const res = await fetch('/api/ventas/clients')
        if (res.ok) {
          const { data } = await res.json()
          setClients(data || [])
        }
      } catch (err) {
        console.error('Error fetching clients:', err)
      } finally {
        setIsLoadingClients(false)
      }
    }
    fetchClients()
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  )

  const handleSelectClient = (id: string, name: string) => {
    setFormData(prev => ({ ...prev, cliente_id: id, cliente_nombre: name }))
    setClientSearch(name)
    setShowClientDropdown(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.cliente_id) {
      setError('Por favor seleccione un cliente de la lista.')
      return
    }
    setIsSaving(true)
    setError(null)
    
    try {
      const res = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to create sales record')
      }
      
      router.push('/ventas')
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in space-y-6">
        <header className="flex items-center gap-4">
          <Link 
            href="/ventas"
            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <TrendingUp className="text-teal-600" size={28} />
              {t('newVenta' as any) || 'Nueva Venta'}
            </h1>
          </div>
        </header>

        {error && (
          <div className="card p-4 text-red-500 bg-red-50 border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="card p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Searchable Client Selector */}
            <div ref={clientDropdownRef} className="relative md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('client' as any) || 'Cliente'} *
              </label>
              <input
                required
                type="text"
                placeholder={isLoadingClients ? 'Cargando clientes...' : 'Buscar y seleccionar cliente...'}
                className="erp-input w-full"
                value={clientSearch}
                onChange={e => {
                  setClientSearch(e.target.value)
                  setShowClientDropdown(true)
                  if (!e.target.value) {
                    setFormData(prev => ({ ...prev, cliente_id: '', cliente_nombre: '' }))
                  }
                }}
                onFocus={() => setShowClientDropdown(true)}
                disabled={isLoadingClients}
              />
              
              {showClientDropdown && filteredClients.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-20 animate-fade-in">
                  {filteredClients.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-900 transition-colors"
                      onClick={() => handleSelectClient(c.id, c.name)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              {showClientDropdown && filteredClients.length === 0 && !isLoadingClients && (
                <div className="absolute left-0 right-0 mt-1 p-4 text-center text-sm text-gray-500 bg-white border border-gray-200 rounded-xl shadow-lg z-20">
                  No se encontraron clientes.
                </div>
              )}
            </div>

            {/* Year Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('year' as any) || 'Año'} *
              </label>
              <select
                required
                className="erp-input w-full"
                value={formData.anio}
                onChange={e => setFormData({ ...formData, anio: parseInt(e.target.value, 10) })}
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>

            {/* Month Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('month' as any) || 'Mes'} *
              </label>
              <select
                required
                className="erp-input w-full"
                value={formData.mes}
                onChange={e => setFormData({ ...formData, mes: parseInt(e.target.value, 10) })}
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('monto' as any) || 'Monto'} *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 select-none">$</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  className="erp-input w-full !pl-10"
                  placeholder="0.00"
                  value={formData.monto}
                  onChange={e => setFormData({ ...formData, monto: e.target.value })}
                />
              </div>
            </div>

          </div>

          <div className="flex justify-end gap-4 pt-6 mt-6 border-t border-gray-100">
            <Link href="/ventas" className="btn-secondary">
              {t('cancel')}
            </Link>
            <button 
              type="submit"
              disabled={isSaving}
              className="btn-primary !bg-teal-600 hover:!bg-teal-700 !border-teal-700"
            >
              {isSaving ? (
                t('loading')
              ) : (
                <><Save size={18} /> {t('saveChanges')}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
