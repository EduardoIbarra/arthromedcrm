import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/invoices/[id]/products
 * Add a new manual product line item to the invoice.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: facturaId } = await params

  try {
    const body = await request.json()
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    if (!note) {
      return NextResponse.json(
        { error: 'Debes indicar una nota que justifique el cambio.' },
        { status: 400 }
      )
    }

    const factura = await prisma.facturas_cliente.findUnique({
      where: { id: facturaId },
    })
    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    const nextQty = Math.max(1, Math.round(Number(body.cantidad_facturada) || 1))
    const nextPrice = Math.max(0, Number(body.precio_unitario) || 0)
    const nextImporte = Math.round(nextQty * nextPrice * 100) / 100

    let nextProductoId = body.producto_id ? String(body.producto_id) : null
    let nextNombre = typeof body.producto_nombre === 'string' ? body.producto_nombre.trim() : ''
    let nextCodigo = body.producto_codigo ? String(body.producto_codigo).trim() : null
    let nextLinea = null

    if (!nextNombre) {
      return NextResponse.json({ error: 'El nombre del producto es requerido' }, { status: 400 })
    }

    if (nextProductoId) {
      const catalog = await prisma.productos.findUnique({ where: { id: nextProductoId } })
      if (!catalog) {
        return NextResponse.json({ error: 'Producto de catálogo no encontrado' }, { status: 404 })
      }
      nextNombre = nextNombre || catalog.nombre
      nextCodigo = nextCodigo || catalog.consecutivo_alg || catalog.order_code || null
      nextLinea = catalog.line || null
    }

    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const auditLine = `[${stamp}] Alta partida manual: "${nextNombre}" x ${nextQty} (Precio: ${nextPrice.toFixed(2)}). Nota: ${note}`
    const prevObs = (factura.observaciones || '').trim()
    const nextObs = prevObs ? `${prevObs}\n${auditLine}` : auditLine

    const newProduct = await prisma.$transaction(async (tx: typeof prisma) => {
      const product = await tx.factura_productos.create({
        data: {
          factura_id: facturaId,
          producto_id: nextProductoId,
          producto_nombre: nextNombre,
          producto_codigo: nextCodigo,
          cantidad_facturada: nextQty,
          cantidad_entregada: 0,
          precio_unitario: nextPrice,
          importe: nextImporte,
          linea: nextLinea,
          manual: true,
        },
      })

      // Recalculate invoice totals from all lines (assume IVA rate from existing invoice)
      const allLines = await tx.factura_productos.findMany({
        where: { factura_id: facturaId },
      })
      const subtotal = allLines.reduce(
        (sum: number, row: any) => sum + Number(row.importe || 0),
        0
      )
      const prevSub = Number(factura.subtotal || 0)
      const prevIva = Number(factura.iva || 0)
      const ivaRate =
        prevSub > 0 && prevIva > 0 ? prevIva / prevSub : 0.16
      const iva = Math.round(subtotal * ivaRate * 100) / 100
      const total = Math.round((subtotal + iva) * 100) / 100

      await tx.facturas_cliente.update({
        where: { id: facturaId },
        data: {
          subtotal,
          iva,
          total,
          observaciones: nextObs,
          updated_at: new Date(),
        },
      })

      return product
    })

    return NextResponse.json({
      product: {
        ...newProduct,
        precio_unitario: Number(newProduct.precio_unitario || 0),
        importe: Number(newProduct.importe || 0),
      },
      note: auditLine,
    })
  } catch (error: any) {
    console.error('[POST invoice product]', error)
    return NextResponse.json(
      { error: error.message || 'Error al agregar producto a la factura' },
      { status: 500 }
    )
  }
}
