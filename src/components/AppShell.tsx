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
  '/clients': { section: 'clients', action: 'view' },
  '/clients/new': { section: 'clients', action: 'create' },
  '/import': { section: 'clients', action: 'create' },
  '/products': { section: 'products', action: 'view' },
  '/hospitals': { section: 'hospitals', action: 'view' },
  '/congresos': { section: 'congresos', action: 'view' },
  '/congresos/new': { section: 'congresos', action: 'create' },
  '/gastos': { section: 'gastos', action: 'view' },
  '/gastos/new': { section: 'gastos', action: 'create' },
  '/settings': { section: 'settings', action: 'view' },
  '/users': { section: 'users', action: 'view' },
  '/users/roles': { section: 'roles', action: 'view' },
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
    const matchedRoute = Object.entries(ROUTE_PERMISSIONS).find(([route]) => 
      pathname === route || (route !== '/' && pathname.startsWith(route))
    )

    if (matchedRoute) {
      const { section, action } = matchedRoute[1]
      if (!hasPermission(section, action)) {
        console.warn(`Access denied for ${pathname}. Required: ${section}:${action}`)
        router.push('/') // Redirect to dashboard if no permission
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
