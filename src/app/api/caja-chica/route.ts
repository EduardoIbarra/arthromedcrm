import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { sendInternalNotification } from '@/lib/respond'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Access denied' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type')
    const search = searchParams.get('search')

    // 1. Fetch last count ("conteo")
    const lastConteo = await prisma.caja_chica_conteos.findFirst({
      where: { deleted_at: null },
      orderBy: { date: 'desc' },
      include: {
        users: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })

    // 2. Calculate overall sums (all-time inputs & outputs)
    const allTimeSums = await prisma.caja_chica_transactions.groupBy({
      by: ['type'],
      _sum: { amount: true },
      where: { deleted_at: null }
    })

    let totalInputs = 0
    let totalOutputs = 0
    for (const group of allTimeSums) {
      if (group.type === 'INPUT') {
        totalInputs = group._sum.amount || 0
      } else if (group.type === 'OUTPUT') {
        totalOutputs = group._sum.amount || 0
      }
    }

    // 3. Calculate current balance starting from the last conteo real_amount
    let baseAmount = 0
    let lastConteoDate: Date | null = null
    if (lastConteo) {
      baseAmount = lastConteo.real_amount
      lastConteoDate = new Date(lastConteo.date)
    }

    const postConteoSums = await prisma.caja_chica_transactions.groupBy({
      by: ['type'],
      _sum: { amount: true },
      where: {
        deleted_at: null,
        ...(lastConteoDate ? { date: { gt: lastConteoDate } } : {})
      }
    })

    let postConteoInputs = 0
    let postConteoOutputs = 0
    for (const group of postConteoSums) {
      if (group.type === 'INPUT') {
        postConteoInputs = group._sum.amount || 0
      } else if (group.type === 'OUTPUT') {
        postConteoOutputs = group._sum.amount || 0
      }
    }

    const currentBalance = baseAmount + postConteoInputs - postConteoOutputs

    // 3. Build filters for list retrieval
    const whereClause: any = { deleted_at: null }

    if (startDate) {
      whereClause.date = { ...whereClause.date, gte: new Date(startDate) }
    }
    if (endDate) {
      whereClause.date = { ...whereClause.date, lte: new Date(endDate) }
    }
    if (type) {
      whereClause.type = type
    }
    if (search) {
      whereClause.OR = [
        { giver: { contains: search, mode: 'insensitive' } },
        { receiver: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
      ]
    }

    // 4. Fetch list of transactions
    const transactions = await prisma.caja_chica_transactions.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
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

    return NextResponse.json({
      data: {
        currentBalance,
        totalInputs,
        totalOutputs,
        lastConteo,
        transactions
      }
    })
  } catch (error: any) {
    console.error('Error in GET /api/caja-chica:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Access denied' }, { status: 401 })
    }

    const body = await request.json()
    const { type, amount, giver, receiver, date, note, category_id, category_custom, is_billed } = body

    if (!type || amount === undefined || !giver || !receiver || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (type !== 'INPUT' && type !== 'OUTPUT') {
      return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 })
    }

    // Create the transaction
    const transaction = await prisma.caja_chica_transactions.create({
      data: {
        type,
        amount: parseFloat(amount),
        giver,
        receiver,
        date: new Date(date),
        note: note || '',
        category_id: category_id || null,
        category_custom: category_custom || null,
        is_billed: Boolean(is_billed),
        created_by: user.id
      }
    })

    // Calculate new current balance for the notification
    const lastConteoForNotif = await prisma.caja_chica_conteos.findFirst({
      where: { deleted_at: null },
      orderBy: { date: 'desc' }
    })

    let baseAmountForNotif = 0
    let lastConteoDateForNotif: Date | null = null
    if (lastConteoForNotif) {
      baseAmountForNotif = lastConteoForNotif.real_amount
      lastConteoDateForNotif = new Date(lastConteoForNotif.date)
    }

    const postConteoSumsForNotif = await prisma.caja_chica_transactions.groupBy({
      by: ['type'],
      _sum: { amount: true },
      where: {
        deleted_at: null,
        ...(lastConteoDateForNotif ? { date: { gt: lastConteoDateForNotif } } : {})
      }
    })

    let postConteoInputsForNotif = 0
    let postConteoOutputsForNotif = 0
    for (const group of postConteoSumsForNotif) {
      if (group.type === 'INPUT') {
        postConteoInputsForNotif = group._sum.amount || 0
      } else if (group.type === 'OUTPUT') {
        postConteoOutputsForNotif = group._sum.amount || 0
      }
    }
    const newBalance = baseAmountForNotif + postConteoInputsForNotif - postConteoOutputsForNotif

    // Send respond.io WhatsApp notification
    try {
      const formattedAmount = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(parseFloat(amount))
      const formattedBalance = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(newBalance)
      const dateString = new Date(date).toLocaleString('es-MX', { timeZone: 'America/Monterrey' })

      const notificationMessage = `💸 *Movimiento de Caja Chica registrado*\n\n` +
        `*Tipo:* ${type === 'INPUT' ? 'Ingreso 📥' : 'Egreso 📤'}\n` +
        `*Monto:* ${formattedAmount} MXN\n` +
        `*Entregó:* ${giver}\n` +
        `*Recibió:* ${receiver}\n` +
        `*Concepto:* ${note || 'Sin nota'}\n` +
        `*Fecha:* ${dateString}\n` +
        `*Saldo Actual:* ${formattedBalance} MXN`

      await sendInternalNotification(notificationMessage, 'caja_chica')
    } catch (notifError) {
      console.error('Error dispatching respond.io notification:', notifError)
    }

    return NextResponse.json({ data: transaction }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/caja-chica:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
