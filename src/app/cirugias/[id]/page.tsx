'use client'

import { useParams } from 'next/navigation'
import CirugiaDetailContent from '../_components/CirugiaDetailContent'

export default function CirugiaDetailPage() {
  const params = useParams()
  const id = params?.id as string
  return <CirugiaDetailContent cirugiaId={id} />
}
