'use client'
import { ReactNode } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: '#f0f5fa' }}>
      <Sidebar />
      <div className="lg:ml-60 flex flex-col min-h-screen transition-[margin] duration-300">
        <Header />
        <main className="flex-1 p-4 lg:p-6 pt-16 lg:pt-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}
