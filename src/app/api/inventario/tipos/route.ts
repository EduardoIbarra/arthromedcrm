import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const tipos = await prisma.tipos_inventario.findMany({
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json({ data: tipos })
  } catch (err: any) {
    console.error('[GET /api/inventario/tipos]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { nombre, descripcion, activo } = body

    if (!nombre) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const nuevoTipo = await prisma.tipos_inventario.create({
      data: {
        nombre,
        descripcion,
        activo: activo ?? true,
      },
    })

    return NextResponse.json({ data: nuevoTipo })
  } catch (err: any) {
    console.error('[POST /api/inventario/tipos]', err)
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un tipo de inventario con ese nombre.' }, { status: 400 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
