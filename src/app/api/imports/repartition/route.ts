import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { querySegundaDB } from '@/lib/segundaDB';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const SHIPPING_WEEKS = 4; // fecha_pago + 4 weeks = shipping limit

function getShippingLimit(fechaPago: Date): Date {
  const d = new Date(fechaPago);
  d.setDate(d.getDate() + SHIPPING_WEEKS * 7);
  return d;
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
          AND (cantidad_recibida IS NULL OR cantidad_recibida < cantidad_ordenada)
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
          const pendiente = (p.cantidad_ordenada || 0) - (Number(p.cantidad_recibida) || 0);
          if (pendiente > 0) {
            inventoryMap[resolvedName] = (inventoryMap[resolvedName] || 0) + pendiente;
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
        aiReasoning: 'No hay productos pendientes en las fuentes seleccionadas.',
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
        allocations: [],
        remainingInventory: inventoryMap,
        aiReasoning: 'Ninguno de los productos en el inventario concuerda con los productos pendientes en las facturas seleccionadas.',
        invoiceIdFromChina,
      });
    }

    // Call Google AI
    const languageString = locale === 'en' ? 'English' : locale === 'zh' ? 'Chinese' : 'Spanish';
    const prompt = `
You are an expert supply chain allocation AI.
You need to allocate an inventory of medical products to pending orders.
Here is the available inventory:
${JSON.stringify(inventoryMap, null, 2)}

Here are the pending orders (eligible for allocation):
${JSON.stringify(relevantOrders, null, 2)}

Allocation Rules:
1. You cannot allocate more than the available inventory for each product.
2. Prioritize orders based on "shippingLimit" (earliest first — most overdue first). Do NOT use customer spending or ranking.
3. REDUCE IMPACT: If inventory is insufficient to fully fulfill a high-priority order, try to reduce impact by distributing at least some quantity to smaller orders too. Use your best judgment.
4. For each product, allocate the quantities across the requested orders.
5. Provide a brief reasoning for the allocation strategy you chose, in ${languageString}.

Output a JSON object with:
- "allocations": array of objects containing "id" (the order item id) and "allocatedQty" (the amount given).
- "aiReasoning": your brief reasoning in ${languageString}.
`;

    const { object } = await generateObject({
      model: google('gemini-2.5-pro'),
      schema: z.object({
        allocations: z.array(z.object({
          id: z.string(),
          allocatedQty: z.number()
        })),
        aiReasoning: z.string()
      }),
      prompt
    });

    // Combine AI results with full order data
    const finalAllocations = relevantOrders.map((order: any) => {
      const aiAlloc = object.allocations.find((a: any) => a.id === order.id);
      return {
        ...order,
        allocatedQty: aiAlloc ? aiAlloc.allocatedQty : 0
      };
    });

    // Calculate unallocated inventory
    const remainingInventory = { ...inventoryMap };
    for (const alloc of finalAllocations) {
      if (remainingInventory[alloc.product]) {
        remainingInventory[alloc.product] -= alloc.allocatedQty;
      }
    }

    return NextResponse.json({
      allocations: finalAllocations,
      remainingInventory,
      aiReasoning: object.aiReasoning,
      invoiceIdFromChina
    });

  } catch (error: any) {
    console.error('Error in repartition:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
