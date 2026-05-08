import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateDistributorId } from '@/lib/distributor-id'

/**
 * POST /api/distributors/assign-ids
 * One-time migration: assigns ARTHDIS-XXXX IDs to all existing active distributors
 * that don't already have a distributor_id.
 */
export async function POST() {
  // Get all active distributors without a distributor_id, ordered by created_at
  const { data: existing, error: fetchError } = await supabase
    .from('clients')
    .select('id, distributor_id')
    .eq('status', 'Activo')
    .is('distributor_id', null)
    .order('created_at', { ascending: true })

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!existing || existing.length === 0) {
    return NextResponse.json({ message: 'No distributors need IDs', assigned: 0 })
  }

  // Assign IDs one by one using the shared generator
  const errors: string[] = []
  let assigned = 0

  for (const row of existing) {
    const distributorId = await generateDistributorId()
    const { error } = await supabase
      .from('clients')
      .update({ distributor_id: distributorId })
      .eq('id', row.id)

    if (error) {
      errors.push(`${row.id}: ${error.message}`)
    } else {
      assigned++
    }
  }

  return NextResponse.json({
    message: `Assigned ${assigned} distributor IDs`,
    assigned,
    total_found: existing.length,
    ...(errors.length > 0 ? { errors } : {}),
  })
}
