import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { querySegundaDB } from '@/lib/segundaDB';
import { computeDeliveryLimit, toIsoDate } from '@/lib/delivery-limit';

type OrderLine = {
  id: string;
  folio: string;
  customerName: string;
  product: string;
  requestedQty: number;
  paymentDate: string | null;
  /** ISO date of delivery deadline (first payment + 5 weeks policy) */
  shippingLimit: string | null;
};

/** Facturas whose numero starts with F or N are excluded from repartition. */
function isExcludedPrefixedFolio(folio: string | null | undefined): boolean {
  return /^[FN]/i.test(String(folio || '').trim());
}

function getPaymentSortTime(order: OrderLine): number {
  if (!order.paymentDate) return Number.MAX_SAFE_INTEGER;
  const t = new Date(order.paymentDate).getTime();
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

function getDeadlineSortTime(order: OrderLine): number {
  if (!order.shippingLimit) return Number.MAX_SAFE_INTEGER;
  const t = new Date(order.shippingLimit).getTime();
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

/**
 * Strict allocation per product:
 * 1) earliest delivery deadline (how long until we must deliver)
 * 2) oldest payment date
 * 3) folio as stable tie-breaker
 *
 * No minimum allocation — assign all available stock greedily in that order.
 */
function allocateByPaymentAndDeadline(
  orders: OrderLine[],
  inventoryMap: Record<string, number>
) {
  const byProduct = new Map<string, OrderLine[]>();
  for (const order of orders) {
    const list = byProduct.get(order.product) || [];
    list.push(order);
    byProduct.set(order.product, list);
  }

  const allocationMap = new Map<string, number>();
  const remaining = { ...inventoryMap };

  for (const [product, productOrders] of byProduct) {
    productOrders.sort((a, b) => {
      const deadlineDiff = getDeadlineSortTime(a) - getDeadlineSortTime(b);
      if (deadlineDiff !== 0) return deadlineDiff;
      const payDiff = getPaymentSortTime(a) - getPaymentSortTime(b);
      if (payDiff !== 0) return payDiff;
      return a.folio.localeCompare(b.folio);
    });

    let stock = remaining[product] || 0;
    for (const order of productOrders) {
      const allocated = Math.min(order.requestedQty, Math.max(0, stock));
      allocationMap.set(order.id, allocated);
      stock -= allocated;
    }
    remaining[product] = stock;
  }

  return { allocationMap, remaining };
}

function buildReasoning(
  orders: OrderLine[],
  allocationMap: Map<string, number>,
  locale: string | undefined
): string {
  const lines = orders
    .filter(o => (allocationMap.get(o.id) || 0) > 0)
    .sort((a, b) => {
      const d = getDeadlineSortTime(a) - getDeadlineSortTime(b);
      if (d !== 0) return d;
      return getPaymentSortTime(a) - getPaymentSortTime(b);
    })
    .slice(0, 8)
    .map(o => {
      const pay = o.paymentDate
        ? new Date(o.paymentDate).toLocaleDateString()
        : 'sin pago';
      const limit = o.shippingLimit
        ? new Date(o.shippingLimit).toLocaleDateString()
        : 'sin límite';
      return `${o.folio} (pago ${pay}, límite ${limit}): ${allocationMap.get(o.id)} uds. de ${o.product}`;
    });

  if (locale === 'en') {
    return [
      'Strict priority by delivery deadline (from payment date), then oldest payment first.',
      'No minimum allocation — stock is assigned fully in that order.',
      lines.length ? `Priority served: ${lines.join('; ')}.` : 'No units could be assigned.',
    ].join(' ');
  }
  if (locale === 'zh') {
    return [
      '严格按交货期限（来自付款日期）优先，然后按最早付款优先。',
      '无最低分配限制——按该顺序分配库存。',
      lines.length ? `已优先分配：${lines.join('；')}。` : '未能分配任何数量。',
    ].join(' ');
  }
  return [
    'Prioridad estricta por fecha límite de entrega (derivada de la fecha de pago), luego pago más antiguo primero.',
    'Sin mínimo de repartición: el inventario se asigna completo en ese orden.',
    lines.length ? `Prioridad atendida: ${lines.join('; ')}.` : 'No se asignaron unidades.',
  ].join(' ');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      facturas,
      cotizacionIds,
      locale,
      selectedOrderIds,
      selectedStockFisico,
      csvContent,
    } = body;

    // Ignore F-prefixed facturas entirely for repartition
    const facturasClean = Array.isArray(facturas)
      ? facturas
          .map((f: string) => String(f).trim())
          .filter((f: string) => f && !isExcludedPrefixedFolio(f))
      : []

    const hasFacturas = facturasClean.length > 0
    const hasCotizaciones = Array.isArray(cotizacionIds) && cotizacionIds.length > 0
    if (!hasFacturas && !hasCotizaciones) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos (facturas o cotizaciones). Las facturas con folio F* o N* se ignoran.' },
        { status: 400 }
      );
    }

    // ──────────────────────────────────────────────────
    // Build inventory map from all selected sources
    // ──────────────────────────────────────────────────
    const inventoryMap: Record<string, number> = {};
    let invoiceIdFromChina = '';

    // Source 1: Legacy CSV
    if (csvContent) {
      const Papa = (await import('papaparse')).default;
      const parsed = Papa.parse(csvContent, { header: false, skipEmptyLines: true });
      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i] as string[];
        if (i === 0 && row[0]) invoiceIdFromChina = row[0].trim();
        const producto = row[1]?.trim();
        const cantidad = parseInt(row[2]?.trim() || '0', 10);
        if (producto && !isNaN(cantidad) && cantidad > 0) {
          inventoryMap[producto] = (inventoryMap[producto] || 0) + cantidad;
        }
      }
    }

    // Source 2: Órdenes de compra from segunda DB
    if (selectedOrderIds && Array.isArray(selectedOrderIds) && selectedOrderIds.length > 0) {
      const placeholders = selectedOrderIds.map((_: any, i: number) => `$${i + 1}`).join(', ');
      const productos = await querySegundaDB<{
        producto_id: string | null;
        producto_nombre: string;
        cantidad_ordenada: number;
        cantidad_recibida: number | null;
      }>(`
        SELECT producto_id, producto_nombre, cantidad_ordenada, COALESCE(cantidad_recibida, 0) AS cantidad_recibida
        FROM orden_productos
        WHERE orden_id IN (${placeholders})
          AND COALESCE(cantidad_recibida, 0) > 0
      `, selectedOrderIds);

      const productIds = productos.map((p: any) => p.producto_id).filter(Boolean) as string[];
      const mainProducts = productIds.length > 0 ? await prisma.productos.findMany({
        where: { id: { in: productIds } },
        select: { id: true, nombre_lista: true }
      }) : [];
      const nameMap = new Map<string, string | null>(mainProducts.map((p: any) => [p.id, p.nombre_lista]));

      for (const p of productos) {
        const resolvedName = (p.producto_id ? nameMap.get(p.producto_id) : null) || p.producto_nombre;
        if (resolvedName) {
          const recibida = Number(p.cantidad_recibida) || 0;
          if (recibida > 0) {
            inventoryMap[resolvedName] = (inventoryMap[resolvedName] || 0) + recibida;
          }
        }
      }
    }

    // Source 3: Stock físico (names/qty chosen on client from primary conteo_diario)
    if (selectedStockFisico && Array.isArray(selectedStockFisico) && selectedStockFisico.length > 0) {
      for (const item of selectedStockFisico as { nombre: string; cantidad: number }[]) {
        if (item.nombre && item.cantidad > 0) {
          inventoryMap[item.nombre] = (inventoryMap[item.nombre] || 0) + item.cantidad;
        }
      }
    }

    Object.keys(inventoryMap).forEach(key => {
      if (inventoryMap[key] <= 0) delete inventoryMap[key];
    });

    if (Object.keys(inventoryMap).length === 0) {
      return NextResponse.json({
        allocations: [],
        remainingInventory: {},
        aiReasoning: 'No hay productos recibidos en las fuentes seleccionadas.',
        invoiceIdFromChina,
      });
    }

    // Exact folio match only — do not map F-240 ↔ 240; F* folios are excluded above
    const pendingFacturas = hasFacturas
      ? (
          await prisma.facturas_cliente.findMany({
            where: { numero_factura: { in: facturasClean } },
            include: {
              factura_productos: {
                where: { cantidad_pendiente: { gt: 0 } },
                include: {
                  productos: { select: { nombre_lista: true } }
                }
              },
              planes_pago: {
                include: {
                  parcialidades: { orderBy: { numero: 'asc' } }
                }
              }
            }
          })
        ).filter((f: any) => !isExcludedPrefixedFolio(f.numero_factura))
      : []

    const pendingCotizaciones = hasCotizaciones
      ? await prisma.cotizaciones.findMany({
          where: { id: { in: cotizacionIds } },
          include: {
            productos: {
              include: {
                productos: { select: { nombre_lista: true } }
              }
            },
            planes_pago: {
              include: {
                parcialidades: { orderBy: { numero: 'asc' } }
              }
            }
          }
        })
      : []

    if (pendingFacturas.length === 0 && pendingCotizaciones.length === 0) {
      return NextResponse.json({
        allocations: [],
        remainingInventory: inventoryMap,
        aiReasoning: 'No hay facturas ni cotizaciones pendientes o válidas seleccionadas (folios F* y N* se ignoran).',
        invoiceIdFromChina
      });
    }

    // Demand lines — priority inputs: payment date + delivery deadline only
    const ordersFromFacturas = pendingFacturas.flatMap((f: any) => {
      const delivery = computeDeliveryLimit(f)
      const shippingLimit = delivery.limitDate
        ? toIsoDate(delivery.limitDate)
        : null
      const paymentDate = delivery.firstPaymentDate
        ? toIsoDate(delivery.firstPaymentDate)
        : f.fecha_pago
          ? toIsoDate(new Date(f.fecha_pago))
          : null

      return f.factura_productos.map((fp: any) => ({
        id: fp.id,
        folio: f.numero_factura,
        customerName: f.cliente_nombre,
        paymentDate,
        shippingLimit,
        deliveryIsReference: delivery.isReferenceOnly,
        product: fp.productos?.nombre_lista || fp.producto_nombre,
        facturadaQty: fp.cantidad_facturada || 0,
        requestedQty: fp.cantidad_pendiente || 0,
        sourceType: 'factura' as const,
      }))
    })

    const ordersFromCotizaciones = pendingCotizaciones.flatMap((c: any) => {
      const firstPartial = c.planes_pago?.[0]?.parcialidades?.[0]
      const paymentDate = firstPartial?.fecha_pago
        ? toIsoDate(new Date(firstPartial.fecha_pago))
        : firstPartial?.fecha_vencimiento
          ? toIsoDate(new Date(firstPartial.fecha_vencimiento))
          : null
      // Same 5-week horizon from payment date when available
      const shippingLimit = paymentDate
        ? toIsoDate(new Date(new Date(paymentDate).getTime() + 35 * 24 * 60 * 60 * 1000))
        : null

      return (c.productos || [])
        .filter((p: any) => (Number(p.cantidad) || 0) > 0)
        .map((p: any) => ({
          id: p.id,
          folio: c.numero_cotizacion,
          customerName: c.cliente_nombre,
          paymentDate,
          shippingLimit,
          deliveryIsReference: true,
          product: p.productos?.nombre_lista || p.producto_nombre,
          facturadaQty: Number(p.cantidad) || 0,
          requestedQty: Number(p.cantidad) || 0,
          sourceType: 'cotizacion' as const,
        }))
    })

    const ordersForAi = [...ordersFromFacturas, ...ordersFromCotizaciones]

    if (ordersForAi.length === 0) {
      return NextResponse.json({
        allocations: [],
        remainingInventory: inventoryMap,
        aiReasoning: 'No hay líneas pendientes válidas en las facturas/cotizaciones seleccionadas.',
        invoiceIdFromChina,
      })
    }

    // Match inventory by product name (fuzzy contains)
    const relevantOrders = ordersForAi.filter((o: any) => {
      const matchKey = Object.keys(inventoryMap).find(invKey =>
        o.product.toLowerCase().includes(invKey.toLowerCase()) ||
        invKey.toLowerCase().includes(o.product.toLowerCase())
      );
      if (matchKey) {
        o.product = matchKey;
        return true;
      }
      return false;
    });

    if (relevantOrders.length === 0) {
      return NextResponse.json({
        allocations: ordersForAi.map((order: any) => ({ ...order, allocatedQty: 0 })),
        remainingInventory: inventoryMap,
        aiReasoning: 'Ninguno de los productos en el inventario concuerda con los productos pendientes en las facturas seleccionadas.',
        invoiceIdFromChina,
      });
    }

    const priorityOrders: OrderLine[] = relevantOrders.map((o: any) => ({
      id: o.id,
      folio: o.folio,
      customerName: o.customerName,
      product: o.product,
      requestedQty: o.requestedQty,
      paymentDate: o.paymentDate,
      shippingLimit: o.shippingLimit,
    }));

    const { allocationMap, remaining: remainingInventory } =
      allocateByPaymentAndDeadline(priorityOrders, inventoryMap);
    const aiReasoning = buildReasoning(priorityOrders, allocationMap, locale);

    const finalAllocations = ordersForAi.map((order: any) => ({
      ...order,
      allocatedQty: allocationMap.get(order.id) || 0,
    }));

    return NextResponse.json({
      allocations: finalAllocations,
      remainingInventory,
      aiReasoning,
      invoiceIdFromChina
    });

  } catch (error: any) {
    console.error('Error in repartition:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
