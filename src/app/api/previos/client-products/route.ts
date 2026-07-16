import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('cliente_id')

    // Always load full product catalog
    const allProducts = await prisma.productos.findMany({
      where: { activo: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        nombre_lista: true,
        precio_unitario: true,
        categoria: true,
        tipo: true,
        consecutivo_alg: true,
        alegra_id: true,
      },
    })

    // Build a frequency map from past previos & invoices for this client
    const frequencyMap = new Map<string, number>()

    if (clienteId) {
      // 1. Gather from previos
      const pastPrevios = await prisma.previos.findMany({
        where: { cliente_id: clienteId },
        select: { id: true },
      })

      if (pastPrevios.length > 0) {
        const previoIds = pastPrevios.map((p: { id: string }) => p.id)
        const pastItems = await prisma.detalle_previo.findMany({
          where: { previo_id: { in: previoIds } },
          select: { producto_id: true, descripcion: true },
        })
        for (const item of pastItems as { producto_id: string | null; descripcion: string | null }[]) {
          const key = item.producto_id || `desc:${item.descripcion}`
          frequencyMap.set(key, (frequencyMap.get(key) || 0) + 1)
        }
      }

      // 2. Gather from past facturas (invoices) matching the client's ID, RFC, or exact Name
      const client = await prisma.clients.findUnique({
        where: { id: clienteId },
        select: { id: true, name: true, rfc: true }
      })

      if (client) {
        const whereConditions: any[] = [{ cliente_id: client.id }]
        if (client.rfc) {
          whereConditions.push({ cliente_rfc: { equals: client.rfc, mode: 'insensitive' } })
        }
        if (client.name) {
          whereConditions.push({ cliente_nombre: { equals: client.name, mode: 'insensitive' } })
        }

        const pastInvoices = await prisma.facturas_cliente.findMany({
          where: {
            OR: whereConditions,
            estado: { notIn: ['anulado', 'cancelada'] }
          },
          select: { id: true },
        })

        if (pastInvoices.length > 0) {
          const invoiceIds = pastInvoices.map((f: { id: string }) => f.id)
          const invoiceItems = await prisma.factura_productos.findMany({
            where: { factura_id: { in: invoiceIds } },
            select: { producto_id: true, producto_nombre: true },
          })
          for (const item of invoiceItems as { producto_id: string | null; producto_nombre: string | null }[]) {
            const key = item.producto_id || `desc:${item.producto_nombre}`
            frequencyMap.set(key, (frequencyMap.get(key) || 0) + 1)
          }
        }
      }
    }

    // Annotate products with frequency
    const annotated = allProducts.map((p: typeof allProducts[number]) => ({
      id: p.id,
      nombre: p.nombre_lista || p.nombre,
      precio_unitario: p.precio_unitario ? Number(p.precio_unitario) : 0,
      categoria: p.categoria,
      tipo: p.tipo,
      consecutivo_alg: p.consecutivo_alg,
      alegra_id: p.alegra_id,
      frequency: frequencyMap.get(p.id) || 0,
    }))

    type AnnotatedProduct = typeof annotated[number]

    // Suggested = products that appear at least once in past previos, sorted by frequency desc
    const suggested = annotated
      .filter((p: AnnotatedProduct) => p.frequency > 0)
      .sort((a: AnnotatedProduct, b: AnnotatedProduct) => b.frequency - a.frequency)

    // All = full catalog sorted normally (suggested items are still included but not duplicated in "all")
    const all = annotated

    return NextResponse.json({ suggested, all })
  } catch (error: any) {
    console.error('Error in /api/previos/client-products:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
