'use client'

import { useCurrency } from '@/contexts/CurrencyContext'
import { DollarSign } from 'lucide-react'

const CURRENCIES = [
  { code: 'MXN' as const, flag: '🇲🇽', label: 'MXN' },
  { code: 'USD' as const, flag: '🇺🇸', label: 'USD' },
]

export default function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency()
  return (
    <div className="flex items-center gap-0.5 bg-blue-50 rounded-xl p-1 border border-blue-100">
      <DollarSign size={13} className="ml-1 mr-0.5" style={{ color: '#8a8b8d' }} />
      {CURRENCIES.map((c) => (
        <button
          key={c.code}
          onClick={() => setCurrency(c.code)}
          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
            currency === c.code
              ? 'bg-white shadow-sm text-brand-600 border border-blue-200'
              : 'text-dark-500 hover:text-dark'
          }`}
          style={currency === c.code ? { color: '#0763a9' } : { color: '#5a5b5d' }}
          aria-label={`Switch to ${c.label}`}
        >
          {c.flag} {c.label}
        </button>
      ))}
    </div>
  )
}
