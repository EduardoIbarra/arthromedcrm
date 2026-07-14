import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const { status, description, location } = await request.json()

    if (!status || !description) {
      return NextResponse.json(
        { error: 'Estado y Descripción son requeridos' },
        { status: 400 }
      )
    }

    // Verify invoice exists
    const facturaExists = await prisma.facturas_cliente.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!facturaExists) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    // Create the update
    const update = await prisma.factura_tracking_updates.create({
      data: {
        factura_id: id,
        status,
        description,
        location: location || null,
      },
    })

    return NextResponse.json({ success: true, update })
  } catch (error: any) {
    console.error('[POST /api/invoices/[id]/tracking-updates]', error)
    return NextResponse.json({ error: 'Error al agregar la actualización de envío' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Support deleting a specific update log entry if requested
  try {
    const { searchParams } = new URL(request.url)
    const updateId = searchParams.get('updateId')

    if (!updateId) {
      return NextResponse.json({ error: 'updateId query param is required' }, { status: 400 })
    }

    await prisma.factura_tracking_updates.delete({
      where: { id: updateId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE /api/invoices/[id]/tracking-updates]', error)
    return NextResponse.json({ error: 'Error al eliminar la actualización' }, { status: 500 })
  }
}
