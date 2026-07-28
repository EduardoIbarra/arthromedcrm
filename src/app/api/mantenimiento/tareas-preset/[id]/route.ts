import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const updated = await prisma.mantenimiento_tareas_preset.update({
      where: { id },
      data: {
        ...(body.tarea ? { tarea: body.tarea.trim() } : {}),
        ...(body.descripcion_ot ? { descripcion_ot: body.descripcion_ot.trim() } : {}),
        ...(body.descripcion_reporte ? { descripcion_reporte: body.descripcion_reporte.trim() } : {}),
        ...(body.orden !== undefined ? { orden: Number(body.orden) } : {}),
        updated_at: new Date(),
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating tarea preset:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.mantenimiento_tareas_preset.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting tarea preset:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
