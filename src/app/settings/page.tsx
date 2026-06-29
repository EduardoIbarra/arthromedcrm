'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/contexts/I18nContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Globe, Database, MessageCircle, Bot, FileText, X, Plus, Loader2, DollarSign, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/contexts/CurrencyContext'
import packageJson from '../../../package.json'


const CARD = { background: '#ffffff', border: '1px solid #d4e0ec' }

function SettingCard({ icon, iconColor, title, children }: { icon: React.ReactNode; iconColor: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 space-y-4 bg-white" style={CARD}>
      <div className="flex items-center gap-2">
        <span style={{ color: iconColor }}>{icon}</span>
        <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center p-2 rounded-lg" style={{ background: '#f8fafd' }}>
      <span className="text-sm" style={{ color: '#5a5b5d' }}>{label}</span>
      <span className="text-sm font-medium font-mono" style={{ color: '#37383a' }}>{value}</span>
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useI18n()
  const { exchangeRate, setExchangeRate } = useCurrency()
  const [exchangeRateInput, setExchangeRateInput] = useState(exchangeRate.toString())
  const [savingRate, setSavingRate] = useState(false)
  const [alegraConfig, setAlegraConfig] = useState<{ configured: boolean; email: string | null } | null>(null)
  const [garantiasUsers, setGarantiasUsers] = useState<string[]>([])
  const [inventarioUsers, setInventarioUsers] = useState<string[]>([])
  const [users, setUsers] = useState<{id: string, email: string, whatsapp: string}[]>([])
  const [savingNumbers, setSavingNumbers] = useState(false)
  const [deliveryDaysInput, setDeliveryDaysInput] = useState('25')
  const [savingDeliveryDays, setSavingDeliveryDays] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setExchangeRateInput(exchangeRate.toString())
  }, [exchangeRate])

  useEffect(() => {
    fetch('/api/alegra/config')
      .then(res => res.json())
      .then(data => setAlegraConfig(data))
      .catch(err => console.error('Error fetching Alegra config:', err))

    fetch('/api/settings?key=notification_config')
      .then(res => res.json())
      .then(data => {
        if (data.value) {
          if (Array.isArray(data.value.garantias)) setGarantiasUsers(data.value.garantias)
          if (Array.isArray(data.value.inventario_salidas)) setInventarioUsers(data.value.inventario_salidas)
        }
      })
      .catch(err => console.error('Error fetching notification config:', err))
      
    fetch('/api/settings?key=delivery_time_days')
      .then(res => res.json())
      .then(data => {
        if (data.value) {
          setDeliveryDaysInput(data.value.toString())
        }
      })
      .catch(err => console.error('Error fetching delivery days:', err))
      
    supabase.from('user_profiles').select('id, email, whatsapp').not('whatsapp', 'is', null).then((res: any) => {
      if (res.data) setUsers(res.data)
    })
  }, [])

  const saveConfig = async (newGarantias: string[], newInventario: string[]) => {
    setSavingNumbers(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key: 'notification_config', 
          value: { garantias: newGarantias, inventario_salidas: newInventario } 
        })
      })
      setGarantiasUsers(newGarantias)
      setInventarioUsers(newInventario)
    } catch (err) {
      console.error('Error saving config:', err)
    } finally {
      setSavingNumbers(false)
    }
  }

  const toggleUser = (userId: string, list: 'garantias' | 'inventario') => {
    if (list === 'garantias') {
      const nextUsers = garantiasUsers.includes(userId) ? garantiasUsers.filter(id => id !== userId) : [...garantiasUsers, userId]
      saveConfig(nextUsers, inventarioUsers)
    } else {
      const nextUsers = inventarioUsers.includes(userId) ? inventarioUsers.filter(id => id !== userId) : [...inventarioUsers, userId]
      saveConfig(garantiasUsers, nextUsers)
    }
  }

  const handleSaveExchangeRate = async () => {
    const val = parseFloat(exchangeRateInput)
    if (isNaN(val) || val <= 0) {
      alert('Por favor introduce un tipo de cambio válido mayor a 0.')
      return
    }
    setSavingRate(true)
    try {
      await setExchangeRate(val)
      alert('Tipo de cambio guardado exitosamente.')
    } catch (err) {
      console.error(err)
      alert('Error al guardar el tipo de cambio.')
    } finally {
      setSavingRate(false)
    }
  }

  const handleSaveDeliveryDays = async () => {
    const val = parseInt(deliveryDaysInput)
    if (isNaN(val) || val <= 0) {
      alert('Por favor introduce un número de días válido mayor a 0.')
      return
    }
    setSavingDeliveryDays(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'delivery_time_days', value: val.toString() }),
      })
      alert('Tiempo de entrega guardado exitosamente.')
    } catch (err) {
      console.error('Error saving delivery days setting:', err)
      alert('Error al guardar el tiempo de entrega.')
    } finally {
      setSavingDeliveryDays(false)
    }
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#37383a' }}>{t('settings')}</h1>
            <p className="text-sm" style={{ color: '#5a5b5d' }}>Configuración del sistema</p>
          </div>
          <div className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-[#f8fafd] border border-[#d4e0ec] text-[#5a5b5d] font-mono">
            v{packageJson.version}
          </div>
        </div>


        <SettingCard icon={<Globe size={16} />} iconColor="#0763a9" title={t('language')}>
          <div className="flex items-center gap-4">
            <p className="text-sm" style={{ color: '#5a5b5d' }}>Idioma de la interfaz:</p>
            <LanguageSwitcher />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-1">
            {[
              { flag: '🇲🇽', name: t('spanish'), desc: 'Predeterminado' },
              { flag: '🇺🇸', name: t('english'), desc: 'English' },
              { flag: '🇨🇳', name: t('chinese'), desc: '中文' },
            ].map(l => (
              <div key={l.flag} className="flex flex-col items-center gap-1 p-3 rounded-xl border text-center" style={{ borderColor: '#e8f1f9', background: '#f8fafd' }}>
                <span className="text-2xl">{l.flag}</span>
                <p className="text-xs font-medium" style={{ color: '#37383a' }}>{l.name}</p>
                <p className="text-xs" style={{ color: '#8a8b8d' }}>{l.desc}</p>
              </div>
            ))}
          </div>
        </SettingCard>

        <SettingCard icon={<DollarSign size={16} />} iconColor="#0d9488" title="Divisa / Tipo de Cambio">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: '#37383a' }}>Tipo de Cambio USD / MXN</p>
                <p className="text-xs" style={{ color: '#8a8b8d' }}>
                  Define el tipo de cambio utilizado para los reportes cuando se selecciona la divisa USD.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={exchangeRateInput}
                  onChange={(e) => setExchangeRateInput(e.target.value)}
                  className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-sm font-mono w-28 text-right outline-none focus:border-brand-500/40"
                  placeholder="20.00"
                />
                <span className="text-xs font-semibold text-gray-500">MXN</span>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleSaveExchangeRate}
                disabled={savingRate}
                className="px-4 py-2 hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                style={{ background: '#0763a9' }}
              >
                {savingRate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Guardar Tipo de Cambio
              </button>
            </div>
          </div>
        </SettingCard>

        <SettingCard icon={<Clock size={16} />} iconColor="#f59e0b" title="Tiempo de Entrega">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: '#37383a' }}>Días de Entrega Prometidos</p>
                <p className="text-xs" style={{ color: '#8a8b8d' }}>
                  Define el número de días hábiles después del pago para entregar la factura.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={deliveryDaysInput}
                  onChange={(e) => setDeliveryDaysInput(e.target.value)}
                  className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-sm font-mono w-28 text-right outline-none focus:border-brand-500/40"
                  placeholder="25"
                />
                <span className="text-xs font-semibold text-gray-500">días hábiles</span>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleSaveDeliveryDays}
                disabled={savingDeliveryDays}
                className="px-4 py-2 hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                style={{ background: '#0763a9' }}
              >
                {savingDeliveryDays ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Guardar Tiempo de Entrega
              </button>
            </div>
          </div>
        </SettingCard>

        <SettingCard icon={<MessageCircle size={16} />} iconColor="#15803d" title="WhatsApp">
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#37383a' }}>Notificaciones de Garantías</p>
            <p className="text-xs mb-3" style={{ color: '#8a8b8d' }}>Selecciona qué usuarios recibirán las notificaciones de nuevos registros o cambios de estado en Garantías. Solo aparecen usuarios con número de WhatsApp configurado.</p>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {users.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No hay usuarios con número de WhatsApp configurado.</p>
              ) : (
                users.map((user) => {
                  const isSelected = garantiasUsers.includes(user.id)
                  return (
                    <label key={`g-${user.id}`} className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors" style={{ border: isSelected ? '1px solid #c2e0ff' : '1px solid #e8f1f9', background: isSelected ? '#f0f7ff' : '#ffffff' }}>
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleUser(user.id, 'garantias')}
                          disabled={savingNumbers}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#37383a' }}>{user.email}</p>
                          <p className="text-xs font-mono" style={{ color: '#8a8b8d' }}>{user.whatsapp}</p>
                        </div>
                      </div>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          <div className="h-px bg-gray-100 my-4" />

          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#37383a' }}>Notificaciones de Salidas de Inventario</p>
            <p className="text-xs mb-3" style={{ color: '#8a8b8d' }}>Selecciona qué usuarios recibirán las alertas cuando se registre una salida manual de inventario.</p>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {users.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No hay usuarios con número de WhatsApp configurado.</p>
              ) : (
                users.map((user) => {
                  const isSelected = inventarioUsers.includes(user.id)
                  return (
                    <label key={`i-${user.id}`} className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors" style={{ border: isSelected ? '1px solid #c2e0ff' : '1px solid #e8f1f9', background: isSelected ? '#f0f7ff' : '#ffffff' }}>
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleUser(user.id, 'inventario')}
                          disabled={savingNumbers}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#37383a' }}>{user.email}</p>
                          <p className="text-xs font-mono" style={{ color: '#8a8b8d' }}>{user.whatsapp}</p>
                        </div>
                      </div>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          <div className="h-px bg-gray-100 my-4" />

          <p className="text-sm" style={{ color: '#5a5b5d' }}>Plantillas aprobadas disponibles:</p>
          <div className="space-y-2">
            {[
              { id: 'lead_generic_followup', desc: 'Seguimiento genérico de lead' },
              { id: 'lead_onboarding_distributor', desc: 'Bienvenida a nuevo distribuidor' },
              { id: 'lead_referral_doctor', desc: 'Referido por médico' },
            ].map(tmpl => (
              <div key={tmpl.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl" style={{ border: '1px solid #e8f1f9', background: '#f8fafd' }}>
                <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0 pulse-dot" style={{ background: '#15803d' }} />
                <div>
                  <p className="text-sm font-mono" style={{ color: '#0763a9' }}>{tmpl.id}</p>
                  <p className="text-xs" style={{ color: '#8a8b8d' }}>{tmpl.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </SettingCard>

        <SettingCard icon={<Bot size={16} />} iconColor="#b45309" title="Inteligencia Artificial">
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ border: '1px solid #e8f1f9', background: '#f8fafd' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: '#37383a' }}>Gemini 2.0 Flash</p>
              <p className="text-xs" style={{ color: '#8a8b8d' }}>Modelo para resúmenes de clientes</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>Activo</span>
          </div>
        </SettingCard>

        <SettingCard icon={<FileText size={16} />} iconColor="#0763a9" title="Integración con Alegra">
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ border: '1px solid #e8f1f9', background: '#f8fafd' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: '#37383a' }}>Sincronización de Facturas</p>
              {alegraConfig?.configured ? (
                <p className="text-xs" style={{ color: '#8a8b8d' }}>Cuenta: {alegraConfig.email}</p>
              ) : (
                <p className="text-xs text-rose-500 font-semibold">Credenciales no configuradas</p>
              )}
            </div>
            {alegraConfig?.configured ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>Conectado</span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>Desconectado</span>
            )}
          </div>
        </SettingCard>

        <SettingCard icon={<Database size={16} />} iconColor="#0763a9" title="Base de Datos">
          <div className="space-y-2">
            <Row label="Proveedor" value="Supabase (PostgreSQL)" />
            <Row label="Proyecto" value="vogpviplsmupegohvbtl" />
            <Row label="Región" value="us-east-1" />
          </div>
        </SettingCard>
      </div>
    </AppShell>
  )
}
