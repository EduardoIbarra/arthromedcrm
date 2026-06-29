'use client'

import { useState, useRef, useEffect } from 'react'
import { toBlob } from 'html-to-image'
import { X, Loader2, Download, Printer, Award, FileText, Check } from 'lucide-react'
import Modal from '@/components/Modal'
import { QRCodeSVG } from 'qrcode.react'
import { createPortal } from 'react-dom'

interface DiplomaTemplate {
  title: string
  presentation: string
  bodyText: string
  subText: string
  hours: string
  location: string
  theme: 'navy-gold' | 'emerald-gold' | 'charcoal-silver' | 'minimalist'
  fontFamily: 'serif' | 'sans'
  logo1: string
  logo2: string
  sig1_name: string
  sig1_title: string
  sig1_image: string
  sig2_name: string
  sig2_title: string
  sig2_image: string
}

interface DiplomaGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
  studentName: string
  taller: {
    id: string
    name: string
    date_time: string
    professor: string
    diploma_template?: any
  }
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

export default function DiplomaGeneratorModal({ isOpen, onClose, studentName, taller }: DiplomaGeneratorModalProps) {
  const [editableName, setEditableName] = useState(studentName)
  const [isGenerating, setIsGenerating] = useState(false)
  const [resolvedTemplate, setResolvedTemplate] = useState<DiplomaTemplate | null>(null)
  
  const baseTemplate: DiplomaTemplate = (() => {
    if (taller.diploma_template && typeof taller.diploma_template === 'object') {
      return {
        ...DEFAULT_TEMPLATE(taller.name, taller.professor),
        ...taller.diploma_template
      }
    }
    return DEFAULT_TEMPLATE(taller.name, taller.professor)
  })()

  const template = resolvedTemplate || baseTemplate

  // Helper to convert images to Base64 to bypass Safari WebKit canvas rendering sandbox blocks
  const convertUrlToBase64 = async (url: string): Promise<string> => {
    if (!url) return ''
    if (url.startsWith('data:')) return url
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Fetch failed')
      const blob = await res.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => resolve(url)
        reader.readAsDataURL(blob)
      })
    } catch (e) {
      console.warn('Failed to convert image to base64:', e)
      return url
    }
  }

  // Pre-resolve all template images to base64 Data URLs
  useEffect(() => {
    if (!isOpen) {
      setResolvedTemplate(null)
      return
    }
    
    const resolveImages = async () => {
      const resolved = { ...baseTemplate }
      try {
        if (resolved.logo1 && !resolved.logo1.startsWith('data:')) {
          resolved.logo1 = await convertUrlToBase64(resolved.logo1)
        }
        if (resolved.logo2 && !resolved.logo2.startsWith('data:')) {
          resolved.logo2 = await convertUrlToBase64(resolved.logo2)
        }
        if (resolved.sig1_image && !resolved.sig1_image.startsWith('data:')) {
          resolved.sig1_image = await convertUrlToBase64(resolved.sig1_image)
        }
        if (resolved.sig2_image && !resolved.sig2_image.startsWith('data:')) {
          resolved.sig2_image = await convertUrlToBase64(resolved.sig2_image)
        }
      } catch (e) {
        console.error('Error pre-resolving template images:', e)
      }
      setResolvedTemplate(resolved)
    }

    resolveImages()
  }, [isOpen, taller.id])

  // Update editable name when prop changes
  useEffect(() => {
    setEditableName(studentName)
  }, [studentName, isOpen])

  const getFormattedDate = () => {
    if (!taller.date_time) return 'Fecha por confirmar'
    try {
      const d = new Date(taller.date_time)
      return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch (e) {
      return taller.date_time
    }
  }

  const replacePlaceholders = (text: string, nameToUse: string) => {
    return text
      .replace(/{{name}}/g, nameToUse)
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

  const getThemeStyles = () => {
    switch (template.theme) {
      case 'emerald-gold':
        return {
          bg: 'bg-white',
          border: 'border-[16px] border-[#064e3b]',
          innerBorder: 'border-[2px] border-[#B89047]',
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
          innerBorder: 'border-[2px] border-[#94a3b8]',
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
          innerBorder: 'border-[1px] border-gray-150',
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
          innerBorder: 'border-[2px] border-[#C5A059]',
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

  // Print function: toggles display styles using a temporary class on document.body
  const handlePrint = () => {
    // Add print style sheet dynamically
    const styleEl = document.createElement('style')
    styleEl.id = 'diploma-print-style'
    styleEl.innerHTML = `
      @media print {
        body.printing-diploma > *:not(#print-diploma-root) {
          display: none !important;
          visibility: hidden !important;
        }
        #print-diploma-root {
          display: block !important;
          visibility: visible !important;
          position: absolute;
          left: 0;
          top: 0;
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        #print-diploma-root * {
          visibility: visible !important;
        }
        @page {
          size: letter landscape;
          margin: 0;
        }
      }
    `
    document.head.appendChild(styleEl)
    
    // Add print class to body
    document.body.classList.add('printing-diploma')
    
    // Trigger print
    window.print()
    
    // Cleanup
    setTimeout(() => {
      document.body.classList.remove('printing-diploma')
      styleEl.remove()
    }, 500)
  }

  // PNG download function
  const handleDownloadPng = async () => {
    const node = document.getElementById('diploma-generator-render-node')
    if (!node) return
    setIsGenerating(true)
    try {
      // Small timeout for browser to ensure image rendering
      await new Promise(r => setTimeout(r, 200))
      
      // iOS Safari bug: call toBlob once to warm up WebKit cache and prevent blank images
      try {
        await toBlob(node, { cacheBust: true })
      } catch (e) {
        // ignore first attempt error
      }
      
      const blob = await toBlob(node, {
        pixelRatio: 2, // Safe 2x resolution (avoid Safari memory limits)
        cacheBust: true,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          position: 'static',
          visibility: 'visible',
        }
      })
      
      if (!blob) throw new Error('Failed to generate PNG blob')
      
      const dataUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `Diploma_${editableName.trim().replace(/\s+/g, '_')}.png`
      link.href = dataUrl
      link.click()
      
      // Cleanup URL object
      setTimeout(() => URL.revokeObjectURL(dataUrl), 1000)
    } catch (err) {
      console.error(err)
      alert('Error al descargar el diploma en imagen. Intenta la opción de Imprimir.')
    } finally {
      setIsGenerating(false)
    }
  }

  const DiplomaLayout = ({ idAttr }: { idAttr?: string }) => (
    <div 
      id={idAttr}
      className={`w-[1000px] h-[773px] relative flex flex-col justify-between p-12 select-none overflow-hidden transition-all ${styles.bg} ${styles.border} ${fontClass}`}
      style={{
        boxSizing: 'border-box',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(254,254,250,1) 100%)'
      }}
    >
      {/* Inner Border */}
      <div className={`absolute inset-3 border-2 pointer-events-none opacity-80 z-10`} style={{ borderColor: styles.innerBorder.split(' ')[2] }} />

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
          <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/>
        </svg>
      </div>

      {/* Top Header Logos */}
      <div className="flex justify-between items-center z-10 w-full px-6">
        <div className="h-16 w-44 flex items-center justify-start">
          {template.logo1 && <img src={template.logo1} alt="Logo 1" className="max-h-16 max-w-full object-contain" />}
        </div>

        <div className={`w-14 h-14 rounded-full flex items-center justify-center border shadow-xs z-10 ${styles.crestBg}`} style={{ borderColor: 'currentColor' }}>
          <Award size={28} />
        </div>

        <div className="h-16 w-44 flex items-center justify-end">
          {template.logo2 && <img src={template.logo2} alt="Logo 2" className="max-h-16 max-w-full object-contain" />}
        </div>
      </div>

      {/* Title & Body */}
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
          {editableName}
        </h3>

        <div className="max-w-2xl space-y-2 mt-2">
          <p className="text-sm leading-relaxed text-gray-650 font-medium">
            {replacePlaceholders(template.bodyText, editableName)}
          </p>
          
          <p className="text-[15.5px] font-bold text-gray-800 tracking-wide uppercase">
            "{taller.name}"
          </p>

          <p className="text-xs leading-relaxed text-gray-500 font-medium max-w-xl mx-auto">
            {replacePlaceholders(template.subText, editableName)}
          </p>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-20 items-end px-16 z-10 w-full mt-6">
        <div className="flex flex-col items-center text-center min-w-0">
          <div className="h-14 flex items-end justify-center mb-1">
            {template.sig1_image && <img src={template.sig1_image} alt="Firma 1" className="max-h-14 max-w-[150px] object-contain" />}
          </div>
          <div className="w-full border-t border-gray-300 my-1" />
          <p className="text-xs font-bold text-gray-850 truncate w-full">{template.sig1_name}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider truncate w-full">{template.sig1_title}</p>
        </div>

        <div className="flex flex-col items-center text-center min-w-0">
          <div className="h-14 flex items-end justify-center mb-1">
            {template.sig2_image && <img src={template.sig2_image} alt="Firma 2" className="max-h-14 max-w-[150px] object-contain" />}
          </div>
          <div className="w-full border-t border-gray-300 my-1" />
          <p className="text-xs font-bold text-gray-850 truncate w-full">{template.sig2_name}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider truncate w-full">{template.sig2_title}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-end text-[9px] text-gray-400 px-6 z-10 mt-4 border-t border-gray-100 pt-2 w-full font-sans">
        <div className="flex flex-col gap-0.5 text-left">
          <span>ID de Certificación: AR-{taller.id.slice(0, 8).toUpperCase()}-{editableName.slice(0, 3).toUpperCase()}</span>
          <span>{template.location}, México</span>
          <span>arthromed.com.mx</span>
        </div>
        
        {/* Verification QR Code */}
        <div className="flex items-center gap-2 bg-white p-1 border border-gray-200 rounded-md shadow-xs">
          <QRCodeSVG 
            value={getVerificationUrl(editableName)} 
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

  if (!isOpen) return null

  return (
    <>
      <Modal open={isOpen} onClose={onClose} title="Generar Diploma">
        <div className="space-y-6">
          <p className="text-xs text-gray-500">
            Revisa y edita el nombre tal como debe aparecer en el certificado físico. Puedes agregar prefijos como "Dr.", "Dra." o "Lic.".
          </p>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">Nombre del Alumno / Doctor</label>
            <input 
              type="text" 
              className="erp-input w-full font-semibold" 
              value={editableName} 
              onChange={e => setEditableName(e.target.value)}
            />
          </div>

          <div className="bg-gray-50 p-4 border border-gray-200 rounded-2xl flex items-center justify-center">
            {/* Visual preview banner of style */}
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <Award size={20} className={styles.accentText} />
              <span>Diseño seleccionado: <strong>{template.theme === 'navy-gold' ? 'Azul y Oro (Sóbrio)' : template.theme === 'emerald-gold' ? 'Verde Esmeralda' : template.theme === 'charcoal-silver' ? 'Gris Grafito' : 'Minimalista'}</strong></span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={handlePrint}
                className="btn-secondary py-3 justify-center gap-2 border-gray-300 font-bold hover:bg-gray-100"
              >
                <Printer size={16} /> Imprimir / PDF
              </button>

              <button 
                type="button"
                disabled={isGenerating}
                onClick={handleDownloadPng}
                className="btn-primary py-3 justify-center gap-2 font-bold"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Descargar PNG
              </button>
            </div>

            <button 
              type="button" 
              onClick={onClose} 
              className="mt-2 text-xs text-gray-400 hover:text-gray-600 text-center"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>

      {/* Hidden print render node */}
      <div
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          pointerEvents: 'none',
          zIndex: -1
        }}
      >
        <div id="diploma-generator-render-node" style={{ width: '1000px', height: '773px', position: 'relative' }}>
          <DiplomaLayout />
        </div>
      </div>

      {/* Screen/Printer layout for printing (using Portal to place directly under body) */}
      {typeof document !== 'undefined' && createPortal(
        <div id="print-diploma-root" style={{ display: 'none' }}>
          <DiplomaLayout />
        </div>,
        document.body
      )}
    </>
  )
}
