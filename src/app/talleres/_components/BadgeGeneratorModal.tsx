'use client'

import { useState, useRef, useEffect } from 'react'
import { toBlob } from 'html-to-image'
import { X, Loader2, Download, Printer, User, Check, Upload, Award } from 'lucide-react'
import Modal from '@/components/Modal'
import { QRCodeSVG } from 'qrcode.react'
import { createPortal } from 'react-dom'

interface Client {
  id: string
  name: string
  email_primary?: string | null
  phone?: string | null
  avatar_url?: string | null
  specialties?: string[]
}

interface Workshop {
  id: string
  name: string
  date_time: string
  professor: string
}

interface BadgeGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
  client: Client | null
  taller: Workshop | null
  onClientUpdate: (updatedClient: any) => void
}

// Compress and resize image to maximum dimensions to prevent Safari's SVG data URI length failure and DB bloat
const resizeImage = (base64Str: string, maxWidth = 300, maxHeight = 300): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = base64Str
    img.onload = () => {
      let width = img.width
      let height = img.height

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height)
          height = maxHeight
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height)
        // Export as JPEG with 0.75 quality to drastically reduce base64 length (approx 15-30KB)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      } else {
        resolve(base64Str)
      }
    }
    img.onerror = () => {
      resolve(base64Str)
    }
  })
}

export default function BadgeGeneratorModal({ isOpen, onClose, client, taller, onClientUpdate }: BadgeGeneratorModalProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Local base64 image state for the badge avatar (bypasses relative URL issues in Safari)
  const [avatarBase64, setAvatarBase64] = useState<string>('')

  // Convert client avatar_url to base64 on load to ensure Safari renders it inside canvas exports
  useEffect(() => {
    if (!isOpen || !client) {
      setAvatarBase64('')
      return
    }

    const resolveAvatar = async () => {
      if (client.avatar_url) {
        if (client.avatar_url.startsWith('data:')) {
          // If it is an existing giant base64 data url, compress it on load for Safari compatibility
          let urlToUse = client.avatar_url
          if (urlToUse.length > 150000) {
            urlToUse = await resizeImage(urlToUse, 300, 300)
          }
          setAvatarBase64(urlToUse)
        } else {
          try {
            const res = await fetch(client.avatar_url)
            if (res.ok) {
              const blob = await res.blob()
              const reader = new FileReader()
              reader.onloadend = async () => {
                const base64 = reader.result as string
                const resized = await resizeImage(base64, 300, 300)
                setAvatarBase64(resized)
              }
              reader.readAsDataURL(blob)
            }
          } catch (e) {
            console.warn('Failed to convert client avatar to base64:', e)
            setAvatarBase64(client.avatar_url) // fallback
          }
        }
      } else {
        setAvatarBase64('')
      }
    }

    resolveAvatar()
  }, [isOpen, client?.id, client?.avatar_url])

  if (!isOpen || !client || !taller) return null

  // Helper to convert date
  const getFormattedDate = () => {
    if (!taller.date_time) return 'Fecha por confirmar'
    try {
      const d = new Date(taller.date_time)
      return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch (e) {
      return taller.date_time
    }
  }

  // Handle avatar upload and convert to base64 to save directly in the DB
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const reader = new FileReader()
    reader.onloadend = async () => {
      const rawBase64 = reader.result as string
      
      // Compress and resize image to maximum 300x300 JPEG to avoid Safari SVG length limits and DB bloat
      const base64Data = await resizeImage(rawBase64, 300, 300)
      
      try {
        // Save to DB
        const res = await fetch(`/api/clients/${client.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar_url: base64Data })
        })

        if (res.ok) {
          const { data } = await res.json()
          setAvatarBase64(base64Data)
          onClientUpdate(data) // update parent page state
        } else {
          const err = await res.json()
          alert('Error al guardar la foto: ' + (err.error || 'Intenta de nuevo'))
        }
      } catch (err) {
        console.error(err)
        alert('Error al guardar la imagen')
      } finally {
        setIsUploading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // Helper to ensure all images inside a node are fully loaded and decoded before capture
  const waitForImagesToDecode = async (element: HTMLElement) => {
    const images = Array.from(element.getElementsByTagName('img'))
    await Promise.all(
      images.map((img) => {
        if (img.complete) return img.decode().catch(() => {})
        return new Promise((resolve) => {
          img.onload = () => img.decode().then(resolve).catch(resolve)
          img.onerror = resolve
        })
      })
    )
  }

  // PDF print trigger
  const handlePrint = async () => {
    // Wait for images inside the print layout to be fully decoded in the DOM
    const printNode = document.getElementById('print-badge-root')
    if (printNode) {
      await waitForImagesToDecode(printNode)
    }

    const styleEl = document.createElement('style')
    styleEl.id = 'badge-print-style'
    styleEl.innerHTML = `
      @media print {
        body.printing-badge > *:not(#print-badge-root) {
          display: none !important;
          visibility: hidden !important;
        }
        #print-badge-root {
          display: flex !important;
          visibility: visible !important;
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 10cm !important;
          height: 15cm !important;
          margin: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        #print-badge-root * {
          visibility: visible !important;
        }
        @page {
          size: 10cm 15cm;
          margin: 0;
        }
      }
    `
    document.head.appendChild(styleEl)
    document.body.classList.add('printing-badge')
    window.print()
    setTimeout(() => {
      document.body.classList.remove('printing-badge')
      styleEl.remove()
    }, 500)
  }

  // Download image PNG
  const handleDownloadPng = async () => {
    const node = document.getElementById('badge-generator-render-node')
    if (!node) return
    setIsGenerating(true)
    try {
      await new Promise(r => setTimeout(r, 200))
      
      // Wait for images to decode fully in memory to prevent blank canvas prints on Safari/iPad
      await waitForImagesToDecode(node)
      
      // Warm up WebKit cache
      try {
        await toBlob(node, { cacheBust: true })
      } catch (e) {
        // ignore
      }

      const blob = await toBlob(node, {
        pixelRatio: 2.5, // High print crispness
        cacheBust: true,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          position: 'static',
          visibility: 'visible',
        }
      })

      if (!blob) throw new Error('Blob output empty')

      const dataUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `Gafete_${client.name.trim().replace(/\s+/g, '_')}.png`
      link.href = dataUrl
      link.click()

      setTimeout(() => URL.revokeObjectURL(dataUrl), 1000)
    } catch (err) {
      console.error(err)
      alert('Error al exportar imagen.')
    } finally {
      setIsGenerating(false)
    }
  }

  const getVerificationUrl = (nameToUse: string) => {
    if (typeof window === 'undefined') return `/talleres/${taller.id}/verify?student=${encodeURIComponent(nameToUse)}`
    return `${window.location.origin}/talleres/${taller.id}/verify?student=${encodeURIComponent(nameToUse)}`
  }

  // Badge Visual Component Layout (Shared between preview and export)
  const BadgeLayout = ({ idAttr, className = "w-[320px] h-[480px]" }: { idAttr?: string; className?: string }) => (
    <div
      id={idAttr}
      className={`${className} bg-white border-2 border-gray-150 rounded-2xl flex flex-col justify-between select-none relative overflow-hidden font-sans shadow-md`}
      style={{ boxSizing: 'border-box' }}
    >
      {/* Header Accent Bar */}
      <div className="bg-slate-50 border-b border-gray-150 py-3 px-4 flex flex-col items-center justify-center text-center relative">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-sky-400 to-amber-500" />
        <img src="/logo.png" alt="Arthromed Logo" className="h-6 object-contain mb-0.5" />
        <span className="text-[7.5px] font-black uppercase tracking-[0.2em] text-[#0763a9] tracking-wider">Arthromed Academy</span>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-3 text-center">
        
        {/* Profile Picture Uploader/Display */}
        <div className="relative mb-3 group">
          <div className="w-32 h-32 rounded-full border-3 border-[#0763a9] overflow-hidden bg-gray-50 flex items-center justify-center shadow-inner relative">
            {avatarBase64 ? (
              <img src={avatarBase64} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User size={64} className="text-gray-300" />
            )}
            
            {/* Hover to upload helper inside the badge preview context */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-[10px] font-bold cursor-pointer"
            >
              <Upload size={18} className="mb-1" />
              {avatarBase64 ? 'Cambiar Foto' : 'Subir Foto'}
            </button>
          </div>

          {isUploading && (
            <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-white text-xs">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
        </div>

        {/* User Role Tag */}
        <span className="px-3 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-[9px] font-black uppercase tracking-wider mb-2">
          Asistente / Participante
        </span>

        {/* Student Name */}
        <h2 className="text-lg font-black text-gray-900 leading-tight uppercase line-clamp-2 max-w-[280px]">
          {client.name}
        </h2>

        {/* Workshop Subtext */}
        <div className="mt-2 text-left w-full bg-gray-50 p-2.5 border border-gray-150 rounded-xl max-w-[270px]">
          <span className="text-[7.5px] font-bold text-gray-400 uppercase tracking-wider block">Taller Práctico</span>
          <span className="text-[10px] font-bold text-gray-800 line-clamp-2 leading-tight">{taller.name}</span>
          <div className="flex justify-between items-center mt-1 text-[8px] text-gray-500 font-medium">
            <span>Fecha: {getFormattedDate()}</span>
            <span>Docente: {taller.professor}</span>
          </div>
        </div>

      </div>

      {/* Footer Branding & Validation QR */}
      <div className="bg-gray-50 border-t border-gray-150 p-3 flex justify-between items-center text-left">
        <div>
          <span className="text-[7.5px] font-bold text-gray-400 uppercase tracking-wider block">Validación Oficial</span>
          <span className="text-[8px] font-bold text-[#0763a9] font-mono">ID: AR-{taller.id.slice(0, 6).toUpperCase()}</span>
          <span className="text-[8.5px] font-semibold text-gray-500 block leading-tight">arthromed.com.mx</span>
        </div>

        {/* Tiny verification QR code for scanning during congress badge validation */}
        <div className="bg-white p-1 border border-gray-200 rounded-md flex items-center gap-1.5 shadow-xs shrink-0 select-none">
          <QRCodeSVG value={getVerificationUrl(client.name)} size={44} level="M" includeMargin={false} />
          <div className="text-[5.5px] font-mono leading-none text-gray-400 flex flex-col justify-center text-left max-w-[35px]">
            <span className="font-bold text-gray-500">QR</span>
            <span>VALIDAR</span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Modal open={isOpen} onClose={onClose} title="Gafete del Participante" maxWidth="450px">
        <div className="space-y-6 flex flex-col items-center">
          <p className="text-xs text-gray-500 text-center w-full">
            Sube la foto del participante e imprime su credencial oficial de Arthromed Academy.
          </p>

          {/* Hidden File Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUploadImage} 
            accept="image/*" 
            className="hidden" 
          />

          {/* Badge Preview Layout Wrapper */}
          <div className="flex justify-center p-4 bg-gray-100 rounded-3xl border border-gray-200/80 shadow-inner">
            <BadgeLayout />
          </div>

          {/* Picture Upload Button & Status */}
          <div className="flex flex-col items-center w-full gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="btn-secondary text-xs px-4 py-2 flex items-center gap-1.5 font-bold hover:bg-gray-50 shrink-0"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {avatarBase64 ? 'Reemplazar Foto del Participante' : 'Subir Foto del Participante'}
            </button>
            {!avatarBase64 && (
              <span className="text-[10px] text-amber-600 font-bold">
                ⚠️ Sube una foto para que se imprima en el gafete.
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 w-full border-t border-gray-150 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handlePrint}
                className="btn-secondary py-3 justify-center gap-2 border-gray-300 font-bold hover:bg-gray-100 flex items-center"
              >
                <Printer size={16} /> Imprimir / PDF
              </button>

              <button
                onClick={handleDownloadPng}
                disabled={isGenerating}
                className="btn-primary py-3 justify-center gap-2 font-bold flex items-center"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Descargar PNG
              </button>
            </div>
            <button
              onClick={onClose}
              className="mt-2 text-xs text-gray-400 hover:text-gray-655 text-center font-medium"
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
        <div id="badge-generator-render-node" style={{ width: '320px', height: '480px', position: 'relative' }}>
          <BadgeLayout />
        </div>
      </div>

      {/* Screen/Printer layout for printing (using Portal to place directly under body) */}
      {typeof document !== 'undefined' && createPortal(
        <div id="print-badge-root" style={{ display: 'none' }}>
          <BadgeLayout className="w-full h-full" />
        </div>,
        document.body
      )}
    </>
  )
}
