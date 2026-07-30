'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Award } from 'lucide-react'
import AppShell from '@/components/AppShell'
import DiplomaBuilder from '../../_components/DiplomaBuilder'

export default function DiplomaDesignerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const workshopId = resolvedParams.id
  const router = useRouter()

  const [taller, setTaller] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadWorkshop() {
      try {
        setIsLoading(true)
        const res = await fetch(`/api/workshops/${workshopId}`)
        if (!res.ok) {
          throw new Error('No se pudo cargar la información del taller.')
        }
        const data = await res.json()
        setTaller(data)
      } catch (err: any) {
        console.error('Error loading workshop for diploma designer:', err)
        setError(err.message || 'Error al cargar el taller.')
      } finally {
        setIsLoading(false)
      }
    }
    if (workshopId) {
      loadWorkshop()
    }
  }, [workshopId])

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 max-w-7xl mx-auto flex justify-center items-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-sm font-semibold text-gray-500">Cargando diseñador de diploma...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (error || !taller) {
    return (
      <AppShell>
        <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700">
            <p className="font-bold text-base">{error || 'Taller no encontrado'}</p>
          </div>
          <Link href="/talleres" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft size={16} /> Volver a Talleres
          </Link>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="min-h-[calc(100vh-80px)] flex flex-col bg-gray-50/50 p-4 lg:p-6 space-y-4">
        {/* Header toolbar */}
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-xs">
          <div className="flex items-center gap-3">
            <Link
              href="/talleres"
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
              title="Volver a talleres"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Award size={20} />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">
                  Diseñador de Diploma
                </h1>
                <p className="text-xs text-gray-500 font-medium">
                  {taller.name}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/talleres" className="btn-secondary text-xs py-2 px-3">
              Volver a Lista
            </Link>
          </div>
        </div>

        {/* Full workspace */}
        <div className="flex-1 bg-white border border-gray-200 rounded-3xl p-4 lg:p-6 shadow-sm overflow-hidden">
          <DiplomaBuilder
            isOpen={true}
            onClose={() => router.push('/talleres')}
            isFullPage={true}
            taller={{
              id: taller.id,
              name: taller.name,
              date_time: taller.date_time,
              professor: taller.professor || taller.professor_name || '',
              diploma_template: taller.diploma_template
            }}
            onSave={(updatedTemplate) => {
              setTaller((prev: any) => ({ ...prev, diploma_template: updatedTemplate }))
            }}
          />
        </div>
      </div>
    </AppShell>
  )
}
