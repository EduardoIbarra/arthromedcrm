import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, numero_remision, observaciones, items, remision_id } = body

    if (!action || !['create', 'edit'].includes(action)) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    // Fetch the factura
    const factura = await prisma.facturas_cliente.findUnique({
      where: { id },
      include: { factura_productos: true }
    })

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (action === 'create') {
      if (!numero_remision) {
        return NextResponse.json({ error: 'El número de remisión es requerido' }, { status: 400 })
      }

      // Check if numero_remision already exists
      const existingRemision = await prisma.remisiones.findUnique({
        where: { numero_remision }
      })
      if (existingRemision) {
        return NextResponse.json({ error: 'El número de remisión ya existe' }, { status: 400 })
      }

      await prisma.$transaction(async (tx: any) => {
        // 1. Create remision
        const remision = await tx.remisiones.create({
          data: {
            numero_remision,
            factura_id: factura.id,
            cliente_id: factura.cliente_id,
            cliente_nombre: factura.cliente_nombre,
            numero_factura: factura.numero_factura,
            observaciones,
            estado: 'entregado',
            tipo: 'venta'
          }
        })

        // 2. Add products & update delivered quantities
        for (const item of items) {
          const { factura_producto_id, producto_id, producto_nombre, cantidad } = item
          if (cantidad > 0) {
            await tx.remision_productos.create({
              data: {
                remision_id: remision.id,
                producto_id,
                producto_nombre,
                cantidad
              }
            })

            // Update delivered qty on factura_producto
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

        // 3. Mark invoice surtido as parcial
        await tx.facturas_cliente.update({
          where: { id: factura.id },
          data: { estado_surtido: 'parcial' }
        })
      })

      return NextResponse.json({ success: true, message: 'Remisión creada exitosamente' })
    }

    if (action === 'edit') {
      if (!remision_id) {
        return NextResponse.json({ error: 'ID de remisión es requerido para editar' }, { status: 400 })
      }

      // Fetch the existing remision and its products
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
            observaciones,
            fecha_edicion: new Date()
          }
        })

        // Map existing remision_productos by product_id
        const oldItemsMap = new Map<string, number>()
        existingRemision.remision_productos.forEach((rp: any) => {
          if (rp.producto_id) oldItemsMap.set(rp.producto_id, rp.cantidad)
        })

        // 2. Adjust products & quantity differences
        for (const item of items) {
          const { factura_producto_id, producto_id, producto_nombre, cantidad } = item
          if (!producto_id) continue

          const oldQty = oldItemsMap.get(producto_id) || 0
          const diff = cantidad - oldQty

          if (diff !== 0) {
            // Update or create remision_productos
            const existingRp = existingRemision.remision_productos.find((rp: any) => rp.producto_id === producto_id)
            if (existingRp) {
              if (cantidad === 0) {
                // Delete if quantity is set to 0
                await tx.remision_productos.delete({
                  where: { id: existingRp.id }
                })
              } else {
                await tx.remision_productos.update({
                  where: { id: existingRp.id },
                  data: { cantidad }
                })
              }
            } else if (cantidad > 0) {
              await tx.remision_productos.create({
                data: {
                  remision_id: remision_id,
                  producto_id,
                  producto_nombre,
                  cantidad
                }
              })
            }

            // Update delivered qty on factura_producto
            const fp = factura.factura_productos.find((p: any) => p.id === factura_producto_id)
            if (fp) {
              const newDelivered = (fp.cantidad_entregada || 0) + diff
              await tx.factura_productos.update({
                where: { id: fp.id },
                data: { cantidad_entregada: newDelivered }
              })
            }
          }
        }

        // 3. Mark invoice surtido as parcial
        await tx.facturas_cliente.update({
          where: { id: factura.id },
          data: { estado_surtido: 'parcial' }
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
