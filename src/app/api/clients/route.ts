import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { ClientInsert } from '@/types/database'

// GET /api/clients — list with filters
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const state = searchParams.get('state') || ''
  const specialty = searchParams.get('specialty') || ''
  const isProspect = searchParams.get('is_prospect') === 'true'
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')

  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) {
    query = query.or(`name.ilike.%${search}%,rfc.ilike.%${search}%,phone.ilike.%${search}%,email_contact.ilike.%${search}%`)
  }
  if (status) {
    query = query.eq('status', status)
  } else if (isProspect) {
    query = query.not('status', 'in', '("Activo","Inactivo")')
  }
  if (state) {
    query = query.contains('states', [state])
  }
  if (specialty) {
    query = query.contains('specialties', [specialty])
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, count, page, pageSize })
}

// POST /api/clients — create client
export async function POST(request: NextRequest) {
  const body: ClientInsert = await request.json()

  const { data, error } = await supabase
    .from('clients')
    .insert(body)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
