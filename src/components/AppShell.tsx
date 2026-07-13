'use client'
import { ReactNode, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useUser } from '@/contexts/UserContext'
import { Section, PermissionAction } from '@/lib/permissions'
import { Loader2 } from 'lucide-react'

// Map routes to sections and required actions
const ROUTE_PERMISSIONS: Record<string, { section: Section, action: PermissionAction }> = {
  '/': { section: 'dashboard', action: 'view' },
  '/chat': { section: 'dashboard', action: 'view' },
  '/clients': { section: 'clients', action: 'view' },
  '/clients/kanban': { section: 'clients', action: 'view' },
  '/clients/new': { section: 'clients', action: 'create' },
  '/cartas-distribuidor': { section: 'clients', action: 'view' },
  '/doctors': { section: 'doctors', action: 'view' },
  '/import': { section: 'clients', action: 'create' },
  '/imports/repartition': { section: 'repartition', action: 'create' },
  '/products': { section: 'products', action: 'view' },
  '/inventario': { section: 'inventario', action: 'view' },
  '/cajas': { section: 'cajas', action: 'view' },
  '/purchase-orders': { section: 'purchase_orders', action: 'view' },
  '/inventario/checklists': { section: 'checklists', action: 'view' },
  '/hospitals': { section: 'hospitals', action: 'view' },
  '/catalogos': { section: 'catalogos', action: 'view' },
  '/calendario': { section: 'calendario', action: 'view' },
  '/congresos': { section: 'congresos', action: 'view' },
  '/congresos/new': { section: 'congresos', action: 'create' },
  '/talleres': { section: 'talleres', action: 'view' },
  '/gastos': { section: 'gastos', action: 'view' },
  '/gastos/new': { section: 'gastos', action: 'create' },
  '/previos': { section: 'previos', action: 'view' },
  '/ventas': { section: 'ventas', action: 'view' },
  '/facturas': { section: 'facturas', action: 'view' },
  '/reportes/ventas': { section: 'reportes', action: 'view' },
  '/cirugias': { section: 'cirugias', action: 'view' },
  '/garantias': { section: 'warranties', action: 'view' },
  '/settings': { section: 'settings', action: 'view' },
  '/users': { section: 'users', action: 'view' },
  '/users/roles': { section: 'roles', action: 'view' },
  '/tickets': { section: 'tickets', action: 'view' },
  '/landing-pages': { section: 'landing_pages', action: 'view' },
  '/landing-pages/new': { section: 'landing_pages', action: 'create' },
  '/communication': { section: 'communication', action: 'view' },
  '/recordatorios': { section: 'recordatorios', action: 'view' },
  '/car-fleet': { section: 'car_fleet', action: 'view' },
  '/directorio': { section: 'directorio', action: 'view' },
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { hasPermission, loading, profile } = useUser()

  useEffect(() => {
    if (loading) return

    // If not logged in, redirect to login (handled by middleware usually, but good as fallback)
    // if (!profile && pathname !== '/login') {
    //   router.push('/login')
    //   return
    // }

    // Find the matching route permission
    // Email whitelist for admin users
    const adminEmails = [
      'eduardo.delacruz@arthromed.com.mx',
      'eduardo@arthromed.com.mx',
      'admin@arthromed.com.mx'
    ];
    if (profile?.email && adminEmails.includes(profile.email)) {
      // Bypass all permission checks for admin emails
    } else {
      const sortedRoutes = Object.entries(ROUTE_PERMISSIONS).sort((a, b) => b[0].length - a[0].length)
      const matchedRoute = sortedRoutes.find(([route]) => 
        pathname === route || (route !== '/' && (pathname + '/').startsWith(route + '/'))
      )

      if (matchedRoute) {
        const { section, action } = matchedRoute[1]
        if (!hasPermission(section, action)) {
          console.warn(`Access denied for ${pathname}. Required: ${section}:${action}`)
          router.push('/') // Redirect to dashboard if no permission
        }
      }
    }
  }, [pathname, loading, hasPermission, router, profile])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f5fa]">
        <Loader2 className="w-8 h-8 text-[#0763a9] animate-spin" />
      </div>
    )
  }

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
