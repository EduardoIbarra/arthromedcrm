import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/workshops/[id]/stations — list all stations with products
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const stations = await prisma.workshop_stations.findMany({
      where: { workshop_id: id },
      include: {
        workshop_station_products: {
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

// POST /api/workshops/[id]/stations — create a station
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

    const station = await prisma.workshop_stations.create({
      data: {
        workshop_id: id,
        name
      },
      include: {
        workshop_station_products: true
      }
    })

    return NextResponse.json({ data: station }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
