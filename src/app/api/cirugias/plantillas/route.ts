import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/cirugias/plantillas — list all templates
export async function GET() {
  try {
    const data = await prisma.cirugia_plantillas.findMany({
      include: {
        cirugia_plantilla_productos: {
          include: {
            productos: {
              select: {
                id: true,
                nombre: true,
                precio_unitario: true,
                categoria: true,
                tipo: true,
              },
            },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('[GET /api/cirugias/plantillas]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/cirugias/plantillas — create a new template
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, descripcion, productos } = body

    if (!nombre) {
      return NextResponse.json({ error: 'El nombre es requerido.' }, { status: 400 })
    }

    const plantilla = await prisma.cirugia_plantillas.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        cirugia_plantilla_productos: {
          create: (productos || []).map((p: any) => ({
            producto_id: p.producto_id,
            cantidad: Number(p.cantidad) || 1,
            es_consumible: Boolean(p.es_consumible),
            tipo_uso: p.tipo_uso || 'venta',
            precio_unitario: p.precio_unitario != null ? Number(p.precio_unitario) : null,
          })),
        },
      },
      include: {
        cirugia_plantilla_productos: {
          include: {
            productos: true,
          },
        },
      },
    })

    return NextResponse.json({ data: plantilla }, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/cirugias/plantillas]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
