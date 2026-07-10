import { NextRequest, NextResponse, after } from 'next/server'
import prisma from '@/lib/prisma'
import { generateClientLetter } from '@/lib/services/letter'
import { sendRespondMessage } from '@/lib/respond'
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import {
  computeDeliveryLimit,
  formatDeliveryLimitMessage,
  firstPaymentFieldsFromAlegraInvoice,
} from '@/lib/delivery-limit'
import { fetchAlegraInvoice } from '@/lib/alegra'

/** Enrich invoice with first-payment data from Alegra when local fields are missing. */
async function enrichDeliverySource(f: any): Promise<any> {
  if (f.primer_pago_fecha && f.primer_pago_monto != null) return f
  if (!f.alegra_id) return f
  try {
    const inv = await fetchAlegraInvoice(String(f.alegra_id))
    const fp = firstPaymentFieldsFromAlegraInvoice(inv)
    const payments = Array.isArray(inv.payments)
      ? inv.payments.map((p: any) => ({ date: p.date, amount: p.amount }))
      : []
    // Persist for list UIs (best-effort)
    if (fp.primer_pago_fecha || fp.total_pagado != null) {
      try {
        await prisma.facturas_cliente.update({
          where: { id: f.id },
          data: {
            primer_pago_fecha: fp.primer_pago_fecha,
            primer_pago_monto: fp.primer_pago_monto,
            total_pagado: fp.total_pagado,
            ...(fp.estadoHint === 'parcial' && f.estado === 'pendiente'
              ? { estado: 'parcial', fecha_pago: fp.primer_pago_fecha || f.fecha_pago }
              : {}),
            ...(fp.estadoHint === 'pagada' && !['pagada', 'pagado'].includes(String(f.estado))
              ? { estado: 'pagada', fecha_pago: fp.primer_pago_fecha || f.fecha_pago }
              : {}),
          },
        })
      } catch (e) {
        console.warn('Could not persist primer_pago for', f.numero_factura, e)
      }
    }
    return {
      ...f,
      primer_pago_fecha: fp.primer_pago_fecha || f.primer_pago_fecha,
      primer_pago_monto: fp.primer_pago_monto ?? f.primer_pago_monto,
      total_pagado: fp.total_pagado ?? f.total_pagado,
      payments,
    }
  } catch (e) {
    console.warn('Alegra enrich failed for', f.numero_factura, e)
    return f
  }
}

function formatPendingFacturasReply(clientName: string, pending: any[]): string {
  let replyText = `*${clientName}* tiene ${pending.length} factura(s) pendiente(s) por surtir.\n`
  for (const f of pending.slice(0, 15)) {
    const delivery = computeDeliveryLimit(f)
    const limit = formatDeliveryLimitMessage(delivery)
    const payLabel = ['pagada', 'pagado'].includes(String(f.estado).toLowerCase())
      ? 'pagada'
      : String(f.estado) === 'parcial'
        ? 'parcial'
        : 'no pagada / pendiente'
    replyText += `• *${f.numero_factura}* (${payLabel}) — límite entrega: ${limit}\n`
  }
  if (pending.length > 15) {
    replyText += `\n_…y ${pending.length - 15} más._\n`
  }
  return replyText
}

export const dynamic = 'force-dynamic'

/**
 * Normalize phone for staff matching.
 * Handles: 8110182368, +528110182368, +52 1 811 018 2368, unicode junk.
 * Returns the local 10-digit MX mobile when possible.
 */
function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return ''
  // Strip invisible/unicode formatting chars then non-digits
  let digits = String(raw)
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u202A-\u202E\u2060\uFEFF]/g, '')
    .replace(/\D/g, '')

  // Mexico mobile often arrives as 521XXXXXXXXXX (country 52 + trunk 1)
  if (digits.startsWith('521') && digits.length >= 13) {
    digits = digits.slice(3)
  } else if (digits.startsWith('52') && digits.length >= 12) {
    digits = digits.slice(2)
  }
  // After stripping 52, leftover leading 1 on 11-digit numbers
  if (digits.startsWith('1') && digits.length === 11) {
    digits = digits.slice(1)
  }
  return digits
}

function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhone(a)
  const nb = normalizePhone(b)
  if (!na || !nb) return false
  if (na === nb) return true
  // Always compare last 10 digits (MX mobile length)
  const la = na.slice(-10)
  const lb = nb.slice(-10)
  return la.length === 10 && lb.length === 10 && la === lb
}

async function findStaffByWhatsApp(phone: string) {
  const profiles = await prisma.user_profiles.findMany({
    where: {
      AND: [{ whatsapp: { not: null } }, { NOT: { whatsapp: '' } }],
    },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      whatsapp: true,
    },
  })
  const match = profiles.find((p: { whatsapp: string | null }) =>
    phonesMatch(p.whatsapp || '', phone)
  )
  if (!match) {
    console.log(
      `[WhatsApp staff auth] No match for phone raw="${phone}" normalized="${normalizePhone(phone)}" against ${profiles.length} profiles`
    )
  }
  return match || null
}

/**
 * Deterministic status intent: "cómo vamos con MAVA", "status de MAVA", etc.
 * Avoids AI dropping distributorQuery on simple phrases.
 */
function parseStatusIntent(message: string): { isStatus: boolean; query: string | null } {
  const text = message.trim()
  if (!text) return { isStatus: false, query: null }

  const patterns: RegExp[] = [
    /c[oó]mo\s+vamos\s+con\s+(.+?)[\s?!.]*$/i,
    /c[oó]mo\s+va(?:n)?\s+con\s+(.+?)[\s?!.]*$/i,
    /(?:estatus|status|estado)\s+(?:de|del|de\s+la)?\s*(.+?)[\s?!.]*$/i,
    /(?:facturas?|pedidos?)\s+(?:de|del|de\s+la)?\s*(.+?)[\s?!.]*$/i,
    /(?:avance|seguimiento)\s+(?:de|del|con)?\s*(.+?)[\s?!.]*$/i,
    /qu[eé]\s+hay\s+(?:de|con)\s+(.+?)[\s?!.]*$/i,
  ]

  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) {
      const query = m[1]
        .replace(/[?!.]+$/g, '')
        .replace(/^(el|la|los|las|cliente|distribuidor)\s+/i, '')
        .trim()
      if (query.length >= 2) {
        return { isStatus: true, query }
      }
    }
  }

  // Soft status keywords without a clear name
  if (
    /\b(c[oó]mo\s+vamos|estatus|status|facturas?\s+pendientes?)\b/i.test(text) &&
    !/\bcarta\b/i.test(text)
  ) {
    return { isStatus: true, query: null }
  }

  return { isStatus: false, query: null }
}

function parseReminderIntent(message: string): boolean {
  return /\b(recu[eé]rdame|recuerdame|av[ií]same|avisame|recordatorio|pon(me)?\s+un\s+recordatorio|agenda(me)?\s+un\s+recordatorio)\b/i.test(
    message
  )
}

const HUB_MENU = `🤖 *ArthroNexus - Asistente Virtual* 🤖

Solo personal de ArthroMed registrado puede usar este agente.

*Comandos y opciones:*
📝 *1. Carta de Distribución*
Ej: _"Generar carta para Juan Pérez dirigida al Hospital Ángeles con las líneas Plasma y Shaver."_

📊 *2. Estatus de Cliente*
Ej: _"¿Cómo vamos con MAVA?"_

⏰ *3. Crear Recordatorio*
Ej: _"Recuérdame el lunes a las 10am llamar a MAVA"_ o _"Recordatorio mañana 15:00 revisar factura 417"_

📅 *4.* */recordatorios* — recordatorios activos de hoy
🏥 *5.* */agenda* — cirugías, congresos y talleres de hoy
🧪 *6.* */probar [ID]* — prueba de un recordatorio

💡 Escribe */ayuda* para ver este menú.`

export async function POST(request: NextRequest) {
  let rawBody = ''
  try {
    const signature = request.headers.get('x-webhook-signature')
    rawBody = await request.text()

    // 1. Verify incoming signature from respond.io if signing secret is set
    if (process.env.RESPOND_WEBHOOK_SIGNING_SECRET) {
      const crypto = await import('crypto')
      const computedSignature = crypto
        .createHmac('sha256', process.env.RESPOND_WEBHOOK_SIGNING_SECRET)
        .update(rawBody)
        .digest('base64')

      try {
        const signatureBuffer = Buffer.from(signature || '', 'base64')
        const computedBuffer = Buffer.from(computedSignature, 'base64')
        if (
          signatureBuffer.length !== computedBuffer.length ||
          !crypto.timingSafeEqual(signatureBuffer, computedBuffer)
        ) {
          console.warn('Webhook signature verification failed.')
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }
      } catch (e) {
        console.error('Error comparing webhook signatures:', e)
        return NextResponse.json({ error: 'Signature verification error' }, { status: 401 })
      }
    }

    // 2. Parse body
    if (!rawBody) {
      return NextResponse.json({ error: 'Empty body' }, { status: 400 })
    }

    const body = JSON.parse(rawBody)
    console.log('Respond.io webhook received:', JSON.stringify(body))

    const messageText = body.message?.message?.text || body.message?.content?.text || body.message?.text || ""
    const phone = body.contact?.phone

    if (!phone) {
      console.log('No phone number in webhook payload. Skipping.')
      return NextResponse.json({ success: true, message: 'No phone number, skipped' })
    }

    if (!messageText.trim()) {
      console.log('Empty message text in webhook payload. Skipping.')
      return NextResponse.json({ success: true, message: 'Empty text, skipped' })
    }

    const host = request.headers.get('host') || 'erp.arthromed.com.mx'

    // Schedule heavy operations to run in the background after returning the response
    after(async () => {
      try {
        // 0. STAFF-ONLY: phone must match a registered user WhatsApp number (/users)
        const staffUser = await findStaffByWhatsApp(phone)
        if (!staffUser) {
          console.log(`WhatsApp access denied for non-staff phone: ${phone}`)
          await sendRespondMessage(phone, {
            type: 'text',
            text: `⛔ *Acceso restringido*\n\nEste agente de WhatsApp es *exclusivo para personal de ArthroMed* cuyo número esté registrado en el ERP (sección Usuarios).\n\nTu número no está autorizado. Por favor contacta a *IT* para que lo registren o actualicen tu WhatsApp en el sistema.\n\nSolo miembros del staff pueden usar este asistente.`,
          })
          return
        }

        const staffName =
          `${staffUser.first_name || ''} ${staffUser.last_name || ''}`.trim() ||
          staffUser.email ||
          'Colaborador'

        const cleanMsg = messageText.trim().toLowerCase();

        // 1. COMMAND ROUTING (HUB)
        if (
          cleanMsg === 'hola' ||
          cleanMsg === 'hi' ||
          cleanMsg === 'hello' ||
          cleanMsg === '/menu' ||
          cleanMsg === '/ayuda' ||
          cleanMsg === '/help' ||
          cleanMsg === '/start' ||
          cleanMsg.startsWith('buenos') ||
          cleanMsg.startsWith('buenas')
        ) {
          await sendRespondMessage(phone, {
            type: 'text',
            text: `Hola *${staffName}*.\n\n${HUB_MENU}`
          });
          return;
        }

        if (cleanMsg.startsWith('/recordatorios')) {
          const mxDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
          const todayStr = `${mxDate.getFullYear()}-${String(mxDate.getMonth() + 1).padStart(2, '0')}-${String(mxDate.getDate()).padStart(2, '0')}`;
          
          const reminders = await prisma.whatsapp_reminders.findMany({
            where: { active: true }
          });

          const activeRemindersToday = [];
          for (const r of reminders) {
            let isActiveToday = false;
            try {
              if (!r.target_id || r.target_type === 'general' || r.target_type === 'none') {
                if (r.dates && r.dates.length > 0) {
                  isActiveToday = r.dates.includes(todayStr);
                } else {
                  isActiveToday = true;
                }
              } else if (r.target_type === 'surgery') {
                const s = await prisma.cirugias.findUnique({ where: { id: r.target_id } });
                if (s) {
                  const sDateStr = new Date(s.fecha).toISOString().split('T')[0];
                  if (sDateStr === todayStr) isActiveToday = true;
                }
              } else if (r.target_type === 'congress') {
                const c = await prisma.congresos.findUnique({ where: { id: r.target_id } });
                if (c) {
                  const cStart = new Date(c.start_date);
                  const cEnd = new Date(c.end_date);
                  const todayDate = new Date(todayStr);
                  if (todayDate >= cStart && todayDate <= cEnd) isActiveToday = true;
                }
              } else if (r.target_type === 'workshop') {
                const w = await prisma.congress_workshops.findUnique({ where: { id: r.target_id } });
                if (w) {
                  const wStartStr = new Date(w.date_time).toISOString().split('T')[0];
                  const wEndStr = w.end_date_time ? new Date(w.end_date_time).toISOString().split('T')[0] : wStartStr;
                  if (todayStr >= wStartStr && todayStr <= wEndStr) isActiveToday = true;
                }
              }
            } catch (err) {
              console.error(`Error verifying reminder ${r.id} for today:`, err);
            }

            if (isActiveToday) {
              const startOfToday = new Date(todayStr + 'T00:00:00.000Z');
              const endOfToday = new Date(todayStr + 'T23:59:59.999Z');
              const logs = await prisma.whatsapp_reminder_logs.findMany({
                where: {
                  reminder_id: r.id,
                  sent_at: {
                    gte: startOfToday,
                    lte: endOfToday
                  }
                }
              });

              activeRemindersToday.push({
                title: r.title,
                time: r.time,
                sent: logs.length > 0,
                status: logs[0]?.status || 'pending'
              });
            }
          }

          let reply = `📅 *Recordatorios Activos de Hoy (${todayStr}):*\n\n`;
          if (activeRemindersToday.length === 0) {
            reply += `No hay recordatorios programados para hoy.`;
          } else {
            activeRemindersToday.forEach((r, idx) => {
              reply += `${idx + 1}. *${r.title}* - ⏰ ${r.time}\n   Estatus: ${r.sent ? `✅ Enviado (${r.status})` : '⏳ Pendiente'}\n\n`;
            });
          }
          await sendRespondMessage(phone, { type: 'text', text: reply });
          return;
        }

        if (cleanMsg.startsWith('/agenda')) {
          const mxDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
          const todayStr = `${mxDate.getFullYear()}-${String(mxDate.getMonth() + 1).padStart(2, '0')}-${String(mxDate.getDate()).padStart(2, '0')}`;
          
          const startOfToday = new Date(todayStr + 'T00:00:00.000Z');
          const endOfToday = new Date(todayStr + 'T23:59:59.999Z');

          const surgeries = await prisma.cirugias.findMany({
            where: {
              fecha: {
                gte: startOfToday,
                lte: endOfToday
              }
            }
          });

          const congresses = await prisma.congresos.findMany({
            where: {
              start_date: { lte: endOfToday },
              end_date: { gte: startOfToday }
            }
          });

          const workshops = await prisma.congress_workshops.findMany({
            where: {
              date_time: {
                gte: startOfToday,
                lte: endOfToday
              }
            }
          });

          let reply = `🏥 *Agenda de hoy (${todayStr}):*\n\n`;

          reply += `*Cirugías:* ${surgeries.length === 0 ? '_Ninguna_' : ''}\n`;
          surgeries.forEach((s: any) => {
            const time = new Date(s.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });
            reply += `• [${time}] *${s.nombre}* (Dr. ${s.medico}) - Estado: ${s.estado}\n`;
          });

          reply += `\n*Congresos:* ${congresses.length === 0 ? '_Ninguno_' : ''}\n`;
          congresses.forEach((c: any) => {
            reply += `• *${c.name}* (Ubicación: ${c.location})\n`;
          });

          reply += `\n*Talleres:* ${workshops.length === 0 ? '_Ninguno_' : ''}\n`;
          workshops.forEach((w: any) => {
            const time = new Date(w.date_time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });
            reply += `• [${time}] *${w.name}* (Prof. ${w.professor})\n`;
          });

          await sendRespondMessage(phone, { type: 'text', text: reply });
          return;
        }

        if (cleanMsg.startsWith('/probar')) {
          const parts = messageText.split(' ');
          const reminderId = parts[1]?.trim();
          if (!reminderId) {
            await sendRespondMessage(phone, {
              type: 'text',
              text: `⚠️ Por favor especifica el ID del recordatorio.\nEjemplo: */probar 123e4567-e89b-12d3-a456-426614174000*`
            });
            return;
          }

          const reminder = await prisma.whatsapp_reminders.findUnique({
            where: { id: reminderId }
          });

          if (!reminder) {
            await sendRespondMessage(phone, {
              type: 'text',
              text: `⚠️ No se encontró ningún recordatorio con el ID *${reminderId}*.`
            });
            return;
          }

          let eventName = 'Evento de prueba';
          let formattedText = reminder.message;

          try {
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
          } catch (err: any) {
            console.error('Error formatting event variables:', err);
          }

          const success = await sendRespondMessage(phone, {
            type: 'text',
            text: `🧪 *[PRUEBA] Recordatorio: ${reminder.title}* (Evento: ${eventName})\n---\n${formattedText}`
          });

          if (success) {
            await sendRespondMessage(phone, {
              type: 'text',
              text: `✅ Mensaje de prueba enviado exitosamente a tu número.`
            });
          } else {
            await sendRespondMessage(phone, {
              type: 'text',
              text: `❌ Error al enviar el mensaje de prueba a través de respond.io.`
            });
          }
          return;
        }

        // 2. Deterministic intents first (status / reminder) — AI often drops "MAVA" on simple phrases
        const statusIntent = parseStatusIntent(messageText)
        const looksLikeReminder = parseReminderIntent(messageText)

        // Fast path: status with a parsed client name — no AI needed
        if (statusIntent.isStatus && statusIntent.query && !looksLikeReminder) {
          console.log(`[WhatsApp] Deterministic status intent for query="${statusIntent.query}"`)
          const client = await prisma.clients.findFirst({
            where: {
              OR: [
                { name: { contains: statusIntent.query, mode: 'insensitive' } },
                { distributor_id: { contains: statusIntent.query, mode: 'insensitive' } },
                { rfc: { contains: statusIntent.query, mode: 'insensitive' } },
              ],
            },
          })

          if (!client) {
            await sendRespondMessage(phone, {
              type: 'text',
              text: `No pudimos encontrar ningún distribuidor que coincida con "*${statusIntent.query}*". Verifica el nombre o código e intenta de nuevo.`,
            })
            return
          }

          // facturas_cliente.cliente_id points to `clientes`, not CRM `clients` — match by name/RFC
          const whereConditions: any[] = []
          if (client.rfc) {
            whereConditions.push({ cliente_rfc: { equals: client.rfc, mode: 'insensitive' } })
          }
          if (client.name) {
            whereConditions.push({ cliente_nombre: { equals: client.name, mode: 'insensitive' } })
            whereConditions.push({ cliente_nombre: { contains: statusIntent.query, mode: 'insensitive' } })
          }
          // Also match query fragment directly on invoice client name (e.g. MAVA)
          whereConditions.push({ cliente_nombre: { contains: statusIntent.query, mode: 'insensitive' } })

          const facturas = await prisma.facturas_cliente.findMany({
            where: {
              OR: whereConditions,
              estado: { notIn: ['anulado', 'cancelada'] },
            },
            include: {
              planes_pago: {
                include: {
                  parcialidades: { orderBy: { numero: 'asc' } },
                },
                orderBy: { created_at: 'desc' },
                take: 1,
              },
            },
            orderBy: { fecha_expedicion: 'desc' },
          })

          let replyText = ''
          if (facturas.length === 0) {
            replyText = `El cliente *${client.name}* no tiene facturas registradas en el sistema.`
          } else {
            const pending = facturas.filter(
              (f: any) => f.estado_surtido !== 'completa' && f.estado_surtido !== 'surtida'
            )
            if (pending.length === 0) {
              const lastOrder = facturas[0]
              const orderDate = new Date(lastOrder.fecha_expedicion).toLocaleDateString('es-MX', {
                timeZone: 'UTC',
              })
              replyText = `Todas las facturas de *${client.name}* están surtidas/completas. Su última orden fue el ${orderDate}.`
            } else {
              const enriched = await Promise.all(pending.map((f: any) => enrichDeliverySource(f)))
              replyText = formatPendingFacturasReply(client.name, enriched)
            }
          }

          replyText += `\n\n🔗 Toda la información a detalle está aquí:\nhttps://${host}/clients/${client.id}?tab=facturas`

          await sendRespondMessage(phone, { type: 'text', text: replyText })
          await prisma.client_activities.create({
            data: {
              client_id: client.id,
              type: 'whatsapp',
              content: `Consulta de estatus general vía WhatsApp por personal (${staffName}).`,
            },
          })
          return
        }

        // 3. AI parser for letter / status (fallback) / personal reminder
        const allLines = await prisma.catalog_lines.findMany()
        const mxNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }))
        const mxNowIso = mxNow.toISOString()

        const prompt = `Eres el parser del asistente ArthroNexus de ArthroMed (ERP México).
Fecha/hora actual en Ciudad de México: ${mxNowIso} (${mxNow.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}).

Mensaje del usuario (staff):
"${messageText}"

Heurística previa del sistema (puede ser incompleta):
- statusIntent.isStatus=${statusIntent.isStatus}, statusIntent.query=${statusIntent.query || 'null'}
- looksLikeReminder=${looksLikeReminder}

Líneas de producto disponibles (nombre e ID):
${allLines.map((l: any) => `- Nombre: "${l.name}" (ID: "${l.id}") ${l.description ? ` - Descripcion: "${l.description}"` : ''}`).join('\n')}

IMPORTANTE:
- Si el mensaje es del tipo "cómo vamos con MAVA" o "status de X", entonces isStatusRequest=true y distributorQuery DEBE ser el nombre (ej. "MAVA"), NUNCA null.
- isLetterRequest, isStatusRequest e isReminderRequest son mutuamente prioritarios: estatus > recordatorio > carta cuando haya ambigüedad de "recordar" vs "cómo vamos".
- distributorQuery es OBLIGATORIO si isStatusRequest o isLetterRequest es true.

Extrae:
1. "isLetterRequest": true si pide generar/crear/mandar una carta de distribución.
2. "isStatusRequest": true si pide estatus, cómo vamos, facturas/pedidos de un distribuidor o cliente.
3. "isReminderRequest": true si pide crear un recordatorio personal (ej. "recuérdame...", "avísame el lunes...").
4. "distributorQuery": nombre/código/RFC del distribuidor (ej. "MAVA", "Juan Pérez"). NUNCA null si isStatusRequest o isLetterRequest.
5. "institutionName": institución/hospital destinatario de la carta; null si no.
6. "distributorName": razón social alternativa para la carta; null si no.
7. "rfc": RFC si se menciona; null si no.
8. "selectedLinesIds": IDs de líneas que coincidan; [] si no.
9. "expirationDate": YYYY-MM-DD si se menciona vigencia de carta; null si no.
10. "missingInformation": mensaje amable si falta info de carta; null si no.
11. "coverage": cobertura geográfica; null si no.
12. "reminderTitle": título corto del recordatorio; null si no.
13. "reminderMessage": texto del recordatorio; null si no.
14. "reminderDate": YYYY-MM-DD (resuelve "el próximo lunes", "mañana", etc. en America/Mexico_City); null si no.
15. "reminderTime": HH:MM 24h (default "09:00"); null si no es recordatorio.
16. "reminderMissingInfo": si falta fecha del recordatorio, pide aclaración; null si no.`

        const openai = createOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        })
        const google = createGoogleGenerativeAI({
          apiKey: process.env.GEMINI_API_KEY,
        })

        const schema = z.object({
          isLetterRequest: z.boolean(),
          isStatusRequest: z.boolean(),
          isReminderRequest: z.boolean(),
          distributorQuery: z.string().nullable(),
          institutionName: z.string().nullable(),
          distributorName: z.string().nullable(),
          rfc: z.string().nullable(),
          selectedLinesIds: z.array(z.string()),
          expirationDate: z.string().nullable(),
          missingInformation: z.string().nullable(),
          coverage: z.string().nullable(),
          reminderTitle: z.string().nullable(),
          reminderMessage: z.string().nullable(),
          reminderDate: z.string().nullable(),
          reminderTime: z.string().nullable(),
          reminderMissingInfo: z.string().nullable(),
        })

        let extraction;
        try {
          const parsed = await generateObject({
            model: google('gemini-1.5-flash') as any,
            schema,
            prompt
          })
          extraction = parsed.object
        } catch (geminiError) {
          console.error('Gemini generation failed, falling back to OpenAI:', geminiError)
          const parsed = await generateObject({
            model: openai('gpt-4o-mini') as any,
            schema,
            prompt
          })
          extraction = parsed.object
        }

        // Merge deterministic heuristics over AI (AI often drops distributorQuery)
        if (statusIntent.isStatus) {
          extraction.isStatusRequest = true
          if (!extraction.distributorQuery && statusIntent.query) {
            extraction.distributorQuery = statusIntent.query
          }
          // Don't treat status as letter/reminder
          extraction.isLetterRequest = false
          if (!looksLikeReminder) extraction.isReminderRequest = false
        }
        if (looksLikeReminder && !extraction.isStatusRequest && !extraction.isLetterRequest) {
          extraction.isReminderRequest = true
        }

        console.log('[WhatsApp] extraction', JSON.stringify({
          statusIntent,
          looksLikeReminder,
          isLetterRequest: extraction.isLetterRequest,
          isStatusRequest: extraction.isStatusRequest,
          isReminderRequest: extraction.isReminderRequest,
          distributorQuery: extraction.distributorQuery,
        }))

        // Personal reminder → whatsapp_reminders (same table as /recordatorios)
        if (extraction.isReminderRequest && !extraction.isLetterRequest && !extraction.isStatusRequest) {
          if (!extraction.reminderDate || extraction.reminderMissingInfo) {
            await sendRespondMessage(phone, {
              type: 'text',
              text:
                extraction.reminderMissingInfo ||
                '¿Para qué fecha y hora quieres el recordatorio? Ej: _"el próximo lunes a las 10:00"_ o _"2026-07-15 15:30"_.',
            })
            return
          }

          const dateMatch = String(extraction.reminderDate).match(/^(\d{4})-(\d{2})-(\d{2})$/)
          if (!dateMatch) {
            await sendRespondMessage(phone, {
              type: 'text',
              text: 'No pude interpretar la fecha del recordatorio. Indica una fecha clara (ej. _próximo lunes_ o _2026-07-20_).',
            })
            return
          }

          let time = (extraction.reminderTime || '09:00').trim()
          const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/)
          if (!timeMatch) {
            time = '09:00'
          } else {
            time = `${String(parseInt(timeMatch[1], 10)).padStart(2, '0')}:${timeMatch[2]}`
          }

          const title =
            (extraction.reminderTitle || '').trim() ||
            `Recordatorio personal — ${staffName}`
          const message =
            (extraction.reminderMessage || '').trim() ||
            messageText.trim()

          const reminder = await prisma.whatsapp_reminders.create({
            data: {
              title,
              message,
              target_type: 'general',
              target_id: null,
              time,
              notify_all_participants: false,
              extra_contacts: [staffUser.id],
              dates: [extraction.reminderDate],
              active: true,
            },
          })

          await sendRespondMessage(phone, {
            type: 'text',
            text: `✅ *Recordatorio creado*\n\n• *Título:* ${title}\n• *Fecha:* ${extraction.reminderDate}\n• *Hora:* ${time} (CDMX)\n• *Mensaje:* ${message}\n\nQuedó registrado en el ERP (Recordatorios WA) y se te enviará por WhatsApp a tu número de staff.\nID: \`${reminder.id}\`\n\nPuedes administrarlo en:\nhttps://${host}/recordatorios`,
          })
          return
        }

        if (!extraction.isLetterRequest && !extraction.isStatusRequest) {
          console.log('Message is not a letter, status or reminder request. Sending hub menu.')
          await sendRespondMessage(phone, {
            type: 'text',
            text: `No pude entender la solicitud.\n\n${HUB_MENU}`,
          })
          return
        }

        if (!extraction.distributorQuery) {
          console.log('Distributor name or query is missing.')
          const replyText = extraction.missingInformation || 'Por favor, confírmame el nombre o código del distribuidor para el cual deseas generar la carta o consultar el estatus.'
          await sendRespondMessage(phone, {
            type: 'text',
            text: replyText
          })
          return
        }

        // 6. Look up client/distributor in the database based on the query
        const client = await prisma.clients.findFirst({
          where: {
            OR: [
              { name: { contains: extraction.distributorQuery, mode: 'insensitive' } },
              { distributor_id: { contains: extraction.distributorQuery, mode: 'insensitive' } },
              { rfc: { contains: extraction.distributorQuery, mode: 'insensitive' } }
            ]
          }
        })

        if (!client) {
          console.log(`No registered client found matching query "${extraction.distributorQuery}". Replying...`)
          await sendRespondMessage(phone, {
            type: 'text',
            text: `No pudimos encontrar ningún distribuidor en nuestro sistema que coincida con "${extraction.distributorQuery}". Por favor, verifica el nombre o código e intenta nuevamente.`
          })
          return
        }

        if (extraction.isStatusRequest) {
          console.log(`Processing status request for client ${client.name}`)
          // NOTE: facturas_cliente.cliente_id → `clientes` table, NOT CRM `clients` UUID
          const whereConditions: any[] = []
          if (client.rfc) {
            whereConditions.push({ cliente_rfc: { equals: client.rfc, mode: 'insensitive' } })
          }
          if (client.name) {
            whereConditions.push({ cliente_nombre: { equals: client.name, mode: 'insensitive' } })
            whereConditions.push({ cliente_nombre: { contains: client.name, mode: 'insensitive' } })
          }
          if (extraction.distributorQuery) {
            whereConditions.push({
              cliente_nombre: { contains: extraction.distributorQuery, mode: 'insensitive' },
            })
          }
          if (whereConditions.length === 0) {
            whereConditions.push({ cliente_nombre: { contains: client.name || '', mode: 'insensitive' } })
          }

          const facturas = await prisma.facturas_cliente.findMany({
            where: {
              OR: whereConditions,
              estado: { notIn: ['anulado', 'cancelada'] },
            },
            include: {
              planes_pago: {
                include: {
                  parcialidades: { orderBy: { numero: 'asc' } },
                },
                orderBy: { created_at: 'desc' },
                take: 1,
              },
            },
            orderBy: { fecha_expedicion: 'desc' },
          })

          let replyText = ''
          if (facturas.length === 0) {
            replyText = `El cliente *${client.name}* no tiene facturas registradas en el sistema.`
          } else {
            const pending = facturas.filter(
              (f: any) => f.estado_surtido !== 'completa' && f.estado_surtido !== 'surtida'
            )
            if (pending.length === 0) {
              const lastOrder = facturas[0]
              const orderDate = new Date(lastOrder.fecha_expedicion).toLocaleDateString('es-MX', {
                timeZone: 'UTC',
              })
              replyText = `Todas las facturas de *${client.name}* están surtidas/completas. Su última orden fue el ${orderDate}.`
            } else {
              const enriched = await Promise.all(pending.map((f: any) => enrichDeliverySource(f)))
              replyText = formatPendingFacturasReply(client.name, enriched)
            }
          }

          replyText += `\n\n🔗 Toda la información a detalle está aquí:\nhttps://${host}/clients/${client.id}?tab=facturas`

          await sendRespondMessage(phone, {
            type: 'text',
            text: replyText,
          })

          await prisma.client_activities.create({
            data: {
              client_id: client.id,
              type: 'whatsapp',
              content: `Consulta de estatus general vía WhatsApp por personal (${staffName}).`,
            },
          })
          return
        }

        // 7. Verify other required fields
        if (!extraction.institutionName || extraction.selectedLinesIds.length === 0) {
          console.log('Letter request is missing required fields (institution or lines). Replying to ask for info.')
          const replyText = extraction.missingInformation || `Encontré al distribuidor **${client.name}**, pero necesito que me confirmes la institución destinataria y las líneas de producto que deseas incluir (ej. Plasma, Shaver).`
          await sendRespondMessage(phone, {
            type: 'text',
            text: replyText
          })
          return
        }

        // 8. Calculate final expiration date
        let finalExpDate: string
        if (extraction.expirationDate) {
          finalExpDate = extraction.expirationDate
        } else {
          const now = new Date()
          const nextYear = now.getFullYear() + 1
          const lastDay = new Date(nextYear, 1, 0)
          const yyyy = lastDay.getFullYear()
          const mm = String(lastDay.getMonth() + 1).padStart(2, '0')
          const dd = String(lastDay.getDate()).padStart(2, '0')
          finalExpDate = `${yyyy}-${mm}-${dd}`
        }

        // 9. Generate and send the letter
        console.log(`Generating letter for client ${client.id} addressed to ${extraction.institutionName}...`)
        
        const letterResult = await generateClientLetter({
          clientId: client.id,
          institutionName: extraction.institutionName,
          distributorName: extraction.distributorName || client.name,
          rfc: extraction.rfc || client.rfc || undefined,
          selectedLines: extraction.selectedLinesIds,
          expirationDate: finalExpDate,
          createdBy: null,
          host,
          coverage: extraction.coverage || undefined
        })

        await prisma.client_activities.create({
          data: {
            client_id: client.id,
            type: 'whatsapp',
            content: `Carta de Distribución generada vía WhatsApp por personal para ${extraction.institutionName} (Líneas: ${extraction.selectedLinesIds.join(', ')})`
          }
        })

        console.log('Sending letter PDF link and attachment back to respond.io...')
        await sendRespondMessage(phone, {
          type: 'text',
          text: `¡Hola! La Carta de Distribución de **${client.name}** para **${extraction.institutionName}** ha sido generada exitosamente. Puedes descargarla en el siguiente enlace:\n${letterResult.pdfUrl}`
        })

        await sendRespondMessage(phone, {
          type: 'attachment',
          fileUrl: letterResult.pdfUrl,
          fileName: `Carta_Distribucion_${(extraction.distributorName || client.name).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
        })

      } catch (err: any) {
        console.error('Error processing WhatsApp webhook in background:', err)
        try {
          await sendRespondMessage(phone, {
            type: 'text',
            text: `Hubo un error al procesar tu solicitud: ${err.message || err}. Por favor intenta de nuevo o comunícate con soporte.`
          })
        } catch (e) {
          console.error('Failed to send error notification:', e)
        }
      }
    })

    return NextResponse.json({ success: true, message: 'Request accepted, processing in background' })

  } catch (err: any) {
    console.error('Error in POST request validation:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
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
