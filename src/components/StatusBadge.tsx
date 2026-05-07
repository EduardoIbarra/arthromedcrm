'use client'
import { ClientStatus } from '@/types/database'
import { useI18n } from '@/contexts/I18nContext'

interface StatusBadgeProps {
  status: ClientStatus | string
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const { t } = useI18n()

  const map: Record<string, { cls: string; label: string; dot: string }> = {
    Activo:            { cls: 'badge-active',   label: t('activo'),         dot: '#15803d' },
    Inactivo:          { cls: 'badge-inactive', label: t('inactivo'),       dot: '#b91c1c' },
    'Nuevo Prospecto': { cls: 'badge-prospect', label: t('nuevoProspecto'), dot: '#b45309' },
    Contactado:        { cls: 'badge-prospect', label: t('contactado'),     dot: '#b45309' },
    Calificado:        { cls: 'badge-prospect', label: t('calificado'),     dot: '#b45309' },
    'Negociación':     { cls: 'badge-prospect', label: t('negociacion'),    dot: '#b45309' },
    Perdido:           { cls: 'badge-inactive', label: t('perdido'),        dot: '#b91c1c' },
    Prospecto:         { cls: 'badge-prospect', label: t('prospecto'),      dot: '#b45309' },
  }

  const info = map[status] ?? { cls: 'badge-prospect', label: status, dot: '#b45309' }
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${info.cls} ${padding}`}>
      <span className={`w-1.5 h-1.5 rounded-full`} style={{ background: info.dot }} />
      {info.label}
    </span>
  )
}
