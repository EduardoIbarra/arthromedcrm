import { NextRequest, NextResponse } from 'next/server'
import { querySegundaDB } from '@/lib/segundaDB'

export const dynamic = 'force-dynamic'

export interface OrdenProducto {
  id: string
  orden_id: string
  producto_id: string | null
  producto_nombre: string | null
  cantidad_ordenada: number
  cantidad_recibida: number | null
}

export interface OrdenCompra {
  id: string
  numero_orden: string
  proveedor: string | null
  fecha_orden: string | null
  fecha_esperada: string | null
  estado: string | null
  observaciones: string | null
  created_at: string | null
  productos: OrdenProducto[]
  // Computed totals
  total_ordenado: number
  total_recibido: number
}

/**
 * GET /api/ordenes-compra
 * Returns ordenes_compra from the second DB that have at least one product
 * where cantidad_recibida < cantidad_ordenada (or cantidad_recibida IS NULL).
 * 
 * Optionally filter by ?estado= (defaults to all with pending products).
 */
export async function GET(request: NextRequest) {
  try {
    // Fetch ordenes that have at least one pending product
    const orders = await querySegundaDB<{
      id: string
      numero_orden: string
      proveedor: string | null
      fecha_orden: string | null
      fecha_esperada: string | null
      estado: string | null
      observaciones: string | null
      created_at: string | null
    }>(`
      SELECT DISTINCT oc.*
      FROM ordenes_compra oc
      INNER JOIN orden_productos op ON op.orden_id = oc.id
      WHERE (op.cantidad_recibida IS NULL OR op.cantidad_recibida < op.cantidad_ordenada)
      ORDER BY oc.created_at DESC
    `)

    if (orders.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Fetch all products for those orders in one query
    const orderIds = orders.map(o => o.id)
    const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(', ')
    const productos = await querySegundaDB<OrdenProducto>(`
      SELECT id, orden_id, producto_id, producto_nombre, cantidad_ordenada, 
             COALESCE(cantidad_recibida, 0) AS cantidad_recibida
      FROM orden_productos
      WHERE orden_id IN (${placeholders})
      ORDER BY producto_nombre ASC
    `, orderIds)

    // Fetch nombre_lista from main database to resolve names
    const prisma = (await import('@/lib/prisma')).default;
    const productIds = productos.map((p: any) => p.producto_id).filter(Boolean) as string[];
    const mainProducts = await prisma.productos.findMany({
      where: { id: { in: productIds } },
      select: { id: true, nombre_lista: true }
    });
    const nameMap = new Map<string, string | null>(mainProducts.map((p: any) => [p.id, p.nombre_lista]));

    const resolvedProductos = productos.map((p: any) => ({
      ...p,
      producto_nombre: (p.producto_id ? nameMap.get(p.producto_id) : null) || p.producto_nombre
    })) as OrdenProducto[];

    // Group products by order and compute totals
    const productosByOrder = new Map<string, OrdenProducto[]>()
    for (const p of resolvedProductos) {
      if (!productosByOrder.has(p.orden_id)) {
        productosByOrder.set(p.orden_id, [])
      }
      productosByOrder.get(p.orden_id)!.push(p)
    }

    const data: OrdenCompra[] = orders.map(o => {
      const prods = productosByOrder.get(o.id) || []
      const total_ordenado = prods.reduce((sum, p) => sum + (p.cantidad_ordenada || 0), 0)
      const total_recibido = prods.reduce((sum, p) => sum + (p.cantidad_recibida || 0), 0)
      return {
        ...o,
        productos: prods,
        total_ordenado,
        total_recibido,
      }
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('[ordenes-compra] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
