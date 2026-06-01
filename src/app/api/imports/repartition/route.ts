import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import Papa from 'papaparse';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const { csvContent, facturas, locale } = await req.json();

    if (!csvContent || !facturas || !Array.isArray(facturas)) {
      return NextResponse.json({ error: 'Faltan datos requeridos (csvContent, facturas)' }, { status: 400 });
    }

    // 1. Parse CSV to aggregate inventory by PRODUCTO
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
    const inventoryMap: Record<string, number> = {};
    let currentFolio = '';
    let currentCliente = '';

    for (const row of parsed.data as any[]) {
      // Handle the format where Folio/Cliente are only on the first row of a group
      if (row.FOLIO) currentFolio = row.FOLIO;
      if (row.CLIENTE) currentCliente = row.CLIENTE;
      
      const producto = row.PRODUCTO?.trim();
      const cantidad = parseInt(row.CANTIDAD || '0', 10);
      
      if (producto && !isNaN(cantidad)) {
        inventoryMap[producto] = (inventoryMap[producto] || 0) + cantidad;
      }
    }

    // Filter out products with 0 quantity
    Object.keys(inventoryMap).forEach(key => {
      if (inventoryMap[key] <= 0) delete inventoryMap[key];
    });

    // Allow 'F-240' notation to match '240'
    const expandedFacturas = Array.from(new Set(
      facturas.flatMap((f: string) => [f, f.replace(/^F-?/i, '')])
    ));

    // 2. Fetch pending orders for the provided facturas
    const pendingFacturas = await prisma.facturas_cliente.findMany({
      where: { 
        numero_factura: { in: expandedFacturas } 
      },
      include: {
        factura_productos: {
          where: {
            cantidad_pendiente: { gt: 0 }
          }
        }
      }
    });

    if (pendingFacturas.length === 0) {
      return NextResponse.json({ allocations: [], inventory: inventoryMap, aiReasoning: 'No hay facturas pendientes o válidas seleccionadas.' });
    }

    // Calculate customer spend for priority
    const clientIds = Array.from(new Set(pendingFacturas.map((f: any) => f.cliente_id).filter(Boolean))) as string[];
    const spendGroups = await prisma.facturas_cliente.groupBy({
      by: ['cliente_id'],
      where: {
        cliente_id: { in: clientIds },
        estado: 'pagada'
      },
      _sum: {
        total: true
      }
    });
    
    const spendMap: Record<string, number> = {};
    spendGroups.forEach((g: any) => {
      if (g.cliente_id) {
        spendMap[g.cliente_id] = Number(g._sum.total || 0);
      }
    });

    // 3. Prepare AI payload
    const ordersForAi = pendingFacturas.flatMap((f: any) => {
      const spend = f.cliente_id ? (spendMap[f.cliente_id] || 0) : 0;
      return f.factura_productos.map((fp: any) => ({
        id: fp.id,
        folio: f.numero_factura,
        customerName: f.cliente_nombre,
        paymentDate: f.fecha_pago ? f.fecha_pago.toISOString() : null, // null means unpaid -> lowest priority
        issueDate: f.fecha_expedicion.toISOString(),
        customerSpend: spend,
        product: fp.producto_nombre,
        requestedQty: fp.cantidad_pendiente || 0
      }));
    });

    // Remove orders for products we didn't receive
    // Use lax matching to account for prefixes like "Radiofrecuencia de Plasma " in the DB
    const relevantOrders = ordersForAi.filter((o: any) => {
      const matchKey = Object.keys(inventoryMap).find(invKey => 
        o.product.toLowerCase().includes(invKey.toLowerCase()) || 
        invKey.toLowerCase().includes(o.product.toLowerCase())
      );
      if (matchKey) {
        o.product = matchKey; // Normalize to match inventoryMap exactly
        return true;
      }
      return false;
    });

    if (relevantOrders.length === 0) {
      return NextResponse.json({ 
        allocations: [], 
        inventory: inventoryMap, 
        aiReasoning: 'Ninguno de los productos recibidos en la importación concuerda con los productos pendientes en las facturas seleccionadas.' 
      });
    }

    // 4. Call Google AI
    const languageString = locale === 'en' ? 'English' : locale === 'zh' ? 'Chinese' : 'Spanish';
    const prompt = `
You are an expert supply chain allocation AI.
You need to allocate an inventory of medical products to pending orders.
Here is the available inventory:
${JSON.stringify(inventoryMap, null, 2)}

Here are the pending orders:
${JSON.stringify(relevantOrders, null, 2)}

Allocation Rules:
1. You cannot allocate more than the available inventory for each product.
2. Prioritize orders based on "paymentDate" (earliest first). Orders with a null paymentDate (unpaid) have the lowest priority.
3. As a secondary priority, prioritize customers with higher "customerSpend" (best buyers served first).
4. REDUCE IMPACT: If a supplier didn't send enough to fulfill a high-priority order and a low-priority order, try to reduce impact by allocating at least some parts to the smaller order (e.g. if A needs 10 and B needs 2, and we have 10, giving A 8 and B 2 is better than giving A 10 and B 0). But don't overly punish the best buyers. Use your best judgment to balance "reduce impact" with "rewarding best buyers".
5. For each product, allocate the quantities across the requested orders.
6. Provide a brief reasoning for the allocation strategy you chose, in ${languageString}.

Output a JSON object with:
- "allocations": array of objects containing "id" (the order id) and "allocatedQty" (the amount given).
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
      const allocatedQty = aiAlloc ? aiAlloc.allocatedQty : 0;
      return {
        ...order,
        allocatedQty
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
      aiReasoning: object.aiReasoning
    });

  } catch (error: any) {
    console.error('Error in repartition:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
