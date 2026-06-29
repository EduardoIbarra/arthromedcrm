'use client'

import { useState, useRef, useEffect } from 'react'
import { toBlob } from 'html-to-image'
import { Plus, Trash2, Upload, Loader2, Award, Shield, FileText, Check, Download, Printer, Settings, Edit3 } from 'lucide-react'
import Modal from '@/components/Modal'
import { QRCodeSVG } from 'qrcode.react'

interface DiplomaTemplate {
  title: string
  presentation: string
  bodyText: string
  subText: string
  hours: string
  location: string
  theme: 'navy-gold' | 'emerald-gold' | 'charcoal-silver' | 'minimalist'
  fontFamily: 'serif' | 'sans'
  logo1: string // dataUrl or url
  logo2: string // dataUrl or url
  sig1_name: string
  sig1_title: string
  sig1_image: string // dataUrl or url
  sig2_name: string
  sig2_title: string
  sig2_image: string // dataUrl or url
}

interface DiplomaBuilderProps {
  isOpen: boolean
  onClose: () => void
  taller: {
    id: string
    name: string
    date_time: string
    professor: string
    diploma_template?: any
  }
  onSave: (template: DiplomaTemplate) => void
}

const DEFAULT_TEMPLATE = (workshopName: string, professor: string): DiplomaTemplate => ({
  title: 'CONSTANCIA',
  presentation: 'Se otorga la presente a:',
  bodyText: 'Por haber completado satisfactoriamente el taller práctico de especialidad médica:',
  subText: `Impartido en las instalaciones de Arthromed Academy el día {{date}}, con una duración total de {{hours}} horas de valor curricular.`,
  hours: '8',
  location: 'Monterrey, Nuevo León',
  theme: 'navy-gold',
  fontFamily: 'serif',
  logo1: '/logo.png',
  logo2: '',
  sig1_name: `Dr. ${professor || 'Instructor Principal'}`,
  sig1_title: 'Profesor Titular',
  sig1_image: '',
  sig2_name: 'Comité Organizador',
  sig2_title: 'Arthromed Academy',
  sig2_image: '',
})

export default function DiplomaBuilder({ isOpen, onClose, taller, onSave }: DiplomaBuilderProps) {
  const [template, setTemplate] = useState<DiplomaTemplate>(() => {
    if (taller.diploma_template && typeof taller.diploma_template === 'object') {
      return {
        ...DEFAULT_TEMPLATE(taller.name, taller.professor),
        ...taller.diploma_template
      }
    }
    return DEFAULT_TEMPLATE(taller.name, taller.professor)
  })

  const [activeTab, setActiveTab] = useState<'text' | 'design' | 'logos' | 'preview'>('text')
  const [isSaving, setIsSaving] = useState(false)
  const [sampleStudentName, setSampleStudentName] = useState('Dr. Alejandro L. Ramírez Gutiérrez')
  
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  
  const fileInputLogo1Ref = useRef<HTMLInputElement>(null)
  const fileInputLogo2Ref = useRef<HTMLInputElement>(null)
  const fileInputSig1Ref = useRef<HTMLInputElement>(null)
  const fileInputSig2Ref = useRef<HTMLInputElement>(null)

  // Pre-resolve relative assets (like default /logo.png) to base64 on mount to avoid WebKit canvas bugs
  useEffect(() => {
    const convertDefaultLogo = async () => {
      if (template.logo1 && template.logo1.startsWith('/')) {
        try {
          const res = await fetch(template.logo1)
          if (res.ok) {
            const blob = await res.blob()
            const reader = new FileReader()
            reader.onloadend = () => {
              setTemplate(prev => ({
                ...prev,
                logo1: reader.result as string
              }))
            }
            reader.readAsDataURL(blob)
          }
        } catch (e) {
          console.warn('Failed to convert default logo to base64 on builder mount:', e)
        }
      }
    }
    convertDefaultLogo()
  }, [])

  // Listen to container resizing to scale preview
  useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width
        setScale(Math.min(1, width / 1000))
      }
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [containerRef.current, activeTab])

  // Save changes to database
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/workshops/${taller.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diploma_template: template
        })
      })
      if (res.ok) {
        onSave(template)
        alert('Plantilla de diploma guardada con éxito.')
      } else {
        const err = await res.json()
        alert('Error al guardar: ' + err.error)
      }
    } catch (err) {
      console.error(err)
      alert('Error en la conexión al guardar la plantilla.')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle image upload and convert to base64 for offline portability
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logo1' | 'logo2' | 'sig1_image' | 'sig2_image') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.onload = () => {
        setTemplate(prev => ({
          ...prev,
          [field]: reader.result as string
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  // Format date text dynamically
  const getFormattedDate = () => {
    if (!taller.date_time) return 'Fecha por confirmar'
    try {
      const d = new Date(taller.date_time)
      return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch (e) {
      return taller.date_time
    }
  }

  // Generate body text with placeholders replaced
  const replacePlaceholders = (text: string, studentName: string) => {
    return text
      .replace(/{{name}}/g, studentName)
      .replace(/{{workshop}}/g, taller.name)
      .replace(/{{date}}/g, getFormattedDate())
      .replace(/{{hours}}/g, template.hours)
      .replace(/{{location}}/g, template.location)
      .replace(/{{professor}}/g, taller.professor || 'Profesor Titular')
  }

  // Generate verification URL for QR code
  const getVerificationUrl = (nameToUse: string) => {
    if (typeof window === 'undefined') return `/talleres/${taller.id}/verify?student=${encodeURIComponent(nameToUse)}`
    return `${window.location.origin}/talleres/${taller.id}/verify?student=${encodeURIComponent(nameToUse)}`
  }

  // CSS Styles for different themes
  const getThemeStyles = () => {
    switch (template.theme) {
      case 'emerald-gold':
        return {
          bg: 'bg-white',
          border: 'border-[16px] border-[#064e3b]',
          innerBorder: 'border-[2px] border-[#B89047] m-1',
          cornerColor: 'text-[#B89047]',
          accentText: 'text-[#B89047]',
          primaryText: 'text-[#064e3b]',
          accentLine: 'bg-[#B89047]',
          crestBg: 'bg-[#064e3b]/5 text-[#B89047]',
        }
      case 'charcoal-silver':
        return {
          bg: 'bg-[#fafafa]',
          border: 'border-[16px] border-[#1e293b]',
          innerBorder: 'border-[2px] border-[#94a3b8] m-1',
          cornerColor: 'text-[#94a3b8]',
          accentText: 'text-[#475569]',
          primaryText: 'text-[#0f172a]',
          accentLine: 'bg-[#94a3b8]',
          crestBg: 'bg-[#1e293b]/5 text-[#475569]',
        }
      case 'minimalist':
        return {
          bg: 'bg-white',
          border: 'border-[4px] border-gray-200',
          innerBorder: 'border-[1px] border-gray-150 m-4',
          cornerColor: 'text-gray-400',
          accentText: 'text-[#0763a9]',
          primaryText: 'text-gray-900',
          accentLine: 'bg-gray-300',
          crestBg: 'bg-gray-55/5 text-gray-500',
        }
      case 'navy-gold':
      default:
        return {
          bg: 'bg-white',
          border: 'border-[16px] border-[#081e3f]',
          innerBorder: 'border-[2px] border-[#C5A059] m-1',
          cornerColor: 'text-[#C5A059]',
          accentText: 'text-[#C5A059]',
          primaryText: 'text-[#081e3f]',
          accentLine: 'bg-[#C5A059]',
          crestBg: 'bg-[#081e3f]/5 text-[#C5A059]',
        }
    }
  }

  const styles = getThemeStyles()
  const fontClass = template.fontFamily === 'serif' ? 'font-serif' : 'font-sans'

  // Component to render the actual diploma page content
  const DiplomaPreviewRender = ({ studentName }: { studentName: string }) => {
    return (
      <div 
        id="diploma-preview-target"
        className={`w-[1000px] h-[773px] relative flex flex-col justify-between p-12 select-none overflow-hidden shadow-2xl transition-all ${styles.bg} ${styles.border} ${fontClass}`}
        style={{
          boxSizing: 'border-box',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(254,254,250,1) 100%)'
        }}
      >
        {/* Inner Border */}
        <div className={`absolute inset-3 border-2 ${template.theme === 'minimalist' ? 'border-gray-200' : 'border-[#C5A059]'} pointer-events-none opacity-80 z-10`} style={{ borderColor: styles.innerBorder.split(' ')[2] }} />

        {/* Decorative corner brackets (except for minimalist) */}
        {template.theme !== 'minimalist' && (
          <>
            <div className={`absolute top-5 left-5 w-8 h-8 border-t-4 border-l-4 pointer-events-none z-15 ${styles.cornerColor}`} style={{ borderColor: styles.cornerColor.split('-')[1] }} />
            <div className={`absolute top-5 right-5 w-8 h-8 border-t-4 border-r-4 pointer-events-none z-15 ${styles.cornerColor}`} style={{ borderColor: styles.cornerColor.split('-')[1] }} />
            <div className={`absolute bottom-5 left-5 w-8 h-8 border-b-4 border-l-4 pointer-events-none z-15 ${styles.cornerColor}`} style={{ borderColor: styles.cornerColor.split('-')[1] }} />
            <div className={`absolute bottom-5 right-5 w-8 h-8 border-b-4 border-r-4 pointer-events-none z-15 ${styles.cornerColor}`} style={{ borderColor: styles.cornerColor.split('-')[1] }} />
          </>
        )}

        {/* Watermark in background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0">
          <svg width="400" height="400" viewBox="0 0 24 24" fill="currentColor" className={styles.primaryText}>
            {/* Caduceus / Medical Cross style vector */}
            <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/>
          </svg>
        </div>

        {/* Top Header Logos */}
        <div className="flex justify-between items-center z-10 w-full px-6">
          {/* Logo 1 */}
          <div className="h-16 w-44 flex items-center justify-start">
            {template.logo1 ? (
              <img src={template.logo1} alt="Logo Principal" className="max-h-16 max-w-full object-contain" />
            ) : (
              <div className="text-xs text-gray-350 italic border border-dashed border-gray-300 p-2 rounded">Sin Logo Principal</div>
            )}
          </div>

          {/* Academic Crest Emblem in center */}
          <div className={`w-14 h-14 rounded-full flex items-center justify-center border shadow-xs z-10 ${styles.crestBg}`} style={{ borderColor: 'currentColor' }}>
            <Award size={28} />
          </div>

          {/* Logo 2 */}
          <div className="h-16 w-44 flex items-center justify-end">
            {template.logo2 ? (
              <img src={template.logo2} alt="Logo Secundario" className="max-h-16 max-w-full object-contain" />
            ) : (
              <div className="text-xs text-gray-300 italic border border-dashed border-gray-200 p-2 rounded">Cargar co-patrocinio</div>
            )}
          </div>
        </div>

        {/* Main Certificate Title and Body */}
        <div className="flex flex-col items-center text-center z-10 w-full px-8 mt-4 space-y-4">
          <span className={`text-[11px] font-bold uppercase tracking-[0.3em] ${styles.accentText}`}>
            Arthromed Academy
          </span>

          <h2 className={`text-4xl md:text-5xl font-black uppercase tracking-wide leading-tight ${styles.primaryText} ${template.fontFamily === 'serif' ? 'font-serif' : 'font-sans'}`}>
            {template.title}
          </h2>

          <div className={`w-32 h-[3px] my-1 ${styles.accentLine}`} />

          <p className="text-xs italic text-gray-500 font-medium my-1">
            {template.presentation}
          </p>

          <h3 className={`text-2xl md:text-3xl font-bold tracking-tight text-gray-900 border-b-2 border-gray-100 pb-2 px-12 ${fontClass}`}>
            {studentName}
          </h3>

          <div className="max-w-2xl space-y-2 mt-2">
            <p className="text-sm leading-relaxed text-gray-650 font-medium">
              {replacePlaceholders(template.bodyText, studentName)}
            </p>
            
            <p className="text-[15.5px] font-bold text-gray-800 tracking-wide uppercase">
              "{taller.name}"
            </p>

            <p className="text-xs leading-relaxed text-gray-500 font-medium max-w-xl mx-auto">
              {replacePlaceholders(template.subText, studentName)}
            </p>
          </div>
        </div>

        {/* Signatures & Footer section */}
        <div className="grid grid-cols-2 gap-20 items-end px-16 z-10 w-full mt-6">
          {/* Signature 1 */}
          <div className="flex flex-col items-center text-center min-w-0">
            <div className="h-14 flex items-end justify-center mb-1">
              {template.sig1_image && (
                <img src={template.sig1_image} alt="Firma 1" className="max-h-14 max-w-[150px] object-contain" />
              )}
            </div>
            <div className="w-full border-t border-gray-300 my-1" />
            <p className="text-xs font-bold text-gray-850 truncate w-full">{template.sig1_name}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider truncate w-full">{template.sig1_title}</p>
          </div>

          {/* Signature 2 */}
          <div className="flex flex-col items-center text-center min-w-0">
            <div className="h-14 flex items-end justify-center mb-1">
              {template.sig2_image && (
                <img src={template.sig2_image} alt="Firma 2" className="max-h-14 max-w-[150px] object-contain" />
              )}
            </div>
            <div className="w-full border-t border-gray-300 my-1" />
            <p className="text-xs font-bold text-gray-850 truncate w-full">{template.sig2_name}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider truncate w-full">{template.sig2_title}</p>
          </div>
        </div>

        {/* Footer credentials or verification */}
        <div className="flex justify-between items-end text-[9px] text-gray-400 px-6 z-10 mt-4 border-t border-gray-100 pt-2 w-full font-sans">
          <div className="flex flex-col gap-0.5">
            <span>ID de Certificación: AR-{taller.id.slice(0, 8).toUpperCase()}-{"{{id_code}}"}</span>
            <span>{template.location}, México</span>
            <span>arthromed.com.mx</span>
          </div>
          
          {/* Verification QR Code */}
          <div className="flex items-center gap-2 bg-white p-1 border border-gray-200 rounded-md shadow-xs">
            <QRCodeSVG 
              value={getVerificationUrl(studentName)} 
              size={36}
              level="M"
              includeMargin={false}
            />
            <div className="text-[6.5px] text-gray-400 font-mono leading-none flex flex-col justify-center text-left">
              <span className="font-bold text-gray-500">ESCANEAR PARA</span>
              <span>VERIFICAR</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Replacement values for ID Code and details
  const renderCompiledHTML = (studentName: string, idCode: string = '001') => {
    const rawHtml = document.getElementById('diploma-preview-target')?.outerHTML || ''
    // replace dynamic markers
    return rawHtml
      .replace(/{{id_code}}/g, idCode)
  }

  if (!isOpen) return null

  return (
    <Modal 
      open={isOpen} 
      onClose={onClose} 
      title={`Diseño de Diploma - ${taller.name}`}
      maxWidth="1100px"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start h-[calc(100vh-180px)] overflow-hidden">
        {/* Left Form Editor: 5 cols */}
        <div className="lg:col-span-5 flex flex-col h-full overflow-y-auto pr-1 space-y-4 pb-4">
          
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button 
              onClick={() => setActiveTab('text')}
              className={`flex-1 pb-2.5 text-xs font-bold border-b-2 text-center transition-colors ${activeTab === 'text' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-450 hover:text-gray-700'}`}
            >
              <span className="flex items-center justify-center gap-1"><FileText size={14} /> Textos</span>
            </button>
            <button 
              onClick={() => setActiveTab('design')}
              className={`flex-1 pb-2.5 text-xs font-bold border-b-2 text-center transition-colors ${activeTab === 'design' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-450 hover:text-gray-700'}`}
            >
              <span className="flex items-center justify-center gap-1"><Settings size={14} /> Diseño</span>
            </button>
            <button 
              onClick={() => setActiveTab('logos')}
              className={`flex-1 pb-2.5 text-xs font-bold border-b-2 text-center transition-colors ${activeTab === 'logos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-450 hover:text-gray-700'}`}
            >
              <span className="flex items-center justify-center gap-1"><Shield size={14} /> Logos / Firmas</span>
            </button>
            <button 
              onClick={() => setActiveTab('preview')}
              className={`lg:hidden flex-1 pb-2.5 text-xs font-bold border-b-2 text-center transition-colors ${activeTab === 'preview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-450 hover:text-gray-700'}`}
            >
              <span className="flex items-center justify-center gap-1"><Award size={14} /> Vista Previa</span>
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 space-y-4 pt-2">
            {activeTab === 'text' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Título del Diploma</label>
                  <input 
                    type="text" 
                    className="erp-input w-full" 
                    value={template.title} 
                    onChange={e => setTemplate(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="CONSTANCIA"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Texto de Presentación</label>
                  <input 
                    type="text" 
                    className="erp-input w-full" 
                    value={template.presentation} 
                    onChange={e => setTemplate(prev => ({ ...prev, presentation: e.target.value }))}
                    placeholder="Se otorga la presente a:"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Texto Principal (Cuerpo)</label>
                  <textarea 
                    rows={3}
                    className="erp-input w-full text-xs" 
                    value={template.bodyText} 
                    onChange={e => setTemplate(prev => ({ ...prev, bodyText: e.target.value }))}
                    placeholder="Cuerpo de texto del diploma..."
                  />
                  <span className="text-[10px] text-gray-400">Reemplazos: <code className="bg-gray-100 px-1 rounded">{"{{name}}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{{workshop}}"}</code></span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Texto Secundario (Fecha, Lugar, Horas)</label>
                  <textarea 
                    rows={3}
                    className="erp-input w-full text-xs" 
                    value={template.subText} 
                    onChange={e => setTemplate(prev => ({ ...prev, subText: e.target.value }))}
                    placeholder="Impartido el día {{date}} con duración de {{hours}}..."
                  />
                  <span className="text-[10px] text-gray-400">Reemplazos: <code className="bg-gray-100 px-1 rounded">{"{{date}}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{{hours}}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{{location}}"}</code></span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Horas Curriculares</label>
                    <input 
                      type="text" 
                      className="erp-input w-full" 
                      value={template.hours} 
                      onChange={e => setTemplate(prev => ({ ...prev, hours: e.target.value }))}
                      placeholder="8"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Lugar de Emisión</label>
                    <input 
                      type="text" 
                      className="erp-input w-full" 
                      value={template.location} 
                      onChange={e => setTemplate(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Monterrey, Nuevo León"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-3">
                  <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5"><Edit3 size={13} /> Firmas</h4>
                  
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider block">Firma Izquierda (Profesor)</span>
                    <input 
                      type="text" 
                      className="erp-input w-full text-xs py-2 bg-white" 
                      value={template.sig1_name} 
                      onChange={e => setTemplate(prev => ({ ...prev, sig1_name: e.target.value }))}
                      placeholder="Nombre del Firmante"
                    />
                    <input 
                      type="text" 
                      className="erp-input w-full text-xs py-1.5 bg-white" 
                      value={template.sig1_title} 
                      onChange={e => setTemplate(prev => ({ ...prev, sig1_title: e.target.value }))}
                      placeholder="Cargo/Título"
                    />
                  </div>

                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider block">Firma Derecha (Organizador)</span>
                    <input 
                      type="text" 
                      className="erp-input w-full text-xs py-2 bg-white" 
                      value={template.sig2_name} 
                      onChange={e => setTemplate(prev => ({ ...prev, sig2_name: e.target.value }))}
                      placeholder="Nombre del Firmante"
                    />
                    <input 
                      type="text" 
                      className="erp-input w-full text-xs py-1.5 bg-white" 
                      value={template.sig2_title} 
                      onChange={e => setTemplate(prev => ({ ...prev, sig2_title: e.target.value }))}
                      placeholder="Cargo/Título"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'design' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Tema y Estilo de Bordes</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button"
                      onClick={() => setTemplate(prev => ({ ...prev, theme: 'navy-gold' }))}
                      className={`flex flex-col items-center p-3 border rounded-xl text-center transition-all ${template.theme === 'navy-gold' ? 'border-blue-600 bg-blue-50/50 shadow-xs' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <div className="w-12 h-6 border-4 border-[#081e3f] bg-white rounded-sm mb-1.5 relative">
                        <div className="absolute inset-0.5 border border-[#C5A059]" />
                      </div>
                      <span className="text-xs font-semibold text-gray-800">Azul Marino y Oro</span>
                      <span className="text-[9px] text-gray-400 uppercase tracking-wider mt-0.5">Soberano / Médico</span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => setTemplate(prev => ({ ...prev, theme: 'emerald-gold' }))}
                      className={`flex flex-col items-center p-3 border rounded-xl text-center transition-all ${template.theme === 'emerald-gold' ? 'border-blue-600 bg-blue-50/50 shadow-xs' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <div className="w-12 h-6 border-4 border-[#064e3b] bg-white rounded-sm mb-1.5 relative">
                        <div className="absolute inset-0.5 border border-[#B89047]" />
                      </div>
                      <span className="text-xs font-semibold text-gray-800">Verde Esmeralda</span>
                      <span className="text-[9px] text-gray-400 uppercase tracking-wider mt-0.5">Clásico Académico</span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => setTemplate(prev => ({ ...prev, theme: 'charcoal-silver' }))}
                      className={`flex flex-col items-center p-3 border rounded-xl text-center transition-all ${template.theme === 'charcoal-silver' ? 'border-blue-600 bg-blue-50/50 shadow-xs' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <div className="w-12 h-6 border-4 border-[#1e293b] bg-white rounded-sm mb-1.5 relative">
                        <div className="absolute inset-0.5 border border-[#94a3b8]" />
                      </div>
                      <span className="text-xs font-semibold text-gray-800">Gris Grafito</span>
                      <span className="text-[9px] text-gray-400 uppercase tracking-wider mt-0.5">Moderno y Sobrio</span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => setTemplate(prev => ({ ...prev, theme: 'minimalist' }))}
                      className={`flex flex-col items-center p-3 border rounded-xl text-center transition-all ${template.theme === 'minimalist' ? 'border-blue-600 bg-blue-50/50 shadow-xs' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <div className="w-12 h-6 border border-gray-300 bg-white rounded-sm mb-1.5 relative">
                        <div className="absolute inset-1 border border-gray-150" />
                      </div>
                      <span className="text-xs font-semibold text-gray-800">Minimalista</span>
                      <span className="text-[9px] text-gray-400 uppercase tracking-wider mt-0.5">Simple Sin Excesos</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Tipografía (Letra)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button"
                      onClick={() => setTemplate(prev => ({ ...prev, fontFamily: 'serif' }))}
                      className={`p-3 border rounded-xl text-center transition-all ${template.fontFamily === 'serif' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <span className="text-lg font-serif font-bold block mb-0.5">Abc</span>
                      <span className="text-xs font-semibold text-gray-800">Serif (Clásica)</span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => setTemplate(prev => ({ ...prev, fontFamily: 'sans' }))}
                      className={`p-3 border rounded-xl text-center transition-all ${template.fontFamily === 'sans' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <span className="text-lg font-sans font-bold block mb-0.5">Abc</span>
                      <span className="text-xs font-semibold text-gray-800">Sans (Limpia)</span>
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50/40 p-4 border border-blue-100 rounded-2xl">
                  <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block mb-1">Nombre de Prueba en Preview</span>
                  <input 
                    type="text" 
                    className="erp-input w-full bg-white text-xs py-2" 
                    value={sampleStudentName} 
                    onChange={e => setSampleStudentName(e.target.value)}
                    placeholder="Dr. Nombre de Prueba"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Este nombre se usa sólo para previsualizar el diploma en pantalla.</p>
                </div>
              </div>
            )}

            {activeTab === 'logos' && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-900">Logotipos Superiores</h4>
                  
                  {/* Logo 1 */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Logo 1 (Izquierdo)</span>
                      <span className="text-xs font-semibold text-gray-800 truncate block mt-0.5">Arthromed o Principal</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => fileInputLogo1Ref.current?.click()}
                        className="p-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-55"
                        title="Subir nuevo logo"
                      >
                        <Upload size={14} />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setTemplate(prev => ({ ...prev, logo1: '/logo.png' }))}
                        className="p-1.5 bg-white border border-gray-200 text-blue-600 rounded-lg hover:bg-gray-55"
                        title="Restaurar default"
                      >
                        <Check size={14} />
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputLogo1Ref} 
                        className="hidden" 
                        accept="image/*"
                        onChange={e => handleImageUpload(e, 'logo1')}
                      />
                    </div>
                  </div>

                  {/* Logo 2 */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Logo 2 (Derecho)</span>
                      <span className="text-xs font-semibold text-gray-800 truncate block mt-0.5">Universidad o Co-patrocinio</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => fileInputLogo2Ref.current?.click()}
                        className="p-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-55"
                        title="Subir logo"
                      >
                        <Upload size={14} />
                      </button>
                      {template.logo2 && (
                        <button 
                          type="button" 
                          onClick={() => setTemplate(prev => ({ ...prev, logo2: '' }))}
                          className="p-1.5 bg-white border border-gray-200 text-red-650 rounded-lg hover:bg-gray-55"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <input 
                        type="file" 
                        ref={fileInputLogo2Ref} 
                        className="hidden" 
                        accept="image/*"
                        onChange={e => handleImageUpload(e, 'logo2')}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t border-gray-150 pt-3">
                  <h4 className="text-xs font-bold text-gray-900">Firmas Digitales (Imagen)</h4>
                  
                  {/* Signature 1 image */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Firma 1 (Izquierda)</span>
                      <span className="text-xs font-semibold text-gray-800 truncate block mt-0.5">
                        {template.sig1_image ? '✓ Imagen Cargada' : 'Firma en blanco / manuscrita'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => fileInputSig1Ref.current?.click()}
                        className="p-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-55"
                      >
                        <Upload size={14} />
                      </button>
                      {template.sig1_image && (
                        <button 
                          type="button" 
                          onClick={() => setTemplate(prev => ({ ...prev, sig1_image: '' }))}
                          className="p-1.5 bg-white border border-gray-200 text-red-650 rounded-lg hover:bg-gray-55"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <input 
                        type="file" 
                        ref={fileInputSig1Ref} 
                        className="hidden" 
                        accept="image/*"
                        onChange={e => handleImageUpload(e, 'sig1_image')}
                      />
                    </div>
                  </div>

                  {/* Signature 2 image */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Firma 2 (Derecha)</span>
                      <span className="text-xs font-semibold text-gray-800 truncate block mt-0.5">
                        {template.sig2_image ? '✓ Imagen Cargada' : 'Firma en blanco / manuscrita'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => fileInputSig2Ref.current?.click()}
                        className="p-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-55"
                      >
                        <Upload size={14} />
                      </button>
                      {template.sig2_image && (
                        <button 
                          type="button" 
                          onClick={() => setTemplate(prev => ({ ...prev, sig2_image: '' }))}
                          className="p-1.5 bg-white border border-gray-200 text-red-650 rounded-lg hover:bg-gray-55"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <input 
                        type="file" 
                        ref={fileInputSig2Ref} 
                        className="hidden" 
                        accept="image/*"
                        onChange={e => handleImageUpload(e, 'sig2_image')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="flex flex-col items-center justify-center p-4 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                <p className="text-xs text-gray-400 italic text-center mb-4">Vista previa en pantalla</p>
                <div 
                  className="origin-top-left overflow-hidden bg-white shadow-lg border border-gray-200"
                  style={{ 
                    width: '100%', 
                    height: `${scale * 773}px`, 
                    maxWidth: '100%' 
                  }}
                >
                  <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                    <DiplomaPreviewRender studentName={sampleStudentName} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="border-t border-gray-200 pt-3 flex gap-2">
            <button 
              onClick={onClose} 
              className="btn-secondary flex-1 justify-center py-2"
            >
              Cancelar
            </button>
            <button 
              disabled={isSaving}
              onClick={handleSave} 
              className="btn-primary flex-1 justify-center py-2 gap-1.5 font-bold"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Guardar Plantilla
            </button>
          </div>
        </div>

        {/* Right Preview Panel (desktop only): 7 cols */}
        <div className="hidden lg:col-span-7 lg:flex flex-col items-center justify-center h-full bg-gray-50/60 border border-gray-150 rounded-3xl p-6 relative overflow-hidden">
          <span className="text-[10px] font-black text-gray-450 uppercase tracking-widest absolute top-4 left-6">
            Vista Previa (Diseño a 1000 x 773px)
          </span>

          <div 
            ref={containerRef}
            className="w-full flex justify-center items-start overflow-hidden bg-transparent"
            style={{ minHeight: '400px' }}
          >
            <div 
              style={{ 
                transform: `scale(${scale})`, 
                transformOrigin: 'top center',
                width: '1000px',
                height: '773px',
                flexShrink: 0
              }}
              className="transition-transform duration-200"
            >
              <DiplomaPreviewRender studentName={sampleStudentName} />
            </div>
          </div>

          <div className="text-[11px] text-gray-450 text-center max-w-sm mt-4 leading-normal">
            Presiona <strong>Guardar Plantilla</strong> en la izquierda para aplicar los cambios del diploma a este taller.
          </div>
        </div>
      </div>
    </Modal>
  )
}
