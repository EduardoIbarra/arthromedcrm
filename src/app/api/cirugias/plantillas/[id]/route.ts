import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/cirugias/plantillas/[id] — retrieve a single template
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await prisma.cirugia_plantillas.findUnique({
      where: { id },
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
    })
    if (!data) return NextResponse.json({ error: 'Plantilla no encontrada.' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('[GET /api/cirugias/plantillas/:id]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT /api/cirugias/plantillas/[id] — update a template and recreate its products
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { nombre, descripcion, productos } = body

    if (!nombre) {
      return NextResponse.json({ error: 'El nombre es requerido.' }, { status: 400 })
    }

    // Delete existing template products
    await prisma.cirugia_plantilla_productos.deleteMany({
      where: { plantilla_id: id },
    })

    const data = await prisma.cirugia_plantillas.update({
      where: { id },
      data: {
        nombre,
        descripcion: descripcion || null,
        updated_at: new Date(),
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

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('[PUT /api/cirugias/plantillas/:id]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/cirugias/plantillas/[id] — delete a template
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.cirugia_plantillas.delete({
      where: { id },
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DELETE /api/cirugias/plantillas/:id]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
