'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import {
  LayoutDashboard, Users, UserPlus, Upload, Settings,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Menu, X, Package, Building, Calendar, Receipt,
  ShieldCheck, FileText, ClipboardList, CalendarDays, TrendingUp, Warehouse, Scissors, Wrench, GitPullRequest, Bot, Sparkles, Ticket, Stethoscope, BookOpen,
  Globe, Send, Palette, Car, Bell, LayoutGrid, Box
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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')

  const navGroups: NavGroup[] = [
    {
      title: null,
      items: [
        { href: '/', icon: LayoutDashboard, label: t('dashboard'), section: 'dashboard' },
        { href: '/chat', icon: Bot, label: t('aiAssistant' as any) || 'Asistente AI', section: 'dashboard' },
      ],
    },
    {
      title: t('catalogos'),
      items: [
        { href: '/clients', icon: Users, label: t('clients'), section: 'clients' },
        { href: '/clients/kanban', icon: LayoutGrid, label: 'Kanban Clientes', section: 'clients' },
        { href: '/products', icon: Package, label: t('products'), section: 'products' },
        { href: '/hospitals', icon: Building, label: t('hospitals'), section: 'hospitals' },
        { href: '/doctors', icon: Stethoscope, label: t('doctores'), section: 'doctors' },
        { href: '/catalogos', icon: FileText, label: t('catalogos'), section: 'catalogos' },
        { href: '/catalogos/lineas', icon: Palette, label: 'Líneas de Distribución', section: 'catalogos' },
      ],
    },
    {
      title: t('inventory' as any) || 'Inventario',
      items: [
        { href: '/inventario', icon: Warehouse, label: t('inventory' as any) || 'Inventario', section: 'inventario' },
        { href: '/cajas', icon: Box, label: 'Cajas', section: 'cajas' },
        { href: '/purchase-orders', icon: ClipboardList, label: 'Órdenes de Compra', section: 'purchase_orders' },
        { href: '/inventario/checklists', icon: ClipboardList, label: t('checklists'), section: 'checklists' },
        { href: '/imports/repartition', icon: GitPullRequest, label: t('repartition' as any) || 'Repartición', section: 'repartition', action: 'create' },
      ],
    },
    {
      title: t('operations' as any) || 'Operaciones',
      items: [
        { href: '/calendario', icon: CalendarDays, label: t('calendar'), section: 'calendario' },
        { href: '/congresos', icon: Calendar, label: t('congresos'), section: 'congresos' },
        { href: '/talleres', icon: BookOpen, label: t('talleres'), section: 'talleres' },
        { href: '/cirugias', icon: Scissors, label: t('surgeries' as any) || 'Cirugías', section: 'cirugias' },
        { href: '/garantias', icon: Wrench, label: t('warranties' as any) || 'Garantías', section: 'warranties' },
        { href: '/tickets', icon: Ticket, label: t('ticketsSidebar' as any) || 'Tickets', section: 'tickets' },
        { href: '/landing-pages', icon: Globe, label: t('landingPages' as any) || 'Landing Pages', section: 'landing_pages' },
        { href: '/communication', icon: Send, label: t('communication' as any) || 'Comunicaciones', section: 'communication' },
        { href: '/recordatorios', icon: Bell, label: 'Recordatorios WA', section: 'recordatorios' },
        { href: '/car-fleet', icon: Car, label: t('carFleet') || 'Flota Vehicular', section: 'car_fleet' },
        { href: '/directorio', icon: Users, label: t('directorio') || 'Directorio', section: 'directorio' },
      ],
    },
    {
      title: t('finances' as any) || 'Finanzas',
      items: [
        { href: '/ventas', icon: TrendingUp, label: t('ventas'), section: 'ventas' },
        { href: '/facturas', icon: FileText, label: t('customerInvoices' as any) || 'Facturas Clientes', section: 'facturas' },
        { href: '/cotizaciones', icon: ClipboardList, label: 'Cotizaciones', section: 'cotizaciones' },
        { href: '/gastos', icon: Receipt, label: t('gastos'), section: 'gastos' },
        { href: '/previos', icon: ClipboardList, label: t('previos' as any) || 'Previos', section: 'previos' },
      ],
    },
    {
      title: t('reports' as any) || 'Reportes',
      items: [
        { href: '/reportes/ventas', icon: TrendingUp, label: t('ventas'), section: 'reportes' }
      ],
    },
    {
      title: t('settings'),
      items: [
        { href: '/users', icon: ShieldCheck, label: t('users'), section: 'users' },
        { href: '/settings', icon: Settings, label: t('settings'), section: 'settings' },
      ],
    },
  ]

  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [title]: !prev[title]
    }))
  }

  // Filter groups and items based on permissions and search query
  const filteredNavGroups = navGroups.map(group => {
    const matchedItems = group.items.filter(item => {
      const hasPerm = hasPermission(item.section, item.action || 'view')
      if (!hasPerm) return false
      if (!searchQuery.trim()) return true
      return item.label.toLowerCase().includes(searchQuery.toLowerCase())
    })
    return {
      ...group,
      items: matchedItems
    }
  }).filter(group => group.items.length > 0)

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

      {/* Search Input */}
      {!collapsed && (
        <div className="px-3 pt-3">
          <div className="relative">
            <input
              type="text"
              placeholder={t('search' as any) || 'Buscar...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 pl-8 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-blue-300 bg-gray-50 focus:bg-white transition-colors"
            />
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
          </div>
        </div>
      )}

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
                <div
                  onClick={() => group.title && toggleGroup(group.title)}
                  className="px-3 py-1.5 text-xs font-semibold tracking-wider uppercase text-gray-500 cursor-pointer hover:text-gray-800 flex items-center justify-between group/title select-none"
                >
                  <span>{group.title}</span>
                  <div className="text-gray-400 group-hover/title:text-gray-650 transition-colors">
                    {collapsedGroups[group.title] && !searchQuery.trim() ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronUp size={14} />
                    )}
                  </div>
                </div>
              )}
              {group.title && collapsed && (
                <div className="px-3 py-1.5 text-center text-xs font-semibold tracking-wider uppercase text-gray-400">
                  —
                </div>
              )}
              {(!group.title || collapsed || !collapsedGroups[group.title!] || searchQuery.trim() !== '') && group.items.map((item) => {
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

      {/* Sidebar bottom actions */}
      <div className="p-3 border-t border-blue-100 flex flex-col gap-2 mt-auto">
        <Link
          href="/chat"
          onClick={() => setMobileOpen(false)}
          className="flex items-center justify-center gap-2 p-2 rounded-xl bg-gradient-to-r from-[#0763a9] to-[#054d85] text-white shadow-sm hover:shadow-md transition-all group"
          title={collapsed ? (t('aiAssistant' as any) || "Asistente AI") : undefined}
        >
          <Sparkles size={18} className="group-hover:animate-pulse" />
          {!collapsed && <span className="text-xs font-semibold">{t('aiAssistant' as any) || 'Asistente AI'}</span>}
        </Link>

        {/* Collapse button (desktop) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex btn-ghost w-full justify-center text-xs"
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
        {SidebarContent()}
      </aside>

      <aside
        className={`
          hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 bg-white border-r border-blue-100 shadow-sm
          transition-all duration-300
          ${collapsed ? 'w-16' : 'w-60'}
        `}
      >
        {SidebarContent()}
      </aside>
    </>
  )
}
