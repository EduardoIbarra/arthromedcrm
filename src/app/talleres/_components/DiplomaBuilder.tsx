'use client'

import { useState, useRef, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { PDFDocument } from 'pdf-lib'
import { Plus, Trash2, Upload, Loader2, Award, Shield, FileText, Check, Download, Printer, Settings, Edit3 } from 'lucide-react'
import Modal from '@/components/Modal'
import { QRCodeSVG } from 'qrcode.react'

export interface SignatureItem {
  id: string
  name: string
  title: string
  image: string
}

export interface DiplomaTemplate {
  title: string
  presentation: string
  bodyText: string
  subText: string
  hours: string
  location: string
  theme: 'navy-gold' | 'emerald-gold' | 'charcoal-silver' | 'minimalist' | 'bonss-diagonal'
  fontFamily: 'serif' | 'sans'
  logo1: string // Upper left logo
  logo2: string // Upper right logo
  logo3: string // Lower right logo
  signatures: SignatureItem[]
  // Instructor Template Fields
  instructorTitle?: string
  instructorPresentation?: string
  instructorBodyText?: string
  instructorSignatures?: SignatureItem[]
  // Legacy fields for backward compatibility
  sig1_name?: string
  sig1_title?: string
  sig1_image?: string
  sig2_name?: string
  sig2_title?: string
  sig2_image?: string
}

interface DiplomaBuilderProps {
  isOpen: boolean
  onClose: () => void
  isFullPage?: boolean
  taller: {
    id: string
    name: string
    date_time: string
    professor: string
    diploma_template?: any
  }
  onSave: (template: DiplomaTemplate) => void
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

export const DEFAULT_INSTRUCTOR_SIGNATURES = (): SignatureItem[] => [
  {
    id: 'sig-inst-1',
    name: 'Dr. Ricardo Reyes Reyes',
    title: 'Director General de Arthromed',
    image: '/images/firmaRicardoReyes.png'
  },
  {
    id: 'sig-inst-2',
    name: 'Eric Ai',
    title: 'Gerente de Bonss Medical LATAM',
    image: '/images/firmaEric.jpg'
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
  signatures: DEFAULT_SIGNATURES(professor),
  instructorTitle: 'RECONOCIMIENTO',
  instructorPresentation: 'Bonss Medical y Arthromed Academy otorgan la presente CONSTANCIA a:',
  instructorBodyText: 'Por su invaluable contribución y destacada participación como PROFESOR / INSTRUCTOR en el',
  instructorSignatures: DEFAULT_INSTRUCTOR_SIGNATURES()
})

const normalizeTemplate = (rawTmpl: any, workshopName: string, professor: string): DiplomaTemplate => {
  const base = DEFAULT_TEMPLATE(workshopName, professor)
  if (!rawTmpl || typeof rawTmpl !== 'object') return base

  // Normalize signatures
  let sigs: SignatureItem[] = []
  if (Array.isArray(rawTmpl.signatures) && rawTmpl.signatures.length > 0) {
    sigs = rawTmpl.signatures
  } else {
    // Migration from legacy sig1/sig2 fields
    if (rawTmpl.sig1_name || rawTmpl.sig1_title || rawTmpl.sig1_image) {
      sigs.push({
        id: 'sig-1',
        name: rawTmpl.sig1_name || `Dr. ${professor || 'Instructor Principal'}`,
        title: rawTmpl.sig1_title || 'Profesor Titular',
        image: rawTmpl.sig1_image || ''
      })
    }
    if (rawTmpl.sig2_name || rawTmpl.sig2_title || rawTmpl.sig2_image) {
      sigs.push({
        id: 'sig-2',
        name: rawTmpl.sig2_name || 'Comité Organizador',
        title: rawTmpl.sig2_title || 'Arthromed Academy',
        image: rawTmpl.sig2_image || ''
      })
    }
    if (sigs.length === 0) {
      sigs = DEFAULT_SIGNATURES(professor)
    }
  }

  let instSigs: SignatureItem[] = []
  if (Array.isArray(rawTmpl.instructorSignatures) && rawTmpl.instructorSignatures.length > 0) {
    instSigs = rawTmpl.instructorSignatures
  } else {
    instSigs = DEFAULT_INSTRUCTOR_SIGNATURES()
  }

  return {
    ...base,
    ...rawTmpl,
    signatures: sigs,
    instructorSignatures: instSigs,
    logo3: rawTmpl.logo3 || '',
    instructorTitle: rawTmpl.instructorTitle || base.instructorTitle,
    instructorPresentation: rawTmpl.instructorPresentation || base.instructorPresentation,
    instructorBodyText: rawTmpl.instructorBodyText || base.instructorBodyText
  }
}

export default function DiplomaBuilder({ isOpen, onClose, isFullPage = false, taller, onSave }: DiplomaBuilderProps) {
  const [template, setTemplate] = useState<DiplomaTemplate>(() => 
    normalizeTemplate(taller.diploma_template, taller.name, taller.professor)
  )

  const [activeTab, setActiveTab] = useState<'text' | 'design' | 'logos' | 'signatures' | 'preview'>('text')
  const [previewRole, setPreviewRole] = useState<'student' | 'instructor'>('student')
  const [textRoleTab, setTextRoleTab] = useState<'student' | 'instructor'>('student')
  const [isSaving, setIsSaving] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [sampleStudentName, setSampleStudentName] = useState('Dr. Alfonso De Jesús Núñez Salazar')
  
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.8)
  
  const fileInputLogo1Ref = useRef<HTMLInputElement>(null)
  const fileInputLogo2Ref = useRef<HTMLInputElement>(null)
  const fileInputLogo3Ref = useRef<HTMLInputElement>(null)

  // Listen to container resizing to scale preview dynamically
  useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width
        const height = entry.contentRect.height
        const scaleX = width / 1000
        const scaleY = height / 773
        setScale(Math.min(1, Math.min(scaleX, scaleY)))
      }
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [containerRef.current, activeTab])

  // Save template configuration to database
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

  // Generate PDF download without CSS transform artifacts
  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true)
    try {
      // Find the source diploma node
      const sourceNode = document.getElementById('diploma-preview-target')
      if (!sourceNode) throw new Error('No se encontró el lienzo de vista previa.')

      // Clone node and place in fixed off-screen container at true 1000x773 scale
      const container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.top = '-9999px'
      container.style.left = '-9999px'
      container.style.width = '1000px'
      container.style.height = '773px'
      container.style.zIndex = '-9999'

      const cloneNode = sourceNode.cloneNode(true) as HTMLElement
      cloneNode.style.transform = 'none'
      container.appendChild(cloneNode)
      document.body.appendChild(container)

      // Allow images to finish rendering inside cloned node
      await new Promise((r) => setTimeout(r, 150))

      const pngDataUrl = await toPng(cloneNode, { quality: 0.98, pixelRatio: 2, width: 1000, height: 773 })
      document.body.removeChild(container)

      const pdfDoc = await PDFDocument.create()
      // US Letter Landscape size in points (11 in x 8.5 in = 792 pt x 612 pt)
      const page = pdfDoc.addPage([792, 612])
      const pngImage = await pdfDoc.embedPng(pngDataUrl)
      
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: 792,
        height: 612,
      })

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      const downloadUrl = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `Diploma_${(taller.name || 'Taller').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      link.click()
      URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.error('Error generating PDF:', err)
      alert('Ocurrió un error al generar el PDF del diploma.')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  // Handle generic image upload to state
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logo1' | 'logo2' | 'logo3') => {
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

  const [sigRoleTab, setSigRoleTab] = useState<'student' | 'instructor'>('student')

  // Handle signature image upload
  const handleSignatureImageUpload = (e: React.ChangeEvent<HTMLInputElement>, sigId: string) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.onload = () => {
        const img = reader.result as string
        setTemplate(prev => {
          if (sigRoleTab === 'instructor') {
            return {
              ...prev,
              instructorSignatures: (prev.instructorSignatures || []).map(s => s.id === sigId ? { ...s, image: img } : s)
            }
          } else {
            return {
              ...prev,
              signatures: prev.signatures.map(s => s.id === sigId ? { ...s, image: img } : s)
            }
          }
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAddSignature = () => {
    const newSig: SignatureItem = {
      id: `sig-${Date.now()}`,
      name: 'Nuevo Firmante',
      title: 'Cargo / Título',
      image: ''
    }
    setTemplate(prev => {
      if (sigRoleTab === 'instructor') {
        return {
          ...prev,
          instructorSignatures: [...(prev.instructorSignatures || []), newSig]
        }
      } else {
        return {
          ...prev,
          signatures: [...prev.signatures, newSig]
        }
      }
    })
  }

  const handleRemoveSignature = (sigId: string) => {
    setTemplate(prev => {
      if (sigRoleTab === 'instructor') {
        if ((prev.instructorSignatures || []).length <= 1) {
          alert('Debe conservar al menos una firma.')
          return prev
        }
        return {
          ...prev,
          instructorSignatures: (prev.instructorSignatures || []).filter(s => s.id !== sigId)
        }
      } else {
        if (prev.signatures.length <= 1) {
          alert('Debe conservar al menos una firma.')
          return prev
        }
        return {
          ...prev,
          signatures: prev.signatures.filter(s => s.id !== sigId)
        }
      }
    })
  }

  const handleUpdateSignature = (sigId: string, field: 'name' | 'title', value: string) => {
    setTemplate(prev => {
      if (sigRoleTab === 'instructor') {
        return {
          ...prev,
          instructorSignatures: (prev.instructorSignatures || []).map(s => s.id === sigId ? { ...s, [field]: value } : s)
        }
      } else {
        return {
          ...prev,
          signatures: prev.signatures.map(s => s.id === sigId ? { ...s, [field]: value } : s)
        }
      }
    })
  }

  const handleResetInstructorSignatures = () => {
    setTemplate(prev => ({
      ...prev,
      instructorSignatures: DEFAULT_INSTRUCTOR_SIGNATURES()
    }))
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

  // Generate text with placeholders replaced
  const replacePlaceholders = (text: string, studentName: string) => {
    return text
      .replace(/{{name}}/g, studentName)
      .replace(/{{workshop}}/g, taller.name)
      .replace(/{{date}}/g, getFormattedDate())
      .replace(/{{hours}}/g, template.hours)
      .replace(/{{location}}/g, template.location)
      .replace(/{{professor}}/g, taller.professor || 'Profesor Titular')
  }

  // Verification URL for QR code
  const getVerificationUrl = (nameToUse: string) => {
    if (typeof window === 'undefined') return `/talleres/${taller.id}/verify?student=${encodeURIComponent(nameToUse)}`
    return `${window.location.origin}/talleres/${taller.id}/verify?student=${encodeURIComponent(nameToUse)}`
  }

  const isBonssTheme = template.theme === 'bonss-diagonal'
  const fontClass = template.fontFamily === 'serif' ? 'font-serif' : 'font-sans'
  const currentRecipientName = previewRole === 'instructor' ? (taller.professor || 'Dr. Instructor Principal') : sampleStudentName

  // Component rendering the actual diploma document canvas
  const DiplomaPreviewRender = ({ studentName, targetId = 'diploma-preview-target' }: { studentName: string; targetId?: string }) => {
    return (
      <div 
        id={targetId}
        className={`w-[1000px] h-[773px] relative flex flex-col justify-between select-none overflow-hidden shadow-2xl transition-all bg-white ${fontClass}`}
        style={{ boxSizing: 'border-box' }}
      >
        {/* Central Spine Illustration Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
          <img 
            src="/images/spine.jpeg" 
            alt="Spine Illustration" 
            className="max-h-[960px] max-w-[740px] w-full h-full object-contain opacity-25 mix-blend-multiply scale-125"
          />
        </div>

        {/* Theme Accents */}
        {isBonssTheme ? (
          <>
            <div 
              className="absolute top-0 left-0 w-[480px] h-[300px] pointer-events-none z-0"
              style={{
                background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)',
                clipPath: 'polygon(0 0, 100% 0, 0 100%)'
              }}
            />
            <div 
              className="absolute top-0 left-0 w-[390px] h-[240px] pointer-events-none z-0"
              style={{
                background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                clipPath: 'polygon(0 0, 100% 0, 0 100%)'
              }}
            />
            <div 
              className="absolute top-0 left-0 w-[398px] h-[246px] pointer-events-none z-0 opacity-40"
              style={{
                background: '#94a3b8',
                clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                transform: 'scale(1.02)'
              }}
            />
            <div 
              className="absolute bottom-0 right-0 w-[420px] h-[300px] pointer-events-none z-0"
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                clipPath: 'polygon(100% 0, 100% 100%, 0 100%)'
              }}
            />
            <div 
              className="absolute bottom-0 right-0 w-[340px] h-[240px] pointer-events-none z-0"
              style={{
                background: 'linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)',
                clipPath: 'polygon(100% 0, 100% 100%, 0 100%)'
              }}
            />
          </>
        ) : (
          <div className={`absolute inset-3 border-2 ${template.theme === 'minimalist' ? 'border-gray-200' : 'border-[#C5A059]'} pointer-events-none opacity-80 z-10`} />
        )}

        {/* TOP HEADER LOGOS */}
        <div className="flex justify-between items-start z-10 w-full p-8">
          <div className="h-20 w-52 flex items-center justify-start">
            {template.logo1 ? (
              <img src={template.logo1} alt="Logo 1" className="max-h-20 max-w-full object-contain filter drop-shadow-xs" />
            ) : (
              <div className={`text-xs p-2 rounded border border-dashed ${isBonssTheme ? 'text-gray-500 border-gray-400 bg-white/40' : 'text-gray-400 border-gray-300'}`}>
                + Logo Superior Izquierdo
              </div>
            )}
          </div>
          <div className="h-20 w-52 flex items-center justify-end">
            {template.logo2 ? (
              <img src={template.logo2} alt="Logo 2" className="max-h-20 max-w-full object-contain" />
            ) : (
              <div className="text-xs text-gray-400 italic border border-dashed border-gray-300 p-2 rounded">
                + Logo Superior Derecho
              </div>
            )}
          </div>
        </div>

        {/* MAIN BODY CONTENT */}
        <div className="flex flex-col items-center text-center z-10 w-full px-12 space-y-3 -mt-4">
          <h2 className="text-5xl font-serif font-black uppercase tracking-wider text-gray-900 leading-tight">
            {previewRole === 'instructor' ? (template.instructorTitle || 'RECONOCIMIENTO') : (template.title || 'CERTIFICADO')}
          </h2>

          <h3 className="text-xl font-serif font-bold uppercase tracking-widest text-gray-800 -mt-1">
            DE RECONOCIMIENTO
          </h3>

          <p className="text-sm italic text-gray-600 font-serif my-2">
            {previewRole === 'instructor' ? (template.instructorPresentation || 'Bonss Medical y Arthromed Academy otorgan la presente CONSTANCIA a:') : (template.presentation || 'Bonss Medical otorga el reconocimiento a:')}
          </p>

          <div className="w-full flex flex-col items-center py-1">
            <h3 className="text-3xl md:text-4xl font-serif font-bold tracking-tight text-gray-950 border-b-2 border-gray-900 pb-1.5 px-8 inline-block max-w-3xl">
              {currentRecipientName}
            </h3>
          </div>

          <div className="max-w-3xl space-y-1.5 mt-2">
            <p className="text-sm leading-relaxed text-gray-800 font-serif font-normal">
              {replacePlaceholders(
                previewRole === 'instructor' ? (template.instructorBodyText || 'Por su invaluable contribución y destacada participación como PROFESOR / INSTRUCTOR en el') : template.bodyText,
                currentRecipientName
              )} <span className="font-bold text-gray-950">"{taller.name}"</span>.
            </p>
          </div>
        </div>

        {/* SIGNATURES SECTION */}
        {(() => {
          const currentSignatures = previewRole === 'instructor'
            ? (template.instructorSignatures && template.instructorSignatures.length > 0 ? template.instructorSignatures : DEFAULT_INSTRUCTOR_SIGNATURES())
            : template.signatures
          return (
            <div className="z-10 w-full px-16 my-1">
              <div className={`grid gap-8 items-start justify-center ${currentSignatures.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' : currentSignatures.length === 2 ? 'grid-cols-2 max-w-xl mx-auto' : 'grid-cols-3 max-w-2xl mx-auto'}`}>
                {currentSignatures.map((sig) => (
                  <div key={sig.id} className="flex flex-col items-center text-center min-w-0">
                    <div className="h-15 flex items-end justify-center mb-1">
                      {sig.image ? (
                        <img src={sig.image} alt={sig.name} className="max-h-15 max-w-[180px] object-contain" />
                      ) : (
                        <div className="h-15" />
                      )}
                    </div>
                    <div className="w-full border-t border-gray-800 my-0.5" />
                    <p className="text-xs font-serif font-bold text-gray-900 whitespace-pre-line break-words leading-tight w-full">{sig.name}</p>
                    <p className="text-[9px] text-gray-600 font-sans uppercase tracking-wider whitespace-pre-line break-words leading-tight w-full mt-0.5">{sig.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* FOOTER SECTION */}
        <div className="flex justify-between items-end px-10 pb-6 z-10 w-full font-sans">
          {/* Lower Left Corner: QR CODE */}
          <div className="flex items-center gap-3 bg-white/90 p-2 border border-gray-200 rounded-xl shadow-xs">
            <QRCodeSVG 
              value={getVerificationUrl(studentName)} 
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

          {/* Center Bottom: Date & Location */}
          <div className="text-xs text-gray-600 font-serif italic text-center pb-2">
            {getFormattedDate()}, {template.location}
          </div>

          {/* Lower Right Corner: Logo 3 */}
          <div className="h-24 w-56 flex items-center justify-end">
            {template.logo3 ? (
              <img src={template.logo3} alt="Logo 3 (Inferior Derecho)" className="max-h-24 max-w-full object-contain filter drop-shadow-xs" />
            ) : (
              <div className="text-[10px] text-gray-500 italic border border-dashed border-gray-400 p-1.5 rounded">
                + Logo Inferior Derecho
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const mainWorkspaceContent = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start h-full overflow-hidden">
      {/* Left Form Editor Controls: 5 cols */}
      <div className="lg:col-span-5 flex flex-col h-full overflow-y-auto pr-1 space-y-4 pb-4">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50/50 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl text-center transition-all ${activeTab === 'text' ? 'bg-white shadow-xs text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <span className="flex items-center justify-center gap-1"><FileText size={13} /> Textos</span>
          </button>
          <button 
            onClick={() => setActiveTab('design')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl text-center transition-all ${activeTab === 'design' ? 'bg-white shadow-xs text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <span className="flex items-center justify-center gap-1"><Settings size={13} /> Diseño</span>
          </button>
          <button 
            onClick={() => setActiveTab('logos')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl text-center transition-all ${activeTab === 'logos' ? 'bg-white shadow-xs text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <span className="flex items-center justify-center gap-1"><Shield size={13} /> Logos</span>
          </button>
          <button 
            onClick={() => setActiveTab('signatures')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl text-center transition-all ${activeTab === 'signatures' ? 'bg-white shadow-xs text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <span className="flex items-center justify-center gap-1"><Edit3 size={13} /> Firmas</span>
          </button>
          <button 
            onClick={() => setActiveTab('preview')}
            className={`lg:hidden flex-1 py-2 text-xs font-bold rounded-xl text-center transition-all ${activeTab === 'preview' ? 'bg-white shadow-xs text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <span className="flex items-center justify-center gap-1"><Award size={13} /> Vista</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 space-y-4 pt-1">
          {activeTab === 'text' && (
            <div className="space-y-3.5">
              {/* Role Sub-Toggle */}
              <div className="flex bg-gray-150 p-1 rounded-xl text-xs font-bold border border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setTextRoleTab('student')
                    setPreviewRole('student')
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all ${textRoleTab === 'student' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  🎓 Textos Alumno
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTextRoleTab('instructor')
                    setPreviewRole('instructor')
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all ${textRoleTab === 'instructor' ? 'bg-white text-amber-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  👨‍⚕️ Textos Instructor
                </button>
              </div>

              {textRoleTab === 'student' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Título Principal (Alumno)</label>
                    <input 
                      type="text" 
                      className="erp-input w-full" 
                      value={template.title} 
                      onChange={e => setTemplate(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="CERTIFICADO"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Texto de Presentación (Alumno)</label>
                    <input 
                      type="text" 
                      className="erp-input w-full" 
                      value={template.presentation} 
                      onChange={e => setTemplate(prev => ({ ...prev, presentation: e.target.value }))}
                      placeholder="Bonss Medical otorga el reconocimiento a:"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Descripción / Motivo (Alumno)</label>
                    <textarea 
                      rows={3}
                      className="erp-input w-full text-xs" 
                      value={template.bodyText} 
                      onChange={e => setTemplate(prev => ({ ...prev, bodyText: e.target.value }))}
                      placeholder="Por su participación en el Taller Práctico..."
                    />
                    <span className="text-[10px] text-gray-400">El nombre del taller y del alumno se agregan automáticamente.</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-amber-900 mb-1">Título Principal (Instructor)</label>
                    <input 
                      type="text" 
                      className="erp-input w-full bg-amber-50/40 border-amber-200" 
                      value={template.instructorTitle || 'RECONOCIMIENTO'} 
                      onChange={e => setTemplate(prev => ({ ...prev, instructorTitle: e.target.value }))}
                      placeholder="RECONOCIMIENTO"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-amber-900 mb-1">Texto de Presentación (Instructor)</label>
                    <input 
                      type="text" 
                      className="erp-input w-full bg-amber-50/40 border-amber-200" 
                      value={template.instructorPresentation || 'Bonss Medical y Arthromed Academy otorgan la presente CONSTANCIA a:'} 
                      onChange={e => setTemplate(prev => ({ ...prev, instructorPresentation: e.target.value }))}
                      placeholder="Bonss Medical y Arthromed Academy otorgan la presente CONSTANCIA a:"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-900 mb-1">Descripción / Motivo (Instructor)</label>
                    <textarea 
                      rows={3}
                      className="erp-input w-full text-xs bg-amber-50/40 border-amber-200" 
                      value={template.instructorBodyText || 'Por su invaluable contribución y destacada participación como PROFESOR / INSTRUCTOR en el'} 
                      onChange={e => setTemplate(prev => ({ ...prev, instructorBodyText: e.target.value }))}
                      placeholder="Por su invaluable contribución y destacada participación como PROFESOR / INSTRUCTOR en el..."
                    />
                    <span className="text-[10px] text-gray-400">Se agrega automáticamente el nombre del taller e instructor.</span>
                  </div>
                </>
              )}

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
                    placeholder="Monterrey, Nuevo León, México"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'design' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Plantilla y Estilo</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => setTemplate(prev => ({ ...prev, theme: 'bonss-diagonal' }))}
                    className={`flex flex-col items-center p-3 border rounded-xl text-center transition-all ${template.theme === 'bonss-diagonal' ? 'border-blue-600 bg-blue-50/50 shadow-xs' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className="w-12 h-7 bg-white border border-gray-300 rounded-sm mb-1.5 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-5 h-5 bg-blue-600 clip-path-triangle" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
                      <div className="absolute bottom-0 right-0 w-5 h-5 bg-slate-900 clip-path-triangle" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
                    </div>
                    <span className="text-xs font-bold text-gray-900">Médico Diagonal (Bonss)</span>
                    <span className="text-[9px] text-gray-400 uppercase mt-0.5">Estilo Arthromed / Bonss</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setTemplate(prev => ({ ...prev, theme: 'navy-gold' }))}
                    className={`flex flex-col items-center p-3 border rounded-xl text-center transition-all ${template.theme === 'navy-gold' ? 'border-blue-600 bg-blue-50/50 shadow-xs' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className="w-12 h-7 border-4 border-[#081e3f] bg-white rounded-sm mb-1.5 relative">
                      <div className="absolute inset-0.5 border border-[#C5A059]" />
                    </div>
                    <span className="text-xs font-bold text-gray-900">Azul Marino y Oro</span>
                    <span className="text-[9px] text-gray-400 uppercase mt-0.5">Borde Marco Clásico</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Tipografía</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => setTemplate(prev => ({ ...prev, fontFamily: 'serif' }))}
                    className={`p-3 border rounded-xl text-center transition-all ${template.fontFamily === 'serif' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <span className="text-lg font-serif font-bold block mb-0.5">Abc</span>
                    <span className="text-xs font-semibold text-gray-800">Serif (Elegante)</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setTemplate(prev => ({ ...prev, fontFamily: 'sans' }))}
                    className={`p-3 border rounded-xl text-center transition-all ${template.fontFamily === 'sans' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <span className="text-lg font-sans font-bold block mb-0.5">Abc</span>
                    <span className="text-xs font-semibold text-gray-800">Sans (Moderna)</span>
                  </button>
                </div>
              </div>

              <div className="bg-blue-50/40 p-3.5 border border-blue-100 rounded-2xl">
                <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block mb-1">Nombre de Prueba en Vista Previa</span>
                <input 
                  type="text" 
                  className="erp-input w-full bg-white text-xs py-1.5" 
                  value={sampleStudentName} 
                  onChange={e => setSampleStudentName(e.target.value)}
                  placeholder="Dr. Nombre de Prueba"
                />
              </div>
            </div>
          )}

          {activeTab === 'logos' && (
            <div className="space-y-3.5">
              <h4 className="text-xs font-bold text-gray-900">Ubicación de Logotipos (Hasta 3 logos)</h4>

              {/* Logo 1 (Upper Left) */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider block">Logo 1 (Esquina Superior Izquierda)</span>
                    <span className="text-xs font-semibold text-gray-800">Marca Principal (Ej. BONSS)</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button 
                      type="button" 
                      onClick={() => fileInputLogo1Ref.current?.click()}
                      className="btn-secondary text-xs py-1 px-2.5"
                    >
                      <Upload size={13} /> Subir
                    </button>
                    {template.logo1 && (
                      <button 
                        type="button" 
                        onClick={() => setTemplate(prev => ({ ...prev, logo1: '' }))}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <input type="file" ref={fileInputLogo1Ref} className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'logo1')} />
              </div>

              {/* Logo 2 (Upper Right) */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider block">Logo 2 (Esquina Superior Derecha)</span>
                    <span className="text-xs font-semibold text-gray-800">Empresa / Co-patrocinador (Ej. ARTHROMED)</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button 
                      type="button" 
                      onClick={() => fileInputLogo2Ref.current?.click()}
                      className="btn-secondary text-xs py-1 px-2.5"
                    >
                      <Upload size={13} /> Subir
                    </button>
                    {template.logo2 && (
                      <button 
                        type="button" 
                        onClick={() => setTemplate(prev => ({ ...prev, logo2: '' }))}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <input type="file" ref={fileInputLogo2Ref} className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'logo2')} />
              </div>

              {/* Logo 3 (Lower Right) */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider block">Logo 3 (Esquina Inferior Derecha)</span>
                    <span className="text-xs font-semibold text-gray-800">Sociedad / Sello (Ej. ISUBE)</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button 
                      type="button" 
                      onClick={() => fileInputLogo3Ref.current?.click()}
                      className="btn-secondary text-xs py-1 px-2.5"
                    >
                      <Upload size={13} /> Subir
                    </button>
                    {template.logo3 && (
                      <button 
                        type="button" 
                        onClick={() => setTemplate(prev => ({ ...prev, logo3: '' }))}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <input type="file" ref={fileInputLogo3Ref} className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'logo3')} />
              </div>

              <p className="text-[11px] text-gray-500 italic bg-amber-50 p-2.5 border border-amber-200 rounded-xl">
                Nota: La esquina inferior izquierda está reservada exclusivamente para el código QR de verificación de validez oficial.
              </p>
            </div>
          )}

          {activeTab === 'signatures' && (
            <div className="space-y-4">
              {/* Role Sub-Toggle */}
              <div className="flex bg-gray-150 p-1 rounded-xl text-xs font-bold border border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setSigRoleTab('student')
                    setPreviewRole('student')
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all ${sigRoleTab === 'student' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  🎓 Firmas Alumno
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSigRoleTab('instructor')
                    setPreviewRole('instructor')
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all ${sigRoleTab === 'instructor' ? 'bg-white text-amber-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  👨‍⚕️ Firmas Instructor
                </button>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-900">
                  {sigRoleTab === 'instructor' ? 'Firmas para Diploma de Instructor' : 'Firmas para Diploma de Alumno'}
                </h4>
                <div className="flex gap-1.5">
                  {sigRoleTab === 'instructor' && (
                    <button 
                      type="button" 
                      onClick={handleResetInstructorSignatures}
                      className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold rounded-lg transition-colors"
                      title="Cargar firmas oficiales de Dr. Ricardo Reyes Reyes y Eric BONSS"
                    >
                      Restablecer Oficiales
                    </button>
                  )}
                  <button 
                    type="button" 
                    onClick={handleAddSignature}
                    className="btn-secondary text-xs py-1 px-2.5 gap-1"
                  >
                    <Plus size={13} /> Agregar
                  </button>
                </div>
              </div>

              {sigRoleTab === 'instructor' && (
                <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 leading-snug">
                  ✨ <strong>Firmas Oficiales Cargas por Defecto:</strong> Incluye firmas digitales del <strong>Dr. Ricardo Reyes Reyes</strong> (Director General Arthromed) y <strong>Eric Ai</strong> (Gerente BONSS LATAM).
                </div>
              )}

              <div className="space-y-3">
                {(sigRoleTab === 'instructor' ? (template.instructorSignatures || DEFAULT_INSTRUCTOR_SIGNATURES()) : template.signatures).map((sig, idx, list) => (
                  <div key={sig.id} className="p-3 bg-gray-50 border border-gray-200 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Firma #{idx + 1}</span>
                      {list.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => handleRemoveSignature(sig.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1"
                        >
                          <Trash2 size={13} /> Eliminar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Nombre</label>
                        <textarea 
                          rows={2}
                          className="erp-input text-xs bg-white py-1.5 resize-none w-full" 
                          value={sig.name} 
                          onChange={e => handleUpdateSignature(sig.id, 'name', e.target.value)}
                          placeholder="Nombre completo (soporta varias líneas)"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Cargo / Título</label>
                        <textarea 
                          rows={2}
                          className="erp-input text-xs bg-white py-1.5 resize-none w-full" 
                          value={sig.title} 
                          onChange={e => handleUpdateSignature(sig.id, 'title', e.target.value)}
                          placeholder="Cargo / Título (soporta varias líneas)"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2 border border-gray-200 rounded-xl">
                      <span className="text-xs text-gray-600 truncate max-w-[180px]">
                        {sig.image ? '✓ Imagen de firma cargada' : 'Sin imagen (Línea de firma)'}
                      </span>
                      <label className="btn-secondary text-xs py-1 px-2.5 cursor-pointer shrink-0">
                        <Upload size={12} /> Cargar Imagen
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={e => handleSignatureImageUpload(e, sig.id)} 
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="flex flex-col items-center justify-center p-2 border border-dashed border-gray-200 rounded-2xl bg-gray-50">
              <div 
                className="origin-top-left overflow-hidden bg-white shadow-lg border border-gray-200"
                style={{ 
                  width: '100%', 
                  height: `${scale * 773}px`, 
                  maxWidth: '100%' 
                }}
              >
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                  <DiplomaPreviewRender studentName={sampleStudentName} targetId="diploma-mobile-preview-target" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="border-t border-gray-200 pt-3 flex flex-col gap-2 shrink-0">
          <div className="flex gap-2">
            <button 
              disabled={isDownloadingPdf}
              onClick={handleDownloadPdf} 
              className="btn-secondary flex-1 justify-center py-2.5 gap-1.5 font-bold border-gray-300 hover:bg-gray-100"
            >
              {isDownloadingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Descargar PDF
            </button>

            <button 
              disabled={isSaving}
              onClick={handleSave} 
              className="btn-primary flex-1 justify-center py-2.5 gap-1.5 font-bold"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Guardar Plantilla
            </button>
          </div>
        </div>
      </div>

      {/* Right Live Canvas Workspace: 7 cols */}
      <div className="hidden lg:col-span-7 lg:flex flex-col items-center justify-between h-full bg-gray-50/70 border border-gray-200 rounded-3xl p-5 overflow-hidden">
        <div className="w-full flex items-center justify-between pb-3 border-b border-gray-200 shrink-0">
          <span className="text-xs font-bold text-gray-800 flex items-center gap-2">
            <Award size={16} className="text-blue-600" />
            Lienzo de Vista Previa del Diploma
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="btn-secondary py-1 px-2.5 text-xs font-bold gap-1"
            >
              {isDownloadingPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Exportar PDF
            </button>
            <span className="text-[10px] font-bold text-gray-500 bg-gray-200/80 px-2.5 py-1 rounded-full">
              1000 x 773 px
            </span>
          </div>
        </div>

        <div 
          ref={containerRef}
          className="w-full flex-1 flex items-center justify-center overflow-hidden bg-transparent my-auto py-2"
        >
          <div 
            style={{ 
              transform: `scale(${scale})`, 
              transformOrigin: 'center center',
              width: '1000px',
              height: '773px',
              flexShrink: 0
            }}
            className="transition-transform duration-200 shadow-2xl rounded-sm"
          >
            <DiplomaPreviewRender studentName={sampleStudentName} />
          </div>
        </div>

        <div className="text-[11px] text-gray-500 text-center max-w-md pt-2 border-t border-gray-200 w-full shrink-0">
          Haz clic en <strong className="text-gray-800">Descargar PDF</strong> para previsualizar el documento impreso o <strong className="text-gray-800">Guardar Plantilla</strong> para conservar la configuración.
        </div>
      </div>
    </div>
  )

  if (isFullPage) {
    return mainWorkspaceContent
  }

  if (!isOpen) return null

  return (
    <Modal 
      open={isOpen} 
      onClose={onClose} 
      title={`Diseño de Diploma - ${taller.name}`}
      maxWidth="1200px"
    >
      <div className="h-[calc(100vh-180px)] overflow-hidden">
        {mainWorkspaceContent}
      </div>
    </Modal>
  )
}
