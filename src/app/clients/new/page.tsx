'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/contexts/I18nContext'
import { ChevronLeft, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { ClientInsert } from '@/types/database'

const MEXICO_STATES = [
  'CDMX','Estado de México','Jalisco','Nuevo León','Puebla','Guanajuato',
  'Veracruz','Chihuahua','Sonora','Coahuila','Tamaulipas','Baja California',
  'Sinaloa','Yucatán','Quintana Roo','San Luis Potosí','Guerrero','Oaxaca',
  'Morelos','Querétaro','Aguascalientes','Durango','Zacatecas','Colima',
  'Nayarit','Hidalgo','Tlaxcala','Tabasco','Michoacán','Chiapas','Campeche',
]
// Dynamic specialties will be fetched from API

const HOSPITAL_CHAINS = [
  'Grupo Angeles','Médica Sur','San Angel Inn','Star Médica','Hospitales ABC',
  'Hospitales AUNA','Hospitales Christus Muguerza','IMSS','ISSSTE','TEC SALUD',
  'Puerta de Hierro','MAC Hospitales','Hospitales Compartamos',
]
const TAX_REGIMES = [
  '601 General de Ley de Personas Morales',
  'Régimen Simplificado de Confianza',
  'Régimen General de Ley Personas Morales',
  'Personas Físicas con Actividades Empresariales',
  'Persona Moral','Otro',
]

const CARD = { background: '#ffffff', border: '1px solid #d4e0ec' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 space-y-4 bg-white" style={CARD}>
      <h2 className="text-sm font-semibold pb-2" style={{ color: '#37383a', borderBottom: '1px solid #e8f1f9' }}>{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a5b5d' }}>{label}</label>
      {children}
    </div>
  )
}

function TagToggle({ value, active, color, onClick }: { value: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
      style={active
        ? { background: `${color}18`, color, border: `1px solid ${color}50` }
        : { color: '#5a5b5d', border: '1px solid #d4e0ec' }
      }
    >{value}</button>
  )
}

export default function NewClientPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [specialties, setSpecialties] = useState<string[]>([])
  const [form, setForm] = useState<Partial<ClientInsert>>({ status: 'Activo', states: [], hospitals: [], specialties: [], tags: [] })

  useEffect(() => {
    async function loadSpecialties() {
      try {
        const res = await fetch('/api/catalog/specialties')
        const json = await res.json()
        if (json.data) setSpecialties(json.data.map((s: any) => s.name))
      } catch (e) {
        console.error('Error loading specialties', e)
        setSpecialties(['Artroscopia', 'Columna', 'Traumatología y Ortopedia'])
      }
    }
    loadSpecialties()
  }, [])

  const set = (key: keyof ClientInsert, val: unknown) => setForm(p => ({ ...p, [key]: val }))
  const toggleArray = (key: keyof ClientInsert, val: string) => {
    const current = (form[key] as string[]) || []
    set(key, current.includes(val) ? current.filter(v => v !== val) : [...current, val])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name?.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      router.push(`/clients/${json.data.id}`)
    } catch (err) { setError(String(err)); setSaving(false) }
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/clients" className="btn-ghost text-sm"><ChevronLeft size={16} /> {t('back')}</Link>
            <h1 className="text-xl font-bold" style={{ color: '#37383a' }}>{t('newClient')}</h1>
          </div>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary text-sm">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {t('createClient')}
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Section title="Información General">
            <Field label={t('companyName')} full>
              <input required className="erp-input" value={form.name || ''} onChange={e => set('name', e.target.value)} />
            </Field>
            <Field label={t('taxId')}>
              <input className="erp-input font-mono" value={form.rfc || ''} onChange={e => set('rfc', e.target.value.toUpperCase())} />
            </Field>
            <Field label={t('status')}>
              <select className="erp-input" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
                <option value="Nuevo Prospecto">Nuevo Prospecto</option>
                <option value="Contactado">Contactado</option>
                <option value="Calificado">Calificado</option>
                <option value="Negociación">Negociación</option>
                <option value="Perdido">Perdido</option>
              </select>
            </Field>
            <Field label="Origen (Source)">
              <input className="erp-input" value={form.source || ''} onChange={e => set('source', e.target.value)} placeholder="Ej: Simposio, WhatsApp" />
            </Field>
            <Field label={t('taxRegime')} full>
              <select className="erp-input" value={form.tax_regime || ''} onChange={e => set('tax_regime', e.target.value)}>
                <option value="">Seleccionar...</option>
                {TAX_REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </Section>

          <Section title={t('contactInfo')}>
            <Field label={t('primaryPhone')}>
              <input type="tel" className="erp-input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
            </Field>
            <Field label={t('whatsappPhone')}>
              <input type="tel" className="erp-input" value={form.whatsapp_phone || ''} onChange={e => set('whatsapp_phone', e.target.value)} placeholder="Si es diferente al principal" />
            </Field>
            <Field label={t('primaryEmail')}>
              <input type="email" className="erp-input" value={form.email_primary || ''} onChange={e => set('email_primary', e.target.value)} />
            </Field>
            <Field label={t('contactEmail')}>
              <input type="email" className="erp-input" value={form.email_contact || ''} onChange={e => set('email_contact', e.target.value)} />
            </Field>
            <Field label={t('billingEmail')}>
              <input type="email" className="erp-input" value={form.email_billing || ''} onChange={e => set('email_billing', e.target.value)} />
            </Field>
          </Section>

          <Section title={t('fiscalInfo')}>
            <Field label={t('zipCode')}>
              <input className="erp-input" value={form.zip_code || ''} onChange={e => set('zip_code', e.target.value)} />
            </Field>
            <Field label={t('fiscalAddress')} full>
              <textarea className="erp-input" rows={2} value={form.fiscal_address || ''} onChange={e => set('fiscal_address', e.target.value)} />
            </Field>
          </Section>

          {/* Commercial toggles */}
          <div className="rounded-2xl p-5 space-y-5 bg-white" style={CARD}>
            <h2 className="text-sm font-semibold pb-2" style={{ color: '#37383a', borderBottom: '1px solid #e8f1f9' }}>{t('commercialInfo')}</h2>
            <div>
              <label className="text-xs font-medium block mb-2" style={{ color: '#5a5b5d' }}>{t('operatingStates')}</label>
              <div className="flex flex-wrap gap-1.5">
                {MEXICO_STATES.map(s => <TagToggle key={s} value={s} active={(form.states || []).includes(s)} color="#0763a9" onClick={() => toggleArray('states', s)} />)}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium block mb-2" style={{ color: '#5a5b5d' }}>{t('medicalSpecialties')}</label>
              <div className="flex flex-wrap gap-1.5">
                {specialties.map(s => <TagToggle key={s} value={s} active={(form.specialties || []).includes(s)} color="#b45309" onClick={() => toggleArray('specialties', s)} />)}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium block mb-2" style={{ color: '#5a5b5d' }}>{t('hospitalChains')}</label>
              <div className="flex flex-wrap gap-1.5">
                {HOSPITAL_CHAINS.map(h => <TagToggle key={h} value={h} active={(form.hospitals || []).includes(h)} color="#15803d" onClick={() => toggleArray('hospitals', h)} />)}
              </div>
            </div>
          </div>

          <Section title="Notas y Etiquetas">
            <Field label={t('notes')} full>
              <textarea className="erp-input" rows={3} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
            </Field>
            <Field label={t('assignedTo')}>
              <input className="erp-input" value={form.assigned_to || ''} onChange={e => set('assigned_to', e.target.value)} placeholder="Nombre del responsable" />
            </Field>
            <Field label={`${t('tags')} (separadas por comas)`}>
              <input className="erp-input" value={(form.tags || []).join(', ')} onChange={e => set('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="vip, nuevo, seguimiento" />
            </Field>
          </Section>

          <div className="flex justify-end pb-6">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {t('createClient')}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
