import { NextRequest, NextResponse, after } from 'next/server'
import prisma from '@/lib/prisma'
import { generateClientLetter } from '@/lib/services/letter'
import { sendRespondMessage } from '@/lib/respond'
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'



export const dynamic = 'force-dynamic'

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
            text: `🤖 *ArthroNexus - Control Virtual* 🤖\n\nHola, soy tu asistente virtual de ArthroMed ERP. Aquí tienes las opciones y comandos disponibles:\n\n📝 *1. Generar Carta de Distribución*\nPídeme generar una carta directamente en lenguaje natural. Ej: _"Generar carta para Juan Pérez dirigida al Hospital Ángeles con las líneas Plasma y Shaver."_\n\n📅 *2. Consultar Recordatorios*\nEscribe */recordatorios* para ver los recordatorios activos de hoy.\n\n🏥 *3. Consultar Agenda*\nEscribe */agenda* para ver las cirugías, congresos y talleres de hoy.\n\n🧪 *4. Enviar Recordatorio de Prueba*\nEscribe */probar [ID_RECORDATORIO]* para enviarte un mensaje de prueba.\n\n💡 Escribe */ayuda* en cualquier momento para ver este menú.`
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

        // 2. FALL BACK TO EXISTING GEMINI PARSER FOR LETTER REQUESTS
        const allLines = await prisma.catalog_lines.findMany()

        const prompt = `Un miembro del personal de Arthromed está enviando un mensaje de WhatsApp en lenguaje natural para solicitar la generación de una Carta de Distribución para un distribuidor.

Mensaje del usuario:
"${messageText}"

Líneas de producto disponibles en el sistema (nombre e ID):
${allLines.map((l: any) => `- Nombre: "${l.name}" (ID: "${l.id}") ${l.description ? ` - Descripcion: "${l.description}"` : ''}`).join('\n')}

Por favor, analiza el mensaje en lenguaje natural y extrae la información estructurada necesaria:
1. "isLetterRequest": Debe ser true si el mensaje solicita generar/crear/mandar una carta de distribución. De lo contrario, false.
2. "isStatusRequest": Debe ser true si el mensaje solicita un estatus, cómo vamos, o información sobre las facturas/pedidos de un distribuidor o cliente (ej. "¿Cómo vamos con MAVA?", "Status de MAVA").
3. "distributorQuery": El nombre, ID de distribuidor, código o RFC del distribuidor/cliente para el cual se solicita la carta o el estatus (ej. "Juan Pérez", "Artromed del Norte", "MAVA"). Este dato es OBLIGATORIO para buscar al cliente en la base de datos si es Letter Request o Status Request. Si no se menciona o no está claro a qué distribuidor se refiere, pon null.
4. "institutionName": El nombre de la institución, hospital, clínica o doctor destinatario al cual va dirigida la carta (ej. "Hospital Ángeles", "IMSS", "ISSSTE"). Si no se especifica o está ausente, pon null.
5. "distributorName": Si se especifica una razón social o nombre exacto para imprimir en la carta que sea diferente al nombre comercial del distribuidor, extráelo aquí. De lo contrario, pon null.
6. "rfc": Si se menciona un RFC específico para usar en la carta, extráelo. De lo contrario, pon null.
7. "selectedLinesIds": Compara las líneas solicitadas en el mensaje con la lista de líneas disponibles en el sistema. Selecciona los IDs de aquellas líneas que coincidan con lo solicitado (por ejemplo, si pide "plasma" coincide con "Bonss Plasma", si pide "shaver" coincide con "Bonss Shaver", etc.). Si no solicita ninguna línea específica o no coincide con ninguna, deja la lista vacía.
8. "expirationDate": Fecha de vencimiento específica en formato YYYY-MM-DD si se menciona en el mensaje. De lo contrario, pon null.
9. "missingInformation": Si "isLetterRequest" es true pero falta el distribuidor ("distributorQuery"), la institución ("institutionName") o las líneas de producto, escribe un mensaje explicativo y amigable en español solicitando los datos faltantes.
10. "coverage": La cobertura geográfica (región, estado, estados, país o países) especificada en la solicitud (ej. "Nuevo León", "los estados de Jalisco, Colima y Nayarit", "república mexicana", etc.). Si no se especifica explícitamente en el mensaje, pon null.`

        const openai = createOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        })
        const google = createGoogleGenerativeAI({
          apiKey: process.env.GEMINI_API_KEY,
        })

        const schema = z.object({
          isLetterRequest: z.boolean(),
          isStatusRequest: z.boolean(),
          distributorQuery: z.string().nullable(),
          institutionName: z.string().nullable(),
          distributorName: z.string().nullable(),
          rfc: z.string().nullable(),
          selectedLinesIds: z.array(z.string()),
          expirationDate: z.string().nullable(),
          missingInformation: z.string().nullable(),
          coverage: z.string().nullable()
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

        if (!extraction.isLetterRequest && !extraction.isStatusRequest) {
          console.log('Message is not a letter or status request. Sending virtual hub menu.')
          await sendRespondMessage(phone, {
            type: 'text',
            text: `🤖 *ArthroNexus - Asistente Virtual* 🤖\n\nNo pude entender la solicitud de carta, estatus o comando. Aquí tienes las opciones y comandos disponibles:\n\n📝 *1. Generar Carta de Distribución*\nPídeme generar una carta directamente en lenguaje natural. Ej: _"Generar carta para Juan Pérez dirigida al Hospital Ángeles con las líneas Plasma y Shaver."_\n\n📊 *2. Estatus de Cliente*\nPregúntame por el estatus de un cliente. Ej: _"¿Cómo vamos con MAVA?"_\n\n📅 *3. Consultar Recordatorios*\nEscribe */recordatorios* para ver los recordatorios activos de hoy.\n\n🏥 *4. Consultar Agenda*\nEscribe */agenda* para ver las cirugías, congresos y talleres de hoy.\n\n🧪 *5. Enviar Recordatorio de Prueba*\nEscribe */probar [ID_RECORDATORIO]* para enviarte un mensaje de prueba.\n\n💡 Escribe */ayuda* en cualquier momento para ver este menú.`
          })
          return
        }

        if (!extraction.distributorQuery) {
          console.log('Distributor name or query is missing.')
          const replyText = extraction.missingInformation || 'Por favor, confírmame el nombre o código del distribuidor para el cual deseas generar la carta.'
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
          const whereConditions: any[] = [{ cliente_id: client.id }]
          if (client.rfc) {
            whereConditions.push({ cliente_rfc: { equals: client.rfc, mode: 'insensitive' } })
          }
          if (client.name) {
            whereConditions.push({ cliente_nombre: { equals: client.name, mode: 'insensitive' } })
          }
          
          const facturas = await prisma.facturas_cliente.findMany({
            where: { 
              OR: whereConditions,
              estado: { notIn: ['anulado', 'cancelada'] }
            },
            orderBy: { fecha_expedicion: 'desc' }
          })
          
          let replyText = ''
          if (facturas.length === 0) {
            replyText = `El cliente *${client.name}* no tiene facturas registradas en el sistema.`
          } else {
            const pending = facturas.filter((f: any) => f.estado_surtido !== 'completa' && f.estado_surtido !== 'surtida')
            if (pending.length === 0) {
              const lastOrder = facturas[0]
              const orderDate = new Date(lastOrder.fecha_expedicion).toLocaleDateString('es-MX', { timeZone: 'UTC' })
              replyText = `Todas las facturas de *${client.name}* están surtidas/completas. Su última orden fue el ${orderDate}.`
            } else {
              const notPaid = pending.filter((f: any) => f.estado !== 'pagada' && f.estado !== 'pagado')
              const paid = pending.filter((f: any) => f.estado === 'pagada' || f.estado === 'pagado')
              replyText = `*${client.name}* tiene ${pending.length} factura(s) pendiente(s) por surtir.\n`
              if (notPaid.length > 0) {
                const notPaidDetails = notPaid.map((f: any) => f.numero_factura).join(', ')
                replyText += `- ${notPaid.length} no pagada(s) (Facturas: ${notPaidDetails}).\n`
              }
              if (paid.length > 0) {
                const paidDetails = paid.map((f: any) => `${f.numero_factura} [límite: ${new Date(f.fecha_vencimiento).toLocaleDateString('es-MX', { timeZone: 'UTC' })}]`).join(', ')
                replyText += `- ${paid.length} pagada(s) en proceso de entrega (Facturas: ${paidDetails}).\n`
              }
            }
          }

          replyText += `\n🔗 Toda la información a detalle está aquí:\nhttps://${host}/clients/${client.id}?tab=facturas`

          await sendRespondMessage(phone, {
            type: 'text',
            text: replyText
          })

          await prisma.client_activities.create({
            data: {
              client_id: client.id,
              type: 'whatsapp',
              content: `Consulta de estatus general vía WhatsApp por personal.`
            }
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
