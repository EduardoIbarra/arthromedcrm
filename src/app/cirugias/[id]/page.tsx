'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import CirugiaDetailContent from '../_components/CirugiaDetailContent'

function CirugiaDetailFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )
}

function CirugiaDetailInner() {
  const params = useParams()
  const id = params?.id as string
  return <CirugiaDetailContent cirugiaId={id} />
}

export default function CirugiaDetailPage() {
  return (
    <Suspense fallback={<CirugiaDetailFallback />}>
      <CirugiaDetailInner />
    </Suspense>
  )
}
