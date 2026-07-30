import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import prisma from '@/lib/prisma'

function formatExpenseDateIso(dateInput?: string | null): string {
  if (!dateInput) return new Date().toISOString()
  const str = String(dateInput).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return `${str}T12:00:00.000Z`
  }
  const parsed = new Date(str)
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

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

  // Also include Caja Chica Retiros if not filtering by specific congress
  let cajaChicaItems: any[] = []
  if (!congressId) {
    try {
      const ccWhere: any = { type: 'OUTPUT', deleted_at: null }
      if (startDate) ccWhere.date = { ...ccWhere.date, gte: new Date(startDate) }
      if (endDate) ccWhere.date = { ...ccWhere.date, lte: new Date(endDate) }

      const ccTxs = await prisma.caja_chica_transactions.findMany({
        where: ccWhere,
        orderBy: { date: 'desc' },
        include: {
          catalog_spending_categories: { select: { id: true, name: true } }
        }
      })

      cajaChicaItems = ccTxs.map((tx: any) => ({
        id: tx.id,
        name: tx.note || tx.receiver || 'Retiro Caja Chica',
        description: `Caja Chica (Entregó: ${tx.giver} | Recibió: ${tx.receiver})`,
        amount: tx.amount,
        iva_percent: 0,
        iva: 0,
        total: tx.amount,
        comments: tx.note,
        card: 'Caja Chica',
        expense_date: tx.date.toISOString(),
        category_id: tx.category_id,
        category: tx.catalog_spending_categories || (tx.category_custom ? { name: tx.category_custom } : null),
        is_billable: tx.is_billed,
        is_billed: tx.is_billed,
        is_caja_chica: true,
        created_at: tx.created_at?.toISOString() || tx.date.toISOString()
      }))
    } catch (err) {
      console.error('Error fetching caja chica transactions in /api/gastos:', err)
    }
  }

  const combinedData = [...(data || []), ...cajaChicaItems].sort((a, b) =>
    new Date(b.expense_date || b.created_at).getTime() - new Date(a.expense_date || a.created_at).getTime()
  )

  return NextResponse.json({ data: combinedData })
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
        expense_date: formatExpenseDateIso(item.expense_date)
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
        expense_date: formatExpenseDateIso(expense_date)
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
