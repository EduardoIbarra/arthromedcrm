import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const clientes = await prisma.clientes.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        nombre: true,
        rfc: true,
      },
      orderBy: { nombre: 'asc' },
    })

    return NextResponse.json(clientes)
  } catch (error: any) {
    console.error('Error fetching clientes:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
