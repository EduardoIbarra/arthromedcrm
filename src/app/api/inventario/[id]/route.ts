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

    const inventario_id = body.inventario_id

    let targetInventarioId = inventario_id
    if (!targetInventarioId) {
      // Fallback to Almacén Principal
      let defaultInv = await prisma.tipos_inventario.findFirst({ where: { nombre: 'Almacén Principal' } })
      if (!defaultInv) {
        defaultInv = await prisma.tipos_inventario.findFirst()
      }
      if (!defaultInv) {
        return NextResponse.json({ error: 'No hay inventarios disponibles.' }, { status: 400 })
      }
      targetInventarioId = defaultInv.id
    }

    const updated = await prisma.inventario_productos.upsert({
      where: {
        tipo_inventario_id_producto_id: {
          tipo_inventario_id: targetInventarioId,
          producto_id: id,
        }
      },
      update: {
        stock_actual: stock,
        stock_updated_at: new Date()
      },
      create: {
        tipo_inventario_id: targetInventarioId,
        producto_id: id,
        stock_actual: stock,
        stock_updated_at: new Date()
      }
    })

    return NextResponse.json({ success: true, stock_actual: stock, stock_updated_at: updated.stock_updated_at, inventario_id: targetInventarioId })
  } catch (err: any) {
    console.error('[PATCH /api/inventario/:id]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
