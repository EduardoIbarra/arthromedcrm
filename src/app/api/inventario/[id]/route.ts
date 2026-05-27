import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/inventario/[id] — update stock_actual for a producto
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await req.json()
    const stock = parseInt(body.stock_actual, 10)

    if (isNaN(stock) || stock < 0) {
      return NextResponse.json(
        { error: 'stock_actual debe ser un número entero no negativo.' },
        { status: 400 }
      )
    }

    await prisma.$executeRaw`
      UPDATE public.productos
      SET stock_actual = ${stock},
          stock_updated_at = NOW()
      WHERE id = ${id}::uuid
    `

    return NextResponse.json({ success: true, stock_actual: stock, stock_updated_at: new Date().toISOString() })
  } catch (err: any) {
    console.error('[PATCH /api/inventario/:id]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
