import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const previo = await prisma.previos.findUnique({
      where: { id },
      include: {
        detalle_previo: {
          orderBy: { orden: 'asc' }
        },
      }
    })

    if (!previo) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ data: previo })
  } catch (error) {
    console.error('Error in /api/previos/[id]:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // 1. Order-only reordering update
    if (body.items && Array.isArray(body.items) && !body.cliente_id && body.cliente_nombre === undefined) {
      await Promise.all(
        body.items.map((item: any) =>
          prisma.detalle_previo.update({
            where: { id: item.id },
            data: { orden: item.orden }
          })
        )
      )
      return NextResponse.json({ success: true })
    }

    // 2. Full edit of Previo metadata and items
    const { cliente_id, cliente_nombre, cfdi_id, metodo_pago_id, forma_pago_id, items } = body

    const existing = await prisma.previos.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Previo no encontrado' }, { status: 404 })
    }

    let total_sin_descuento = 0
    let descuento_total_monto = 0
    let total_con_descuento = 0

    const formattedItems = (items || []).map((l: any, index: number) => {
      const cant = Number(l.cantidad) || 1
      const pUnit = Number(l.precio_unitario) || 0
      const descPct = Number(l.descuento_porcentaje) || 0
      const ivaPct = Number(l.iva_porcentaje) || 0

      const subtotalBase = cant * pUnit
      const descMonto = subtotalBase * (descPct / 100)
      const baseConDesc = subtotalBase - descMonto
      const ivaMonto = baseConDesc * (ivaPct / 100)
      const totalItem = baseConDesc + ivaMonto

      total_sin_descuento += subtotalBase
      descuento_total_monto += descMonto
      total_con_descuento += totalItem

      return {
        orden: index,
        producto_id: l.producto_id || null,
        descripcion: l.descripcion || 'Producto',
        cantidad: cant,
        precio_unitario: pUnit,
        descuento_porcentaje: descPct,
        descuento_monto: descMonto,
        iva_porcentaje: ivaPct,
        iva_monto: ivaMonto,
        subtotal: totalItem,
      }
    })

    const updated = await prisma.$transaction(async (tx: any) => {
      // Clear existing items
      await tx.detalle_previo.deleteMany({
        where: { previo_id: id }
      })

      // Update parent record
      const p = await tx.previos.update({
        where: { id },
        data: {
          cliente_id: cliente_id || null,
          cliente_nombre: cliente_nombre || '',
          cfdi_id: cfdi_id || null,
          metodo_pago_id: metodo_pago_id || null,
          forma_pago_id: forma_pago_id || null,
          total_sin_descuento,
          descuento_total_monto,
          total_con_descuento,
          detalle_previo: {
            create: formattedItems
          }
        },
        include: {
          detalle_previo: {
            orderBy: { orden: 'asc' }
          }
        }
      })

      return p
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Error in PUT /api/previos/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existing = await prisma.previos.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Previo no encontrado' }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.detalle_previo.deleteMany({ where: { previo_id: id } }),
      prisma.previos.delete({ where: { id } })
    ])

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/previos/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

