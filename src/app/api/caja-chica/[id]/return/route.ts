import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function POST(
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

    const body = await request.json()
    const returnAmount = parseFloat(body.amount)
    const note = body.note || ''
    const returnDate = body.date ? new Date(body.date).toISOString() : new Date().toISOString()

    if (isNaN(returnAmount) || returnAmount <= 0) {
      return NextResponse.json({ error: 'El monto devuelto debe ser un número mayor a 0' }, { status: 400 })
    }

    const tx = await prisma.caja_chica_transactions.findUnique({
      where: { id }
    })

    if (!tx || tx.deleted_at) {
      return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
    }

    if (tx.type !== 'OUTPUT') {
      return NextResponse.json({ error: 'Solo se pueden registrar devoluciones en transacciones de tipo Retiro' }, { status: 400 })
    }

    const originalAmount = tx.original_amount ?? tx.amount
    const currentReturned = tx.returned_amount ?? 0
    const remainingAmount = originalAmount - currentReturned

    if (returnAmount > remainingAmount + 0.001) {
      return NextResponse.json({
        error: `El monto devuelto ($${returnAmount}) excede el saldo restante de la transacción ($${remainingAmount.toFixed(2)})`
      }, { status: 400 })
    }

    const newReturnedAmount = currentReturned + returnAmount
    const newAmount = Math.max(0, Number((originalAmount - newReturnedAmount).toFixed(2)))

    // Fetch user details for the log
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, email')
      .eq('id', user.id)
      .single()

    const createdByName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
      : user.email || 'Usuario'

    const newLogEntry = {
      id: crypto.randomUUID(),
      amount: returnAmount,
      note,
      date: returnDate,
      created_at: new Date().toISOString(),
      created_by: user.id,
      created_by_name: createdByName
    }

    const existingLogs = Array.isArray(tx.return_logs) ? (tx.return_logs as any[]) : []

    const updatedTx = await prisma.caja_chica_transactions.update({
      where: { id },
      data: {
        original_amount: originalAmount,
        returned_amount: newReturnedAmount,
        amount: newAmount,
        return_logs: [...existingLogs, newLogEntry]
      },
      include: {
        users: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        },
        catalog_spending_categories: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json({ data: updatedTx })
  } catch (error: any) {
    console.error('Error in POST /api/caja-chica/[id]/return:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
