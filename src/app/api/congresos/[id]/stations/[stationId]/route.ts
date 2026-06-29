import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PATCH /api/congresos/[id]/stations/[stationId] — update station name + replace products
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stationId: string }> }
) {
  const { stationId } = await params
  try {
    const body = await req.json()
    const { name, products } = body

    const result = await prisma.$transaction(async (tx: any) => {
      // Update station name if provided
      await tx.congreso_stations.update({
        where: { id: stationId },
        data: {
          ...(name !== undefined && { name })
        }
      })

      // Replace products if provided
      if (Array.isArray(products)) {
        await tx.congreso_station_products.deleteMany({ where: { station_id: stationId } })
        if (products.length > 0) {
          await tx.congreso_station_products.createMany({
            data: products.map((p: any) => ({
              station_id: stationId,
              product_id: p.product_id,
              cantidad: parseInt(p.cantidad) || 1
            }))
          })
        }
      }

      return tx.congreso_stations.findUnique({
        where: { id: stationId },
        include: {
          congreso_station_products: {
            include: {
              productos: {
                select: { id: true, nombre: true, precio_unitario: true, categoria: true, tipo: true }
              }
            },
            orderBy: { created_at: 'asc' }
          }
        }
      })
    })

    return NextResponse.json({ data: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/congresos/[id]/stations/[stationId] — delete a station (products cascade)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; stationId: string }> }
) {
  const { stationId } = await params
  try {
    await prisma.congreso_stations.delete({ where: { id: stationId } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
