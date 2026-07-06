import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/congresos/[id]/pendientes — list all pendientes
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const pendientes = await prisma.congreso_pendientes.findMany({
      where: { congreso_id: id },
      include: {
        responsable: {
          select: { id: true, first_name: true, last_name: true, email: true, position: true }
        }
      },
      orderBy: { created_at: 'asc' }
    })
    return NextResponse.json({ data: pendientes })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/congresos/[id]/pendientes — create a new pendiente
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json()
    const { name, description, amount, responsable_id } = body

    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    const pendiente = await prisma.congreso_pendientes.create({
      data: {
        congreso_id: id,
        name,
        description: description || null,
        amount: amount ? Number(amount) : null,
        responsable_id: responsable_id || null,
        completed: false
      },
      include: {
        responsable: {
          select: { id: true, first_name: true, last_name: true, email: true, position: true }
        }
      }
    })

    return NextResponse.json({ data: pendiente }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
