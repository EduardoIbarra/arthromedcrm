import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { ClientActivityInsert } from '@/types/database'

// POST /api/clients/[id]/activities
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const activity: ClientActivityInsert = {
    client_id: id,
    type: body.type,
    content: body.content,
    created_by: body.created_by || 'Usuario',
  }

  const { data, error } = await supabase
    .from('client_activities')
    .insert(activity)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update last_contact_at
  await supabase
    .from('clients')
    .update({ last_contact_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ data }, { status: 201 })
}

// GET /api/clients/[id]/activities
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabase
    .from('client_activities')
    .select('*')
    .eq('client_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
