'use client'

import { useState, useRef, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { toBlob } from 'html-to-image'
import { Plus, Trash2, Upload, Loader2, Sparkles, AlertCircle, Eye, RefreshCw, Calendar, MapPin, DollarSign, Phone, Mail, Shield, Globe } from 'lucide-react'
import Modal from '@/components/Modal'
import { Doctor } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

interface FlyerBuilderProps {
  isOpen: boolean
  onClose: () => void
  tallerId: string | null
  workshopName: string
  workshopDate: string
  workshopCost: string
  congressName: string
  selectedDoctors: Doctor[]
  onSave: (flyerUrl: string) => void
}

const getFlagPath = (countryName: string | null | undefined): string | null => {
  if (!countryName) return null
  const name = countryName.toLowerCase().trim()
  if (name.includes('mexico') || name.includes('méxico')) return '/flags/mx.png'
  if (name.includes('colombia')) return '/flags/co.png'
  if (name.includes('argentina')) return '/flags/ar.png'
  if (name.includes('españa') || name.includes('espana')) return '/flags/es.png'
  if (name.includes('estado') || name.includes('eeuu') || name.includes('usa') || name.includes('united states')) return '/flags/us.png'
  if (name.includes('chile')) return '/flags/cl.png'
  if (name.includes('peru') || name.includes('perú')) return '/flags/pe.png'
  if (name.includes('ecuador')) return '/flags/ec.png'
  if (name.includes('brazil') || name.includes('brasil')) return '/flags/br.png'
  if (name.includes('panama') || name.includes('panamá')) return '/flags/pa.png'
  if (name.includes('costa rica')) return '/flags/cr.png'
  return null
}

export default function FlyerBuilder({
  isOpen,
  onClose,
  tallerId,
  workshopName,
  workshopDate,
  workshopCost,
  congressName,
  selectedDoctors,
  onSave
}: FlyerBuilderProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Design configuration state
  const [title, setTitle] = useState(workshopName)
  const [subtitle, setSubtitle] = useState('TALLER DE ALTA ESPECIALIDAD')
  const [dateText, setDateText] = useState('')
  const [locationText, setLocationText] = useState(congressName || 'Sede por confirmar')
  const [costText, setCostText] = useState('')
  const [features, setFeatures] = useState<string[]>([
    'Práctica hands-on en modelos anatómicos avanzados',
    'Tecnología de radiofrecuencia plasma de última generación',
    'Discusión interactiva de casos clínicos reales',
    'Constancia académica con valor curricular'
  ])
  const [newFeature, setNewFeature] = useState('')
  const [featuredImage, setFeaturedImage] = useState<string | null>(null)
  const [showQR, setShowQR] = useState(true)
  
  // Generating states
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Pre-fill fields on open/props update
  useEffect(() => {
    setTitle(workshopName)
    setLocationText(congressName || 'Sede por confirmar')
    
    // Format date beautifully
    if (workshopDate) {
      try {
        const d = new Date(workshopDate)
        const day = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
        const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        setDateText(`${day} | ${time}`)
      } catch (err) {
        setDateText(workshopDate)
      }
    } else {
      setDateText('Fecha por confirmar')
    }

    // Format cost
    if (workshopCost && parseFloat(workshopCost) > 0) {
      const formatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(parseFloat(workshopCost))
      setCostText(formatted)
    } else {
      setCostText('Sin costo / Invitación académica')
    }
  }, [workshopName, workshopDate, workshopCost, congressName])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.onload = () => {
        setFeaturedImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const addFeature = () => {
    if (newFeature.trim() && features.length < 5) {
      setFeatures([...features, newFeature.trim()])
      setNewFeature('')
    }
  }

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index))
  }

  // Construct registration URL for the QR code
  const registrationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/talleres/${tallerId || 'd0a658d4-0631-46b9-ab16-553ae8986b4f'}/landing`
    : ''

  const handleGenerate = async () => {
    setIsGenerating(true)
    setErrorMsg(null)
    
    try {
      // Reference to the offscreen compiler element
      const compileNode = document.getElementById('flyer-compiler-element')
      if (!compileNode) {
        throw new Error('No se encontró el elemento de compilación.')
      }

      // Wait a moment for rendering and fonts
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Render the element to a Blob
      const blob = await toBlob(compileNode, {
        cacheBust: true,
        pixelRatio: 2, // Sharper high-resolution image
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          position: 'static',
          visibility: 'visible'
        }
      })

      if (!blob) {
        throw new Error('Error al renderizar el volante a imagen.')
      }

      // Convert Blob to File
      const fileName = `generated_flyer_${tallerId || 'new'}_${Date.now()}.png`
      const file = new File([blob], fileName, { type: 'image/png' })

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(`talleres/${fileName}`, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw uploadError
      }

      // Retrieve the public URL
      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(data.path)

      if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error('No se pudo obtener la URL pública del archivo.')
      }

      // Return URL to the parent form
      onSave(publicUrlData.publicUrl)
      onClose()
    } catch (err: any) {
      console.error('Flyer generation error:', err)
      setErrorMsg(err.message || 'Error al compilar y guardar el volante.')
    } finally {
      setIsGenerating(false)
    }
  }

  // Visual layout components shared between Preview and Compiler
  const FlyerContent = () => (
    <div className="w-[800px] h-[1100px] bg-[#f4f8fc] bg-linear-to-b from-[#f4f8fc] via-[#eef4fa] to-[#e4eef6] relative font-sans text-gray-800 select-none overflow-hidden border border-gray-200">
      {/* Decorative Wavy backgrounds at bottom left */}
      <div className="absolute left-[-50px] bottom-[-50px] w-[220px] h-[220px] bg-[#0d9488]/10 rounded-full opacity-60 z-0 pointer-events-none" />
      <div className="absolute left-[-20px] bottom-[-20px] w-[160px] h-[160px] bg-[#3d8bbf]/20 rounded-full opacity-70 z-0 pointer-events-none" />
      
      {/* Top Header Logos - Monochrome clean header banner */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-white border-b border-[#e2edf7] px-10 py-3 flex justify-between items-center z-20 shadow-xs">
        <img
          src="/logo.png"
          alt="Arthromed Logo"
          className="h-10 object-contain"
          crossOrigin="anonymous"
        />
        <div className="text-right">
          <p className="text-[9px] font-black text-[#0763a9] uppercase tracking-widest leading-none mb-1">
            Arthromed Academy
          </p>
          <span className="inline-block px-2.5 py-0.5 bg-blue-50 text-[#0763a9] border border-blue-100 rounded-md text-[8px] font-black uppercase tracking-wider">
            {subtitle}
          </span>
        </div>
      </div>

      {/* Main Body Section: Split Column Layout (Height: 560px, Top: 100px) */}
      <div className="absolute left-[40px] right-[40px] top-[100px] h-[560px] z-10">
        
        {/* Left Column: WIDER and much TALLER Vertical Featured Image Container (takes full height) */}
        <div className="absolute left-0 top-0 w-[330px] h-[550px] rounded-3xl overflow-hidden border border-[#e2edf7] shadow-sm bg-linear-to-tr from-[#0a2342] via-[#0763a9] to-[#3d8bbf]">
          {featuredImage ? (
            <img
              src={featuredImage}
              alt="Flyer Cover"
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
              <div className="w-14 h-14 rounded-full border border-white/10 bg-white/5 flex items-center justify-center mb-4">
                <Sparkles size={24} className="text-blue-200 animate-pulse" />
              </div>
              <h3 className="text-sm font-black tracking-wider leading-tight uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                Entrenamiento Quirúrgico
              </h3>
              <p className="text-[8px] text-blue-200 uppercase tracking-widest font-semibold mt-1">
                Arthromed Academy
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Prominent Title, Access Info Card & Features list */}
        <div className="absolute left-[355px] top-0 right-0 h-[550px] flex flex-col justify-between py-1">
          {/* Prominent Workshop Title */}
          <div>
            <span className="text-[9px] font-black text-[#0d9488] uppercase tracking-widest mb-1.5 block">
              Taller Práctico de Especialidad
            </span>
            <h1 className="text-3xl md:text-[32px] font-black text-[#0a2342] leading-tight tracking-tight uppercase border-l-4 border-[#0d9488] pl-3.5">
              {title || 'Nombre del Taller Académico'}
            </h1>
            <div className="text-gray-300 tracking-[0.2em] text-[8px] mt-2">••••••••••••••</div>
          </div>

          {/* Access Info Card - Vertical list directly between Title and Features */}
          <div className="flex flex-col gap-4.5 my-4 bg-transparent p-0">
            <div className="flex items-start gap-4 px-0.5">
              <Calendar size={20} className="text-[#0763a9] shrink-0 mt-1" />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block leading-none">Fecha</span>
                <span className="text-[15.5px] font-black text-gray-800 leading-tight block w-full mt-1.5 uppercase" title={dateText}>
                  {dateText ? dateText.replace(/hrs/gi, '').trim() : 'Pendiente'}
                </span>
              </div>
            </div>
            
            <div className="flex items-start gap-4 px-0.5">
              <MapPin size={20} className="text-[#0763a9] shrink-0 mt-1" />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block leading-none">Sede</span>
                <span className="text-[15.5px] font-black text-gray-800 leading-tight block w-full mt-1.5 uppercase" title={locationText}>
                  {locationText || 'Por confirmar'}
                </span>
              </div>
            </div>
            
            <div className="flex items-start gap-4 px-0.5">
              <DollarSign size={20} className="text-[#0d9488] shrink-0 mt-1" />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block leading-none">Inversión</span>
                <span className="text-[15.5px] font-black text-[#0d9488] leading-tight block w-full mt-1.5 uppercase" title={costText}>
                  {costText || 'Sin costo'}
                </span>
              </div>
            </div>
          </div>

          {/* Features list */}
          <div className="flex-1 flex flex-col justify-end pt-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#0763a9] border-b border-gray-200 pb-1 mb-2.5">
              Temario y Beneficios Clave
            </p>
            
            <div className="space-y-3">
              {features.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#0d9488]/15 border border-[#0d9488]/30 flex items-center justify-center shrink-0 text-[#0d9488] text-[10px] font-bold mt-0.5">
                    ✓
                  </div>
                  <p className="text-[11px] text-gray-700 font-bold leading-relaxed">
                    {feature}
                  </p>
                </div>
              ))}
              {features.length === 0 && (
                <p className="text-xs text-gray-400 italic">No se han añadido temas clave todavía.</p>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Instructors Row (Total height: 185px, placed at top 680px) */}
      <div className="absolute left-[40px] right-[40px] top-[680px] h-[170px] border-t border-[#e2edf7] pt-4 flex flex-col justify-between z-10">
        <p className="text-xs font-black uppercase tracking-widest text-[#0763a9] text-center">
          Profesorado e Instructores
        </p>
        
        <div className="flex justify-center items-start gap-8">
          {selectedDoctors.map((doc) => (
            <div key={doc.id} className="flex flex-col items-center">
              {/* Doctor Avatar Container */}
              <div className="relative w-16 h-16 shrink-0">
                <div className="w-full h-full rounded-full p-[2px] bg-gradient-to-tr from-[#0d9488] to-[#3d8bbf] shadow-md">
                  <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
                    {doc.avatar_url ? (
                      <img
                        src={doc.avatar_url}
                        alt={doc.name}
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <span className="text-lg font-bold text-[#0763a9]">
                        {doc.name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('')}
                      </span>
                    )}
                  </div>
                </div>
                {/* Overlapping country flag, perfectly centered vector image or Globe fallback */}
                <div className="absolute bottom-[-2px] right-[-2px] w-5 h-5 rounded-full bg-white shadow-sm flex items-center justify-center border border-gray-200 z-10 overflow-hidden select-none">
                  {getFlagPath(doc.country) ? (
                    <img
                      src={getFlagPath(doc.country)!}
                      alt={doc.country || 'Flag'}
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <Globe size={11} className="text-gray-400" />
                  )}
                </div>
              </div>
              <p className="text-[11px] font-black text-[#0a2342] text-center mt-2 max-w-[110px] leading-tight truncate">
                {doc.name}
              </p>
              <p className="text-[9px] text-[#0d9488] font-bold uppercase tracking-wider text-center mt-0.5 max-w-[110px]">
                {doc.country || 'México'}
              </p>
            </div>
          ))}
          {selectedDoctors.length === 0 && (
            <p className="text-xs text-gray-400 italic">No hay doctores seleccionados.</p>
          )}
        </div>
      </div>

      {/* Footer Section: Contact and Registration QR (Total height: 210px, placed at top 865px) */}
      <div className="absolute left-[40px] right-[40px] top-[865px] bottom-10 border-t border-[#e2edf7] pt-5 flex justify-between items-center z-10">
        
        {/* Contact/Support Info */}
        <div className="max-w-[480px] space-y-3">
          <h4 className="text-xs font-black text-[#0a2342] uppercase tracking-wide">
            Registro Académico y Soporte
          </h4>
          
          <div className="flex flex-col text-[11px] space-y-2 text-gray-600 font-semibold">
            <p className="flex items-center gap-2.5 text-[#0763a9]">
              <MapPin size={13} className="shrink-0" />
              <span className="font-bold truncate max-w-[320px]">{locationText}</span>
            </p>
            <p className="flex items-center gap-2.5">
              <Phone size={13} className="text-[#0763a9] shrink-0" />
              <span>Soporte Arthromed: <strong className="text-[#0763a9]">+52 (55) 4739 1234</strong></span>
            </p>
            <p className="flex items-center gap-2.5">
              <Mail size={13} className="text-[#0763a9] shrink-0" />
              <span>Email: <strong className="text-[#0763a9]">contacto@arthromed.mx</strong></span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <span className="bg-blue-50 border border-blue-100 text-[#0763a9] px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Shield size={11} className="shrink-0" /> Cupo Limitado a 20 Médicos
            </span>
            <span className="bg-teal-50 border border-teal-100 text-[#0d9488] px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider">
              • Valor Curricular
            </span>
          </div>
        </div>

        {/* QR Code Container */}
        {showQR && registrationUrl ? (
          <div className="flex flex-col items-center bg-white border border-[#e2edf7] p-2.5 rounded-2xl shadow-md shrink-0 select-none">
            <QRCodeSVG
              value={registrationUrl}
              size={85}
              level="M"
              includeMargin={false}
            />
            <span className="text-[8px] font-black text-[#0763a9] mt-1.5 uppercase tracking-wider">
              Registro Online
            </span>
          </div>
        ) : (
          <div className="h-20 w-20 bg-white/5 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center text-gray-500 text-xs shrink-0">
            QR Oculto
          </div>
        )}
      </div>
    </div>
  )
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Generar Volante Académico / Flyer Premium"
      maxWidth="1100px"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch max-h-[80vh]">
        
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-5 space-y-5 overflow-y-auto pr-1 select-text">
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-500 border-b pb-1">
              Contenido del Volante
            </h3>
            
            {/* Title override */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Título del Taller</label>
              <input
                type="text"
                className="erp-input w-full text-xs"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nombre del Taller"
              />
            </div>

            {/* Subtitle override */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Subtítulo Banner</label>
              <input
                type="text"
                className="erp-input w-full text-xs"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Ej. Taller de Alta Especialidad"
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Imagen Destacada (Recomendado)</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary py-2 text-xs flex-1 justify-center flex items-center gap-1"
                >
                  <Upload size={14} />
                  Subir Imagen
                </button>
                {featuredImage && (
                  <button
                    type="button"
                    onClick={() => setFeaturedImage(null)}
                    className="btn-secondary py-2 text-xs text-red-500 hover:text-red-700 hover:border-red-200"
                  >
                    Quitar
                  </button>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
              <p className="text-[10px] text-gray-400 mt-1">La imagen se integrará como fondo del encabezado.</p>
            </div>

            {/* Grid detail overrides */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Texto de Fecha</label>
                <input
                  type="text"
                  className="erp-input w-full text-xs"
                  value={dateText}
                  onChange={(e) => setDateText(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Texto de Costo</label>
                <input
                  type="text"
                  className="erp-input w-full text-xs"
                  value={costText}
                  onChange={(e) => setCostText(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Texto de Sede (Lugar)</label>
              <input
                type="text"
                className="erp-input w-full text-xs"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
              />
            </div>

            {/* QR display check */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showQR"
                checked={showQR}
                onChange={(e) => setShowQR(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <label htmlFor="showQR" className="text-xs font-bold text-gray-700 cursor-pointer">
                Mostrar código QR de registro en línea
              </label>
            </div>
          </div>

          {/* Features editor list */}
          <div className="space-y-3 pt-3 border-t">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-500 border-b pb-1 flex justify-between items-center">
              <span>Características destacadas</span>
              <span className="text-[10px] text-gray-400 normal-case font-medium">Límite 5 items</span>
            </h3>

            <div className="flex gap-2">
              <input
                type="text"
                className="erp-input flex-1 text-xs"
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                placeholder="Añadir punto clave..."
                disabled={features.length >= 5}
              />
              <button
                type="button"
                onClick={addFeature}
                className="btn-primary p-2 shrink-0"
                disabled={!newFeature.trim() || features.length >= 5}
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {features.map((feature, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100 text-xs">
                  <span className="flex-1 truncate">{feature}</span>
                  <button
                    type="button"
                    onClick={() => removeFeature(idx)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Errors, Action button */}
          <div className="pt-4 border-t space-y-3">
            {errorMsg && (
              <div className="flex gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs items-start font-semibold">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isGenerating}
                className="btn-secondary text-xs py-2.5 px-4"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || selectedDoctors.length === 0}
                className="btn-primary text-xs py-2.5 px-5 flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Generando e Importando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Aplicar Flyer al Taller</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Scaled Preview */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center bg-[#f0f4f8] rounded-2xl p-6 border border-[#d4e0ec] relative overflow-hidden select-none">
          <div className="absolute top-3 left-4 flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-white border px-2.5 py-1 rounded-full shadow-xs">
            <Eye size={12} /> Vista Previa del Volante
          </div>
          
          {/* Sizing wrapper with scaling to fit standard screen height */}
          <div className="w-full flex items-center justify-center p-2" style={{ height: '520px' }}>
            <div
              style={{
                transform: 'scale(0.46)', // Scale down the 800px wide flyer to ~370px to fit
                transformOrigin: 'center center',
                width: '800px',
                height: '1100px',
                flexShrink: 0
              }}
              className="rounded-2xl shadow-xl overflow-hidden bg-white border"
            >
              <FlyerContent />
            </div>
          </div>
        </div>

      </div>

      {/* Hidden offscreen compiler container. Always at full scale (1:1) for pixel-perfect screenshot exports */}
      <div
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          pointerEvents: 'none'
        }}
      >
        <div id="flyer-compiler-element" style={{ width: '800px', height: '1100px' }}>
          <FlyerContent />
        </div>
      </div>
    </Modal>
  )
}
