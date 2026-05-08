'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import {
  LayoutDashboard, Users, UserPlus, Upload, Settings,
  ChevronLeft, ChevronRight, Menu, X,
} from 'lucide-react'
import { useI18n } from '@/contexts/I18nContext'

export default function Sidebar() {
  const { t } = useI18n()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = [
    { href: '/', icon: LayoutDashboard, label: t('dashboard') },
    { href: '/clients', icon: Users, label: t('clients') },
    { href: '/clients/new', icon: UserPlus, label: t('newClient') },
    { href: '/import', icon: Upload, label: t('import') },
    { href: '/settings', icon: Settings, label: t('settings') },
  ]

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-blue-100">
        {collapsed ? (
          /* Collapsed: show small square crop of logo */
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: '#e8f1f9' }}>
            <Image
              src="https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png"
              alt="Arthromed"
              width={36}
              height={36}
              className="object-contain"
              style={{ objectPosition: 'left center' }}
            />
          </div>
        ) : (
          /* Expanded: logo + ERP badge */
          <div className="flex items-center gap-2 min-w-0">
            <Image
              src="https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png"
              alt="Arthromed ERP"
              width={120}
              height={36}
              className="object-contain flex-shrink-0"
              priority
            />
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
              style={{ background: '#0763a9', color: '#ffffff', letterSpacing: '0.05em' }}
            >
              ERP
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
                ${active
                  ? 'border'
                  : 'border border-transparent hover:bg-blue-50'
                }
              `}
              style={active ? {
                background: '#e8f1f9',
                borderColor: '#c5d9ee',
                color: '#0763a9',
              } : { color: '#5a5b5d' }}
            >
              <Icon
                size={20}
                className="flex-shrink-0"
                style={{ color: active ? '#0763a9' : undefined }}
              />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
              {active && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: '#0763a9' }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Collapse button (desktop) */}
      <div className="hidden lg:flex p-3 border-t border-blue-100">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="btn-ghost w-full justify-center text-xs"
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /> Colapsar</>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-white border border-blue-100 shadow"
        style={{ color: '#0763a9' }}
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`
          lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-blue-100 shadow-xl
          transform transition-transform duration-300
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg btn-ghost"
        >
          <X size={18} />
        </button>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 bg-white border-r border-blue-100 shadow-sm
          transition-all duration-300
          ${collapsed ? 'w-16' : 'w-60'}
        `}
      >
        <SidebarContent />
      </aside>
    </>
  )
}
