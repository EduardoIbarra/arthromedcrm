import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendNotificationToUser } from '@/lib/respond';

export async function POST(req: Request) {
  try {
    const { allocations, remainingInventory, aiReasoning, invoiceIdFromChina } = await req.json();

    if (!allocations || !Array.isArray(allocations)) {
      return NextResponse.json({ error: 'Asignaciones inválidas' }, { status: 400 });
    }

    // We use a transaction to ensure all DB operations succeed or fail together
    await prisma.$transaction(async (tx: any) => {
      // 1. Create the main import record
      const importacion = await tx.importaciones_recepcion.create({
        data: {
          status: 'applied',
          invoice_id_china: invoiceIdFromChina || null
        }
      });

      // 2. Aggregate allocations by product to calculate total received vs assigned
      const itemsMap: Record<string, { asignada: number; recibida: number }> = {};
      
      // Calculate allocated amount per product
      for (const alloc of allocations) {
        if (!itemsMap[alloc.product]) {
          itemsMap[alloc.product] = { asignada: 0, recibida: 0 };
        }
        itemsMap[alloc.product].asignada += alloc.allocatedQty;
      }

      // Add remaining inventory to get total received
      for (const product in remainingInventory) {
        if (!itemsMap[product]) {
          itemsMap[product] = { asignada: 0, recibida: 0 };
        }
        itemsMap[product].recibida = itemsMap[product].asignada + remainingInventory[product];
      }

      // 3. Create import_items and their allocations
      for (const [productName, data] of Object.entries(itemsMap)) {
        const importItem = await tx.importacion_items.create({
          data: {
            importacion_id: importacion.id,
            producto_nombre: productName,
            cantidad_recibida: data.recibida,
            cantidad_asignada: data.asignada
          }
        });

        // Create specific allocations for this product
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

            // 4. Update factura_productos
            await tx.factura_productos.update({
              where: { id: alloc.id },
              data: {
                cantidad_entregada: { increment: alloc.allocatedQty }
                // Note: cantidad_pendiente is a generated column in the schema `(cantidad_facturada - cantidad_entregada)`
              }
            });
          }
        }

        // 5. Add remaining to inventario_productos for Almacén Principal
        if (remainingInventory[productName] > 0) {
          // Find the product by name. We assume product name matches uniquely.
          // If not, we might need more advanced matching, but for now we try to update.
          const productRecords = await tx.productos.findMany({
            where: { nombre: productName }
          });
          
          if (productRecords.length > 0) {
            const product = productRecords[0];

            let defaultInv = await tx.tipos_inventario.findFirst({ where: { nombre: 'Almacén Principal' } });
            if (!defaultInv) {
              defaultInv = await tx.tipos_inventario.findFirst();
            }

            if (defaultInv) {
              await tx.inventario_productos.upsert({
                where: {
                  tipo_inventario_id_producto_id: {
                    tipo_inventario_id: defaultInv.id,
                    producto_id: product.id,
                  }
                },
                update: {
                  stock_actual: { increment: remainingInventory[productName] },
                  stock_updated_at: new Date()
                },
                create: {
                  tipo_inventario_id: defaultInv.id,
                  producto_id: product.id,
                  stock_actual: remainingInventory[productName],
                  stock_updated_at: new Date()
                }
              });
            }
          }
        }
      }
    });

    // 6. Send WhatsApp notifications to staff members assigned to the affected clients
    if (allocations && allocations.length > 0) {
      const allocIds = allocations.map((a: any) => a.id);
      const f_prods = await prisma.factura_productos.findMany({
        where: { id: { in: allocIds } },
        include: {
          facturas_cliente: true
        }
      });

      // Collect unique customer names from the affected invoices
      const uniqueCustomerNames = Array.from(new Set(f_prods.map((fp: any) => fp.facturas_cliente?.cliente_nombre).filter(Boolean))) as string[];

      // Lookup the CRM client records to find the assigned_to
      const crmClients = await prisma.clients.findMany({
        where: { name: { in: uniqueCustomerNames } },
        select: { name: true, assigned_to: true }
      });

      // Build a map of assigned_to -> Set of client names
      const notificationsMap: Record<string, Set<string>> = {};
      for (const client of crmClients) {
        if (client.assigned_to && client.name) {
          if (!notificationsMap[client.assigned_to]) {
            notificationsMap[client.assigned_to] = new Set();
          }
          notificationsMap[client.assigned_to].add(client.name);
        }
      }

      // Send the notifications
      for (const [userId, clientSet] of Object.entries(notificationsMap)) {
        const clientList = Array.from(clientSet).join(', ');
        const msg = `Hola, se ha completado una repartición de inventario. Por favor, confirma la dirección de envío con los siguientes clientes: ${clientList}.`;
        
        // Send asynchronously
        sendNotificationToUser(userId, msg).catch(err => {
          console.error(`Failed to send WhatsApp to user ${userId}:`, err);
        });
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error in save allocations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
