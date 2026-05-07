'use client'
import { useI18n } from '@/contexts/I18nContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Bell, Search } from 'lucide-react'
import Link from 'next/link'

export default function Header() {
  const { t } = useI18n()
  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-3 px-4 lg:px-6 py-3 bg-white border-b border-blue-100"
      style={{ boxShadow: '0 1px 4px rgba(7,99,169,0.06)' }}
    >
      {/* Spacer for mobile hamburger */}
      <div className="w-8 lg:hidden" />

      {/* Search bar */}
      <Link
        href="/clients"
        className="flex-1 max-w-md flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-100 bg-blue-50/60 text-sm transition-colors hover:border-brand-500/40"
        style={{ color: '#8a8b8d' }}
      >
        <Search size={15} />
        <span className="hidden sm:block">{t('search')}</span>
      </Link>

      <div className="flex items-center gap-2 ml-auto">
        <LanguageSwitcher />
        <button
          className="p-2 rounded-xl transition-colors hover:bg-blue-50"
          style={{ color: '#5a5b5d' }}
          aria-label="Notificaciones"
        >
          <Bell size={18} />
        </button>
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: '#0763a9' }}
        >
          A
        </div>
      </div>
    </header>
  )
}
