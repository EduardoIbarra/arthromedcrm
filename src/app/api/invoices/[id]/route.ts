import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { fetchAlegraInvoice, fetchAlegraPaymentsForInvoice } from '@/lib/alegra'

export const dynamic = 'force-dynamic'

async function backfillProductsFromAlegra(facturaId: string, alegraId: string) {
  // Full invoice fetch (list sync often omits items)
  let alegraInvoice = await fetchAlegraInvoice(alegraId)
  let items = Array.isArray(alegraInvoice?.items) ? alegraInvoice.items : []

  // Retry with explicit fields if empty (some Alegra responses omit items)
  if (items.length === 0) {
    try {
      alegraInvoice = await fetchAlegraInvoice(alegraId, 'items')
      items = Array.isArray(alegraInvoice?.items) ? alegraInvoice.items : []
    } catch (err) {
      console.warn('Alegra fields=items retry failed:', err)
    }
  }

  if (items.length === 0) {
    return {
      products: [] as any[],
      alegraInvoice,
      error:
        'Alegra no devolvió partidas (items) para esta factura. Revisa en Alegra que la factura tenga conceptos y vuelve a sincronizar.',
    }
  }

  const existing = await prisma.factura_productos.findMany({
    where: { factura_id: facturaId },
    select: {
      producto_nombre: true,
      producto_codigo: true,
      alegra_id: true,
      cantidad_entregada: true,
    },
  })

  // Preserve delivered qty by alegra line id, then code, then name
  const deliveredByKey = new Map<string, number>()
  for (const row of existing) {
    if (row.alegra_id) deliveredByKey.set(`a:${row.alegra_id}`, row.cantidad_entregada || 0)
    if (row.producto_codigo) deliveredByKey.set(`c:${row.producto_codigo.toLowerCase()}`, row.cantidad_entregada || 0)
    deliveredByKey.set(`n:${row.producto_nombre.toLowerCase()}`, row.cantidad_entregada || 0)
  }

  const allProductos = await prisma.productos.findMany({
    select: { id: true, consecutivo_alg: true, nombre: true, line: true },
  })
  const productByRef = new Map<string, string>()
  const productByName = new Map<string, string>()
  const productLineByRef = new Map<string, string>()
  const productLineByName = new Map<string, string>()
  for (const p of allProductos) {
    if (p.consecutivo_alg) productByRef.set(p.consecutivo_alg.toLowerCase(), p.id)
    if (p.nombre) productByName.set(p.nombre.toLowerCase(), p.id)
    if (p.line) {
      if (p.consecutivo_alg) productLineByRef.set(p.consecutivo_alg.toLowerCase(), p.line)
      if (p.nombre) productLineByName.set(p.nombre.toLowerCase(), p.line)
    }
  }

  const rows = items.map((item: any) => {
    const iName = (item.name || item.description || item.reference || 'Producto').toString().trim() || 'Producto'
    const rKey = item.reference?.toString().trim().toLowerCase() || null
    const nKey = iName.toLowerCase()
    const pid = (rKey && productByRef.get(rKey)) ?? productByName.get(nKey) ?? null
    const linea = (rKey && productLineByRef.get(rKey)) ?? productLineByName.get(nKey) ?? null
    const rawQty = Number(item.quantity)
    // cantidad_facturada is Int — keep at least 1 when Alegra sends fractional qty
    const qty = Math.max(1, Math.round(Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1))
    const price = Number(item.price) || 0
    const lineTotal =
      item.total != null && Number.isFinite(Number(item.total))
        ? Number(item.total)
        : price * (Number.isFinite(rawQty) && rawQty > 0 ? rawQty : qty)
    const alegraLineId = item.id != null ? String(item.id) : null
    const prevDelivered =
      (alegraLineId && deliveredByKey.get(`a:${alegraLineId}`)) ??
      (rKey && deliveredByKey.get(`c:${rKey}`)) ??
      deliveredByKey.get(`n:${nKey}`) ??
      0
    return {
      factura_id: facturaId,
      producto_id: pid || null,
      producto_nombre: iName,
      producto_codigo: item.reference ? String(item.reference) : null,
      cantidad_facturada: qty,
      cantidad_entregada: Math.min(Number(prevDelivered) || 0, qty),
      precio_unitario: price,
      importe: lineTotal,
      linea: linea || null,
      alegra_id: alegraLineId,
    }
  })

  // Ensure parent invoice exists on the same DB before insert (FK factura_productos_factura_id_fkey)
  const parent = await prisma.facturas_cliente.findUnique({
    where: { id: facturaId },
    select: { id: true },
  })
  if (!parent) {
    return {
      products: [] as any[],
      alegraInvoice,
      error: `No se encontró la factura ${facturaId} en la base de datos principal.`,
    }
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.factura_productos.deleteMany({ where: { factura_id: facturaId } })
    if (rows.length > 0) {
      await tx.factura_productos.createMany({ data: rows })
    }
  })

  const products = await prisma.factura_productos.findMany({
    where: { factura_id: facturaId },
    orderBy: { producto_nombre: 'asc' },
  })

  return { products, alegraInvoice, error: null as string | null }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const forceSyncProducts = request.nextUrl.searchParams.get('sync_products') === '1'

    let factura = await prisma.facturas_cliente.findUnique({
      where: { id },
      include: {
        factura_productos: {
          orderBy: {
            producto_nombre: 'asc',
          },
        },
        remisiones: {
          include: {
            remision_productos: true,
          },
        },
        planes_pago: {
          include: {
            parcialidades: {
              orderBy: {
                numero: 'asc',
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
          take: 1,
        },
      },
    })

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (!Array.isArray(factura.factura_productos)) {
      factura.factura_productos = await prisma.factura_productos.findMany({
        where: { factura_id: id },
        orderBy: { producto_nombre: 'asc' },
      })
    }

    let productsBackfilled = false
    let productSyncError: string | null = null
    let alegraInvoice: any = null
    let complementos_pago: any[] = []
    let alegra_summary: {
      total: number | null
      totalPaid: number | null
      balance: number | null
      status: string | null
    } | null = null

    // Backfill missing line items from Alegra (common when list-sync omitted items)
    const needsProductSync =
      factura.alegra_id &&
      (forceSyncProducts || !factura.factura_productos || factura.factura_productos.length === 0)

    if (needsProductSync && factura.alegra_id) {
      try {
        const result = await backfillProductsFromAlegra(factura.id, factura.alegra_id)
        alegraInvoice = result.alegraInvoice
        if (result.products.length > 0) {
          factura.factura_productos = result.products
          productsBackfilled = true
        } else if (result.error) {
          productSyncError = result.error
        }
      } catch (err: any) {
        console.error('Error backfilling products from Alegra:', err)
        productSyncError = err?.message || 'Error al sincronizar productos desde Alegra'
      }
    } else if (!factura.alegra_id && (!factura.factura_productos || factura.factura_productos.length === 0)) {
      productSyncError = 'Esta factura no tiene alegra_id; no se pueden importar productos automáticamente.'
    }

    // Complementos de pago (pagos / REPs) from Alegra
    if (factura.alegra_id) {
      try {
        const { invoice, payments } = await fetchAlegraPaymentsForInvoice(
          factura.alegra_id,
          alegraInvoice || undefined
        )
        alegraInvoice = invoice
        complementos_pago = payments
        alegra_summary = {
          total: invoice?.total != null ? Number(invoice.total) : null,
          totalPaid: invoice?.totalPaid != null ? Number(invoice.totalPaid) : null,
          balance: invoice?.balance != null ? Number(invoice.balance) : null,
          status: invoice?.status || null,
        }
      } catch (err) {
        console.error('Error fetching Alegra payments for invoice:', err)
      }
    }

    return NextResponse.json({
      ...factura,
      factura_productos: factura.factura_productos || [],
      complementos_pago,
      alegra_summary,
      products_backfilled: productsBackfilled,
      product_sync_error: productSyncError,
    })
  } catch (error: any) {
    console.error('Error fetching factura:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
