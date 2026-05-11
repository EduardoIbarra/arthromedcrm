import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

export const getSession = cache(async () => {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
})

export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getProfile = cache(async () => {
  const user = await getUser()
  if (!user) return null

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
})

export const isAdmin = cache(async () => {
  const profile = await getProfile()
  return profile?.role === 'admin' || profile?.role === 'superadmin'
})

export const isSuperAdmin = cache(async () => {
  const profile = await getProfile()
  return profile?.role === 'superadmin'
})
