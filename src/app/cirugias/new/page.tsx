'use client'

import { Suspense } from 'react'
import CirugiaDetailContent from '../_components/CirugiaDetailContent'

function NewCirugiaFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )
}

export default function NewCirugiaPage() {
  return (
    <Suspense fallback={<NewCirugiaFallback />}>
      <CirugiaDetailContent cirugiaId={null} />
    </Suspense>
  )
}
