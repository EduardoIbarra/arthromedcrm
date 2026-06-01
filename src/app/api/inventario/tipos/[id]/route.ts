import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { nombre, descripcion, activo } = body

    const tipo = await prisma.tipos_inventario.update({
      where: { id },
      data: {
        nombre,
        descripcion,
        activo,
      },
    })

    return NextResponse.json({ data: tipo })
  } catch (err: any) {
    console.error('[PATCH /api/inventario/tipos/[id]]', err)
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un tipo de inventario con ese nombre.' }, { status: 400 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    // Check if it's the main inventory, maybe we shouldn't delete it
    const tipo = await prisma.tipos_inventario.findUnique({ where: { id } })
    if (tipo?.nombre === 'Almacén Principal') {
      return NextResponse.json({ error: 'No se puede eliminar el inventario principal.' }, { status: 400 })
    }

    await prisma.tipos_inventario.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DELETE /api/inventario/tipos/[id]]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
