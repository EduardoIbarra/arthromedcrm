import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const reporte = await prisma.mantenimiento_reportes.findFirst({
      where: { id, deleted_at: null },
      include: {
        registros: {
          where: { deleted_at: null },
          orderBy: { created_at: 'asc' },
        },
      },
    })

    if (!reporte) {
      return NextResponse.json({ error: 'Reporte de mantenimiento no encontrado' }, { status: 404 })
    }

    return NextResponse.json(reporte)
  } catch (error: any) {
    console.error('Error fetching maintenance report detail:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const reporte = await prisma.mantenimiento_reportes.findUnique({
      where: { id },
      include: { registros: true },
    })

    if (!reporte) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
    }

    // Soft delete report and append deleted marker to folio so unique constraint is freed up
    await prisma.mantenimiento_reportes.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        folio: `${reporte.folio}-DEL-${Date.now()}`
      },
    })

    // Unlink records and set status back to REGISTRADO
    if (reporte.registros && reporte.registros.length > 0) {
      await prisma.mantenimiento_registros.updateMany({
        where: { id: { in: reporte.registros.map((r: any) => r.id) } },
        data: { reporte_id: null, status: 'REGISTRADO' },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting maintenance report:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
