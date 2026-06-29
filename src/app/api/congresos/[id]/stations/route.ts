import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/congresos/[id]/stations — list all stations with products
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const stations = await prisma.congreso_stations.findMany({
      where: { congress_id: id },
      include: {
        congreso_station_products: {
          include: {
            productos: {
              select: { id: true, nombre: true, precio_unitario: true, categoria: true, tipo: true }
            }
          },
          orderBy: { created_at: 'asc' }
        }
      },
      orderBy: { created_at: 'asc' }
    })
    return NextResponse.json({ data: stations })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/congresos/[id]/stations — create a station
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json()
    const { name } = body

    if (!name) {
      return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
    }

    const station = await prisma.congreso_stations.create({
      data: {
        congress_id: id,
        name
      },
      include: {
        congreso_station_products: true
      }
    })

    return NextResponse.json({ data: station }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
