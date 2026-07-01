import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/kanban/clients
// Query params:
//   assigned_to: string   — filter by assigned user id (default = all with assignment)
//   all: 'true'           — superadmin: return all clients that have any assigned_to
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const assignedTo = searchParams.get('assigned_to') || ''
  const all = searchParams.get('all') === 'true'

  try {
    // Fetch clients from supabase with optional filter
    let query = supabase
      .from('clients')
      .select('id, name, phone, email_contact, status, assigned_to, last_contact_at, avatar_url, states, specialties, tags')
      .order('name', { ascending: true })

    if (all) {
      // superadmin: all clients that have an assigned staff member
      query = query.not('assigned_to', 'is', null)
    } else if (assignedTo) {
      query = query.eq('assigned_to', assignedTo)
    } else {
      // default: no filter — caller provides assigned_to
      query = query.not('assigned_to', 'is', null)
    }

    const { data: clients, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch all kanban_client_columns to know where each client lives
    const clientIds = (clients || []).map((c: any) => c.id)

    const assignments = clientIds.length > 0
      ? await prisma.kanban_client_columns.findMany({
          where: { client_id: { in: clientIds } },
          select: { client_id: true, column_id: true, id: true },
        })
      : []

    const assignmentMap: Record<string, string> = {}
    assignments.forEach((a: any) => {
      assignmentMap[a.client_id] = a.column_id
    })

    // Fetch default "Contacto" column for unassigned clients
    const contactoColumn = await prisma.kanban_columns.findFirst({
      where: { name: 'Contacto' },
      orderBy: { position: 'asc' },
    })

    const enriched = (clients || []).map((c: any) => ({
      ...c,
      kanban_column_id: assignmentMap[c.id] || contactoColumn?.id || null,
    }))

    return NextResponse.json({ data: enriched })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
