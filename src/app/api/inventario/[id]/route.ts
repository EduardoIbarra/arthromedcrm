import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/inventario/[id] — update quantity for almacen_propio
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()
    const quantity = parseInt(body.stock_actual, 10)

    if (isNaN(quantity) || quantity < 0) {
      return NextResponse.json(
        { error: 'cantidad debe ser un número entero no negativo.' },
        { status: 400 }
      )
    }

    const updated = await prisma.almacen_propio.update({
      where: { id },
      data: {
        cantidad: quantity,
        updated_at: new Date()
      }
    })

    return NextResponse.json({ success: true, stock_actual: quantity, stock_updated_at: updated.updated_at, inventario_id: 'almacen-propio' })
  } catch (err: any) {
    console.error('[PATCH /api/inventario/:id]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
