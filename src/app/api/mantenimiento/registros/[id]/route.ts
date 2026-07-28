import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const registro = await prisma.mantenimiento_registros.findFirst({
      where: { id, deleted_at: null },
      include: { reporte: true },
    })

    if (!registro) {
      return NextResponse.json({ error: 'Registro de falla no encontrado' }, { status: 404 })
    }

    return NextResponse.json(registro)
  } catch (error: any) {
    console.error('Error fetching maintenance record:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
      producto,
      numero_serie_lote,
      tipo_falla,
      descripcion_detalle,
      frecuencia,
      observaciones,
      fabricante,
      periodo_evaluado,
      evidencias,
      status,
    } = body

    const updated = await prisma.mantenimiento_registros.update({
      where: { id },
      data: {
        ...(producto && { producto: producto.trim() }),
        ...(numero_serie_lote && { numero_serie_lote: numero_serie_lote.trim() }),
        ...(tipo_falla && { tipo_falla: tipo_falla.trim() }),
        ...(descripcion_detalle && { descripcion_detalle: descripcion_detalle.trim() }),
        ...(frecuencia !== undefined && { frecuencia: Number(frecuencia) }),
        ...(observaciones !== undefined && { observaciones: observaciones?.trim() || null }),
        ...(fabricante !== undefined && { fabricante: fabricante?.trim() }),
        ...(periodo_evaluado !== undefined && { periodo_evaluado: periodo_evaluado?.trim() }),
        ...(evidencias !== undefined && { evidencias }),
        ...(status && { status }),
        updated_at: new Date(),
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating maintenance record:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.mantenimiento_registros.update({
      where: { id },
      data: { deleted_at: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting maintenance record:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
