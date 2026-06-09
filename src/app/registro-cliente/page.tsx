'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { CheckCircle, ChevronRight, Loader2, Building2, Phone, MapPin, User, ArrowLeft, Mail, Plus, Trash2, Briefcase, Globe, FileText, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'

const MEXICAN_STATES = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
  'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México',
  'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit',
  'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
  'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
]

const TAX_REGIMES = [
  { code: '601', label: '601 General de Ley Personas Morales' },
  { code: '603', label: '603 Personas Morales con Fines no Lucrativos' },
  { code: '605', label: '605 Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { code: '606', label: '606 Arrendamiento' },
  { code: '612', label: '612 Personas Físicas con Actividades Empresariales y Profesionales' },
  { code: '625', label: '625 Régimen Simplificado de Confianza (RESICO)' },
  { code: 'Otro', label: 'Otro / No definido' },
]

const DEFAULT_HOSPITALS = [
  'Grupo Angeles', 'Medica Sur', 'San Angel Inn', 'Star Medica',
  'Hospitales ABC', 'Hospitales Christus Muguerza', 'IMSS', 'ISSSTE', 'Pemex', 'Alegra / Red Privada'
]

type Step = 'general' | 'fiscal' | 'operation' | 'addresses' | 'confirm'

interface CustomAddress {
  name: string
  address: string
  zip_code: string
  is_dhl?: boolean
}

const DhlLogo = () => (
  <span className="inline-flex items-center gap-0.5 bg-[#FFCC00] text-[#D00000] font-black italic tracking-tighter px-1.5 py-0.5 rounded text-[9px] select-none h-4 shadow-xs" style={{ fontFamily: "'Outfit', 'Inter', sans-serif" }}>
    DHL
  </span>
)

interface FormState {
  name: string
  phone: string
  email_primary: string
  legal_representative: string
  rfc: string
  tax_regime: string
  zip_code: string
  fiscal_address: string
  email_billing: string
  email_contact: string
  states: string[]
  hospitals: string[]
  specialties: string[]
  customSpecialty: string
  customHospital: string
  addresses: CustomAddress[]
  acceptTerms: boolean
}

const STEP_META: Record<Step, { icon: React.ReactNode; title: string; subtitle: string }> = {
  general: { icon: <User size={22} />, title: 'Información General', subtitle: 'Proporcione sus datos de contacto principales' },
  fiscal: { icon: <FileText size={22} />, title: 'Datos Fiscales', subtitle: 'Información para facturación y régimen tributario' },
  operation: { icon: <Briefcase size={22} />, title: 'Operación y Mercado', subtitle: 'Estados, especialidades y hospitales donde opera' },
  addresses: { icon: <MapPin size={22} />, title: 'Direcciones de Entrega', subtitle: 'Ingrese sus direcciones de entrega (sucursal DHL Ocurre o domicilio particular)' },
  confirm: { icon: <CheckCircle size={22} />, title: 'Confirmar y Enviar', subtitle: 'Verifique su información antes de finalizar' },
}

export default function RegistroClientePage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center bg-linear-to-br from-[#f0f5fa] via-[#dceaf5] to-[#c5d9ee]"><Loader2 className="animate-spin w-8 h-8 text-[#0763a9]" /></div>}>
      <RegistroClienteContent />
    </Suspense>
  )
}

function RegistroClienteContent() {
  const [step, setStep] = useState<Step>('general')
  const [clientId, setClientId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    email_primary: '',
    legal_representative: '',
    rfc: '',
    tax_regime: '',
    zip_code: '',
    fiscal_address: '',
    email_billing: '',
    email_contact: '',
    states: [],
    hospitals: [],
    specialties: [],
    customSpecialty: '',
    customHospital: '',
    addresses: [],
    acceptTerms: true
  })

  const [dbHospitals, setDbHospitals] = useState<string[]>([])
  const [dbSpecialties, setDbSpecialties] = useState<string[]>([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(false)
  const [savingProgress, setSavingProgress] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const [newAddrName, setNewAddrName] = useState('')
  const [newAddrVal, setNewAddrVal] = useState('')
  const [newAddrZip, setNewAddrZip] = useState('')
  const [newAddrIsDhl, setNewAddrIsDhl] = useState(false)
  const [stateSearch, setStateSearch] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)

  // Load catalogs and cached state
  useEffect(() => {
    async function init() {
      setLoadingCatalogs(true)
      try {
        const [hRes, sRes] = await Promise.all([
          fetch('/api/hospitals'),
          fetch('/api/catalog/specialties')
        ])
        const hJson = await hRes.json()
        const sJson = await sRes.json()

        if (hJson.data) {
          const list = hJson.data.map((h: any) => h.name)
          const merged = Array.from(new Set([...DEFAULT_HOSPITALS, ...list, 'Otros']))
          setDbHospitals(merged)
        } else {
          setDbHospitals([...DEFAULT_HOSPITALS, 'Otros'])
        }

        if (sJson.data) {
          setDbSpecialties([...sJson.data.map((s: any) => s.name), 'Otra especialidad'])
        } else {
          setDbSpecialties(['Ortopedia y Traumatología', 'Cirugía de Columna', 'Artroscopia', 'Otra especialidad'])
        }
      } catch (e) {
        console.error('Error loading catalogs', e)
        setDbHospitals([...DEFAULT_HOSPITALS, 'Otros'])
        setDbSpecialties(['Ortopedia y Traumatología', 'Cirugía de Columna', 'Artroscopia', 'Otra especialidad'])
      } finally {
        setLoadingCatalogs(false)
      }

      // Check localStorage for saved form
      const cachedForm = localStorage.getItem('registro_cliente_form')
      const cachedId = localStorage.getItem('registro_cliente_id')
      if (cachedForm) {
        try {
          setForm(JSON.parse(cachedForm))
        } catch (_) {}
      }
      if (cachedId) {
        setClientId(cachedId)
      }
    }
    init()
  }, [])

  // Auto-focus inputs on step change
  useEffect(() => {
    if (step !== 'confirm' && step !== 'operation' && step !== 'addresses') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [step])

  // Validation rules per step
  const isStepValid = () => {
    if (step === 'general') {
      return form.name.trim().length >= 3 &&
             /^\d{10}$/.test(form.phone.replace(/\D/g, '')) &&
             /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email_primary.trim())
    }
    if (step === 'fiscal') {
      // RFC is optional, but if entered, it should be between 12 and 13 chars
      if (form.rfc.trim() && (form.rfc.trim().length < 12 || form.rfc.trim().length > 13)) {
        return false
      }
      if (form.zip_code.trim() && !/^\d{5}$/.test(form.zip_code.trim())) {
        return false
      }
      if (form.email_billing.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email_billing.trim())) {
        return false
      }
      return true
    }
    if (step === 'operation') {
      // specialties and hospitals might need custom values if chosen
      if (form.specialties.includes('Otra especialidad') && !form.customSpecialty.trim()) {
        return false
      }
      if (form.hospitals.includes('Otros') && !form.customHospital.trim()) {
        return false
      }
      return true
    }
    if (step === 'addresses') {
      return true // Addresses are fully optional
    }
    if (step === 'confirm') {
      return form.acceptTerms
    }
    return true
  }

  // Auto-save function on clicking next/continuar
  const handleNext = async () => {
    if (!isStepValid()) return
    setSavingProgress(true)
    setError('')

    const payload: any = {
      name: form.name.trim(),
      phone: form.phone.replace(/\D/g, ''),
      whatsapp_phone: form.phone.replace(/\D/g, ''),
      email_primary: form.email_primary.trim(),
      legal_representative: form.legal_representative.trim() || null,
      rfc: form.rfc.trim() || null,
      tax_regime: form.tax_regime || null,
      zip_code: form.zip_code.trim() || null,
      fiscal_address: form.fiscal_address.trim() || null,
      email_billing: form.email_billing.trim() || null,
      email_contact: form.email_contact.trim() || null,
      states: form.states,
      hospitals: form.hospitals.map(h => h === 'Otros' ? form.customHospital : h).filter(Boolean),
      specialties: form.specialties.map(s => s === 'Otra especialidad' ? form.customSpecialty : s).filter(Boolean),
      addresses: form.addresses,
      source: 'Formulario Público',
      status: 'Nuevo Prospecto'
    }

    try {
      if (!clientId) {
        // Create new record
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Error al guardar los datos')
        if (json.data && json.data.id) {
          setClientId(json.data.id)
          localStorage.setItem('registro_cliente_id', json.data.id)
        }
      } else {
        // Update existing record
        const res = await fetch(`/api/clients/${clientId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Error al guardar los datos')
      }

      // Save form state to localStorage
      localStorage.setItem('registro_cliente_form', JSON.stringify(form))

      // Navigate to next step
      const stepOrder: Step[] = ['general', 'fiscal', 'operation', 'addresses', 'confirm']
      const currentIdx = stepOrder.indexOf(step)
      if (currentIdx < stepOrder.length - 1) {
        setStep(stepOrder[currentIdx + 1])
      }
    } catch (e: any) {
      setError(e.message || 'Error de conexión. Intente de nuevo.')
    } finally {
      setSavingProgress(false)
    }
  }

  const handleBack = () => {
    const stepOrder: Step[] = ['general', 'fiscal', 'operation', 'addresses', 'confirm']
    const currentIdx = stepOrder.indexOf(step)
    if (currentIdx > 0) {
      setStep(stepOrder[currentIdx - 1])
    }
  }

  const handleFinalSubmit = async () => {
    setSavingProgress(true)
    setError('')
    try {
      if (!clientId) throw new Error('Identificador de registro no encontrado')

      // Mark the status as "Nuevo Prospecto" or confirm complete
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Nuevo Prospecto',
          notes: (form.acceptTerms ? '[Aceptó Aviso de Privacidad] ' : '') + 'Registro completado desde Formulario Público.'
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al finalizar registro')

      // Clear local cache
      localStorage.removeItem('registro_cliente_form')
      localStorage.removeItem('registro_cliente_id')
      setSubmitted(true)
    } catch (e: any) {
      setError(e.message || 'Error de conexión al finalizar.')
    } finally {
      setSavingProgress(false)
    }
  }

  const addCustomAddress = () => {
    if (!newAddrName.trim() || !newAddrVal.trim()) return
    const updatedAddresses = [...form.addresses, {
      name: newAddrName.trim(),
      address: newAddrVal.trim(),
      zip_code: newAddrZip.trim(),
      is_dhl: newAddrIsDhl
    }]
    setForm(p => ({ ...p, addresses: updatedAddresses }))
    setNewAddrName('')
    setNewAddrVal('')
    setNewAddrZip('')
    setNewAddrIsDhl(false)
  }

  const removeCustomAddress = (idx: number) => {
    const updated = form.addresses.filter((_, i) => i !== idx)
    setForm(p => ({ ...p, addresses: updated }))
  }

  const toggleItem = (field: 'states' | 'hospitals' | 'specialties', item: string) => {
    const current = form[field]
    const updated = current.includes(item)
      ? current.filter(i => i !== item)
      : [...current, item]
    setForm(p => ({ ...p, [field]: updated }))
  }

  const progressPercentage = (() => {
    const stepOrder: Step[] = ['general', 'fiscal', 'operation', 'addresses', 'confirm']
    return ((stepOrder.indexOf(step) + 1) / stepOrder.length) * 100
  })()

  if (submitted) {
    return (
      <div className="min-h-[100dvh] bg-linear-to-br from-[#f0f5fa] via-[#dceaf5] to-[#c5d9ee] relative overflow-hidden flex items-start justify-center p-4">
        <div className="fixed rounded-full blur-[80px] opacity-35 pointer-events-none z-0 w-[380px] h-[380px] bg-radial from-[#9bbfdf] to-[#0763a9] -top-20 -right-20 animate-[pulse_12s_infinite_alternate]" />
        <div className="fixed rounded-full blur-[80px] opacity-35 pointer-events-none z-0 w-[280px] h-[280px] bg-radial from-[#c5d9ee] to-[#3d8bbf] -bottom-15 -left-15 animate-[pulse_16s_infinite_alternate-reverse]" />
        <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-4 pt-12">
          <div className="flex flex-col items-center gap-3 mb-8">
            <Image
              src="https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png"
              alt="Arthromed Logo"
              width={400}
              height={140}
              className="h-28 w-auto object-contain"
              priority
            />
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full bg-white border border-[#d4e0ec] rounded-3xl p-10 shadow-xl text-center flex flex-col items-center gap-6"
          >
            <div className="w-20 h-20 bg-linear-to-br from-[#dcfce7] to-[#bbf7d0] rounded-full flex items-center justify-center text-[#15803d] shadow-lg shadow-[#15803d]/20">
              <CheckCircle size={40} />
            </div>
            <h1 className="text-2xl font-bold text-[#37383a]">¡Datos actualizados con éxito!</h1>
            <p className="text-[#5a5b5d] leading-relaxed">
              Muchas gracias por proporcionar su información. Su registro ya está actualizado en nuestro sistema y un asesor especializado dará seguimiento a su perfil.
            </p>
            <div className="flex items-center gap-2 px-4 py-2 bg-[#e8f1f9] border border-[#c5d9ee] rounded-full text-[11px] font-bold text-[#0763a9] uppercase tracking-wider mt-2">
              <span>🏥</span> Arthromed — Equipo de Alto Rendimiento
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-linear-to-br from-[#f0f5fa] via-[#dceaf5] to-[#c5d9ee] relative overflow-hidden flex items-start justify-center p-4">
      {/* Background patterns */}
      <div className="fixed rounded-full blur-[80px] opacity-30 pointer-events-none z-0 w-[380px] h-[380px] bg-radial from-[#9bbfdf] to-[#0763a9] -top-20 -right-20" />
      <div className="fixed rounded-full blur-[80px] opacity-30 pointer-events-none z-0 w-[280px] h-[280px] bg-radial from-[#c5d9ee] to-[#3d8bbf] -bottom-15 -left-15" />

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-4 pt-6 pb-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <Image
            src="https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png"
            alt="Arthromed Logo"
            width={340}
            height={110}
            className="h-20 w-auto object-contain"
            priority
          />
        </div>

        {/* Progress Tracker */}
        <div className="w-full h-1 bg-[#0763a9]/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-[#0763a9] to-[#3d8bbf] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <p className="text-[10px] font-bold text-[#8a8b8d] tracking-widest self-end mt-[-10px] uppercase">
          Paso {step === 'general' ? 1 : step === 'fiscal' ? 2 : step === 'operation' ? 3 : step === 'addresses' ? 4 : 5} de 5
        </p>

        {/* Card Component */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 15, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full bg-white border border-[#d4e0ec] rounded-3xl p-6 md:p-8 shadow-xl shadow-[#0763a9]/5"
        >
          {/* Section Icon & Title */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-linear-to-br from-[#e8f1f9] to-[#c5d9ee] rounded-2xl flex items-center justify-center text-[#0763a9] shadow-sm flex-shrink-0">
              {STEP_META[step].icon}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[#37383a] leading-tight tracking-tight">
                {STEP_META[step].title}
              </h1>
              <p className="text-xs md:text-sm text-[#5a5b5d] leading-relaxed mt-0.5">
                {STEP_META[step].subtitle}
              </p>
            </div>
          </div>

          <hr className="border-[#f0f5fa] mb-6" />

          {/* Form Content per Step */}
          <div className="space-y-5 mb-8">
            {step === 'general' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-[#5a5b5d] uppercase tracking-wider mb-2" htmlFor="name">
                    Nombre o Razón social *
                  </label>
                  <input
                    ref={inputRef}
                    id="name"
                    type="text"
                    className="w-full bg-[#f8fafd] border-2 border-[#d4e0ec] rounded-xl px-4 py-3 text-[#37383a] transition-all focus:outline-none focus:border-[#0763a9] focus:bg-white focus:shadow-[0_0_0_4px_rgba(7,99,169,0.1)] placeholder:text-[#b4b5b7]"
                    placeholder="Ej. Comercializadora Médica del Norte S.A. de C.V."
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    autoComplete="organization"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5a5b5d] uppercase tracking-wider mb-2" htmlFor="legal_representative">
                    Nombre de Directivo o Representante Legal (Opcional)
                  </label>
                  <input
                    id="legal_representative"
                    type="text"
                    className="w-full bg-[#f8fafd] border-2 border-[#d4e0ec] rounded-xl px-4 py-3 text-[#37383a] transition-all focus:outline-none focus:border-[#0763a9] focus:bg-white focus:shadow-[0_0_0_4px_rgba(7,99,169,0.1)] placeholder:text-[#b4b5b7]"
                    placeholder="Ej. Ing. Juan Pérez Gómez"
                    value={form.legal_representative}
                    onChange={e => setForm(p => ({ ...p, legal_representative: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#5a5b5d] uppercase tracking-wider mb-2" htmlFor="phone">
                      Teléfono de contacto principal *
                    </label>
                    <div className="flex items-center bg-[#f8fafd] border-2 border-[#d4e0ec] rounded-xl overflow-hidden focus-within:border-[#0763a9] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(7,99,169,0.1)] transition-all">
                      <span className="px-3.5 py-3 text-sm font-bold text-[#5a5b5d] bg-[#f0f5fa] border-r-2 border-[#d4e0ec]">
                        🇲🇽 +52
                      </span>
                      <input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={15}
                        className="flex-1 bg-transparent px-4 py-3 text-[#37383a] focus:outline-none placeholder:text-[#b4b5b7]"
                        placeholder="81 1234 5678"
                        value={form.phone}
                        onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                        autoComplete="tel"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#5a5b5d] uppercase tracking-wider mb-2" htmlFor="email_primary">
                      Dirección de correo electrónico *
                    </label>
                    <input
                      id="email_primary"
                      type="email"
                      className="w-full bg-[#f8fafd] border-2 border-[#d4e0ec] rounded-xl px-4 py-3 text-[#37383a] transition-all focus:outline-none focus:border-[#0763a9] focus:bg-white focus:shadow-[0_0_0_4px_rgba(7,99,169,0.1)] placeholder:text-[#b4b5b7]"
                      placeholder="correo@ejemplo.com"
                      value={form.email_primary}
                      onChange={e => setForm(p => ({ ...p, email_primary: e.target.value }))}
                      autoComplete="email"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 'fiscal' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#5a5b5d] uppercase tracking-wider mb-2" htmlFor="rfc">
                      RFC (Registro Federal de Contribuyentes)
                    </label>
                    <input
                      ref={inputRef}
                      id="rfc"
                      type="text"
                      className="w-full bg-[#f8fafd] border-2 border-[#d4e0ec] rounded-xl px-4 py-3 text-[#37383a] transition-all focus:outline-none focus:border-[#0763a9] focus:bg-white focus:shadow-[0_0_0_4px_rgba(7,99,169,0.1)] placeholder:text-[#b4b5b7] uppercase"
                      placeholder="Ej. ABC010101XYZ"
                      value={form.rfc}
                      onChange={e => setForm(p => ({ ...p, rfc: e.target.value.toUpperCase() }))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#5a5b5d] uppercase tracking-wider mb-2" htmlFor="tax_regime">
                      Régimen Fiscal
                    </label>
                    <select
                      id="tax_regime"
                      className="w-full bg-[#f8fafd] border-2 border-[#d4e0ec] rounded-xl px-4 py-3 text-[#37383a] transition-all focus:outline-none focus:border-[#0763a9] focus:bg-white focus:shadow-[0_0_0_4px_rgba(7,99,169,0.1)]"
                      value={form.tax_regime}
                      onChange={e => setForm(p => ({ ...p, tax_regime: e.target.value }))}
                    >
                      <option value="">Seleccione su régimen fiscal</option>
                      {TAX_REGIMES.map(reg => (
                        <option key={reg.code} value={reg.label}>{reg.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-[#5a5b5d] uppercase tracking-wider mb-2" htmlFor="zip_code">
                      Código Postal (Fiscal)
                    </label>
                    <input
                      id="zip_code"
                      type="text"
                      maxLength={5}
                      className="w-full bg-[#f8fafd] border-2 border-[#d4e0ec] rounded-xl px-4 py-3 text-[#37383a] transition-all focus:outline-none focus:border-[#0763a9] focus:bg-white focus:shadow-[0_0_0_4px_rgba(7,99,169,0.1)] placeholder:text-[#b4b5b7]"
                      placeholder="Ej. 64000"
                      value={form.zip_code}
                      onChange={e => setForm(p => ({ ...p, zip_code: e.target.value.replace(/\D/g, '') }))}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-[#5a5b5d] uppercase tracking-wider mb-2" htmlFor="email_billing">
                      Correo electrónico para facturación
                    </label>
                    <input
                      id="email_billing"
                      type="email"
                      className="w-full bg-[#f8fafd] border-2 border-[#d4e0ec] rounded-xl px-4 py-3 text-[#37383a] transition-all focus:outline-none focus:border-[#0763a9] focus:bg-white focus:shadow-[0_0_0_4px_rgba(7,99,169,0.1)] placeholder:text-[#b4b5b7]"
                      placeholder="facturacion@ejemplo.com"
                      value={form.email_billing}
                      onChange={e => setForm(p => ({ ...p, email_billing: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5a5b5d] uppercase tracking-wider mb-2" htmlFor="fiscal_address">
                    Dirección Fiscal Completa
                  </label>
                  <textarea
                    id="fiscal_address"
                    rows={2}
                    className="w-full bg-[#f8fafd] border-2 border-[#d4e0ec] rounded-xl px-4 py-3 text-[#37383a] transition-all focus:outline-none focus:border-[#0763a9] focus:bg-white focus:shadow-[0_0_0_4px_rgba(7,99,169,0.1)] placeholder:text-[#b4b5b7]"
                    placeholder="Calle, Número exterior/interior, Colonia, Municipio, Estado, CP"
                    value={form.fiscal_address}
                    onChange={e => setForm(p => ({ ...p, fiscal_address: e.target.value }))}
                  />
                </div>
              </>
            )}

            {step === 'operation' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-[#5a5b5d] uppercase tracking-wider mb-2" htmlFor="email_contact">
                    Correo electrónico de contacto secundario (opcional)
                  </label>
                  <input
                    id="email_contact"
                    type="email"
                    className="w-full bg-[#f8fafd] border-2 border-[#d4e0ec] rounded-xl px-4 py-3 text-[#37383a] transition-all focus:outline-none focus:border-[#0763a9] focus:bg-white focus:shadow-[0_0_0_4px_rgba(7,99,169,0.1)] placeholder:text-[#b4b5b7]"
                    placeholder="contacto@ejemplo.com"
                    value={form.email_contact}
                    onChange={e => setForm(p => ({ ...p, email_contact: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5a5b5d] uppercase tracking-wider mb-2">
                    ¿En qué estado(s) de la República Mexicana trabaja actualmente?
                  </label>
                  <input
                    type="text"
                    placeholder="🔍 Buscar estado..."
                    className="w-full bg-[#f8fafd] border-2 border-[#d4e0ec] rounded-xl px-4 py-2.5 text-sm text-[#37383a] focus:outline-none focus:border-[#0763a9] focus:bg-white focus:shadow-[0_0_0_4px_rgba(7,99,169,0.1)] mb-3 placeholder:text-[#b4b5b7]"
                    value={stateSearch}
                    onChange={e => setStateSearch(e.target.value)}
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 bg-[#f8fafd] border border-[#d4e0ec] rounded-xl">
                    {MEXICAN_STATES.filter(state => 
                      state.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(
                        stateSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                      )
                    ).map(state => {
                      const selected = form.states.includes(state)
                      return (
                        <button
                          type="button"
                          key={state}
                          onClick={() => toggleItem('states', state)}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs text-left border transition-all ${
                            selected
                              ? 'bg-[#e8f1f9] border-[#0763a9] text-[#0763a9] font-bold shadow-xs'
                              : 'bg-white border-[#e8f1f9] text-[#37383a] hover:border-[#b4d2ed]'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-white ${selected ? 'bg-[#0763a9] border-[#0763a9]' : 'border-gray-300'}`}>
                            {selected && <Check size={10} />}
                          </div>
                          <span className="truncate">{state}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5a5b5d] uppercase tracking-wider mb-3">
                    Hospitales o cadena hospitalaria en los que distribuye nuestros productos
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-[#f8fafd] border border-[#d4e0ec] rounded-xl">
                    {dbHospitals.map(hosp => {
                      const selected = form.hospitals.includes(hosp)
                      return (
                        <button
                          type="button"
                          key={hosp}
                          onClick={() => toggleItem('hospitals', hosp)}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs text-left border transition-all ${
                            selected
                              ? 'bg-[#e8f1f9] border-[#0763a9] text-[#0763a9] font-bold shadow-xs'
                              : 'bg-white border-[#e8f1f9] text-[#37383a] hover:border-[#b4d2ed]'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-white ${selected ? 'bg-[#0763a9] border-[#0763a9]' : 'border-gray-300'}`}>
                            {selected && <Check size={10} />}
                          </div>
                          <span className="truncate">{hosp}</span>
                        </button>
                      )
                    })}
                  </div>
                  {form.hospitals.includes('Otros') && (
                    <input
                      type="text"
                      className="w-full bg-white border-2 border-[#0763a9] rounded-xl px-4 py-3 mt-2 text-[#37383a] focus:outline-none text-sm placeholder:text-[#b4b5b7] focus:shadow-[0_0_0_4px_rgba(7,99,169,0.1)]"
                      placeholder="Especifique los otros hospitales (separe con comas)"
                      value={form.customHospital}
                      onChange={e => setForm(p => ({ ...p, customHospital: e.target.value }))}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5a5b5d] uppercase tracking-wider mb-3">
                    ¿En qué especialidades tiene mayor actividad actualmente?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-[#f8fafd] border border-[#d4e0ec] rounded-xl">
                    {dbSpecialties.map(spec => {
                      const selected = form.specialties.includes(spec)
                      return (
                        <button
                          type="button"
                          key={spec}
                          onClick={() => toggleItem('specialties', spec)}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs text-left border transition-all ${
                            selected
                              ? 'bg-[#e8f1f9] border-[#0763a9] text-[#0763a9] font-bold shadow-xs'
                              : 'bg-white border-[#e8f1f9] text-[#37383a] hover:border-[#b4d2ed]'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-white ${selected ? 'bg-[#0763a9] border-[#0763a9]' : 'border-gray-300'}`}>
                            {selected && <Check size={10} />}
                          </div>
                          <span className="truncate">{spec}</span>
                        </button>
                      )
                    })}
                  </div>
                  {form.specialties.includes('Otra especialidad') && (
                    <input
                      type="text"
                      className="w-full bg-white border-2 border-[#0763a9] rounded-xl px-4 py-3 mt-2 text-[#37383a] focus:outline-none text-sm placeholder:text-[#b4b5b7] focus:shadow-[0_0_0_4px_rgba(7,99,169,0.1)]"
                      placeholder="Especifique su especialidad"
                      value={form.customSpecialty}
                      onChange={e => setForm(p => ({ ...p, customSpecialty: e.target.value }))}
                    />
                  )}
                </div>
              </>
            )}

            {step === 'addresses' && (
              <>
                <div className="bg-[#f0f5fa] border border-[#d4e0ec] rounded-2xl p-4 md:p-5 space-y-4">
                  <h3 className="text-sm font-bold text-[#37383a] flex items-center gap-2">
                    <Plus size={16} /> Registrar Dirección de Entrega
                  </h3>
                  <p className="text-xs text-[#5a5b5d] leading-relaxed">
                    Por favor, ingrese los datos de sus direcciones de entrega (sucursal <DhlLogo /> Ocurre o domicilio particular).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[#5a5b5d] uppercase tracking-wider mb-1">
                        Nombre / Alias de la Dirección *
                      </label>
                      <input
                        type="text"
                        className="w-full bg-white border border-[#d4e0ec] rounded-lg px-3 py-2 text-sm text-[#37383a] focus:outline-none focus:border-[#0763a9]"
                        placeholder="Ej. Oficina Principal o Sucursal DHL"
                        value={newAddrName}
                        onChange={e => setNewAddrName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#5a5b5d] uppercase tracking-wider mb-1">
                        Código Postal (Opcional)
                      </label>
                      <input
                        type="text"
                        maxLength={5}
                        className="w-full bg-white border border-[#d4e0ec] rounded-lg px-3 py-2 text-sm text-[#37383a] focus:outline-none focus:border-[#0763a9]"
                        placeholder="Ej. 25000"
                        value={newAddrZip}
                        onChange={e => setNewAddrZip(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#5a5b5d] uppercase tracking-wider mb-1">
                      Dirección Completa *
                    </label>
                    <textarea
                      rows={2}
                      className="w-full bg-white border border-[#d4e0ec] rounded-lg px-3 py-2 text-sm text-[#37383a] focus:outline-none focus:border-[#0763a9]"
                      placeholder="Ej. Boulevard Venustiano Carranza 3450, Col. República, Saltillo, Coahuila"
                      value={newAddrVal}
                      onChange={e => setNewAddrVal(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <input
                      type="checkbox"
                      id="new-addr-dhl"
                      className="w-4 h-4 text-[#0763a9] border-gray-300 rounded focus:ring-[#0763a9] cursor-pointer"
                      checked={newAddrIsDhl}
                      onChange={e => setNewAddrIsDhl(e.target.checked)}
                    />
                    <label htmlFor="new-addr-dhl" className="text-xs font-bold text-[#5a5b5d] cursor-pointer flex items-center gap-1.5 selection:bg-transparent">
                      Es una sucursal <DhlLogo /> Ocurre
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={addCustomAddress}
                    disabled={!newAddrName.trim() || !newAddrVal.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-[#0763a9] hover:bg-[#054d85] disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-sm transition-all"
                  >
                    <Plus size={16} /> Agregar Dirección a la Lista
                  </button>
                </div>

                {form.addresses.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    <h4 className="text-xs font-bold text-[#5a5b5d] uppercase tracking-wider">Direcciones Registradas ({form.addresses.length})</h4>
                    {form.addresses.map((addr, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-3 p-3 bg-[#f8fafd] border border-[#e8f1f9] rounded-xl hover:border-[#b4d2ed] transition-colors">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-[#0763a9]">{addr.name}</span>
                            {addr.is_dhl && <DhlLogo />}
                            {addr.zip_code && <span className="text-[10px] bg-[#e8f1f9] px-1.5 py-0.5 rounded text-gray-500 font-mono">CP {addr.zip_code}</span>}
                          </div>
                          <p className="text-xs text-[#5a5b5d] mt-1 line-clamp-2">{addr.address}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCustomAddress(idx)}
                          className="text-[#b91c1c] hover:bg-[#fee2e2] p-1.5 rounded-lg transition-colors flex-shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#5a5b5d] bg-[#f0f5fa] border border-[#d4e0ec] p-3 rounded-xl text-center">
                    No ha agregado direcciones de entrega aún. Puede continuar sin agregar direcciones si lo prefiere.
                  </p>
                )}
              </>
            )}

            {step === 'confirm' && (
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                <ConfirmRow label="Nombre / Razón Social" value={form.name} />
                {form.legal_representative && <ConfirmRow label="Representante / Directivo" value={form.legal_representative} />}
                <ConfirmRow label="Teléfono" value={form.phone} />
                <ConfirmRow label="Correo Electrónico" value={form.email_primary} />

                {(form.rfc || form.tax_regime || form.fiscal_address) && (
                  <div className="border border-[#e8f1f9] rounded-2xl p-4 bg-[#f8fafd] space-y-2.5">
                    <h3 className="text-xs font-bold text-[#8a8b8d] uppercase tracking-wider">Información Fiscal</h3>
                    {form.rfc && <ConfirmRowMini label="RFC" value={form.rfc} />}
                    {form.tax_regime && <ConfirmRowMini label="Régimen" value={form.tax_regime} />}
                    {form.zip_code && <ConfirmRowMini label="C.P. Fiscal" value={form.zip_code} />}
                    {form.email_billing && <ConfirmRowMini label="Email Facturas" value={form.email_billing} />}
                    {form.fiscal_address && <ConfirmRowMini label="Dirección Fiscal" value={form.fiscal_address} />}
                  </div>
                )}

                {(form.states.length > 0 || form.hospitals.length > 0 || form.specialties.length > 0) && (
                  <div className="border border-[#e8f1f9] rounded-2xl p-4 bg-[#f8fafd] space-y-2.5">
                    <h3 className="text-xs font-bold text-[#8a8b8d] uppercase tracking-wider">Operación y Mercado</h3>
                    {form.states.length > 0 && <ConfirmRowMini label="Estados de Operación" value={form.states.join(', ')} />}
                    {form.hospitals.length > 0 && <ConfirmRowMini label="Hospitales" value={form.hospitals.join(', ')} />}
                    {form.specialties.length > 0 && (
                      <ConfirmRowMini
                        label="Especialidades"
                        value={form.specialties.map(s => s === 'Otra especialidad' ? form.customSpecialty : s).filter(Boolean).join(', ')}
                      />
                    )}
                  </div>
                )}

                {form.addresses.length > 0 && (
                  <div className="border border-[#e8f1f9] rounded-2xl p-4 bg-[#f8fafd] space-y-2">
                    <h3 className="text-xs font-bold text-[#8a8b8d] uppercase tracking-wider">Direcciones de Entrega ({form.addresses.length})</h3>
                    {form.addresses.map((addr, index) => (
                      <div key={index} className="text-xs p-2.5 bg-white rounded-lg border border-[#e8f1f9]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#0763a9]">{addr.name}</span>
                          {addr.is_dhl && <DhlLogo />}
                          {addr.zip_code && <span className="font-mono text-[10px] text-gray-500">(CP: {addr.zip_code})</span>}
                        </div>
                        <p className="text-gray-650 mt-1">{addr.address}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-start gap-3 mt-4 pt-2">
                  <input
                    type="checkbox"
                    id="accept-terms"
                    className="mt-1 w-4 h-4 text-[#0763a9] border-gray-300 rounded focus:ring-[#0763a9] cursor-pointer"
                    checked={form.acceptTerms}
                    onChange={e => setForm(p => ({ ...p, acceptTerms: e.target.checked }))}
                  />
                  <label htmlFor="accept-terms" className="text-xs text-[#5a5b5d] leading-relaxed cursor-pointer selection:bg-transparent">
                    Acepto que mi información sea guardada y procesada de acuerdo con el{' '}
                    <Link href="/aviso-de-privacidad" target="_blank" className="text-[#0763a9] hover:underline font-bold">
                      Aviso de Privacidad
                    </Link>{' '}
                    de Arthromed.
                  </label>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs md:text-sm text-[#b91c1c] bg-[#fee2e2] border border-[#fecaca] rounded-xl px-4 py-3 mb-6 animate-pulse">
              ⚠️ {error}
            </p>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center gap-3">
            {step !== 'general' && (
              <button
                type="button"
                id="btn-back"
                disabled={savingProgress}
                className="w-12 h-12 flex items-center justify-center rounded-xl border-2 border-[#d4e0ec] bg-[#f8fafd] text-[#5a5b5d] hover:bg-[#e8f1f9] hover:border-[#9bbfdf] transition-all flex-shrink-0 disabled:opacity-50"
                onClick={handleBack}
              >
                <ArrowLeft size={18} />
              </button>
            )}

            <button
              type="button"
              id="btn-next"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-linear-to-br from-[#0763a9] to-[#054d85] text-white py-3.5 px-6 rounded-xl font-bold text-base md:text-lg shadow-lg shadow-[#0763a9]/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              onClick={step === 'confirm' ? handleFinalSubmit : handleNext}
              disabled={savingProgress || !isStepValid() || loadingCatalogs}
            >
              {savingProgress ? (
                <Loader2 size={20} className="animate-spin" />
              ) : step === 'confirm' ? (
                <CheckCircle size={20} />
              ) : null}
              {savingProgress
                ? 'Guardando...'
                : step === 'confirm'
                ? 'Confirmar Registro'
                : 'Continuar'}
              {step !== 'confirm' && !savingProgress && <ChevronRight size={20} />}
            </button>
          </div>
        </motion.div>

        <p className="text-[10px] text-[#8a8b8d] text-center leading-relaxed max-w-[400px] mt-2">
          Su información está segura con nosotros. Guardamos su progreso en cada paso en caso de interrupción. <br />
          <Link href="/aviso-de-privacidad" className="text-[#0763a9] hover:underline font-semibold">
            Aviso de Privacidad
          </Link>
        </p>
      </div>
    </div>
  )
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 p-3 bg-[#f8fafd] border border-[#e8f1f9] rounded-xl">
      <span className="text-[10px] font-bold text-[#8a8b8d] uppercase tracking-wider mt-0.5">{label}</span>
      <span className="text-xs font-semibold text-[#37383a] text-right leading-tight">{value || '—'}</span>
    </div>
  )
}

function ConfirmRowMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-3 text-xs border-b border-[#f0f5fa] pb-1.5 last:border-0 last:pb-0">
      <span className="font-semibold text-gray-450">{label}</span>
      <span className="text-[#37383a] text-right max-w-[70%] truncate" title={value}>{value || '—'}</span>
    </div>
  )
}
