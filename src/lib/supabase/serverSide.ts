import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!serviceRoleKey) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY not set, falling back to anon key')
}

const key = serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabaseAdmin = createClient(supabaseUrl, key) as any
