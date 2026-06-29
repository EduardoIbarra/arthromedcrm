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
    <div className="min-h-screen bg-[#f0f5fa] text-gray-800 flex flex-col justify-between relative font-sans py-12 px-4">
      {/* Main Container */}
      <div className="max-w-xl w-full mx-auto flex-1 flex flex-col justify-center items-center z-10 my-8">
        
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <img 
            src="/logo.png" 
            alt="Arthromed Logo" 
            className="h-10 object-contain mb-2"
          />
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#0763a9]">
            Arthromed Academy
          </span>
          <span className="text-[11px] text-gray-500 mt-1">Portal de Validación de Credenciales</span>
        </div>

        {/* Verification Card */}
        <div className="w-full bg-white border border-gray-200/80 rounded-3xl p-8 shadow-xl relative overflow-hidden flex flex-col items-center text-center">
          {/* Top colored accent line */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 via-sky-500 to-amber-500" />
          
          {/* Pulsing check icon */}
          <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center mb-5 relative">
            <ShieldCheck size={40} className="text-emerald-600" />
          </div>

          <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2">
            Registro Oficial Verificado
          </span>

          <h1 className="text-2xl font-black text-gray-900 leading-tight uppercase mb-4 font-serif">
            Constancia Válida
          </h1>

          <div className="w-24 h-[1px] bg-gray-200 mb-6" />

          {/* Student details */}
          <div className="space-y-5 w-full text-left bg-gray-50 p-5 border border-gray-150 rounded-2xl">
            <div className="flex gap-4">
              <User className="text-[#0763a9] shrink-0 mt-0.5" size={20} />
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Estudiante / Alumno</span>
                <span className="text-base font-bold text-gray-900 font-serif mt-0.5 block">{student}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <BookOpen className="text-[#0763a9] shrink-0 mt-0.5" size={20} />
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Taller Práctico</span>
                <span className="text-sm font-semibold text-gray-800 mt-0.5 block">{workshop.name}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex gap-3">
                <Calendar className="text-gray-400 shrink-0 mt-0.5" size={16} />
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Fecha</span>
                  <span className="text-xs text-gray-700 font-semibold mt-0.5 block">{getFormattedDate()}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <MapPin className="text-gray-400 shrink-0 mt-0.5" size={16} />
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Sede</span>
                  <span className="text-xs text-gray-700 font-semibold mt-0.5 block">{location}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 border-t border-gray-200/80 pt-4">
              <Award className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Horas Curriculares</span>
                <span className="text-xs text-amber-700 font-bold block mt-0.5">
                  {hours} Horas de Valor Curricular
                </span>
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  Profesor Titular: {workshop.professor || 'Instructor Arthromed'}
                </span>
              </div>
            </div>
          </div>

          {/* Verification Code */}
          <div className="mt-6 flex flex-col items-center justify-center text-[10px] text-gray-400 font-mono gap-0.5">
            <span>ID de Certificación: <strong className="text-gray-700">AR-{workshop.id.slice(0, 8).toUpperCase()}-{student.slice(0, 3).toUpperCase()}</strong></span>
            <span>Fecha de Verificación: {new Date().toLocaleDateString('es-MX')}</span>
          </div>

          <div className="w-full flex gap-3 mt-8">
            <Link 
              href={`/talleres/${workshop.id}/landing`}
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              Info del Taller <ExternalLink size={14} />
            </Link>
            
            <a 
              href="https://arthromed.com.mx"
              target="_blank" 
              rel="noreferrer"
              className="flex-1 px-4 py-2.5 bg-[#0763a9] hover:bg-[#06528c] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
            >
              <Check size={14} /> Sitio Oficial
            </a>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 z-10 w-full mt-4">
        <p>© {new Date().getFullYear()} Arthromed Academy. Todos los derechos reservados.</p>
        <p className="mt-1 text-[10px] text-gray-400">Este documento constituye un registro digital de asistencia académica verificado en tiempo real.</p>
      </footer>
    </div>
  )
}
