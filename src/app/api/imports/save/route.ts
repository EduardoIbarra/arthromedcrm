import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendNotificationToUser } from '@/lib/respond';

export interface SelectedSource {
  type: 'orden_compra' | 'stock_fisico'
  id: string        // orden ID or 'stock_fisico'
  label: string     // PO number or 'Stock Físico'
}

export async function POST(req: Request) {
  try {
    const { allocations, remainingInventory, aiReasoning, invoiceIdFromChina, selectedSources } = await req.json();

    if (!allocations || !Array.isArray(allocations)) {
      return NextResponse.json({ error: 'Asignaciones inválidas' }, { status: 400 });
    }

    let repartitionId: string = '';

    // We use a transaction to ensure all DB operations succeed or fail together
    await prisma.$transaction(async (tx: any) => {
      // 1. Create the main import record
      const importacion = await tx.importaciones_recepcion.create({
        data: {
          status: 'applied',
          invoice_id_china: invoiceIdFromChina || null
        }
      });

      repartitionId = importacion.id;

      // 2. Record the inventory sources used
      if (selectedSources && Array.isArray(selectedSources)) {
        for (const src of selectedSources as SelectedSource[]) {
          await tx.importacion_fuentes.create({
            data: {
              importacion_id: importacion.id,
              tipo_fuente: src.type,
              fuente_id: src.id,
              numero_fuente: src.label,
            }
          });
        }
      }

      // 3. Aggregate allocations by product to calculate total received vs assigned
      const itemsMap: Record<string, { asignada: number; recibida: number }> = {};

      for (const alloc of allocations) {
        if (!itemsMap[alloc.product]) {
          itemsMap[alloc.product] = { asignada: 0, recibida: 0 };
        }
        itemsMap[alloc.product].asignada += alloc.allocatedQty;
      }

      for (const product in remainingInventory) {
        if (!itemsMap[product]) {
          itemsMap[product] = { asignada: 0, recibida: 0 };
        }
        itemsMap[product].recibida = itemsMap[product].asignada + remainingInventory[product];
      }

      // 4. Create importacion_items and importacion_asignaciones (log only — no mutations to factura_productos or inventario_productos)
      for (const [productName, data] of Object.entries(itemsMap)) {
        const importItem = await tx.importacion_items.create({
          data: {
            importacion_id: importacion.id,
            producto_nombre: productName,
            cantidad_recibida: data.recibida,
            cantidad_asignada: data.asignada,
          }
        });

        const productAllocations = allocations.filter((a: any) => a.product === productName);
        for (const alloc of productAllocations) {
          if (alloc.allocatedQty > 0) {
            await tx.importacion_asignaciones.create({
              data: {
                item_id: importItem.id,
                factura_producto_id: alloc.id,
                cantidad_asignada: alloc.allocatedQty,
                ai_reasoning: aiReasoning || null,
                manual_adjustment: alloc.manualAdjustment || false
              }
            });
          }
        }
      }
    });

    // 5. Send WhatsApp notifications to staff members assigned to the affected clients
    if (allocations && allocations.length > 0) {
      const allocIds = allocations.map((a: any) => a.id);
      const f_prods = await prisma.factura_productos.findMany({
        where: { id: { in: allocIds } },
        include: { facturas_cliente: true }
      });

      const uniqueCustomerNames = Array.from(
        new Set(f_prods.map((fp: any) => fp.facturas_cliente?.cliente_nombre).filter(Boolean))
      ) as string[];

      const crmClients = await prisma.clients.findMany({
        where: { name: { in: uniqueCustomerNames } },
        select: { name: true, assigned_to: true }
      });

      const notificationsMap: Record<string, Set<string>> = {};
      for (const client of crmClients) {
        if (client.assigned_to && client.name) {
          if (!notificationsMap[client.assigned_to]) {
            notificationsMap[client.assigned_to] = new Set();
          }
          notificationsMap[client.assigned_to].add(client.name);
        }
      }

      for (const [userId, clientSet] of Object.entries(notificationsMap)) {
        const clientList = Array.from(clientSet).join(', ');
        const msg = `Hola, se ha completado una repartición de inventario. Por favor, confirma la dirección de envío con los siguientes clientes: ${clientList}.`;
        sendNotificationToUser(userId, msg).catch(err => {
          console.error(`Failed to send WhatsApp to user ${userId}:`, err);
        });
      }
    }

    return NextResponse.json({ success: true, repartitionId });

  } catch (error: any) {
    console.error('Error in save allocations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
