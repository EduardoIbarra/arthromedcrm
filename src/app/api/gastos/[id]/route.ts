import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data, error } = await supabase
    .from('gastos')
    .select(`
      *,
      congreso:congresos(name),
      category:catalog_spending_categories(name),
      gasto_attachments(*)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    // Check if it's a caja chica transaction
    try {
      const prisma = (await import('@/lib/prisma')).default
      const tx = await prisma.caja_chica_transactions.findUnique({
        where: { id },
        include: {
          catalog_spending_categories: { select: { id: true, name: true } }
        }
      })

      if (tx) {
        const ccData = {
          id: tx.id,
          name: tx.note || tx.receiver || 'Retiro Caja Chica',
          description: `Caja Chica (Entregó: ${tx.giver} | Recibió: ${tx.receiver})`,
          amount: tx.amount,
          iva_percent: 0,
          iva: 0,
          total: tx.amount,
          comments: tx.note || '',
          card: 'Caja Chica',
          expense_date: tx.date.toISOString(),
          category_id: tx.category_id,
          category: tx.catalog_spending_categories || (tx.category_custom ? { name: tx.category_custom } : null),
          is_billable: tx.is_billed,
          is_billed: tx.is_billed,
          is_caja_chica: true,
          created_at: tx.created_at?.toISOString() || tx.date.toISOString()
        }
        return NextResponse.json({ data: ccData })
      }
    } catch (err: any) {
      console.error('Error fetching caja chica item in /api/gastos/[id]:', err)
    }

    return NextResponse.json({ error: 'Gasto not found' }, { status: 404 })
  }

  return NextResponse.json({ data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { attachments, ...gastoData } = body

    if (gastoData.expense_date) {
      const str = String(gastoData.expense_date).trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        gastoData.expense_date = `${str}T12:00:00.000Z`
      }
    }

    // Update main gasto data
    const { data, error } = await supabase
      .from('gastos')
      .update({
        ...gastoData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Handle attachments if provided
    if (attachments && Array.isArray(attachments)) {
      // Simple strategy: delete existing and insert new ones
      // In a production app with high concurrency this might need a better approach
      await supabase.from('gasto_attachments').delete().eq('gasto_id', id)
      
      if (attachments.length > 0) {
        const { error: attachmentsError } = await supabase
          .from('gasto_attachments')
          .insert(
            attachments.map((att: { name: string; url: string }) => ({
              gasto_id: id,
              name: att.name,
              url: att.url
            }))
          )
        if (attachmentsError) console.error('Error updating attachments:', attachmentsError)
      }
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { error } = await supabase
      .from('gastos')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
