import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/invoices/[id]/products/[productId]
 * Update invoice line: product, quantity, unit price. Note is required.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const { id: facturaId, productId } = await params

  try {
    const body = await request.json()
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    if (!note) {
      return NextResponse.json(
        { error: 'Debes indicar una nota que justifique el cambio.' },
        { status: 400 }
      )
    }

    const line = await prisma.factura_productos.findUnique({
      where: { id: productId },
    })
    if (!line || line.factura_id !== facturaId) {
      return NextResponse.json({ error: 'Producto de factura no encontrado' }, { status: 404 })
    }

    const factura = await prisma.facturas_cliente.findUnique({
      where: { id: facturaId },
    })
    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    // Resolve product change
    let nextProductoId = line.producto_id
    let nextNombre = line.producto_nombre
    let nextCodigo = line.producto_codigo
    let nextLinea = line.linea

    if (body.producto_id !== undefined) {
      const pid = body.producto_id ? String(body.producto_id) : null
      if (pid) {
        const catalog = await prisma.productos.findUnique({ where: { id: pid } })
        if (!catalog) {
          return NextResponse.json({ error: 'Producto de catálogo no encontrado' }, { status: 404 })
        }
        nextProductoId = catalog.id
        nextNombre = catalog.nombre
        nextCodigo = catalog.consecutivo_alg || catalog.order_code || nextCodigo
        nextLinea = catalog.line || nextLinea
        // Optional override of unit price from catalog if caller didn't send precio
        if (body.precio_unitario === undefined && catalog.precio_unitario != null) {
          body.precio_unitario = Number(catalog.precio_unitario)
        }
      } else {
        nextProductoId = null
      }
    }

    if (typeof body.producto_nombre === 'string' && body.producto_nombre.trim()) {
      nextNombre = body.producto_nombre.trim()
    }
    if (body.producto_codigo !== undefined) {
      nextCodigo = body.producto_codigo ? String(body.producto_codigo) : null
    }

    let nextQty = line.cantidad_facturada
    if (body.cantidad_facturada !== undefined) {
      const q = Number(body.cantidad_facturada)
      if (!Number.isFinite(q) || q < 1) {
        return NextResponse.json({ error: 'La cantidad debe ser al menos 1' }, { status: 400 })
      }
      nextQty = Math.round(q)
    }

    let nextPrice =
      line.precio_unitario != null ? Number(line.precio_unitario) : 0
    if (body.precio_unitario !== undefined) {
      const p = Number(body.precio_unitario)
      if (!Number.isFinite(p) || p < 0) {
        return NextResponse.json({ error: 'Precio unitario inválido' }, { status: 400 })
      }
      nextPrice = p
    }

    const nextImporte = Math.round(nextQty * nextPrice * 100) / 100
    const nextEntregada = Math.min(line.cantidad_entregada || 0, nextQty)

    // Build audit snippet
    const changes: string[] = []
    if (nextNombre !== line.producto_nombre) {
      changes.push(`producto: "${line.producto_nombre}" → "${nextNombre}"`)
    }
    if ((nextCodigo || '') !== (line.producto_codigo || '')) {
      changes.push(`código: "${line.producto_codigo || '-'}" → "${nextCodigo || '-'}"`)
    }
    if (nextQty !== line.cantidad_facturada) {
      changes.push(`cantidad: ${line.cantidad_facturada} → ${nextQty}`)
    }
    if (nextPrice !== Number(line.precio_unitario || 0)) {
      changes.push(
        `precio: ${Number(line.precio_unitario || 0).toFixed(2)} → ${nextPrice.toFixed(2)}`
      )
    }
    if (changes.length === 0) {
      return NextResponse.json({ error: 'No hay cambios que guardar' }, { status: 400 })
    }

    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const auditLine = `[${stamp}] Edición partida: ${changes.join('; ')}. Nota: ${note}`
    const prevObs = (factura.observaciones || '').trim()
    const nextObs = prevObs ? `${prevObs}\n${auditLine}` : auditLine

    const updated = await prisma.$transaction(async (tx: typeof prisma) => {
      const product = await tx.factura_productos.update({
        where: { id: productId },
        data: {
          producto_id: nextProductoId,
          producto_nombre: nextNombre,
          producto_codigo: nextCodigo,
          cantidad_facturada: nextQty,
          cantidad_entregada: nextEntregada,
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
        (sum: number, row: { importe: unknown }) => sum + Number(row.importe || 0),
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
        ...updated,
        precio_unitario: Number(updated.precio_unitario || 0),
        importe: Number(updated.importe || 0),
      },
      note: auditLine,
    })
  } catch (error: any) {
    console.error('[PATCH invoice product]', error)
    return NextResponse.json({ error: error.message || 'Error al actualizar producto' }, { status: 500 })
  }
}
