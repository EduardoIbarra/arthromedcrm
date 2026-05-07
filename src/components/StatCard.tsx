'use client'
import { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  title: string
  value: number | string
  icon: ReactNode
  trend?: number
  color?: 'blue' | 'green' | 'red' | 'amber'
  subtitle?: string
}

const colorMap = {
  blue:  { iconBg: '#e8f1f9', iconColor: '#0763a9', border: '#c5d9ee', accent: '#0763a9' },
  green: { iconBg: '#dcfce7', iconColor: '#15803d', border: '#bbf7d0', accent: '#15803d' },
  red:   { iconBg: '#fee2e2', iconColor: '#b91c1c', border: '#fecaca', accent: '#b91c1c' },
  amber: { iconBg: '#fef3c7', iconColor: '#b45309', border: '#fde68a', accent: '#b45309' },
}

export default function StatCard({ title, value, icon, trend, color = 'blue', subtitle }: StatCardProps) {
  const c = colorMap[color]
  return (
    <div
      className="bg-white rounded-2xl p-5 flex flex-col gap-3 transition-all duration-150 hover:-translate-y-0.5"
      style={{ border: `1px solid ${c.border}`, boxShadow: '0 1px 4px rgba(7,99,169,0.06)' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: '#5a5b5d' }}>{title}</p>
          <p className="text-3xl font-bold mt-1" style={{ color: '#37383a' }}>{value}</p>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: '#8a8b8d' }}>{subtitle}</p>}
        </div>
        <div className="p-3 rounded-xl" style={{ background: c.iconBg, color: c.iconColor }}>
          {icon}
        </div>
      </div>

      {trend !== undefined && (
        <div
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: trend > 0 ? '#15803d' : trend < 0 ? '#b91c1c' : '#8a8b8d' }}
        >
          {trend > 0 ? <TrendingUp size={13} /> : trend < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
          <span>{trend > 0 ? '+' : ''}{trend}% este mes</span>
        </div>
      )}
    </div>
  )
}
