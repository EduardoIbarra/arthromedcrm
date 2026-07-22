import { Suspense } from 'react'
import TallerForm from '../_components/TallerForm'
import AppShell from '@/components/AppShell'

export default function NewTallerPage() {
  return (
    <Suspense fallback={
      <AppShell>
        <div className="p-8 max-w-7xl mx-auto flex justify-center items-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-[#0763a9] rounded-full animate-spin" />
            <p className="text-sm font-semibold text-gray-500">Cargando taller...</p>
          </div>
        </div>
      </AppShell>
    }>
      <TallerForm tallerId={null} />
    </Suspense>
  )
}
