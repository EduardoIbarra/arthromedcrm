'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import {
  LayoutDashboard, Users, UserPlus, Upload, Settings,
  ChevronLeft, ChevronRight, Menu, X, Package, Building, Calendar, Receipt,
  ShieldCheck, FileText
} from 'lucide-react'
import { useI18n } from '@/contexts/I18nContext'
import { useUser } from '@/contexts/UserContext'
import { Section, PermissionAction } from '@/lib/permissions'

interface NavItem {
  href: string
  icon: any
  label: string
  section: Section
  action?: PermissionAction
}

interface NavGroup {
  title: string | null
  items: NavItem[]
}

export default function Sidebar() {
  const { t } = useI18n()
  const pathname = usePathname()
  const { hasPermission, loading } = useUser()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const navGroups: NavGroup[] = [
    {
      title: null,
      items: [
        { href: '/', icon: LayoutDashboard, label: t('dashboard'), section: 'dashboard' },
      ],
    },
    {
      title: t('distribuidores'),
      items: [
        { href: '/clients', icon: Users, label: t('clients'), section: 'clients' },
        { href: '/clients/new', icon: UserPlus, label: t('newClient'), section: 'clients', action: 'create' },
        { href: '/import', icon: Upload, label: t('import'), section: 'clients', action: 'create' },
      ],
    },
    {
      title: t('prices'),
      items: [
        { href: '/products', icon: Package, label: t('products'), section: 'products' },
        { href: '/hospitals', icon: Building, label: t('hospitals'), section: 'hospitals' },
      ],
    },
    {
      title: t('events'),
      items: [
        { href: '/congresos', icon: Calendar, label: t('congresos'), section: 'congresos' },
        { href: '/catalogos', icon: FileText, label: t('catalogos'), section: 'congresos' },
        { href: '/gastos', icon: Receipt, label: t('gastos'), section: 'gastos' },
      ],
    },
    {
      title: null,
      items: [
        { href: '/settings', icon: Settings, label: t('settings'), section: 'settings' },
        { href: '/users', icon: ShieldCheck, label: t('users'), section: 'users' },
      ],
    },
  ]

  // Filter groups and items based on permissions
  const filteredNavGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => 
      hasPermission(item.section, item.action || 'view')
    )
  })).filter(group => group.items.length > 0)

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-blue-100">
        {collapsed ? (
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
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-4 px-3 py-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-8 w-full rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : filteredNavGroups.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="text-xs text-gray-400 italic">{t('noPermissions' as any) || 'No tienes permisos para ver ninguna sección.'}</p>
          </div>
        ) : (
          filteredNavGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="space-y-1">
              {group.title && !collapsed && (
                <div className="px-3 py-1.5 text-xs font-semibold tracking-wider uppercase text-gray-500">
                  {group.title}
                </div>
              )}
              {group.title && collapsed && (
                <div className="px-3 py-1.5 text-center text-xs font-semibold tracking-wider uppercase text-gray-400">
                  —
                </div>
              )}
              {group.items.map((item) => {
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
            </div>
          ))
        )}
      </nav>

      {/* Collapse button (desktop) */}
      <div className="hidden lg:flex p-3 border-t border-blue-100">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="btn-ghost w-full justify-center text-xs"
          aria-label={collapsed ? (t('expandMenu' as any) || 'Expandir menú') : (t('collapseMenu' as any) || 'Colapsar menú')}
        >
          {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /> {t('collapse' as any) || 'Colapsar'}</>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-white border border-blue-100 shadow"
        style={{ color: '#0763a9' }}
        aria-label={t('openMenu' as any) || 'Abrir menú'}
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

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
