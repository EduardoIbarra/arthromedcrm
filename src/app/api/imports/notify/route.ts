import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendNotificationToUser } from '@/lib/respond';

/**
 * POST /api/imports/notify
 * Sends WhatsApp notifications to staff members assigned to all clients
 * affected in a given repartition.
 */
export async function POST(req: Request) {
  try {
    const { allocations, repartitionId } = await req.json();

    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return NextResponse.json({ error: 'No hay asignaciones' }, { status: 400 });
    }

    const allocIds = allocations.map((a: any) => a.id).filter(Boolean);
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

    let sent = 0;
    for (const [userId, clientSet] of Object.entries(notificationsMap)) {
      const clientList = Array.from(clientSet).join(', ');
      const msg = `Hola, hay una repartición de inventario completada. Por favor, confirma la dirección de envío con los siguientes clientes: ${clientList}.`;
      await sendNotificationToUser(userId, msg);
      sent++;
    }

    return NextResponse.json({ success: true, notificationsSent: sent });
  } catch (error: any) {
    console.error('Error in notify:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
