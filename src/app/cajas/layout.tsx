import type { Metadata } from 'next'
import { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Cajas',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
