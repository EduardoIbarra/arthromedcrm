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

type RemisionRecomputeTx = {
  remisiones: {
    findMany: (args: any) => Promise<
      Array<{
        id: string
        estado: string | null
        remision_productos: Array<{
          producto_id: string | null
          producto_nombre: string
          cantidad: number
        }>
      }>
    >
  }
  factura_productos: {
    findMany: (args: any) => Promise<
      Array<{
        id: string
        producto_id: string | null
        producto_nombre: string
        cantidad_facturada: number
        cantidad_entregada: number
      }>
    >
    update: (args: any) => Promise<any>
  }
  facturas_cliente: { update: (args: any) => Promise<any> }
}

/**
 * Source of truth for delivered qty: sum of remision_productos for remisiones
 * linked to this invoice (excluding cancelled). Caps at cantidad_facturada.
 * Then recalculates estado_surtido.
 *
 * Call this after Alegra product rebuild so sync never wipes deliveries.
 */
export async function recomputeEntregadaFromRemisiones(
  tx: RemisionRecomputeTx,
  facturaId: string
): Promise<{ updatedLines: number; estado: EstadoSurtido }> {
  const remisiones = await tx.remisiones.findMany({
    where: { factura_id: facturaId },
    include: { remision_productos: true },
  })

  const cancelled = new Set(['cancelada', 'cancelado', 'anulado', 'anulada'])
  // Name pool always filled; product_id pool for catalog-linked remision lines.
  // After a product_id allocation we also debit the name pool so the same units
  // are not applied twice to another invoice line.
  const byName = new Map<string, number>()
  const byProductId = new Map<string, number>()

  for (const rem of remisiones) {
    const est = String(rem.estado || '').toLowerCase()
    if (cancelled.has(est)) continue
    for (const rp of rem.remision_productos || []) {
      const qty = Number(rp.cantidad) || 0
      if (qty <= 0) continue
      const nameKey = (rp.producto_nombre || '').trim().toLowerCase()
      if (nameKey) {
        byName.set(nameKey, (byName.get(nameKey) || 0) + qty)
      }
      if (rp.producto_id) {
        byProductId.set(rp.producto_id, (byProductId.get(rp.producto_id) || 0) + qty)
      }
    }
  }

  const fps = await tx.factura_productos.findMany({
    where: { factura_id: facturaId },
  })

  const nameRemaining = new Map(byName)
  const productIdRemaining = new Map(byProductId)
  const namesWithRemision = new Set(byName.keys())
  const pidsWithRemision = new Set(byProductId.keys())
  let updatedLines = 0

  for (const fp of fps) {
    const fact = Number(fp.cantidad_facturada) || 0
    const nameKey = (fp.producto_nombre || '').trim().toLowerCase()
    const matchedRemision =
      (fp.producto_id != null && pidsWithRemision.has(fp.producto_id)) ||
      (nameKey !== '' && namesWithRemision.has(nameKey))

    // Only rewrite lines that appear in remisiones — leave manual entregada alone otherwise
    if (!matchedRemision) continue

    let delivered = 0

    // Prefer product_id match (catalog link on remision line)
    if (fp.producto_id && productIdRemaining.has(fp.producto_id)) {
      const avail = productIdRemaining.get(fp.producto_id) || 0
      const take = Math.min(fact, avail)
      delivered += take
      productIdRemaining.set(fp.producto_id, Math.max(0, avail - take))
      if (nameKey && take > 0) {
        const nAvail = nameRemaining.get(nameKey) || 0
        nameRemaining.set(nameKey, Math.max(0, nAvail - take))
      }
    }

    // Then product name (how remisiones store lines when created from the UI)
    if (delivered < fact && nameKey && nameRemaining.has(nameKey)) {
      const avail = nameRemaining.get(nameKey) || 0
      const take = Math.min(fact - delivered, avail)
      delivered += take
      nameRemaining.set(nameKey, Math.max(0, avail - take))
    }

    const next = Math.max(0, Math.min(fact, delivered))
    const prev = Number(fp.cantidad_entregada) || 0
    if (next !== prev) updatedLines++
    await tx.factura_productos.update({
      where: { id: fp.id },
      data: { cantidad_entregada: next },
    })
  }

  const estado = await recalcAndPersistEstadoSurtido(tx, facturaId)
  return { updatedLines, estado }
}
