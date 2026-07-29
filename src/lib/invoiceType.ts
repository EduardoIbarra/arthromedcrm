export type TipoFactura = 'venta' | 'renta' | 'servicio'

export function getItemTipo(item: {
  producto_nombre?: string | null
  productos?: { tipo?: string | null; categoria?: string | null } | null
}): TipoFactura {
  const name = (item.producto_nombre || '').toLowerCase()
  const prodTipo = (item.productos?.tipo || '').toLowerCase()
  const prodCat = (item.productos?.categoria || '').toLowerCase()

  if (
    name.includes('renta') ||
    name.includes('alquiler') ||
    name.includes('arrendamiento') ||
    prodTipo.includes('renta') ||
    prodCat.includes('renta')
  ) {
    return 'renta'
  }

  if (
    name.includes('servicio') ||
    name.includes('mantenimiento') ||
    name.includes('reparacion') ||
    name.includes('capacitacion') ||
    name.includes('soporte') ||
    name.includes('poliza') ||
    prodTipo.includes('servicio') ||
    prodCat.includes('servicio')
  ) {
    return 'servicio'
  }

  return 'venta'
}

export function calculateTipoFactura(
  items: Array<{
    producto_nombre?: string | null
    productos?: { tipo?: string | null; categoria?: string | null } | null
  }> | null | undefined
): TipoFactura {
  if (!items || items.length === 0) return 'venta'
  const types = new Set(items.map(getItemTipo))
  if (types.has('renta')) return 'renta'
  if (types.has('servicio')) return 'servicio'
  return 'venta'
}
