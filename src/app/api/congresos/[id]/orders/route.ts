import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const orders = await prisma.orders.findMany({
      where: { congress_id: id },
      include: {
        clients: {
          select: {
            name: true,
            email_primary: true,
            phone: true
          }
        },
        order_items: true
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    // Fetch product info manually in one batch to decorate the order items
    const productIds = Array.from(new Set(orders.flatMap((o: any) => o.order_items.map((oi: any) => oi.product_id))))
    
    let productMap = new Map()
    if (productIds.length > 0) {
      const products = await prisma.productos.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          nombre: true,
          model: true,
          order_code: true,
          nombre_lista: true
        }
      })
      products.forEach((p: any) => productMap.set(p.id, { ...p, description: p.nombre }))
    }

    const decoratedOrders = orders.map((order: any) => ({
      ...order,
      order_items: order.order_items.map((oi: any) => ({
        ...oi,
        product: productMap.get(oi.product_id) || {
          description: 'Producto desconocido',
          model: '',
          order_code: ''
        }
      }))
    }))

    return NextResponse.json({ data: decoratedOrders })

  } catch (error: any) {
    console.error('Error fetching congress orders:', error)
    return NextResponse.json({ error: error.message || 'Error al obtener las pre-órdenes' }, { status: 500 })
  }
}
