import { Metadata } from 'next'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Wrench, Calendar, Clock, CheckCircle2, AlertCircle, Shield, User, FileText } from 'lucide-react'

const STATUS_FLOW = [
  { value: 'recibido', label: 'Recibido', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { value: 'en_revision', label: 'En revisión', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  { value: 'aprobado', label: 'Aprobado', color: 'text-teal-700 bg-teal-50 border-teal-200' },
  { value: 'rechazado', label: 'Rechazado', color: 'text-red-700 bg-red-50 border-red-200' },
  { value: 'en_reparacion', label: 'En reparación', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  { value: 'completado', label: 'Completado', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { value: 'entregado', label: 'Entregado / Devuelto', color: 'text-gray-700 bg-gray-50 border-gray-200' },
]

function getStatusDetails(status: string) {
  return STATUS_FLOW.find(s => s.value === status) || {
    value: status,
    label: status,
    color: 'text-gray-700 bg-gray-100 border-gray-200'
  }
}

function formatDate(dateString: Date | string | null) {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const warranty = await prisma.garantias.findUnique({
    where: { id }
  })

  if (!warranty) {
    return { title: 'Garantía No Encontrada' }
  }

  const statusLabel = getStatusDetails(warranty.estado).label
  const title = `Garantía: ${warranty.producto_nombre}`
  const description = `Estado: ${statusLabel} | Cliente: ${warranty.cliente_nombre}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      title,
      description,
      card: 'summary',
    }
  }
}

export default async function WarrantyViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const warranty = await prisma.garantias.findUnique({
    where: { id }
  })

  if (!warranty) {
    notFound()
  }

  const statusInfo = getStatusDetails(warranty.estado)

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 sm:p-8 font-sans animate-fade-in">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden relative">
        {/* Header Decorator */}
        <div className="h-32 w-full bg-gradient-to-r from-brand-600 to-brand-400 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        </div>
        
        <div className="px-8 pb-8 pt-0 relative">
          {/* Floating Icon */}
          <div className="w-20 h-20 bg-white rounded-2xl shadow-md border border-gray-50 flex items-center justify-center absolute -top-10 left-8">
            <div className="w-16 h-16 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
              <Shield size={32} />
            </div>
          </div>

          <div className="pt-16 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-wider text-brand-500 uppercase mb-1">Registro de Garantía</p>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{warranty.producto_nombre}</h1>
              {warranty.modelo && (
                <p className="text-gray-500 font-medium mt-1">Modelo: <span className="text-gray-700">{warranty.modelo}</span></p>
              )}
            </div>
            <div className="shrink-0">
              <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold border ${statusInfo.color} shadow-sm`}>
                {statusInfo.label}
              </span>
            </div>
          </div>

          <div className="h-px w-full bg-gray-100 my-8"></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* Detalles principales */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <User size={16} />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Cliente</h3>
                </div>
                <p className="text-gray-900 font-medium text-lg">{warranty.cliente_nombre}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <Calendar size={16} />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Fecha de Recepción</h3>
                </div>
                <p className="text-gray-900 font-medium">{formatDate(warranty.fecha_recepcion)}</p>
              </div>

              {warranty.numero_serie && (
                <div>
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <AlertCircle size={16} />
                    <h3 className="text-xs font-bold uppercase tracking-wider">Número de Serie</h3>
                  </div>
                  <p className="text-gray-900 font-mono bg-gray-50 inline-block px-2 py-0.5 rounded border border-gray-100">{warranty.numero_serie}</p>
                </div>
              )}
            </div>

            {/* Falla y Notas */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <Wrench size={16} />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Descripción de la falla</h3>
                </div>
                <div className="bg-orange-50 text-orange-900 p-4 rounded-2xl border border-orange-100/50 leading-relaxed text-sm shadow-sm">
                  {warranty.descripcion_falla}
                </div>
              </div>

              {warranty.diagnostico && (
                <div>
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <FileText size={16} />
                    <h3 className="text-xs font-bold uppercase tracking-wider">Diagnóstico</h3>
                  </div>
                  <div className="bg-gray-50 text-gray-700 p-4 rounded-2xl border border-gray-100 leading-relaxed text-sm">
                    {warranty.diagnostico}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-10 flex justify-center">
             <div className="text-center text-xs text-gray-400">
               <p>Desarrollado por Arthromed ERP</p>
               <p>Sistema interno de garantías</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
