import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { allocations, remainingInventory, aiReasoning } = await req.json();

    if (!allocations || !Array.isArray(allocations)) {
      return NextResponse.json({ error: 'Asignaciones inválidas' }, { status: 400 });
    }

    // We use a transaction to ensure all DB operations succeed or fail together
    await prisma.$transaction(async (tx) => {
      // 1. Create the main import record
      const importacion = await tx.importaciones_recepcion.create({
        data: {
          status: 'applied'
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
        const productAllocations = allocations.filter(a => a.product === productName);
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

        // 5. Add remaining to productos.stock_actual
        if (remainingInventory[productName] > 0) {
          // Find the product by name. We assume product name matches uniquely.
          // If not, we might need more advanced matching, but for now we try to update.
          const productRecords = await tx.productos.findMany({
            where: { nombre: productName }
          });
          
          if (productRecords.length > 0) {
            // Update the first matching product
            await tx.productos.update({
              where: { id: productRecords[0].id },
              data: {
                stock_actual: { increment: remainingInventory[productName] },
                stock_updated_at: new Date()
              }
            });
          }
        }
      }
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error in save allocations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
