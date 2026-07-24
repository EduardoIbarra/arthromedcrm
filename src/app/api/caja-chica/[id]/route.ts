import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Access denied' }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 })
    }

    const transaction = await prisma.caja_chica_transactions.update({
      where: { id },
      data: { deleted_at: new Date() }
    })

    return NextResponse.json({ data: transaction })
  } catch (error: any) {
    console.error('Error in DELETE /api/caja-chica/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
