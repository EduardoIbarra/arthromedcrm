import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import prisma from '@/lib/prisma'
import { ClientInsert } from '@/types/database'
import { generateDistributorId } from '@/lib/distributor-id'

// GET /api/clients — list with filters
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const state = searchParams.get('state') || ''
  const specialty = searchParams.get('specialty') || ''
  const congreso = searchParams.get('congreso') || ''
  const isProspect = searchParams.get('is_prospect') === 'true'
  const source = searchParams.get('source') || ''
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
  if (congreso) {
    query = query.contains('tags', [`congreso:${congreso}`])
  }
  if (source) {
    query = query.eq('source', source)
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

  // Auto-assign distributor ID for new active distributors
  if (body.status === 'Activo' && !body.distributor_id) {
    body.distributor_id = await generateDistributorId()
  }

  try {
    const data = await prisma.clients.create({
      data: {
        name: body.name,
        rfc: body.rfc,
        zip_code: body.zip_code,
        fiscal_address: body.fiscal_address,
        email_primary: body.email_primary,
        email_billing: body.email_billing,
        email_contact: body.email_contact,
        phone: body.phone,
        whatsapp_phone: body.whatsapp_phone,
        states: body.states || [],
        hospitals: body.hospitals || [],
        specialties: body.specialties || [],
        tax_regime: body.tax_regime,
        status: body.status || 'Nuevo Prospecto',
        notes: body.notes,
        tags: body.tags || [],
        assigned_to: body.assigned_to,
        source: body.source,
        legal_representative: body.legal_representative,
        distributor_id: body.distributor_id,
        letter_created_at: body.letter_created_at ? new Date(body.letter_created_at) : null,
        letter_expires_at: body.letter_expires_at ? new Date(body.letter_expires_at) : null,
        letter_url: body.letter_url,
        addresses: body.addresses || []
      }
    })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
