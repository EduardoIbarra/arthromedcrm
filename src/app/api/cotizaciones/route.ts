import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const estado = searchParams.get('estado')

    const where: any = {}

    if (estado && estado !== 'all') {
      where.estado = estado
    }

    if (search) {
      where.OR = [
        { numero_cotizacion: { contains: search, mode: 'insensitive' } },
        { cliente_nombre: { contains: search, mode: 'insensitive' } },
        { cliente_rfc: { contains: search, mode: 'insensitive' } },
      ]
    }

    const cotizaciones = await prisma.cotizaciones.findMany({
      where,
      orderBy: { fecha_expedicion: 'desc' },
      include: {
        clientes: {
          select: {
            nombre: true,
            correo: true,
            telefono: true,
          }
        },
        _count: {
          select: {
            comentarios: true,
            documentos: true,
          }
        }
      }
    })

    return NextResponse.json({ data: cotizaciones })
  } catch (err: any) {
    console.error('[GET /api/cotizaciones] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
