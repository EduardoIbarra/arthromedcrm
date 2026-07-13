import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { computeEstadoSurtido } from '@/lib/fulfillment-status'

export const dynamic = 'force-dynamic'

/**
 * Bulk set estado_surtido AND keep product quantities consistent:
 * - completa  → cantidad_entregada = cantidad_facturada
 * - no_surtida → cantidad_entregada = 0
 * - parcial   → status only re-derived from current deliveries (cannot invent partials)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, estado_surtido } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Se requieren IDs válidos' }, { status: 400 })
    }

    if (!estado_surtido || !['no_surtida', 'parcial', 'completa'].includes(estado_surtido)) {
      return NextResponse.json({ error: 'Estado de surtido inválido' }, { status: 400 })
    }

    let updated = 0

    await prisma.$transaction(async (tx: any) => {
      for (const id of ids) {
        const fps = await tx.factura_productos.findMany({ where: { factura_id: id } })

        if (estado_surtido === 'completa') {
          for (const fp of fps) {
            const fact = Number(fp.cantidad_facturada) || 0
            await tx.factura_productos.update({
              where: { id: fp.id },
              data: { cantidad_entregada: fact },
            })
          }
          await tx.facturas_cliente.update({
            where: { id },
            data: { estado_surtido: 'completa' },
          })
          updated++
          continue
        }

        if (estado_surtido === 'no_surtida') {
          for (const fp of fps) {
            await tx.factura_productos.update({
              where: { id: fp.id },
              data: { cantidad_entregada: 0 },
            })
          }
          await tx.facturas_cliente.update({
            where: { id },
            data: { estado_surtido: 'no_surtida' },
          })
          updated++
          continue
        }

        // parcial: re-derive from current line deliveries (do not invent quantities)
        const derived = computeEstadoSurtido(fps)
        await tx.facturas_cliente.update({
          where: { id },
          data: { estado_surtido: derived },
        })
        updated++
      }
    })

    return NextResponse.json({
      success: true,
      message: `Se actualizaron ${updated} facturas exitosamente`,
      count: updated,
    })
  } catch (error: any) {
    console.error('Error updating invoices fulfillment status:', error)
    return NextResponse.json({ error: error.message || 'Error al actualizar facturas' }, { status: 500 })
  }
}
