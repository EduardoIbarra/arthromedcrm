'use client'

import { useState, useRef, useEffect } from 'react'
import { toPng, toBlob } from 'html-to-image'
import { PDFDocument } from 'pdf-lib'
import { X, Loader2, Download, Printer, Award, FileText, Check } from 'lucide-react'
import Modal from '@/components/Modal'
import { QRCodeSVG } from 'qrcode.react'
import { createPortal } from 'react-dom'

interface SignatureItem {
  id: string
  name: string
  title: string
  image: string
}

interface DiplomaTemplate {
  title: string
  presentation: string
  bodyText: string
  subText: string
  hours: string
  location: string
  theme: 'navy-gold' | 'emerald-gold' | 'charcoal-silver' | 'minimalist' | 'bonss-diagonal'
  fontFamily: 'serif' | 'sans'
  logo1: string
  logo2: string
  logo3: string
  signatures?: SignatureItem[]
  sig1_name?: string
  sig1_title?: string
  sig1_image?: string
  sig2_name?: string
  sig2_title?: string
  sig2_image?: string
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

const DEFAULT_SIGNATURES = (professor: string): SignatureItem[] => [
  {
    id: 'sig-1',
    name: `Dr. ${professor || 'Ricardo Reyes Reyes'}`,
    title: 'Director General de Arthromed',
    image: ''
  },
  {
    id: 'sig-2',
    name: 'Eric Ai',
    title: 'Gerente de Bonss Medical LATAM',
    image: ''
  }
]

const DEFAULT_TEMPLATE = (workshopName: string, professor: string): DiplomaTemplate => ({
  title: 'CERTIFICADO',
  presentation: 'Bonss Medical otorga el reconocimiento a:',
  bodyText: 'Por su participación en el',
  subText: `Impartido en {{location}} el día {{date}}, con una duración total de {{hours}} horas de valor curricular.`,
  hours: '8',
  location: 'Monterrey, Nuevo León, México',
  theme: 'bonss-diagonal',
  fontFamily: 'serif',
  logo1: '',
  logo2: '',
  logo3: '',
  signatures: DEFAULT_SIGNATURES(professor)
})

export default function DiplomaGeneratorModal({ isOpen, onClose, studentName, taller }: DiplomaGeneratorModalProps) {
  const [editableName, setEditableName] = useState(studentName)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [resolvedTemplate, setResolvedTemplate] = useState<DiplomaTemplate | null>(null)
  
  const baseTemplate: DiplomaTemplate = (() => {
    if (taller.diploma_template && typeof taller.diploma_template === 'object') {
      const tmpl = {
        ...DEFAULT_TEMPLATE(taller.name, taller.professor),
        ...taller.diploma_template
      }
      if (!Array.isArray(tmpl.signatures) || tmpl.signatures.length === 0) {
        const sigs: SignatureItem[] = []
        if (tmpl.sig1_name || tmpl.sig1_title || tmpl.sig1_image) {
          sigs.push({
            id: 'sig-1',
            name: tmpl.sig1_name || `Dr. ${taller.professor || 'Instructor Principal'}`,
            title: tmpl.sig1_title || 'Profesor Titular',
            image: tmpl.sig1_image || ''
          })
        }
        if (tmpl.sig2_name || tmpl.sig2_title || tmpl.sig2_image) {
          sigs.push({
            id: 'sig-2',
            name: tmpl.sig2_name || 'Comité Organizador',
            title: tmpl.sig2_title || 'Arthromed Academy',
            image: tmpl.sig2_image || ''
          })
        }
        tmpl.signatures = sigs.length > 0 ? sigs : DEFAULT_SIGNATURES(taller.professor)
      }
      return tmpl
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

  // Pre-resolve template images
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
        if (resolved.logo3 && !resolved.logo3.startsWith('data:')) {
          resolved.logo3 = await convertUrlToBase64(resolved.logo3)
        }
        if (Array.isArray(resolved.signatures)) {
          resolved.signatures = await Promise.all(
            resolved.signatures.map(async (s) => ({
              ...s,
              image: s.image && !s.image.startsWith('data:') ? await convertUrlToBase64(s.image) : s.image
            }))
          )
        }
      } catch (e) {
        console.error('Error pre-resolving template images:', e)
      }
      setResolvedTemplate(resolved)
    }

    resolveImages()
  }, [isOpen, taller.id])

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

  const getVerificationUrl = (nameToUse: string) => {
    if (typeof window === 'undefined') return `/talleres/${taller.id}/verify?student=${encodeURIComponent(nameToUse)}`
    return `${window.location.origin}/talleres/${taller.id}/verify?student=${encodeURIComponent(nameToUse)}`
  }

  const fontClass = template.fontFamily === 'serif' ? 'font-serif' : 'font-sans'

  // PDF download handler
  const handleDownloadPdf = async () => {
    const node = document.getElementById('diploma-generator-render-node')
    if (!node) return
    setIsGeneratingPdf(true)
    try {
      const pngDataUrl = await toPng(node, { quality: 0.98, pixelRatio: 2 })
      const pdfDoc = await PDFDocument.create()
      const page = pdfDoc.addPage([1000, 773])
      const pngImage = await pdfDoc.embedPng(pngDataUrl)

      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: 1000,
        height: 773,
      })

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      const dataUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.download = `Diploma_${editableName.trim().replace(/\s+/g, '_')}.pdf`
      link.href = dataUrl
      link.click()

      setTimeout(() => URL.revokeObjectURL(dataUrl), 1000)
    } catch (err) {
      console.error('Error generating PDF diploma:', err)
      alert('Error al generar el PDF del diploma.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  // PNG download handler
  const handleDownloadPng = async () => {
    const node = document.getElementById('diploma-generator-render-node')
    if (!node) return
    setIsGenerating(true)
    try {
      const blob = await toBlob(node, { pixelRatio: 2, cacheBust: true })
      if (!blob) throw new Error('Failed to generate PNG blob')
      
      const dataUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `Diploma_${editableName.trim().replace(/\s+/g, '_')}.png`
      link.href = dataUrl
      link.click()
      
      setTimeout(() => URL.revokeObjectURL(dataUrl), 1000)
    } catch (err) {
      console.error(err)
      alert('Error al descargar el diploma en imagen PNG.')
    } finally {
      setIsGenerating(false)
    }
  }

  const signaturesList = template.signatures || DEFAULT_SIGNATURES(taller.professor)
  const isBonssTheme = template.theme === 'bonss-diagonal'

  const DiplomaLayout = ({ idAttr }: { idAttr?: string }) => (
    <div 
      id={idAttr}
      className={`w-[1000px] h-[773px] relative flex flex-col justify-between select-none overflow-hidden transition-all bg-white ${fontClass}`}
      style={{ boxSizing: 'border-box' }}
    >
      {/* Theme Accents */}
      {isBonssTheme ? (
        <>
          <div 
            className="absolute top-0 left-0 w-[420px] h-[260px] pointer-events-none z-0"
            style={{
              background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)',
              clipPath: 'polygon(0 0, 100% 0, 0 100%)'
            }}
          />
          <div 
            className="absolute top-0 left-0 w-[430px] h-[268px] pointer-events-none z-0 opacity-40"
            style={{
              background: '#94a3b8',
              clipPath: 'polygon(0 0, 100% 0, 0 100%)',
              transform: 'scale(1.02)'
            }}
          />
          <div 
            className="absolute bottom-0 right-0 w-[360px] h-[260px] pointer-events-none z-0"
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              clipPath: 'polygon(100% 0, 100% 100%, 0 100%)'
            }}
          />
        </>
      ) : (
        <div className="absolute inset-3 border-2 border-[#C5A059] pointer-events-none opacity-80 z-10" />
      )}

      {/* Central Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.08] z-0">
        <svg width="460" height="650" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-900">
          <path d="M50 10 C45 20, 55 30, 50 40 C45 50, 55 60, 50 70 C45 80, 55 90, 50 100 C45 110, 55 120, 50 130 C45 140, 55 150, 50 160 C45 170, 55 180, 50 190" />
          <circle cx="50" cy="20" r="8" opacity="0.6" />
          <circle cx="50" cy="40" r="9" opacity="0.6" />
          <circle cx="50" cy="60" r="10" opacity="0.6" />
          <circle cx="50" cy="80" r="11" opacity="0.6" />
          <circle cx="50" cy="100" r="12" opacity="0.6" />
          <circle cx="50" cy="120" r="12" opacity="0.6" />
          <circle cx="50" cy="140" r="13" opacity="0.6" />
          <circle cx="50" cy="160" r="13" opacity="0.6" />
          <circle cx="50" cy="180" r="14" opacity="0.6" />
        </svg>
      </div>

      {/* TOP HEADER LOGOS */}
      <div className="flex justify-between items-start z-10 w-full p-8">
        <div className="h-20 w-52 flex items-center justify-start">
          {template.logo1 && <img src={template.logo1} alt="Logo 1" className="max-h-20 max-w-full object-contain filter drop-shadow-md" />}
        </div>
        <div className="h-20 w-52 flex items-center justify-end">
          {template.logo2 && <img src={template.logo2} alt="Logo 2" className="max-h-20 max-w-full object-contain" />}
        </div>
      </div>

      {/* MAIN BODY CONTENT */}
      <div className="flex flex-col items-center text-center z-10 w-full px-12 space-y-3 -mt-4">
        <h2 className="text-5xl font-serif font-black uppercase tracking-wider text-gray-900 leading-tight">
          {template.title || 'CERTIFICADO'}
        </h2>
        <h3 className="text-xl font-serif font-bold uppercase tracking-widest text-gray-800 -mt-1">
          DE RECONOCIMIENTO
        </h3>
        <p className="text-sm italic text-gray-600 font-serif my-2">
          {template.presentation || 'Bonss Medical otorga el reconocimiento a:'}
        </p>
        <div className="w-full flex flex-col items-center py-1">
          <h3 className="text-3xl md:text-4xl font-serif font-bold tracking-tight text-gray-950 border-b-2 border-gray-900 pb-1.5 px-8 inline-block max-w-3xl">
            {editableName}
          </h3>
        </div>
        <div className="max-w-3xl space-y-1.5 mt-2">
          <p className="text-sm leading-relaxed text-gray-800 font-serif font-normal">
            {replacePlaceholders(template.bodyText, editableName)} <span className="font-bold text-gray-950">"{taller.name}"</span>.
          </p>
        </div>
      </div>

      {/* SIGNATURES SECTION */}
      <div className="z-10 w-full px-16 my-2">
        <div className={`grid gap-12 items-end justify-center ${signaturesList.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' : signaturesList.length === 2 ? 'grid-cols-2 max-w-2xl mx-auto' : 'grid-cols-3 max-w-3xl mx-auto'}`}>
          {signaturesList.map((sig) => (
            <div key={sig.id} className="flex flex-col items-center text-center min-w-0">
              <div className="h-16 flex items-end justify-center mb-1">
                {sig.image && <img src={sig.image} alt={sig.name} className="max-h-16 max-w-[170px] object-contain" />}
              </div>
              <div className="w-full border-t border-gray-800 my-1" />
              <p className="text-xs font-serif font-bold text-gray-900 truncate w-full">{sig.name}</p>
              <p className="text-[10px] text-gray-600 font-sans uppercase tracking-wider truncate w-full">{sig.title}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER SECTION */}
      <div className="flex justify-between items-end px-10 pb-6 z-10 w-full font-sans">
        <div className="flex items-center gap-3 bg-white/90 p-2 border border-gray-200 rounded-xl shadow-xs">
          <QRCodeSVG 
            value={getVerificationUrl(editableName)} 
            size={64}
            level="M"
            includeMargin={false}
          />
          <div className="text-[8px] text-gray-500 font-mono leading-tight flex flex-col justify-center text-left">
            <span className="font-bold text-gray-800">CONSTANCIA</span>
            <span className="font-bold text-emerald-600">VERIFICADA</span>
            <span className="mt-1 text-[7px] text-gray-400">ESCANEAR QR</span>
          </div>
        </div>

        <div className="text-xs text-gray-600 font-serif italic text-center pb-2">
          {getFormattedDate()}, {template.location}
        </div>

        <div className="h-20 w-44 flex items-center justify-end">
          {template.logo3 && <img src={template.logo3} alt="Logo 3" className="max-h-20 max-w-full object-contain filter drop-shadow-md" />}
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
            Revisa y edita el nombre tal como debe aparecer en el certificado.
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
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <Award size={20} className="text-blue-600" />
              <span>Plantilla seleccionada: <strong>{template.theme === 'bonss-diagonal' ? 'Médico Diagonal (Bonss)' : 'Estándar'}</strong></span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                disabled={isGeneratingPdf}
                onClick={handleDownloadPdf}
                className="btn-primary py-3 justify-center gap-2 font-bold"
              >
                {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Descargar PDF
              </button>

              <button 
                type="button"
                disabled={isGenerating}
                onClick={handleDownloadPng}
                className="btn-secondary py-3 justify-center gap-2 font-bold border-gray-300 hover:bg-gray-100"
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

      {/* Hidden print/render node */}
      <div
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          pointerEvents: 'none',
          zIndex: -1
        }}
      >
        <DiplomaLayout idAttr="diploma-generator-render-node" />
      </div>
    </>
  )
}
