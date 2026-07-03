import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await prisma.purchase_orders.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            productos: true
          }
        }
      }
    })

    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (error: any) {
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
    const { status, notes, items } = body

    const updatedOrder = await prisma.$transaction(async (tx: any) => {
      // 1. Update purchase order fields
      const order = await tx.purchase_orders.update({
        where: { id },
        data: {
          status: status || 'PENDING',
          notes: notes !== undefined ? notes : null,
        }
      })

      // 2. If items were passed, update them
      if (items && Array.isArray(items)) {
        // Delete existing items
        await tx.purchase_order_items.deleteMany({
          where: { purchase_order_id: id }
        })

        // Create new items
        await Promise.all(
          items.map((item: any) =>
            tx.purchase_order_items.create({
              data: {
                purchase_order_id: id,
                product_id: item.product_id,
                quantity: parseInt(item.quantity, 10)
              }
            })
          )
        )
      }

      return tx.purchase_orders.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              productos: true
            }
          }
        }
      })
    })

    return NextResponse.json({ data: updatedOrder })
  } catch (error: any) {
    console.error('Error in PUT /api/purchase-orders/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.purchase_orders.delete({
      where: { id }
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error in DELETE /api/purchase-orders/[id]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
