import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await prisma.purchase_orders.findMany({
      orderBy: {
        created_at: 'desc'
      },
      include: {
        items: {
          include: {
            productos: true
          }
        }
      }
    })
    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error in GET /api/purchase-orders:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { status, notes, items } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'La orden debe contener al menos un producto' }, { status: 400 })
    }

    const purchaseOrder = await prisma.$transaction(async (tx: any) => {
      const order = await tx.purchase_orders.create({
        data: {
          status: status || 'PENDING',
          notes: notes || null,
        }
      })

      // Create items
      const createdItems = await Promise.all(
        items.map((item: any) =>
          tx.purchase_order_items.create({
            data: {
              purchase_order_id: order.id,
              product_id: item.product_id,
              quantity: parseInt(item.quantity, 10)
            }
          })
        )
      )

      return {
        ...order,
        items: createdItems
      }
    })

    return NextResponse.json({ data: purchaseOrder }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/purchase-orders:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
