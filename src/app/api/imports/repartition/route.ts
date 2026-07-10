import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { querySegundaDB } from '@/lib/segundaDB';

const SHIPPING_WEEKS = 5; // fecha_pago / primer pago + 5 weeks = shipping limit

function getShippingLimit(fechaPago: Date): Date {
  const d = new Date(fechaPago);
  d.setDate(d.getDate() + SHIPPING_WEEKS * 7);
  return d;
}

type OrderLine = {
  id: string;
  folio: string;
  customerName: string;
  product: string;
  requestedQty: number;
  paymentDate: string | null;
  issueDate: string | null;
};

function getPaymentSortTime(order: OrderLine): number {
  const raw = order.paymentDate || order.issueDate;
  if (!raw) return Number.MAX_SAFE_INTEGER;
  return new Date(raw).getTime();
}

/** Strict FIFO: oldest payment date first, per product. */
function allocateFifo(orders: OrderLine[], inventoryMap: Record<string, number>) {
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
      const dateDiff = getPaymentSortTime(a) - getPaymentSortTime(b);
      if (dateDiff !== 0) return dateDiff;
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

function buildFifoReasoning(
  orders: OrderLine[],
  allocationMap: Map<string, number>,
  locale: string | undefined
): string {
  const lines = orders
    .filter(o => (allocationMap.get(o.id) || 0) > 0)
    .sort((a, b) => getPaymentSortTime(a) - getPaymentSortTime(b))
    .slice(0, 8)
    .map(o => {
      const date = o.paymentDate || o.issueDate;
      const dateLabel = date ? new Date(date).toLocaleDateString() : 'sin fecha';
      return `${o.folio} (${dateLabel}): ${allocationMap.get(o.id)} uds. de ${o.product}`;
    });

  if (locale === 'en') {
    return [
      'Strict FIFO allocation by payment date (oldest first).',
      'Each product is fully assigned to earlier-paid invoices before later ones.',
      lines.length ? `Priority served: ${lines.join('; ')}.` : 'No units could be assigned.',
    ].join(' ');
  }
  if (locale === 'zh') {
    return [
      '严格按付款日期先进先出 (FIFO) 分配。',
      '每种产品优先满足付款日期更早的发票。',
      lines.length ? `已优先分配：${lines.join('；')}。` : '未能分配任何数量。',
    ].join(' ');
  }
  return [
    'Asignación estricta FIFO por fecha de pago (más antigua primero).',
    'Cada producto se asigna por completo a facturas con pago más antiguo antes que las recientes.',
    lines.length ? `Prioridad atendida: ${lines.join('; ')}.` : 'No se asignaron unidades.',
  ].join(' ');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { facturas, locale, selectedOrderIds, selectedStockFisico, csvContent } = body;

    if (!facturas || !Array.isArray(facturas)) {
      return NextResponse.json({ error: 'Faltan datos requeridos (facturas)' }, { status: 400 });
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

    // Source 3: Stock físico from segunda DB
    if (selectedStockFisico && Array.isArray(selectedStockFisico) && selectedStockFisico.length > 0) {
      // selectedStockFisico is an array of { nombre, cantidad } items chosen by user
      for (const item of selectedStockFisico as { nombre: string; cantidad: number }[]) {
        if (item.nombre && item.cantidad > 0) {
          inventoryMap[item.nombre] = (inventoryMap[item.nombre] || 0) + item.cantidad;
        }
      }
    }

    // Filter out products with 0 quantity
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

    // Allow 'F-240' notation to match '240'
    const expandedFacturas = Array.from(new Set(
      facturas.flatMap((f: string) => [f, f.replace(/^F-?/i, '')])
    ));

    // Fetch pending orders for the provided facturas
    const pendingFacturas = await prisma.facturas_cliente.findMany({
      where: { numero_factura: { in: expandedFacturas } },
      include: {
        factura_productos: {
          where: { cantidad_pendiente: { gt: 0 } },
          include: {
            productos: { select: { nombre_lista: true } }
          }
        }
      }
    });

    if (pendingFacturas.length === 0) {
      return NextResponse.json({
        allocations: [],
        remainingInventory: inventoryMap,
        aiReasoning: 'No hay facturas pendientes o válidas seleccionadas.',
        invoiceIdFromChina
      });
    }

    // Build AI orders
    const ordersForAi = pendingFacturas.flatMap((f: any) => {
      const baseDate = f.fecha_pago || f.fecha_expedicion || new Date()
      const shippingLimit = getShippingLimit(new Date(baseDate))

      return f.factura_productos.map((fp: any) => ({
        id: fp.id,
        folio: f.numero_factura,
        customerName: f.cliente_nombre,
        paymentDate: f.fecha_pago ? f.fecha_pago.toISOString() : null,
        shippingLimit: shippingLimit.toISOString(),
        issueDate: f.fecha_expedicion ? f.fecha_expedicion.toISOString() : null,
        product: fp.productos?.nombre_lista || fp.producto_nombre,
        facturadaQty: fp.cantidad_facturada || 0,
        requestedQty: fp.cantidad_pendiente || 0,
      }))
    })

    if (ordersForAi.length === 0) {
      return NextResponse.json({
        allocations: [],
        remainingInventory: inventoryMap,
        aiReasoning: 'No hay facturas pendientes válidas seleccionadas.',
        invoiceIdFromChina,
      })
    }

    // Match to received inventory using fuzzy matching
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

    const fifoOrders: OrderLine[] = relevantOrders.map((o: any) => ({
      id: o.id,
      folio: o.folio,
      customerName: o.customerName,
      product: o.product,
      requestedQty: o.requestedQty,
      paymentDate: o.paymentDate,
      issueDate: o.issueDate,
    }));

    const { allocationMap, remaining: remainingInventory } = allocateFifo(fifoOrders, inventoryMap);
    const aiReasoning = buildFifoReasoning(fifoOrders, allocationMap, locale);

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
