import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('gastos')
    .select(`
      *,
      congreso:congresos(name),
      category:catalog_spending_categories(name)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, amount, iva_percent, iva, total, comments, congress_id, category_id } = body

    if (!name || amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('gastos')
      .insert({
        name,
        description: description || '',
        amount,
        iva_percent: iva_percent ?? 16,
        iva,
        total,
        comments: comments || '',
        congress_id: congress_id || null,
        category_id: category_id || null
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
