'use client'
import { useEffect, useState, Suspense } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { CheckCircle, Info, ExternalLink, Copy, Check } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

function QRContent() {
  const searchParams = useSearchParams()
  const congressId = searchParams.get('congressId')

  const [baseUrl, setBaseUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [congressName, setCongressName] = useState<string | null>(null)

  useEffect(() => {
    setBaseUrl(window.location.origin)
  }, [])

  useEffect(() => {
    if (congressId) {
      fetch(`/api/congresos/${congressId}`)
        .then(res => res.json())
        .then(res => {
          if (res.data) setCongressName(res.data.name)
        })
        .catch(console.error)
    }
  }, [congressId])

  const registrationUrl = baseUrl
    ? `${baseUrl}/registro${congressId ? `?congressId=${congressId}` : ''}`
    : ''

  const copyToClipboard = () => {
    if (!registrationUrl) return
    navigator.clipboard.writeText(registrationUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-[100dvh] bg-linear-to-br from-[#f0f5fa] via-[#dceaf5] to-[#c5d9ee] relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated background blobs - matching registro page */}
      <div className="fixed rounded-full blur-[80px] opacity-35 pointer-events-none z-0 w-[500px] h-[500px] bg-radial from-[#9bbfdf] to-[#0763a9] -top-20 -right-20 animate-[pulse_12s_infinite_alternate]" />
      <div className="fixed rounded-full blur-[80px] opacity-35 pointer-events-none z-0 w-[400px] h-[400px] bg-radial from-[#c5d9ee] to-[#3d8bbf] -bottom-15 -left-15 animate-[pulse_16s_infinite_alternate-reverse]" />

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-8 py-12">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4"
        >
          <Image
            src="https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png"
            alt="Arthromed Logo"
            width={480}
            height={160}
            className="h-32 w-auto object-contain"
            priority
          />
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="w-full bg-white border border-[#d4e0ec] rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-[#0763a9]/10 flex flex-col items-center text-center"
        >
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#37383a] leading-tight tracking-tight mb-3">
              Registro de Médicos
            </h1>
            {congressName && (
              <h2 className="text-xl md:text-2xl font-bold text-[#0763a9] leading-tight tracking-tight mb-3">
                {congressName}
              </h2>
            )}
            <p className="text-[#5a5b5d] text-lg max-w-md mx-auto leading-relaxed">
              Escanee el código QR para acceder al formulario de registro y recibir información especializada.
            </p>
          </div>

          {/* QR Code Container */}
          <div className="relative p-6 bg-white border-4 border-[#0763a9]/10 rounded-3xl shadow-inner mb-8 group">
            {registrationUrl ? (
              <div className="bg-white p-4 rounded-2xl shadow-sm">
                <QRCodeSVG
                  value={registrationUrl}
                  size={256}
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: "https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png",
                    x: undefined,
                    y: undefined,
                    height: 30,
                    width: 90,
                    excavate: true,
                  }}
                />
              </div>
            ) : (
              <div className="w-[256px] h-[256px] flex items-center justify-center bg-[#f8fafd] rounded-2xl animate-pulse">
                <div className="w-12 h-12 border-4 border-[#0763a9]/20 border-t-[#0763a9] rounded-full animate-spin" />
              </div>
            )}

            {/* Visual scan indicators */}
            <div className="absolute -top-2 -left-2 w-8 h-8 border-t-4 border-l-4 border-[#0763a9] rounded-tl-lg" />
            <div className="absolute -top-2 -right-2 w-8 h-8 border-t-4 border-r-4 border-[#0763a9] rounded-tr-lg" />
            <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-4 border-l-4 border-[#0763a9] rounded-bl-lg" />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-4 border-r-4 border-[#0763a9] rounded-br-lg" />
          </div>

          {/* Information Badges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-md mb-8">
            <div className="flex items-center gap-3 px-4 py-3 bg-[#f8fafd] border border-[#e8f1f9] rounded-2xl text-left">
              <div className="w-8 h-8 bg-[#e8f1f9] rounded-full flex items-center justify-center text-[#0763a9] flex-shrink-0">
                <CheckCircle size={16} />
              </div>
              <span className="text-xs font-bold text-[#37383a] uppercase tracking-wide">Rápido y Seguro</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 bg-[#f8fafd] border border-[#e8f1f9] rounded-2xl text-left">
              <div className="w-8 h-8 bg-[#e8f1f9] rounded-full flex items-center justify-center text-[#0763a9] flex-shrink-0">
                <Info size={16} />
              </div>
              <span className="text-xs font-bold text-[#37383a] uppercase tracking-wide">Asesoría Personal</span>
            </div>
          </div>

          {/* Footer Link / Copy */}
          <div className="flex flex-col items-center gap-4 w-full border-t border-[#f0f5fa] pt-8">
            <p className="text-xs text-[#8a8b8d] font-medium uppercase tracking-widest">O use este enlace directo:</p>
            <div className="flex items-center gap-2 w-full max-w-sm">
              <div className="flex-1 bg-[#f8fafd] border border-[#d4e0ec] rounded-xl px-4 py-2.5 text-sm font-mono text-[#5a5b5d] truncate">
                {registrationUrl || 'Cargando...'}
              </div>
              <button
                onClick={copyToClipboard}
                className={`p-2.5 rounded-xl border-2 transition-all flex-shrink-0 ${copied
                  ? 'bg-[#dcfce7] border-[#bbf7d0] text-[#15803d]'
                  : 'bg-white border-[#d4e0ec] text-[#5a5b5d] hover:border-[#0763a9] hover:text-[#0763a9]'
                  }`}
                title="Copiar enlace"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
              <a
                href={`/registro${congressId ? `?congressId=${congressId}` : ''}`}
                className="p-2.5 bg-[#0763a9] text-white rounded-xl shadow-md shadow-[#0763a9]/20 hover:bg-[#054d85] transition-all flex-shrink-0"
                title="Abrir página"
              >
                <ExternalLink size={18} />
              </a>
            </div>
          </div>
        </motion.div>

        {/* Brand Slogan */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col items-center gap-2 text-center"
        >
          <p className="text-[#0763a9] font-bold tracking-[0.2em] uppercase text-[10px]">
            Arthromed — Equipo de Alto Rendimiento
          </p>
          <div className="w-12 h-1 bg-[#0763a9]/20 rounded-full" />
        </motion.div>
      </div>
    </div>
  )
}

export default function QRPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>}>
      <QRContent />
    </Suspense>
  )
}
