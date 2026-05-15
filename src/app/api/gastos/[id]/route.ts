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
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
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
