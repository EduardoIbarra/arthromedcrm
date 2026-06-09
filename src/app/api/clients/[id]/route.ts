import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import prisma from '@/lib/prisma'
import { ClientUpdate } from '@/types/database'
import { generateDistributorId } from '@/lib/distributor-id'

// GET /api/clients/[id]
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const data = await prisma.clients.findUnique({
      where: { id },
      include: {
        client_activities: {
          orderBy: { created_at: 'desc' }
        }
      }
    })
    if (!data) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/clients/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body: any = await request.json()

  // Remove relation fields that cannot be updated directly
  delete body.client_activities
  delete body.client_custom_fields
  delete body.congress_workshop_enrollments
  delete body.distributor_letters
  delete body.garantias
  delete body.orders
  delete body.product_prices

  // Auto-assign distributor ID when status changes to Activo
  if (body.status === 'Activo') {
    const existing = await prisma.clients.findUnique({
      where: { id },
      select: { distributor_id: true }
    })
    if (!existing?.distributor_id) {
      body.distributor_id = await generateDistributorId()
    }
  }

  // Convert dates if present
  if (body.letter_created_at) body.letter_created_at = new Date(body.letter_created_at)
  if (body.letter_expires_at) body.letter_expires_at = new Date(body.letter_expires_at)

  try {
    const data = await prisma.clients.update({
      where: { id },
      data: body
    })
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
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

