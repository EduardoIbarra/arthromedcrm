'use client'
import { useI18n } from '@/contexts/I18nContext'
import { Locale } from '@/lib/i18n'
import { Globe } from 'lucide-react'

const LOCALES: { code: Locale; flag: string; label: string }[] = [
  { code: 'es', flag: '🇲🇽', label: 'ES' },
  { code: 'en', flag: '🇺🇸', label: 'EN' },
  { code: 'zh', flag: '🇨🇳', label: '中' },
]

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()
  return (
    <div className="flex items-center gap-0.5 bg-blue-50 rounded-xl p-1 border border-blue-100">
      <Globe size={13} className="ml-1 mr-0.5" style={{ color: '#8a8b8d' }} />
      {LOCALES.map((l) => (
        <button
          key={l.code}
          onClick={() => setLocale(l.code)}
          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
            locale === l.code
              ? 'bg-white shadow-sm text-brand-600 border border-blue-200'
              : 'text-dark-500 hover:text-dark'
          }`}
          style={locale === l.code ? { color: '#0763a9' } : { color: '#5a5b5d' }}
          aria-label={`Switch to ${l.label}`}
        >
          {l.flag} {l.label}
        </button>
      ))}
    </div>
  )
}
