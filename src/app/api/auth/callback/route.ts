import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in search params, use it as the redirection URL after successful sign in
  const next = searchParams.get('next') ?? '/'

  // Determine the correct origin for redirection
  const host = request.headers.get('host')
  const protocol = request.headers.get('x-forwarded-proto') ?? (host?.includes('localhost') ? 'http' : 'https')
  const origin = host ? `${protocol}://${host}` : new URL(request.url).origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && user.email) {
        // Enforce email domain restriction
        const isAuthorized = user.email.endsWith('@arthromed.com.mx') || 
                             user.email === 'arthromedpruebas@gmail.com' || 
                             user.email === 'edibarra0@gmail.com' ||
                             user.email === 'ed@datata.mx'
        
        if (!isAuthorized) {
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/login?error=Acceso denegado. Se requiere un correo de @arthromed.com.mx.`)
        }

        try {
          const profile = await prisma.user_profiles.findUnique({
            where: { id: user.id }
          })
          
          if (!profile) {
            const fullName = user.user_metadata?.full_name || ''
            const nameParts = fullName.split(' ')
            const firstName = nameParts[0] || null
            const lastName = nameParts.slice(1).join(' ') || null
            
            await prisma.user_profiles.create({
              data: {
                id: user.id,
                email: user.email,
                first_name: firstName,
                last_name: lastName,
              }
            })
          }
        } catch (e) {
          console.error("Error creating user profile", e)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
