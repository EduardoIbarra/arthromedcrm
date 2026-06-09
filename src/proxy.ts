import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === '/login'
  const isAuthCallback = request.nextUrl.pathname.startsWith('/api/auth')
  const isPublicAsset = request.nextUrl.pathname.startsWith('/_next') || 
                        request.nextUrl.pathname.startsWith('/favicon.ico') ||
                        request.nextUrl.pathname.startsWith('/distribuidores') || // Public directory
                        request.nextUrl.pathname === '/registro' ||
                        request.nextUrl.pathname === '/registro-cliente' ||
                        request.nextUrl.pathname === '/qr' ||
                        (request.nextUrl.pathname.startsWith('/congresos/') && request.nextUrl.pathname.endsWith('/landing'))

  const isPublicApi = (request.nextUrl.pathname === '/api/catalog/specialties' && request.method === 'GET') ||
                      (request.nextUrl.pathname === '/api/hospitals' && request.method === 'GET') ||
                      (request.nextUrl.pathname.startsWith('/api/congresos/') && request.method === 'GET') ||
                      (request.nextUrl.pathname === '/api/catalogos' && request.method === 'GET') ||
                      (request.nextUrl.pathname === '/api/clients' && request.method === 'POST') ||
                      (request.nextUrl.pathname.startsWith('/api/clients/') && (request.method === 'GET' || request.method === 'PATCH')) ||
                      (request.nextUrl.pathname === '/api/products/filter' && request.method === 'GET') ||
                      (request.nextUrl.pathname === '/api/orders' && request.method === 'POST') ||
                      (request.nextUrl.pathname === '/api/workshops' && request.method === 'GET') ||
                      (request.nextUrl.pathname.startsWith('/api/workshops/')) ||
                      (request.nextUrl.pathname.startsWith('/api/public/')) ||
                      (request.nextUrl.pathname === '/api/whatsapp/send' && request.method === 'POST')

  // Fast-path for completely public routes to avoid hitting Supabase in middleware
  if (isPublicAsset || isPublicApi) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isLoginPage && !isAuthCallback) {
    // Return 401 for API routes instead of redirecting
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
