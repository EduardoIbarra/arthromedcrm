import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === '/login'
  const isAuthCallback = request.nextUrl.pathname.startsWith('/api/auth')
  const isPublicAsset = request.nextUrl.pathname.startsWith('/_next') || 
                        request.nextUrl.pathname.startsWith('/favicon.ico') ||
                        request.nextUrl.pathname.startsWith('/distribuidores') ||
                        request.nextUrl.pathname.startsWith('/lista-precios') ||
                        request.nextUrl.pathname === '/registro' ||
                        request.nextUrl.pathname === '/registro-cliente' ||
                        request.nextUrl.pathname === '/qr' ||
                        (request.nextUrl.pathname.startsWith('/congresos/') && request.nextUrl.pathname.endsWith('/landing')) ||
                        (request.nextUrl.pathname.startsWith('/talleres/') && (request.nextUrl.pathname.endsWith('/landing') || request.nextUrl.pathname.endsWith('/verify')))

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
                      (request.nextUrl.pathname === '/api/prices/export') ||
                      (request.nextUrl.pathname === '/api/whatsapp/send' && request.method === 'POST') ||
                      (request.nextUrl.pathname === '/api/whatsapp/webhook' && request.method === 'POST')

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

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user || null
  } catch {
    user = null
  }

  // Fallback 1: Check Authorization header
  if (!user) {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim()
      try {
        const { data } = await supabase.auth.getUser(token)
        if (data?.user) user = data.user
      } catch {
        // Ignore token verification errors
      }
    }
  }

  // Fallback 2: Check all sb-*-auth-token cookies across projects
  if (!user) {
    const allCookies = request.cookies.getAll()
    for (const c of allCookies) {
      if (c.name.includes('-auth-token') && c.value) {
        try {
          const raw = c.value.replace(/^base64-/, '')
          const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'))
          const token = parsed.access_token || (Array.isArray(parsed) ? parsed[0] : null)
          if (token && typeof token === 'string') {
            const { data } = await supabase.auth.getUser(token)
            if (data?.user) {
              user = data.user
              break
            }
          }
        } catch {
          // Ignore invalid JSON / chunked cookies
        }
      }
    }
  }

  if (!user && !isLoginPage && !isAuthCallback) {
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
