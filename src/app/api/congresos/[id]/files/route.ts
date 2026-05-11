import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  const { data, error } = await supabase
    .from('congreso_files')
    .select('*')
    .eq('congreso_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { name, url, file_type, size_bytes } = body

    if (!name || !url) {
      return NextResponse.json({ error: 'Missing name or url' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('congreso_files')
      .insert({
        congreso_id: id,
        name,
        url,
        file_type,
        size_bytes
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
