import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { I18nProvider } from '@/contexts/I18nContext'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Arthromed ERP',
  description: 'Sistema de gestión de distribuidores para Arthromed — equipo médico de alto rendimiento',
  keywords: ['ERP', 'Arthromed', 'distribuidores', 'equipo médico', 'México'],
  authors: [{ name: 'Arthromed' }],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="antialiased">
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
