import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendRespondMessage } from '@/lib/respond';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleSend(request);
}

export async function POST(request: NextRequest) {
  return handleSend(request);
}

async function handleSend(request: NextRequest) {
  try {
    // Prevent running cron job logic on non-production environments (e.g., develop or preview)
    if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
      console.log(`[Cron Reminders] Skipped: Cron jobs are disabled on non-production environments (current: ${process.env.VERCEL_ENV})`);
      return NextResponse.json({ message: `Cron jobs are disabled on non-production environments (current: ${process.env.VERCEL_ENV})` });
    }

    // 1. Authorization check
    const authHeader = request.headers.get('Authorization');
    let isAuthorized = false;

    if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) isAuthorized = true;
      } catch (e) {
        // ignore auth error
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get current date and time in Mexico City
    const mxDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
    const todayStr = `${mxDate.getFullYear()}-${String(mxDate.getMonth() + 1).padStart(2, '0')}-${String(mxDate.getDate()).padStart(2, '0')}`;
    const currentHour = mxDate.getHours();
    const currentMinute = mxDate.getMinutes();
    const currentHHMM = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    console.log(`[Cron Reminders] Running at ${todayStr} ${currentHHMM} MX Time`);

    // 3. Fetch active reminders
    const reminders = await prisma.whatsapp_reminders.findMany({
      where: { active: true }
    });

    const results = [];

    // 4. Process each reminder
    for (const r of reminders) {
      let event: any = null;
      let shouldRunToday = false;

      try {
        if (!r.target_id || r.target_type === 'general' || r.target_type === 'none') {
          if (r.dates && r.dates.length > 0) {
            shouldRunToday = r.dates.includes(todayStr);
          } else {
            shouldRunToday = true;
          }
          event = null;
        } else if (r.target_type === 'surgery') {
          const s = await prisma.cirugias.findUnique({ where: { id: r.target_id } });
          if (s) {
            const eventDateStr = new Date(s.fecha).toISOString().split('T')[0];
            if (eventDateStr === todayStr) {
              shouldRunToday = true;
              event = s;
            }
          }
        } else if (r.target_type === 'congress') {
          const c = await prisma.congresos.findUnique({ where: { id: r.target_id } });
          if (c) {
            const cStart = new Date(c.start_date);
            const cEnd = new Date(c.end_date);
            const todayDate = new Date(todayStr);
            if (todayDate >= cStart && todayDate <= cEnd) {
              shouldRunToday = true;
              event = c;
            }
          }
        } else if (r.target_type === 'workshop') {
          const w = await prisma.congress_workshops.findUnique({ where: { id: r.target_id } });
          if (w) {
            const wStartStr = new Date(w.date_time).toISOString().split('T')[0];
            const wEndStr = w.end_date_time ? new Date(w.end_date_time).toISOString().split('T')[0] : wStartStr;
            if (todayStr >= wStartStr && todayStr <= wEndStr) {
              shouldRunToday = true;
              event = w;
            }
          }
        }
      } catch (err) {
        console.error(`[Cron Reminders] Error checking event details for reminder ${r.id}:`, err);
        continue;
      }

      const isGeneral = !r.target_id || r.target_type === 'general' || r.target_type === 'none';
      if (!shouldRunToday || (!event && !isGeneral)) {
        continue; // Event is not active today
      }

      // Check scheduled time
      if (currentHHMM < r.time) {
        continue; // Scheduled for later today
      }

      // Check if already sent successfully today
      const startOfToday = new Date(todayStr + 'T00:00:00.000Z');
      const endOfToday = new Date(todayStr + 'T23:59:59.999Z');
      const sentLog = await prisma.whatsapp_reminder_logs.findFirst({
        where: {
          reminder_id: r.id,
          status: 'success',
          sent_at: {
            gte: startOfToday,
            lte: endOfToday
          }
        }
      });

      if (sentLog) {
        continue; // Already sent successfully today
      }

      // 5. Gather recipients
      const recipients: any[] = [];
      const recipientIds = new Set<string>();

      // Notify all participants if checked and target_id exists
      if (r.notify_all_participants && r.target_id) {
        if (r.target_type === 'surgery') {
          const team = await prisma.cirugia_equipo.findMany({
            where: { cirugia_id: r.target_id }
          });
          const teamUserIds = team.map((t: any) => t.user_id);
          const profiles = await prisma.user_profiles.findMany({
            where: { id: { in: teamUserIds } }
          });
          profiles.forEach((p: any) => {
            if (!recipientIds.has(p.id)) {
              recipientIds.add(p.id);
              recipients.push(p);
            }
          });
        } else if (r.target_type === 'congress') {
          const members = await prisma.congreso_members.findMany({
            where: { congress_id: r.target_id },
            include: { user_profiles: true }
          });
          members.forEach((m: any) => {
            if (m.user_profiles && !recipientIds.has(m.user_id)) {
              recipientIds.add(m.user_id);
              recipients.push(m.user_profiles);
            }
          });
        } else if (r.target_type === 'workshop') {
          const members = await prisma.congress_workshop_members.findMany({
            where: { workshop_id: r.target_id },
            include: { user_profiles: true }
          });
          members.forEach((m: any) => {
            if (m.user_profiles && !recipientIds.has(m.user_id)) {
              recipientIds.add(m.user_id);
              recipients.push(m.user_profiles);
            }
          });
        }
      }

      // Add extra contacts
      if (r.extra_contacts && r.extra_contacts.length > 0) {
        const extraProfiles = await prisma.user_profiles.findMany({
          where: { id: { in: r.extra_contacts } }
        });
        extraProfiles.forEach((p: any) => {
          if (!recipientIds.has(p.id)) {
            recipientIds.add(p.id);
            recipients.push(p);
          }
        });
      }

      console.log(`[Cron Reminders] Sending reminder "${r.title}" to ${recipients.length} recipients.`);
      let successCount = 0;
      let failCount = 0;

      // 6. Send message to each recipient
      for (const recipient of recipients) {
        const phone = recipient.whatsapp;
        if (!phone) {
          await prisma.whatsapp_reminder_logs.create({
            data: {
              reminder_id: r.id,
              recipient_phone: 'N/A',
              recipient_name: `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim() || recipient.email,
              status: 'failed',
              error_message: 'No WhatsApp number found in profile'
            }
          });
          failCount++;
          continue;
        }

        const textToSend = formatMessage(r.message, event, r.target_type);
        const recipientName = `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim() || 'Colaborador';
        
        const success = await sendRespondMessage(phone, {
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
                    text: textToSend
                  }
                ]
              }
            ]
          }
        });

        await prisma.whatsapp_reminder_logs.create({
          data: {
            reminder_id: r.id,
            recipient_phone: phone,
            recipient_name: recipientName || recipient.email,
            status: success ? 'success' : 'failed',
            error_message: success ? null : 'Failed to send via respond.io API'
          }
        });

        if (success) successCount++;
        else failCount++;
      }

      results.push({
        reminderId: r.id,
        title: r.title,
        recipientsChecked: recipients.length,
        successCount,
        failCount
      });
    }

    return NextResponse.json({ success: true, processed: results });
  } catch (error: any) {
    console.error('[Cron Reminders] Critical Error:', error);
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
