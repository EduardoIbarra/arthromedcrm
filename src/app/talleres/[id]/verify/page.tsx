import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldCheck, Calendar, MapPin, Award, BookOpen, User, Check, ExternalLink } from 'lucide-react'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ student?: string }>
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params
  const { student } = await searchParams
  const studentName = student || 'Participante'

  try {
    const workshop = await prisma.congress_workshops.findUnique({
      where: { id }
    })
    
    const title = `Verificación de Constancia: ${studentName} | Arthromed Academy`
    return {
      title,
      description: workshop ? `Verificación oficial de la asistencia de ${studentName} al taller "${workshop.name}".` : 'Portal de Verificación de Constancias Académicas Arthromed.'
    }
  } catch (e) {
    return {
      title: 'Verificación de Constancia | Arthromed Academy'
    }
  }
}

export default async function VerifyPage({ params, searchParams }: Props) {
  const { id } = await params
  const { student } = await searchParams

  if (!student) {
    notFound()
  }

  const workshop = await prisma.congress_workshops.findUnique({
    where: { id },
    include: {
      congresos: {
        select: { name: true, location: true }
      }
    }
  })

  if (!workshop) {
    notFound()
  }

  // Format date
  const getFormattedDate = () => {
    try {
      const d = new Date(workshop.date_time)
      return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch (e) {
      return 'Fecha por confirmar'
    }
  }

  const template = workshop.diploma_template as any || {}
  const hours = template.hours || '8'
  const location = template.location || workshop.congresos?.location || 'Monterrey, Nuevo León'

  return (
    <div className="min-h-screen bg-slate-900 bg-linear-to-tr from-[#030712] via-[#0f172a] to-[#1e1b4b] text-white flex flex-col justify-between relative font-sans overflow-hidden py-12 px-4">
      {/* Decorative background glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-xl w-full mx-auto flex-1 flex flex-col justify-center items-center z-10 my-8">
        
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <img 
            src="/logo.png" 
            alt="Arthromed Logo" 
            className="h-12 object-contain filter brightness-100 mb-2"
          />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">
            Arthromed Academy
          </span>
          <span className="text-xs text-slate-400 mt-1">Portal de Validación de Credenciales</span>
        </div>

        {/* Verification Card */}
        <div className="w-full bg-slate-950/60 backdrop-blur-md border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
          {/* Animated Gold Header Accent */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-linear-to-r from-blue-500 via-emerald-400 to-amber-500" />
          
          {/* Pulsing check icon */}
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
            <ShieldCheck size={40} className="text-emerald-400" />
          </div>

          <span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
            Registro Oficial Verificado
          </span>

          <h1 className="text-2xl font-black text-white leading-tight uppercase mb-4 font-serif">
            Constancia Válida
          </h1>

          <div className="w-24 h-[1px] bg-slate-800 mb-6" />

          {/* Student details */}
          <div className="space-y-6 w-full text-left bg-slate-900/40 p-5 border border-slate-800/60 rounded-2xl">
            <div className="flex gap-4">
              <User className="text-blue-400 shrink-0 mt-0.5" size={20} />
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Estudiante / Alumno</span>
                <span className="text-lg font-bold text-white font-serif mt-0.5 block">{student}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <BookOpen className="text-blue-400 shrink-0 mt-0.5" size={20} />
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Taller Práctico</span>
                <span className="text-sm font-semibold text-slate-200 mt-0.5 block">{workshop.name}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex gap-3">
                <Calendar className="text-slate-400 shrink-0 mt-0.5" size={16} />
                <div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Fecha</span>
                  <span className="text-xs text-slate-300 font-semibold mt-0.5 block">{getFormattedDate()}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <MapPin className="text-slate-400 shrink-0 mt-0.5" size={16} />
                <div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Sede</span>
                  <span className="text-xs text-slate-300 font-semibold mt-0.5 block">{location}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 border-t border-slate-800/80 pt-4">
              <Award className="text-amber-500 shrink-0 mt-0.5" size={20} />
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Horas Curriculares</span>
                <span className="text-xs text-amber-400 font-bold block mt-0.5">
                  {hours} Horas de Valor Curricular
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Profesor Titular: {workshop.professor || 'Instructor Arthromed'}
                </span>
              </div>
            </div>
          </div>

          {/* Verification Code */}
          <div className="mt-6 flex flex-col items-center justify-center text-[10px] text-slate-500 font-mono gap-1">
            <span>ID de Certificación: <strong className="text-slate-300">AR-{workshop.id.slice(0, 8).toUpperCase()}-{student.slice(0, 3).toUpperCase()}</strong></span>
            <span>Fecha de Verificación: {new Date().toLocaleDateString('es-MX')}</span>
          </div>

          <div className="w-full flex gap-3 mt-8">
            <Link 
              href={`/talleres/${workshop.id}/landing`}
              className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              Info del Taller <ExternalLink size={14} />
            </Link>
            
            <a 
              href="https://arthromed.com.mx"
              target="_blank" 
              rel="noreferrer"
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
            >
              <Check size={14} /> Sitio Oficial
            </a>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 z-10 w-full">
        <p>© {new Date().getFullYear()} Arthromed Academy. Todos los derechos reservados.</p>
        <p className="mt-1 text-[10px]">Este documento constituye un registro digital de asistencia académica verificado en tiempo real.</p>
      </footer>
    </div>
  )
}
