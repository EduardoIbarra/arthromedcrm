import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''

  // Only fetch active clients and only select public fields
  let query = supabase
    .from('clients')
    .select('id, name, rfc, states, status, distributor_id, letter_created_at, letter_expires_at')
    .in('status', ['Activo', 'Inactivo'])
    .order('name', { ascending: true })

  if (search) {
    query = query.or(`name.ilike.%${search}%,rfc.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
