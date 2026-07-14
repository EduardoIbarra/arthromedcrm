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

    const { carrier, trackingNumber } = await request.json()

    if (!carrier || !trackingNumber) {
      return NextResponse.json(
        { error: 'Carrier y Número de Guía son requeridos' },
        { status: 400 }
      )
    }

    // Check if invoice exists
    const factura = await prisma.facturas_cliente.findUnique({
      where: { id },
      select: { id: true, tracking_id: true },
    })

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    let trackingId = factura.tracking_id

    if (trackingId) {
      // Update existing tracking record
      await prisma.factura_tracking.update({
        where: { id: trackingId },
        data: {
          carrier,
          tracking_number: trackingNumber,
          updated_at: new Date(),
        },
      })
    } else {
      // Create new tracking record
      const tracking = await prisma.factura_tracking.create({
        data: {
          carrier,
          tracking_number: trackingNumber,
        },
      })
      trackingId = tracking.id

      // Link to invoice
      await prisma.facturas_cliente.update({
        where: { id },
        data: { tracking_id: trackingId },
      })
    }

    // Add an update entry to log the tracking creation/change
    await prisma.factura_tracking_updates.create({
      data: {
        factura_id: id,
        status: 'shipped',
        description: `Información de envío registrada (${carrier} - ${trackingNumber})`,
      },
    })

    // Return the updated tracking info
    const updatedTracking = await prisma.factura_tracking.findUnique({
      where: { id: trackingId },
    })

    return NextResponse.json({ success: true, tracking: updatedTracking })
  } catch (error: any) {
    console.error('[POST /api/invoices/[id]/tracking]', error)
    return NextResponse.json({ error: 'Error al registrar la información de envío' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    // Check if invoice exists
    const factura = await prisma.facturas_cliente.findUnique({
      where: { id },
      select: { id: true, tracking_id: true },
    })

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (factura.tracking_id) {
      // Unlink and delete
      await prisma.facturas_cliente.update({
        where: { id },
        data: { tracking_id: null },
      })

      await prisma.factura_tracking.delete({
        where: { id: factura.tracking_id },
      })

      // Add a cancellation/removal update log
      await prisma.factura_tracking_updates.create({
        data: {
          factura_id: id,
          status: 'cancelled',
          description: 'Información de envío eliminada',
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE /api/invoices/[id]/tracking]', error)
    return NextResponse.json({ error: 'Error al eliminar la información de envío' }, { status: 500 })
  }
}
