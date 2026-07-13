import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const RESPOND_API_TOKEN = process.env.RESPOND_API_TOKEN;
const RESPOND_CHANNEL_ID = parseInt(process.env.RESPOND_CHANNEL_ID || '0', 10);

export async function GET(request: NextRequest) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Business day logic for "yesterday"
    const yesterday = new Date(today);
    if (today.getDay() === 1) { // Monday
      yesterday.setDate(today.getDate() - 3); // Friday
    } else if (today.getDay() === 0) { // Sunday (Cron runs Mon-Fri, so this shouldn't happen)
      yesterday.setDate(today.getDate() - 2); 
    } else {
      yesterday.setDate(today.getDate() - 1);
    }

    const in3Days = new Date(today);
    in3Days.setDate(today.getDate() + 3);

    const pendingParcialidades = await prisma.parcialidades.findMany({
      where: {
        pagado: false,
        fecha_vencimiento: {
          not: null
        }
      },
      include: {
        planes_pago: {
          include: {
            clientes: true
          }
        }
      }
    });

    const messagesToSend = [];

    for (const p of pendingParcialidades) {
      if (!p.fecha_vencimiento) continue;
      const vDate = new Date(p.fecha_vencimiento);
      vDate.setHours(0, 0, 0, 0);

      const client = p.planes_pago?.clientes;
      if (!client) continue;

      const phone = client.whatsapp_phone || client.phone;
      if (!phone) continue;

      let templateName = null;
      if (vDate.getTime() === in3Days.getTime()) {
        templateName = 'payment_reminder_3_days';
      } else if (vDate.getTime() === yesterday.getTime()) {
        templateName = 'payment_overdue_polite';
      }

      if (templateName) {
        // Simple normalization to digits
        let digits = phone.replace(/\D/g, '');
        if (digits.length === 10) {
            digits = '52' + digits; // Assuming Mexico code if 10 digits
        }
        messagesToSend.push({
          phone: `phone:+${digits}`,
          template: templateName
        });
      }
    }

    let successCount = 0;
    let failCount = 0;

    for (const msg of messagesToSend) {
      if (!RESPOND_API_TOKEN || !RESPOND_CHANNEL_ID) break;

      const payload = {
        channelId: RESPOND_CHANNEL_ID,
        message: {
          type: 'whatsapp_template',
          template: {
            name: msg.template,
            languageCode: 'es_MX' // Using es_MX as requested by other respond scripts
          }
        }
      };

      const url = `https://api.respond.io/v2/contact/${encodeURIComponent(msg.phone)}/message`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESPOND_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        successCount++;
      } else {
        failCount++;
        console.error(`Failed to send ${msg.template} to ${msg.phone}:`, res.status, await res.text());
      }
    }

    return NextResponse.json({ success: true, processed: messagesToSend.length, successCount, failCount });
  } catch (err: any) {
    console.error('Error in cron/payment-reminders:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
