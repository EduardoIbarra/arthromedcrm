'use client'
import { useState, useRef, useEffect } from 'react'
import { CheckCircle, ChevronRight, Loader2, Stethoscope, Building2, Phone, MapPin, User, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

const MEXICAN_STATES = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas',
  'Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Estado de México',
  'Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán','Morelos','Nayarit',
  'Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí',
  'Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas',
]

// Dynamic specialties will be fetched from API


type Step = 'name' | 'specialty' | 'hospital' | 'phone' | 'state' | 'confirm'

interface FormData {
  name: string
  specialty: string
  customSpecialty: string
  hospital: string
  phone: string
  state: string
}

const STEPS: Step[] = ['name', 'specialty', 'hospital', 'phone', 'state', 'confirm']

const STEP_META: Record<Step, { icon: React.ReactNode; title: string; subtitle: string }> = {
  name:      { icon: <User size={22} />,         title: '¿Cómo se llama?',              subtitle: 'Su nombre completo como aparece en su cédula profesional' },
  specialty: { icon: <Stethoscope size={22} />,  title: '¿Cuál es su especialidad?',    subtitle: 'Seleccione la que mejor describe su práctica principal' },
  hospital:  { icon: <Building2 size={22} />,    title: '¿Dónde ejerce?',               subtitle: 'Hospital o institución donde realiza la mayoría de sus procedimientos' },
  phone:     { icon: <Phone size={22} />,         title: '¿Su WhatsApp?',               subtitle: 'Le enviaremos información de productos relevantes a su especialidad' },
  state:     { icon: <MapPin size={22} />,        title: '¿En qué estado practica?',    subtitle: 'Esto nos permite asignarle un asesor en su zona' },
  confirm:   { icon: <CheckCircle size={22} />,  title: 'Todo listo',                   subtitle: 'Verifique su información antes de enviar' },
}

export default function RegistroPage() {
  const [step, setStep] = useState<Step>('name')
  const [form, setForm] = useState<FormData>({ name: '', specialty: '', customSpecialty: '', hospital: '', phone: '', state: '' })
  const [specialties, setSpecialties] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const stepIndex = STEPS.indexOf(step)

  useEffect(() => {
    async function loadSpecialties() {
      try {
        const res = await fetch('/api/catalog/specialties')
        const json = await res.json()
        if (json.data) {
          setSpecialties([...json.data.map((s: any) => s.name), 'Otra especialidad'])
        }
      } catch (e) {
        console.error('Error loading specialties', e)
        // Fallback in case of error
        setSpecialties(['Ortopedia y Traumatología', 'Cirugía de Columna', 'Otra especialidad'])
      }
    }
    loadSpecialties()
  }, [])

  useEffect(() => {
    if (step !== 'confirm' && step !== 'specialty' && step !== 'state') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [step])

  const isStepValid = (f = form) => {
    if (step === 'name') return f.name.trim().length >= 3
    if (step === 'specialty') {
      if (f.specialty === 'Otra especialidad') return f.customSpecialty.trim().length >= 2
      return !!f.specialty
    }
    if (step === 'hospital') return f.hospital.trim().length >= 2
    if (step === 'phone') return /^\d{10}$/.test(f.phone.replace(/\D/g, ''))
    if (step === 'state') return !!f.state
    return true
  }

  const next = (f = form) => {
    if (!isStepValid(f)) return
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  const back = () => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') next()
  }

  const submit = async () => {
    setLoading(true)
    setError('')
    const specialtyValue = form.specialty === 'Otra especialidad' && form.customSpecialty
      ? form.customSpecialty
      : form.specialty
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          specialties: [specialtyValue],
          hospitals: [form.hospital.trim()],
          whatsapp_phone: form.phone.replace(/\D/g, ''),
          phone: form.phone.replace(/\D/g, ''),
          states: [form.state],
          status: 'Nuevo Prospecto',
          source: 'Simposio Registro',
          tags: ['simposio'],
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Error al registrar')
      }
      setSubmitted(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar. Intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) return <SuccessScreen name={form.name.split(' ')[0]} />

  const progress = ((stepIndex + 1) / STEPS.length) * 100

  return (
    <div className="min-h-[100dvh] bg-linear-to-br from-[#f0f5fa] via-[#dceaf5] to-[#c5d9ee] relative overflow-hidden flex items-start justify-center p-4">
      {/* Animated background blobs */}
      <div className="fixed rounded-full blur-[80px] opacity-35 pointer-events-none z-0 w-[380px] h-[380px] bg-radial from-[#9bbfdf] to-[#0763a9] -top-20 -right-20 animate-[pulse_12s_infinite_alternate]" />
      <div className="fixed rounded-full blur-[80px] opacity-35 pointer-events-none z-0 w-[280px] h-[280px] bg-radial from-[#c5d9ee] to-[#3d8bbf] -bottom-15 -left-15 animate-[pulse_16s_infinite_alternate-reverse]" />

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-4 pt-6 pb-8">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <Image 
            src="https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png" 
            alt="Arthromed Logo" 
            width={180} 
            height={60} 
            className="h-12 w-auto object-contain"
            priority
          />
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-[#0763a9]/10 rounded-full overflow-hidden">
          <div className="h-full bg-linear-to-r from-[#0763a9] to-[#3d8bbf] rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>

        {/* Step counter */}
        <p className="text-[10px] font-bold text-[#8a8b8d] tracking-widest self-end mt-[-12px] uppercase">Paso {stepIndex + 1} de {STEPS.length}</p>

        {/* Card */}
        <motion.div 
          key={step}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full bg-white border border-[#d4e0ec] rounded-3xl p-6 md:p-8 shadow-xl shadow-[#0763a9]/5"
        >
          {/* Step icon + header */}
          <div className="w-12 h-12 bg-linear-to-br from-[#e8f1f9] to-[#c5d9ee] rounded-2xl flex items-center justify-center text-[#0763a9] mb-5 shadow-sm">
            {STEP_META[step].icon}
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-[#37383a] leading-tight tracking-tight mb-2">{STEP_META[step].title}</h1>
          <p className="text-sm text-[#5a5b5d] leading-relaxed mb-6">{STEP_META[step].subtitle}</p>

          {/* Field */}
          <div className="w-full mb-6">
            {step === 'name' && (
              <input
                ref={inputRef}
                id="field-name"
                className="w-full bg-[#f8fafd] border-2 border-[#d4e0ec] rounded-2xl px-4 py-3.5 text-lg text-[#37383a] transition-all focus:outline-none focus:border-[#0763a9] focus:bg-white focus:shadow-[0_0_0_4px_rgba(7,99,169,0.1)] placeholder:text-[#b4b5b7]"
                type="text"
                placeholder="Dr. Juan García Hernández"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                onKeyDown={handleKey}
                autoComplete="name"
              />
            )}

            {step === 'specialty' && (
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#9bbfdf] scrollbar-track-[#f0f5fa]">
                {specialties.map(sp => (
                  <button
                    key={sp}
                    id={`specialty-${sp.replace(/\s+/g, '-').toLowerCase()}`}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all active:scale-[0.98] ${
                      form.specialty === sp 
                        ? 'border-[#0763a9] bg-[#e8f1f9] text-[#0763a9] font-semibold' 
                        : 'border-[#e8f1f9] bg-[#f8fafd] text-[#37383a] hover:border-[#9bbfdf]'
                    }`}
                    onClick={() => { 
                      const updated = { ...form, specialty: sp };
                      setForm(updated); 
                      if (sp !== 'Otra especialidad') {
                        setTimeout(() => next(updated), 180) 
                      }
                    }}
                  >
                    {sp}
                  </button>
                ))}
                {form.specialty === 'Otra especialidad' && (
                  <input
                    ref={inputRef}
                    id="field-custom-specialty"
                    className="w-full bg-white border-2 border-[#0763a9] rounded-xl px-4 py-3 mt-2 text-[#37383a] focus:outline-none"
                    type="text"
                    placeholder="Especifique su especialidad"
                    value={form.customSpecialty}
                    onChange={e => setForm(p => ({ ...p, customSpecialty: e.target.value }))}
                    onKeyDown={handleKey}
                  />
                )}
              </div>
            )}

            {step === 'hospital' && (
              <input
                ref={inputRef}
                id="field-hospital"
                className="w-full bg-[#f8fafd] border-2 border-[#d4e0ec] rounded-2xl px-4 py-3.5 text-lg text-[#37383a] transition-all focus:outline-none focus:border-[#0763a9] focus:bg-white focus:shadow-[0_0_0_4px_rgba(7,99,169,0.1)] placeholder:text-[#b4b5b7]"
                type="text"
                placeholder="Hospital o Institución"
                value={form.hospital}
                onChange={e => setForm(p => ({ ...p, hospital: e.target.value }))}
                onKeyDown={handleKey}
                autoComplete="organization"
              />
            )}

            {step === 'phone' && (
              <div className="flex items-center bg-[#f8fafd] border-2 border-[#d4e0ec] rounded-2xl overflow-hidden focus-within:border-[#0763a9] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(7,99,169,0.1)] transition-all">
                <span className="px-4 py-3.5 text-sm font-bold text-[#5a5b5d] bg-[#f0f5fa] border-r-2 border-[#d4e0ec] flex items-center gap-1">
                  🇲🇽 <span className="opacity-60">+52</span>
                </span>
                <input
                  ref={inputRef}
                  id="field-phone"
                  className="flex-1 bg-transparent px-4 py-3.5 text-lg text-[#37383a] focus:outline-none placeholder:text-[#b4b5b7]"
                  type="tel"
                  inputMode="numeric"
                  placeholder="55 1234 5678"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  onKeyDown={handleKey}
                  autoComplete="tel"
                  maxLength={15}
                />
              </div>
            )}

            {step === 'state' && (
              <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#9bbfdf] scrollbar-track-[#f0f5fa]">
                {MEXICAN_STATES.map(st => (
                  <button
                    key={st}
                    id={`state-${st.replace(/\s+/g, '-').toLowerCase()}`}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm transition-all active:scale-[0.98] ${
                      form.state === st 
                        ? 'border-[#0763a9] bg-[#e8f1f9] text-[#0763a9] font-semibold' 
                        : 'border-[#e8f1f9] bg-[#f8fafd] text-[#37383a] hover:border-[#9bbfdf]'
                    }`}
                    onClick={() => { 
                      const updated = { ...form, state: st };
                      setForm(updated); 
                      setTimeout(() => next(updated), 180) 
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            )}

            {step === 'confirm' && (
              <div className="flex flex-col gap-3">
                <ConfirmRow label="Nombre" value={form.name} />
                <ConfirmRow label="Especialidad" value={form.specialty === 'Otra especialidad' ? form.customSpecialty : form.specialty} />
                <ConfirmRow label="Hospital / Institución" value={form.hospital} />
                <ConfirmRow label="WhatsApp" value={`+52 ${form.phone}`} />
                <ConfirmRow label="Estado" value={form.state} />
                {error && <p className="text-sm text-[#b91c1c] bg-[#fee2e2] border border-[#fecaca] rounded-xl px-4 py-3 mt-2">{error}</p>}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            {stepIndex > 0 && (
              <button 
                id="btn-back" 
                className="w-12 h-12 flex items-center justify-center rounded-2xl border-2 border-[#d4e0ec] bg-[#f8fafd] text-[#5a5b5d] hover:bg-[#e8f1f9] hover:border-[#9bbfdf] transition-all flex-shrink-0" 
                onClick={back}
              >
                <ArrowLeft size={18} />
              </button>
            )}

            {step !== 'specialty' && step !== 'state' && (
              <button
                id={step === 'confirm' ? 'btn-submit' : 'btn-next'}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-linear-to-br from-[#0763a9] to-[#054d85] text-white py-3.5 px-6 rounded-2xl font-bold text-lg shadow-lg shadow-[#0763a9]/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                onClick={step === 'confirm' ? submit : next}
                disabled={loading || !isStepValid()}
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : step === 'confirm' ? <CheckCircle size={20} /> : null}
                {loading ? 'Registrando...' : step === 'confirm' ? 'Confirmar registro' : 'Continuar'}
                {step !== 'confirm' && !loading && <ChevronRight size={20} />}
              </button>
            )}
          </div>
        </motion.div>

        <p className="text-[11px] text-[#8a8b8d] text-center leading-relaxed max-w-[300px] mt-2">
          Sus datos se mantienen confidenciales y sólo se usan para contactarle con información relevante a su práctica.
        </p>
      </div>
    </div>
  )
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 p-3.5 bg-[#f8fafd] border border-[#e8f1f9] rounded-2xl">
      <span className="text-[10px] font-bold text-[#8a8b8d] uppercase tracking-wider mt-1">{label}</span>
      <span className="text-sm font-semibold text-[#37383a] text-right leading-tight">{value || '—'}</span>
    </div>
  )
}

function SuccessScreen({ name }: { name: string }) {
  return (
    <div className="min-h-[100dvh] bg-linear-to-br from-[#f0f5fa] via-[#dceaf5] to-[#c5d9ee] relative overflow-hidden flex items-start justify-center p-4">
      <div className="fixed rounded-full blur-[80px] opacity-35 pointer-events-none z-0 w-[380px] h-[380px] bg-radial from-[#9bbfdf] to-[#0763a9] -top-20 -right-20 animate-[pulse_12s_infinite_alternate]" />
      <div className="fixed rounded-full blur-[80px] opacity-35 pointer-events-none z-0 w-[280px] h-[280px] bg-radial from-[#c5d9ee] to-[#3d8bbf] -bottom-15 -left-15 animate-[pulse_16s_infinite_alternate-reverse]" />
      <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-4 pt-12">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Image 
            src="https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png" 
            alt="Arthromed Logo" 
            width={200} 
            height={70} 
            className="h-14 w-auto object-contain"
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
          <h1 className="text-2xl font-bold text-[#37383a]">¡Bienvenido, Dr. {name}!</h1>
          <p className="text-[#5a5b5d] leading-relaxed">
            Su registro fue recibido con éxito. Un asesor especializado se pondrá en contacto con usted por WhatsApp para enviarle la información solicitada.
          </p>
          <div className="flex items-center gap-2 px-4 py-2 bg-[#e8f1f9] border border-[#c5d9ee] rounded-full text-[11px] font-bold text-[#0763a9] uppercase tracking-wider">
            <span>🏥</span> Arthromed — Equipo de Alto Rendimiento
          </div>
        </motion.div>
      </div>
    </div>
  )
}
