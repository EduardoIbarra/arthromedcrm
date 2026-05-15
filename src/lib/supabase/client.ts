import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.warn('Warning: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined.')
    return new Proxy({}, {
      get: () => {
        return () => { throw new Error('Supabase client was initialized without URL or Key.') }
      }
    }) as any
  }

  return createBrowserClient(url, key)
}
