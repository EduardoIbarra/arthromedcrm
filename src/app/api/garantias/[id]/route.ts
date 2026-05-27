import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// PATCH /api/garantias/[id] - Update warranty record
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      estado,
      diagnostico,
      resolucion,
      costo_reparacion,
      notas,
      numero_serie,
      modelo,
    } = body

    const updateData: any = {}

    if (estado !== undefined) {
      updateData.estado = estado
      // Automatically set resolution date when state goes to completed or delivered
      if (estado === 'completado' || estado === 'entregado') {
        updateData.fecha_resolucion = new Date()
      } else if (estado === 'recibido' || estado === 'en_revision' || estado === 'en_reparacion') {
        // If state goes back to active repair/review, clear resolution date
        updateData.fecha_resolucion = null
      }
    }

    if (diagnostico !== undefined) updateData.diagnostico = diagnostico
    if (resolucion !== undefined) updateData.resolucion = resolucion
    if (notas !== undefined) updateData.notas = notas
    if (numero_serie !== undefined) updateData.numero_serie = numero_serie
    if (modelo !== undefined) updateData.modelo = modelo

    if (costo_reparacion !== undefined) {
      updateData.costo_reparacion = costo_reparacion !== null && costo_reparacion !== '' ? Number(costo_reparacion) : null
    }

    const updated = await prisma.garantias.update({
      where: { id },
      data: updateData,
      include: {
        clientes: {
          select: {
            nombre: true,
            correo: true,
            telefono: true,
          },
        },
        productos: {
          select: {
            nombre: true,
            categoria: true,
          },
        },
      },
    })

    return NextResponse.json({ data: updated })
  } catch (err: any) {
    console.error('[PATCH /api/garantias/[id]] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/garantias/[id] - Delete warranty record
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.garantias.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Registro de garantía eliminado exitosamente' })
  } catch (err: any) {
    console.error('[DELETE /api/garantias/[id]] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
