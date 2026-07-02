import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Generate the next sequential remision number: REM-0001, REM-0002, etc. */
async function generateNumeroRemision(): Promise<string> {
  const count = await prisma.remisiones.count()
  const next = count + 1
  return `REM-${String(next).padStart(4, '0')}`
}

/**
 * Recalculate invoice estado_surtido based on the actual sum of
 * cantidad_entregada across all factura_productos after any changes.
 */
async function recalcEstadoSurtido(tx: any, facturaId: string): Promise<string> {
  const fps = await tx.factura_productos.findMany({ where: { factura_id: facturaId } })
  if (!fps || fps.length === 0) return 'no_surtida'

  const anyDelivered = fps.some((fp: any) => (fp.cantidad_entregada || 0) > 0)
  const allDelivered = fps.every((fp: any) => (fp.cantidad_entregada || 0) >= fp.cantidad_facturada)

  if (allDelivered) return 'completa'
  if (anyDelivered) return 'parcial'
  return 'no_surtida'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, observaciones, items, remision_id } = body

    if (!action || !['create', 'edit'].includes(action)) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    // Fetch the factura with its products
    const factura = await prisma.facturas_cliente.findUnique({
      where: { id },
      include: { factura_productos: true }
    })

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    // ──────────────────────────────────────────────
    // CREATE
    // ──────────────────────────────────────────────
    if (action === 'create') {
      // Auto-generate a unique numero_remision
      let numero_remision = await generateNumeroRemision()
      // Safety: ensure uniqueness even under race conditions
      let existing = await prisma.remisiones.findUnique({ where: { numero_remision } })
      while (existing) {
        const n = parseInt(numero_remision.replace('REM-', ''), 10) + 1
        numero_remision = `REM-${String(n).padStart(4, '0')}`
        existing = await prisma.remisiones.findUnique({ where: { numero_remision } })
      }

      await prisma.$transaction(async (tx: any) => {
        // 1. Create remision record
        const remision = await tx.remisiones.create({
          data: {
            numero_remision,
            factura_id: factura.id,
            cliente_id: factura.cliente_id,
            cliente_nombre: factura.cliente_nombre,
            numero_factura: factura.numero_factura,
            observaciones: observaciones || null,
            estado: 'preparando',
            tipo: 'venta'
          }
        })

        // 2. Create remision_productos & update cantidad_entregada
        for (const item of items) {
          const { factura_producto_id, producto_nombre, cantidad } = item
          if (cantidad > 0) {
            await tx.remision_productos.create({
              data: {
                remision_id: remision.id,
                producto_id: null,
                producto_nombre,
                cantidad
              }
            })

            // Update delivered qty on the matching factura_producto
            const fp = factura.factura_productos.find((p: any) => p.id === factura_producto_id)
            if (fp) {
              const newDelivered = (fp.cantidad_entregada || 0) + cantidad
              await tx.factura_productos.update({
                where: { id: fp.id },
                data: { cantidad_entregada: newDelivered }
              })
            }
          }
        }

        // 3. Recalculate and update invoice estado_surtido
        const nuevoEstado = await recalcEstadoSurtido(tx, factura.id)
        await tx.facturas_cliente.update({
          where: { id: factura.id },
          data: { estado_surtido: nuevoEstado }
        })
      })

      return NextResponse.json({ success: true, message: 'Remisión creada exitosamente' })
    }

    // ──────────────────────────────────────────────
    // EDIT
    // ──────────────────────────────────────────────
    if (action === 'edit') {
      if (!remision_id) {
        return NextResponse.json({ error: 'ID de remisión es requerido para editar' }, { status: 400 })
      }

      const existingRemision = await prisma.remisiones.findUnique({
        where: { id: remision_id },
        include: { remision_productos: true }
      })

      if (!existingRemision) {
        return NextResponse.json({ error: 'Remisión no encontrada' }, { status: 404 })
      }

      await prisma.$transaction(async (tx: any) => {
        // 1. Update remision metadata
        await tx.remisiones.update({
          where: { id: remision_id },
          data: {
            observaciones: observaciones || null,
            fecha_edicion: new Date()
          }
        })

        // 2. Build a map of old remision_productos by producto_nombre
        const oldByName = new Map<string, { id: string; cantidad: number }>()
        existingRemision.remision_productos.forEach((rp: any) => {
          if (rp.producto_nombre) oldByName.set(rp.producto_nombre, { id: rp.id, cantidad: rp.cantidad })
        })

        // 3. Apply diffs for each item in the incoming payload
        for (const item of items) {
          const { factura_producto_id, producto_nombre, cantidad } = item
          const old = oldByName.get(producto_nombre)
          const oldQty = old?.cantidad ?? 0
          const diff = cantidad - oldQty

          // Update/create/delete the remision_productos row
          if (old) {
            if (cantidad === 0) {
              await tx.remision_productos.delete({ where: { id: old.id } })
            } else if (diff !== 0) {
              await tx.remision_productos.update({ where: { id: old.id }, data: { cantidad } })
            }
          } else if (cantidad > 0) {
            await tx.remision_productos.create({
              data: { remision_id, producto_id: null, producto_nombre, cantidad }
            })
          }

          // Apply the quantity diff to the factura_producto
          if (diff !== 0) {
            const fp = factura.factura_productos.find((p: any) => p.id === factura_producto_id)
            if (fp) {
              const newDelivered = Math.max(0, (fp.cantidad_entregada || 0) + diff)
              await tx.factura_productos.update({
                where: { id: fp.id },
                data: { cantidad_entregada: newDelivered }
              })
            }
          }
        }

        // 4. Recalculate invoice estado_surtido (can move to no_surtida, parcial, completa)
        const nuevoEstado = await recalcEstadoSurtido(tx, factura.id)
        await tx.facturas_cliente.update({
          where: { id: factura.id },
          data: { estado_surtido: nuevoEstado }
        })
      })

      return NextResponse.json({ success: true, message: 'Remisión actualizada exitosamente' })
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
  } catch (error: any) {
    console.error('Error in remisiones API:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}
