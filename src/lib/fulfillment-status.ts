/**
 * Invoice fulfillment (estado_surtido) is derived from product line deliveries.
 * Values: no_surtida | parcial | completa
 * Legacy alias "surtida" is treated as complete when reading.
 */

export type EstadoSurtido = 'no_surtida' | 'parcial' | 'completa'

export type ProductFulfillmentLine = {
  cantidad_facturada?: number | null
  cantidad_entregada?: number | null
}

/** Compute status from line items (source of truth). */
export function computeEstadoSurtido(
  products: ProductFulfillmentLine[] | null | undefined
): EstadoSurtido {
  const lines = (products || []).filter(p => (Number(p.cantidad_facturada) || 0) > 0)
  if (lines.length === 0) return 'no_surtida'

  const anyDelivered = lines.some(p => (Number(p.cantidad_entregada) || 0) > 0)
  const allDelivered = lines.every(
    p => (Number(p.cantidad_entregada) || 0) >= (Number(p.cantidad_facturada) || 0)
  )

  if (allDelivered) return 'completa'
  if (anyDelivered) return 'parcial'
  return 'no_surtida'
}

/** Normalize legacy values for UI comparisons. */
export function normalizeEstadoSurtido(value: string | null | undefined): EstadoSurtido {
  if (value === 'completa' || value === 'surtida') return 'completa'
  if (value === 'parcial') return 'parcial'
  return 'no_surtida'
}

/**
 * Recalculate and persist estado_surtido for one invoice from its products.
 * Note: cantidad_pendiente is a generated column (facturada - entregada) — never write it.
 */
export async function recalcAndPersistEstadoSurtido(
  tx: {
    factura_productos: {
      findMany: (args: any) => Promise<any[]>
    }
    facturas_cliente: { update: (args: any) => Promise<any> }
  },
  facturaId: string
): Promise<EstadoSurtido> {
  const fps = await tx.factura_productos.findMany({ where: { factura_id: facturaId } })
  const estado = computeEstadoSurtido(fps)

  await tx.facturas_cliente.update({
    where: { id: facturaId },
    data: { estado_surtido: estado },
  })

  return estado
}
