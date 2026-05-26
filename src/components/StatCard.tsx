'use client'
import { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Link from 'next/link'

interface StatCardProps {
  title: string
  value: number | string
  icon: ReactNode
  trend?: number
  color?: 'blue' | 'green' | 'red' | 'amber'
  subtitle?: string
  href?: string
}

const colorMap = {
  blue:  { iconBg: '#e8f1f9', iconColor: '#0763a9', border: '#c5d9ee', accent: '#0763a9' },
  green: { iconBg: '#dcfce7', iconColor: '#15803d', border: '#bbf7d0', accent: '#15803d' },
  red:   { iconBg: '#fee2e2', iconColor: '#b91c1c', border: '#fecaca', accent: '#b91c1c' },
  amber: { iconBg: '#fef3c7', iconColor: '#b45309', border: '#fde68a', accent: '#b45309' },
}

export default function StatCard({ title, value, icon, trend, color = 'blue', subtitle, href }: StatCardProps) {
  const c = colorMap[color]
  
  const valueStr = String(value)
  const textSizeClass = valueStr.length > 12
    ? "text-lg sm:text-xl md:text-2xl lg:text-lg xl:text-xl 2xl:text-2xl"
    : valueStr.length > 9
    ? "text-xl sm:text-2xl md:text-3xl lg:text-xl xl:text-2xl"
    : "text-2xl sm:text-3xl"

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium truncate" style={{ color: '#5a5b5d' }} title={title}>{title}</p>
          <p className={`${textSizeClass} font-bold mt-0.5 sm:mt-1 truncate`} style={{ color: '#37383a' }} title={valueStr}>{value}</p>
          {subtitle && <p className="text-[10px] sm:text-xs mt-0.5 truncate" style={{ color: '#8a8b8d' }} title={subtitle}>{subtitle}</p>}
        </div>
        <div className="p-2 sm:p-3 rounded-xl shrink-0" style={{ background: c.iconBg, color: c.iconColor }}>
          {icon}
        </div>
      </div>

      {trend !== undefined && (
        <div
          className="flex items-center gap-1 text-[10px] sm:text-xs font-medium"
          style={{ color: trend > 0 ? '#15803d' : trend < 0 ? '#b91c1c' : '#8a8b8d' }}
        >
          {trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
          <span>{trend > 0 ? '+' : ''}{trend}% este mes</span>
        </div>
      )}
    </>
  )

  const commonProps = {
    className: "bg-white rounded-2xl p-3.5 sm:p-5 flex flex-col gap-2 sm:gap-3 transition-all duration-150 hover:-translate-y-0.5",
    style: { border: `1px solid ${c.border}`, boxShadow: '0 1px 4px rgba(7,99,169,0.06)' }
  }

  if (href) {
    return (
      <Link href={href} {...commonProps}>
        {content}
      </Link>
    )
  }

  return (
    <div {...commonProps}>
      {content}
    </div>
  )
}
