import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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

  // Protect all routes except login and auth callback
  const isLoginPage = request.nextUrl.pathname === '/login'
  const isAuthCallback = request.nextUrl.pathname.startsWith('/api/auth')
  const isPublicAsset = request.nextUrl.pathname.startsWith('/_next') || 
                        request.nextUrl.pathname.startsWith('/favicon.ico') ||
                        request.nextUrl.pathname.startsWith('/distribuidores') || // Public directory
                        request.nextUrl.pathname === '/registro' ||
                        request.nextUrl.pathname === '/qr'

  if (!user && !isLoginPage && !isAuthCallback && !isPublicAsset) {
    // Also allow specific public API routes
    const isPublicApi = (request.nextUrl.pathname === '/api/catalog/specialties' && request.method === 'GET') ||
                        (request.nextUrl.pathname.startsWith('/api/congresos/') && request.method === 'GET') ||
                        (request.nextUrl.pathname === '/api/clients' && request.method === 'POST') ||
                        (request.nextUrl.pathname.startsWith('/api/public/'))

    if (!isPublicApi) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
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
