import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Access denied' }, { status: 401 })
    }

    const conteos = await prisma.caja_chica_conteos.findMany({
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

    return NextResponse.json({ data: conteos })
  } catch (error: any) {
    console.error('Error in GET /api/caja-chica/conteos:', error)
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
    const { system_amount, real_amount, note, date } = body

    if (system_amount === undefined || real_amount === undefined || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const sysAmt = parseFloat(system_amount)
    const realAmt = parseFloat(real_amount)
    const discrepancy = realAmt - sysAmt

    const conteo = await prisma.caja_chica_conteos.create({
      data: {
        system_amount: sysAmt,
        real_amount: realAmt,
        discrepancy,
        note: note || '',
        date: new Date(date),
        created_by: user.id
      }
    })

    return NextResponse.json({ data: conteo }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/caja-chica/conteos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
