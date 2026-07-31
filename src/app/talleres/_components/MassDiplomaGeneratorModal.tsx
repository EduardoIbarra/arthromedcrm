'use client'

import { useState, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { PDFDocument } from 'pdf-lib'
import { Loader2, Download, Award, GraduationCap, UserCheck, CheckCircle2, FileText, Layers } from 'lucide-react'
import Modal from '@/components/Modal'
import { QRCodeSVG } from 'qrcode.react'

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
  instructorTitle?: string
  instructorPresentation?: string
  instructorBodyText?: string
  instructorSignatures?: SignatureItem[]
}

interface MassDiplomaGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
  taller: {
    id: string
    name: string
    date_time: string
    professor: string
    diploma_template?: any
    congress_workshop_doctors?: any[]
  }
  enrolledClients: Array<{ id: string; name: string }>
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
    return url
  }
}

export default function MassDiplomaGeneratorModal({ isOpen, onClose, taller, enrolledClients }: MassDiplomaGeneratorModalProps) {
  const [targetType, setTargetType] = useState<'students' | 'instructors' | 'all'>('students')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressIndex, setProgressIndex] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [currentRecipientName, setCurrentRecipientName] = useState('')
  const [activeRenderItem, setActiveRenderItem] = useState<{ name: string; role: 'student' | 'instructor' } | null>(null)
  const [resolvedTemplate, setResolvedTemplate] = useState<DiplomaTemplate | null>(null)

  // Base Template initialization
  const baseTemplate: DiplomaTemplate = (() => {
    if (taller.diploma_template && typeof taller.diploma_template === 'object') {
      const tmpl = {
        ...DEFAULT_TEMPLATE(taller.name, taller.professor),
        ...taller.diploma_template
      }
      if (!Array.isArray(tmpl.signatures) || tmpl.signatures.length === 0) {
        tmpl.signatures = DEFAULT_SIGNATURES(taller.professor)
      }
      if (!Array.isArray(tmpl.instructorSignatures) || tmpl.instructorSignatures.length === 0) {
        tmpl.instructorSignatures = DEFAULT_INSTRUCTOR_SIGNATURES()
      }
      return tmpl
    }
    return DEFAULT_TEMPLATE(taller.name, taller.professor)
  })()

  const template = resolvedTemplate || baseTemplate

  // Extract Instructor names
  const instructorNames: string[] = []
  if (taller.professor) {
    taller.professor.split(/,|\se\s|\sy\s/).forEach(p => {
      const clean = p.trim()
      if (clean && !instructorNames.includes(clean)) instructorNames.push(clean)
    })
  }
  if (taller.congress_workshop_doctors && Array.isArray(taller.congress_workshop_doctors)) {
    taller.congress_workshop_doctors.forEach((d: any) => {
      const docName = d.doctors?.name || d.doctores?.name
      if (docName && !instructorNames.includes(docName)) {
        instructorNames.push(docName)
      }
    })
  }
  if (instructorNames.length === 0 && taller.professor) {
    instructorNames.push(taller.professor)
  }

  // Pre-resolve base64 images
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
        if (Array.isArray(resolved.instructorSignatures)) {
          resolved.instructorSignatures = await Promise.all(
            resolved.instructorSignatures.map(async (s) => ({
              ...s,
              image: s.image && !s.image.startsWith('data:') ? await convertUrlToBase64(s.image) : s.image
            }))
          )
        }
      } catch (e) {
        console.error('Error resolving template images:', e)
      }
      setResolvedTemplate(resolved)
    }

    resolveImages()
  }, [isOpen, taller.id])

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
    if (!text) return ''
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

  // Build target list based on selection
  const getRecipientItems = (): Array<{ name: string; role: 'student' | 'instructor' }> => {
    const items: Array<{ name: string; role: 'student' | 'instructor' }> = []
    
    if (targetType === 'students' || targetType === 'all') {
      enrolledClients.forEach(c => {
        if (c.name) items.push({ name: c.name, role: 'student' })
      })
    }
    
    if (targetType === 'instructors' || targetType === 'all') {
      instructorNames.forEach(name => {
        if (name) items.push({ name, role: 'instructor' })
      })
    }
    
    return items
  }

  // Batch Generation Procedure
  const handleGenerateMassPdf = async () => {
    const recipients = getRecipientItems()
    if (recipients.length === 0) {
      alert('No hay diplomas seleccionados para generar.')
      return
    }

    setIsGenerating(true)
    setTotalCount(recipients.length)
    setProgressIndex(0)

    try {
      const pdfDoc = await PDFDocument.create()

      for (let i = 0; i < recipients.length; i++) {
        const item = recipients[i]
        setProgressIndex(i + 1)
        setCurrentRecipientName(item.name)
        setActiveRenderItem(item)

        // Wait 120ms for DOM update & SVG QR rendering
        await new Promise((resolve) => setTimeout(resolve, 150))

        const renderNode = document.getElementById('mass-diploma-active-canvas')
        if (!renderNode) continue

        // Offscreen container rendering for pure 1000x773 export
        const container = document.createElement('div')
        container.style.position = 'fixed'
        container.style.top = '-9999px'
        container.style.left = '-9999px'
        container.style.width = '1000px'
        container.style.height = '773px'
        container.style.zIndex = '-9999'

        const cloneNode = renderNode.cloneNode(true) as HTMLElement
        cloneNode.style.transform = 'none'
        container.appendChild(cloneNode)
        document.body.appendChild(container)

        await new Promise((resolve) => setTimeout(resolve, 100))

        const pngDataUrl = await toPng(cloneNode, { quality: 0.98, pixelRatio: 2, width: 1000, height: 773 })
        document.body.removeChild(container)

        const page = pdfDoc.addPage([792, 612]) // US Letter Landscape
        const pngImage = await pdfDoc.embedPng(pngDataUrl)

        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: 792,
          height: 612
        })
      }

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      const downloadUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `Diplomas_Masivos_${(taller.name || 'Taller').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      link.click()
      URL.revokeObjectURL(downloadUrl)

    } catch (err) {
      console.error('Error generating mass PDF diplomas:', err)
      alert('Ocurrió un error al generar el PDF masivo de diplomas.')
    } finally {
      setIsGenerating(false)
      setActiveRenderItem(null)
    }
  }

  if (!isOpen) return null

  const fontClass = template.fontFamily === 'serif' ? 'font-serif' : 'font-sans'
  const isBonssTheme = template.theme === 'bonss-diagonal'
  const currentSignatures = activeRenderItem?.role === 'instructor'
    ? (template.instructorSignatures && template.instructorSignatures.length > 0 ? template.instructorSignatures : DEFAULT_INSTRUCTOR_SIGNATURES())
    : (template.signatures || DEFAULT_SIGNATURES(taller.professor))

  return (
    <Modal open={isOpen} onClose={onClose} title="Descarga Masiva de Diplomas en PDF">
      <div className="space-y-6">
        
        {/* Hidden active render canvas for offscreen html-to-image capture */}
        {activeRenderItem && (
          <div className="fixed top-[-9999px] left-[-9999px] z-[-9999]">
            <div 
              id="mass-diploma-active-canvas"
              className={`w-[1000px] h-[773px] relative flex flex-col justify-between select-none overflow-hidden transition-all bg-white ${fontClass}`}
              style={{ boxSizing: 'border-box' }}
            >
              {/* Central Spine Watermark */}
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
                <div className="absolute inset-3 border-2 border-[#C5A059] pointer-events-none opacity-80 z-10" />
              )}

              {/* TOP HEADER LOGOS */}
              <div className="flex justify-between items-start z-10 w-full p-8">
                <div className="h-20 w-52 flex items-center justify-start">
                  {template.logo1 && <img src={template.logo1} alt="Logo 1" className="max-h-20 max-w-full object-contain filter drop-shadow-xs" />}
                </div>
                <div className="h-20 w-52 flex items-center justify-end">
                  {template.logo2 && <img src={template.logo2} alt="Logo 2" className="max-h-20 max-w-full object-contain" />}
                </div>
              </div>

              {/* MAIN BODY CONTENT */}
              <div className="flex flex-col items-center text-center z-10 w-full px-12 space-y-3 -mt-4">
                <h2 className="text-5xl font-serif font-black uppercase tracking-wider text-gray-900 leading-tight">
                  {activeRenderItem.role === 'instructor' ? (template.instructorTitle || 'RECONOCIMIENTO') : (template.title || 'CERTIFICADO')}
                </h2>
                <h3 className="text-xl font-serif font-bold uppercase tracking-widest text-gray-800 -mt-1">
                  DE RECONOCIMIENTO
                </h3>
                <p className="text-sm italic text-gray-600 font-serif my-2">
                  {activeRenderItem.role === 'instructor' ? (template.instructorPresentation || 'Bonss Medical y Arthromed Academy otorgan la presente CONSTANCIA a:') : (template.presentation || 'Bonss Medical otorga el reconocimiento a:')}
                </p>
                <div className="w-full flex flex-col items-center py-1">
                  <h3 className="text-3xl md:text-4xl font-serif font-bold tracking-tight text-gray-950 border-b-2 border-gray-900 pb-1.5 px-8 inline-block max-w-3xl">
                    {activeRenderItem.name}
                  </h3>
                </div>
                <div className="max-w-3xl space-y-1.5 mt-2">
                  <p className="text-sm leading-relaxed text-gray-800 font-serif font-normal">
                    {replacePlaceholders(
                      activeRenderItem.role === 'instructor' ? (template.instructorBodyText || 'Por su invaluable contribución y destacada participación como PROFESOR / INSTRUCTOR en el') : template.bodyText,
                      activeRenderItem.name
                    )} <span className="font-bold text-gray-950">"{taller.name}"</span>.
                  </p>
                </div>
              </div>

              {/* SIGNATURES SECTION */}
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

              {/* FOOTER SECTION */}
              <div className="flex justify-between items-end px-10 pb-6 z-10 w-full font-sans">
                <div className="flex items-center gap-3 bg-white/90 p-2 border border-gray-200 rounded-xl shadow-xs">
                  <QRCodeSVG 
                    value={getVerificationUrl(activeRenderItem.name)} 
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

                <div className="h-24 w-56 flex items-center justify-end">
                  {template.logo3 && <img src={template.logo3} alt="Logo 3" className="max-h-24 max-w-full object-contain filter drop-shadow-xs" />}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Selection Form */}
        <div className="space-y-4 font-sans">
          <p className="text-xs text-gray-500 leading-relaxed">
            Genera y descarga un único archivo PDF que contiene todos los diplomas seleccionados (1 página por cada diploma en formato horizontal para impresión).
          </p>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">Seleccionar grupo a incluir en el PDF:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setTargetType('students')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${targetType === 'students' ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs mb-1">
                  <GraduationCap size={16} />
                  <span>Asistentes</span>
                </div>
                <span className="text-xs font-semibold text-gray-900">{enrolledClients.length} Alumnos</span>
              </button>

              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setTargetType('instructors')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${targetType === 'instructors' ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-1.5 text-amber-700 font-bold text-xs mb-1">
                  <UserCheck size={16} />
                  <span>Instructores</span>
                </div>
                <span className="text-xs font-semibold text-gray-900">{instructorNames.length} Docentes</span>
              </button>

              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setTargetType('all')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${targetType === 'all' ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs mb-1">
                  <Layers size={16} />
                  <span>Todos</span>
                </div>
                <span className="text-xs font-semibold text-gray-900">{enrolledClients.length + instructorNames.length} Diplomas</span>
              </button>
            </div>
          </div>

          {/* Progress Card during batch generation */}
          {isGenerating && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                  <span>Generando diplomas en PDF masivo...</span>
                </div>
                <span className="text-xs font-bold text-blue-700 font-mono">
                  {progressIndex} / {totalCount} ({Math.round((progressIndex / Math.max(1, totalCount)) * 100)}%)
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-200" 
                  style={{ width: `${Math.round((progressIndex / Math.max(1, totalCount)) * 100)}%` }} 
                />
              </div>

              <p className="text-[11px] text-blue-800 truncate italic">
                Procesando: <strong className="font-semibold">{currentRecipientName}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Modal Action Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            disabled={isGenerating}
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isGenerating || getRecipientItems().length === 0}
            onClick={handleGenerateMassPdf}
            className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-2"
          >
            {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span>Generar PDF Masivo ({getRecipientItems().length} Páginas)</span>
          </button>
        </div>

      </div>
    </Modal>
  )
}
