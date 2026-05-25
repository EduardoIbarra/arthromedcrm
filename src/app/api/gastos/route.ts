import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const congressId = searchParams.get('congress_id')

  let query = supabase
    .from('gastos')
    .select(`
      *,
      congreso:congresos(name),
      category:catalog_spending_categories(name)
    `)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (startDate) {
    query = query.gte('expense_date', startDate)
  }
  if (endDate) {
    query = query.lte('expense_date', endDate)
  }
  if (congressId) {
    query = query.eq('congress_id', congressId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (Array.isArray(body)) {
      // Bulk insert
      const gastosToInsert = body.map((item: any) => ({
        name: item.name,
        description: item.description || '',
        amount: item.amount,
        iva_percent: item.iva_percent ?? 16,
        iva: item.iva ?? 0,
        total: item.total ?? item.amount,
        comments: item.comments || '',
        card: item.card || null,
        congress_id: item.congress_id || null,
        category_id: item.category_id || null,
        is_billable: item.is_billable || false,
        is_billed: item.is_billed || false,
        folio_fiscal: item.folio_fiscal || null,
        invoice_url: item.invoice_url || null,
        expense_date: item.expense_date ? new Date(item.expense_date).toISOString() : new Date().toISOString()
      }))

      const { data, error } = await supabase
        .from('gastos')
        .insert(gastosToInsert)
        .select()

      if (error) throw error

      return NextResponse.json({ data }, { status: 201 })
    }

    // Single insert
    const { 
      name, description, amount, iva_percent, iva, total, comments, card,
      congress_id, category_id, is_billable, is_billed, folio_fiscal, 
      invoice_url, attachments, expense_date
    } = body

    if (!name || amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: gasto, error } = await supabase
      .from('gastos')
      .insert({
        name,
        description: description || '',
        amount,
        iva_percent: iva_percent ?? 16,
        iva,
        total,
        comments: comments || '',
        card: card || null,
        congress_id: congress_id || null,
        category_id: category_id || null,
        is_billable: is_billable || false,
        is_billed: is_billed || false,
        folio_fiscal: folio_fiscal || null,
        invoice_url: invoice_url || null,
        expense_date: expense_date ? new Date(expense_date).toISOString() : new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    // Insert attachments if any
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const { error: attachmentsError } = await supabase
        .from('gasto_attachments')
        .insert(
          attachments.map((att: { name: string; url: string }) => ({
            gasto_id: gasto.id,
            name: att.name,
            url: att.url
          }))
        )
      
      if (attachmentsError) {
        console.error('Error inserting attachments:', attachmentsError)
      }
    }

    return NextResponse.json({ data: gasto }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
