import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendRespondMessage } from '@/lib/respond';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Access denied' }, { status: 401 });
    }

    const { reminderId, testPhone } = await request.json();

    if (!reminderId || !testPhone) {
      return NextResponse.json({ error: 'Missing reminderId or testPhone' }, { status: 400 });
    }

    const reminder = await prisma.whatsapp_reminders.findUnique({
      where: { id: reminderId }
    });

    if (!reminder) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
    }

    let eventName = 'Evento de prueba';
    let formattedText = reminder.message;

    // Resolve event details based on type
    if (reminder.target_type === 'surgery') {
      const s = await prisma.cirugias.findUnique({ where: { id: reminder.target_id } });
      if (s) {
        formattedText = formatMessage(reminder.message, s, 'surgery');
        eventName = s.nombre;
      }
    } else if (reminder.target_type === 'congress') {
      const c = await prisma.congresos.findUnique({ where: { id: reminder.target_id } });
      if (c) {
        formattedText = formatMessage(reminder.message, c, 'congress');
        eventName = c.name;
      }
    } else if (reminder.target_type === 'workshop') {
      const w = await prisma.congress_workshops.findUnique({ where: { id: reminder.target_id } });
      if (w) {
        formattedText = formatMessage(reminder.message, w, 'workshop');
        eventName = w.name;
      }
    }

    // Send the message using respond.io helper
    const recipientName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'Colaborador';
    const testContent = `🧪 *[PRUEBA] Recordatorio: ${reminder.title}* (Evento: ${eventName})\n---\n${formattedText}`;

    const success = await sendRespondMessage(testPhone, {
      type: 'template',
      template: {
        name: 'recordatorio_general_staff',
        language: {
          code: 'es'
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: recipientName
              },
              {
                type: 'text',
                text: testContent
              }
            ]
          }
        ]
      }
    });

    if (!success) {
      return NextResponse.json({ error: 'Failed to send WhatsApp template message via respond.io' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Test message sent successfully' });
  } catch (error: any) {
    console.error('[POST /api/recordatorios/test] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// Helper to format reminder templates dynamically
function formatMessage(template: string, event: any, type: string): string {
  let msg = template;
  if (!event) return msg;
  if (type === 'surgery') {
    const dateStr = new Date(event.fecha).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'long' });
    const timeStr = new Date(event.fecha).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });
    msg = msg
      .replace(/{nombre_evento}/g, event.nombre || '')
      .replace(/{medico}/g, event.medico || '')
      .replace(/{fecha}/g, `${dateStr} a las ${timeStr}`)
      .replace(/{notas}/g, event.notas || '')
      .replace(/{descripcion}/g, event.descripcion || '');
  } else if (type === 'congress') {
    const startStr = new Date(event.start_date).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium' });
    const endStr = new Date(event.end_date).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium' });
    msg = msg
      .replace(/{nombre_evento}/g, event.name || '')
      .replace(/{ubicacion}/g, event.location || '')
      .replace(/{fecha_inicio}/g, startStr)
      .replace(/{fecha_fin}/g, endStr)
      .replace(/{descripcion}/g, event.description || '');
  } else if (type === 'workshop') {
    const dateStr = new Date(event.date_time).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'long' });
    const timeStr = new Date(event.date_time).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });
    msg = msg
      .replace(/{nombre_evento}/g, event.name || '')
      .replace(/{profesor}/g, event.professor || '')
      .replace(/{fecha}/g, `${dateStr} a las ${timeStr}`)
      .replace(/{descripcion}/g, event.description || '');
  }
  return msg;
}
