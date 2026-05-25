import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const { name, role, has_pin, has_gafete, notes } = body

    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido.' }, { status: 400 })
    }

    const data = await prisma.congreso_viajeros.create({
      data: {
        congreso_id: id,
        name,
        role: role || null,
        has_pin: !!has_pin,
        has_gafete: !!has_gafete,
        notes: notes || null
      }
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
