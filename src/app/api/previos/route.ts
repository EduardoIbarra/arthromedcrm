import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const search = searchParams.get('search')?.toLowerCase() || ''

    const skip = (page - 1) * pageSize

    let where: any = {}

    if (search) {
      const isNumeric = !isNaN(parseFloat(search))
      where = {
        OR: [
          { folio: { contains: search, mode: 'insensitive' } },
          { cliente_nombre: { contains: search, mode: 'insensitive' } },
          ...(isNumeric ? [{ total_con_descuento: { equals: parseFloat(search) } }] : []),
          ...(isNumeric ? [{ total_sin_descuento: { equals: parseFloat(search) } }] : []),
        ]
      }
    }

    const [previos, count] = await Promise.all([
      prisma.previos.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.previos.count({ where })
    ])

    return NextResponse.json({ data: previos, count })
  } catch (error) {
    console.error('Error in /api/previos:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
