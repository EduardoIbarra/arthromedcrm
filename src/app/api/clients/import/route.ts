import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { ClientInsert } from '@/types/database'

export async function POST(request: NextRequest) {
  const { clients }: { clients: ClientInsert[] } = await request.json()

  if (!Array.isArray(clients) || clients.length === 0) {
    return NextResponse.json({ error: 'No clients provided' }, { status: 400 })
  }

  // Insert in batches of 50
  const batchSize = 50
  let inserted = 0
  const errors: string[] = []

  for (let i = 0; i < clients.length; i += batchSize) {
    const batch = clients.slice(i, i + batchSize)
    const { error, count } = await supabase.from('clients').insert(batch)
    if (error) errors.push(error.message)
    else inserted += count || batch.length
  }

  if (errors.length > 0) {
    return NextResponse.json({ inserted, errors }, { status: 207 })
  }

  return NextResponse.json({ inserted }, { status: 201 })
}
