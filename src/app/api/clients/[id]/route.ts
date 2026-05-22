import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { ClientUpdate } from '@/types/database'
import { generateDistributorId } from '@/lib/distributor-id'

// GET /api/clients/[id]
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      client_activities (*)
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

// PATCH /api/clients/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body: any = await request.json()

  // Remove relation fields that cannot be updated directly
  delete body.client_activities

  // Auto-assign distributor ID when status changes to Activo
  if (body.status === 'Activo') {
    // Check if the client already has a distributor_id
    const { data: existing } = await supabase
      .from('clients')
      .select('distributor_id')
      .eq('id', id)
      .single()

    if (!existing?.distributor_id) {
      body.distributor_id = await generateDistributorId()
    }
  }

  const { data, error } = await supabase
    .from('clients')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/clients/[id]
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

