import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, contactInfo, congressId, notes, items } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'La orden debe contener al menos un producto' }, { status: 400 })
    }

    if (!congressId) {
      return NextResponse.json({ error: 'Se requiere el ID del congreso' }, { status: 400 })
    }

    let finalClientId = clientId

    // If no clientId, check contactInfo and find/create client
    if (!finalClientId) {
      if (!contactInfo || !contactInfo.name || !contactInfo.email || !contactInfo.phone) {
        return NextResponse.json({ 
          error: 'Falta información de contacto. Especifique ID de cliente o Nombre, Correo y Teléfono.' 
        }, { status: 400 })
      }

      const email = contactInfo.email.trim().toLowerCase()
      const phone = contactInfo.phone.trim()

      // Deduplication: look for existing client by email or phone
      const existingClient = await prisma.clients.findFirst({
        where: {
          OR: [
            { email_primary: email },
            { email_contact: email },
            { phone: phone }
          ]
        }
      })

      if (existingClient) {
        finalClientId = existingClient.id
      } else {
        // Create new client lead/prospect
        const newClient = await prisma.clients.create({
          data: {
            name: contactInfo.name.trim(),
            email_primary: email,
            email_contact: email,
            phone: phone,
            status: 'Nuevo Prospecto',
            source: 'Landing Page Pre-Order',
            registered_at: new Date()
          }
        })
        finalClientId = newClient.id
      }
    } else {
      // Verify existing client
      const clientExists = await prisma.clients.findUnique({
        where: { id: finalClientId }
      })
      if (!clientExists) {
        return NextResponse.json({ error: 'El ID del cliente especificado no existe' }, { status: 404 })
      }
    }

    // Calculate total amount
    let totalAmount = 0
    const orderItemsData = items.map((item: any) => {
      const quantity = Number(item.quantity)
      const unitPrice = Number(item.unitPrice)
      const totalPrice = quantity * unitPrice
      totalAmount += totalPrice

      return {
        product_id: item.productId,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice
      }
    })

    // Perform transaction to create order and items
    const order = await prisma.$transaction(async (tx: any) => {
      const newOrder = await tx.orders.create({
        data: {
          client_id: finalClientId,
          congress_id: congressId,
          status: 'pending',
          total_amount: totalAmount,
          currency: 'MXN',
          notes: notes || 'Pre-orden desde Landing Page',
          order_items: {
            create: orderItemsData
          }
        },
        include: {
          order_items: true
        }
      })
      return newOrder
    })

    return NextResponse.json({ 
      success: true, 
      clientId: finalClientId, 
      orderId: order.id 
    }, { status: 201 })

  } catch (error: any) {
    console.error('Error placing pre-order:', error)
    return NextResponse.json({ error: error.message || 'Error al procesar la orden' }, { status: 500 })
  }
}
