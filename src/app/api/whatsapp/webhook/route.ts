import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { generateClientLetter } from '@/lib/services/letter'
import { sendRespondMessage } from '@/lib/respond'
import { generateObject } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

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

    const messageText = body.message?.content?.text || body.message?.text || ""
    const phone = body.contact?.phone

    if (!phone) {
      console.log('No phone number in webhook payload. Skipping.')
      return NextResponse.json({ success: true, message: 'No phone number, skipped' })
    }

    if (!messageText.trim()) {
      console.log('Empty message text in webhook payload. Skipping.')
      return NextResponse.json({ success: true, message: 'Empty text, skipped' })
    }

    // 3. Look up client by matching phone number in the database
    const phoneClean = phone.replace(/\D/g, '')
    const last10 = phoneClean.slice(-10)

    if (last10.length < 10) {
      console.warn('Phone number too short for client lookup:', phoneClean)
      return NextResponse.json({ success: true, message: 'Invalid phone number format, skipped' })
    }

    const client = await prisma.clients.findFirst({
      where: {
        OR: [
          { phone: { endsWith: last10 } },
          { whatsapp_phone: { endsWith: last10 } }
        ]
      }
    })

    if (!client) {
      console.log(`No registered client found for phone number ending in ${last10}. Replying...`)
      await sendRespondMessage(phone, {
        type: 'text',
        text: 'No pudimos encontrar un distribuidor asociado a este número de WhatsApp en nuestro sistema. Por favor, asegúrate de estar registrado en Arthromed ERP.'
      })
      return NextResponse.json({ success: true, message: 'Client not found, reply sent' })
    }

    // 4. Fetch all available product lines for the parser
    const allLines = await prisma.catalog_lines.findMany()

    // 5. Query Gemini to parse the message
    const prompt = `Un usuario (distribuidor registrado en Arthromed ERP) ha enviado un mensaje de WhatsApp en lenguaje natural solicitando generar una Carta de Distribución.

Mensaje del usuario:
"${messageText}"

Datos del distribuidor en el sistema:
- Nombre: ${client.name}
- RFC: ${client.rfc || 'No registrado'}

Líneas de producto disponibles en el sistema (nombre e ID):
${allLines.map((l: any) => `- Nombre: "${l.name}" (ID: "${l.id}") ${l.description ? ` - Descripcion: "${l.description}"` : ''}`).join('\n')}

Por favor, analiza el mensaje en lenguaje natural y extrae la información estructurada necesaria para la generación de la Carta de Distribución.

Reglas:
1. "isLetterRequest": Debe ser true si el mensaje del usuario pide generar/crear/solicitar una carta de distribución (ej. "hola, por favor genérame una carta de distribución", "necesito mi carta para el Hospital Angeles", "me puedes mandar la carta de distribuidor de plasma y shaver para el IMSS?"). Si es un saludo genérico o pregunta no relacionada, debe ser false.
2. "institutionName": El nombre de la institución, hospital, clínica, doctor o entidad destinataria a la cual va dirigida la carta (ej. "Hospital Ángeles", "IMSS", "Dr. Pérez"). Si el usuario NO especificó a quién va dirigida, deja este campo como null o vacío.
3. "distributorName": Si el usuario especifica un nombre o razón social diferente para el distribuidor en el cuerpo del mensaje, extráelo. De lo contrario, usa "${client.name}".
4. "rfc": Si el usuario menciona un RFC específico para la carta, extráelo. De lo contrario, usa "${client.rfc || ''}".
5. "selectedLinesIds": Compara las líneas solicitadas en el mensaje con la lista de líneas disponibles en el sistema. Selecciona los IDs de aquellas líneas que coincidan con lo solicitado (por ejemplo, si pide "plasma" coincide con "Bonss Plasma", si pide "shaver" coincide con "Bonss Shaver", etc.). Si no solicita ninguna línea específica o no coincide con ninguna, deja la lista vacía.
6. "expirationDate": Si el usuario menciona una vigencia específica (por ejemplo, "con vigencia al 31 de diciembre de 2026" o "que dure 6 meses"), calcula y proporciona la fecha en formato YYYY-MM-DD. De lo contrario, pon null.
7. "missingInformation": Si "isLetterRequest" es true pero falta la institución destinataria o no pudiste mapear ninguna línea de producto, escribe un mensaje explicativo y amigable en español solicitando al usuario los datos faltantes para poder generar su carta. De lo contrario, pon null.`

    const parsed = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: z.object({
        isLetterRequest: z.boolean(),
        institutionName: z.string().nullable(),
        distributorName: z.string().nullable(),
        rfc: z.string().nullable(),
        selectedLinesIds: z.array(z.string()),
        expirationDate: z.string().nullable(),
        missingInformation: z.string().nullable()
      }),
      prompt
    })

    const extraction = parsed.object

    // 6. Handle cases based on extraction result
    if (!extraction.isLetterRequest) {
      console.log('Message is not a letter request. Sending general instructions.')
      await sendRespondMessage(phone, {
        type: 'text',
        text: `¡Hola! Soy el asistente inteligente de Arthromed ERP. Puedo ayudarte a generar tu Carta de Distribución directamente desde aquí.\n\nPara generarla, solo pídeme lo siguiente en un solo mensaje:\n1. La institución o destinatario (ej. Hospital Ángeles).\n2. Las líneas de producto que requieres (ej. Plasma, Shaver).\n\nEjemplo: 'Por favor genérame mi carta para el Hospital Ángeles con las líneas Plasma y Shaver.'`
      })
      return NextResponse.json({ success: true, message: 'General instructions sent' })
    }

    if (!extraction.institutionName || extraction.selectedLinesIds.length === 0) {
      console.log('Letter request is missing required fields. Replying to ask for info.')
      const replyText = extraction.missingInformation || 'Por favor, confírmame la institución/destinatario y las líneas de producto que deseas incluir (ej. Plasma, Shaver) para poder generar tu carta.'
      await sendRespondMessage(phone, {
        type: 'text',
        text: replyText
      })
      return NextResponse.json({ success: true, message: 'Missing information request sent' })
    }

    // 7. Calculate final expiration date
    let finalExpDate: string
    if (extraction.expirationDate) {
      finalExpDate = extraction.expirationDate
    } else {
      // Default validity is last day of next January
      const now = new Date()
      const nextYear = now.getFullYear() + 1
      const lastDay = new Date(nextYear, 1, 0)
      const yyyy = lastDay.getFullYear()
      const mm = String(lastDay.getMonth() + 1).padStart(2, '0')
      const dd = String(lastDay.getDate()).padStart(2, '0')
      finalExpDate = `${yyyy}-${mm}-${dd}`
    }

    // 8. Generate and send the letter
    console.log(`Generating letter for client ${client.id} addressed to ${extraction.institutionName}...`)
    
    const host = request.headers.get('host') || 'erp.arthromed.com.mx'
    
    const letterResult = await generateClientLetter({
      clientId: client.id,
      institutionName: extraction.institutionName,
      distributorName: extraction.distributorName || client.name,
      rfc: extraction.rfc || client.rfc || undefined,
      selectedLines: extraction.selectedLinesIds,
      expirationDate: finalExpDate,
      createdBy: null,
      host
    })

    // Log the activity on the client profile
    await prisma.client_activities.create({
      data: {
        client_id: client.id,
        type: 'whatsapp',
        content: `Carta de Distribución generada vía WhatsApp para ${extraction.institutionName} (Líneas: ${extraction.selectedLinesIds.join(', ')})`
      }
    })

    // Reply with text and attachment
    console.log('Sending letter PDF link and attachment back to respond.io...')
    await sendRespondMessage(phone, {
      type: 'text',
      text: `¡Hola! Tu Carta de Distribución para ${extraction.institutionName} ha sido generada exitosamente. Aquí tienes el documento:`
    })

    await sendRespondMessage(phone, {
      type: 'attachment',
      fileUrl: letterResult.pdfUrl,
      fileName: `Carta_Distribucion_${(extraction.distributorName || client.name).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
    })

    return NextResponse.json({ success: true, message: 'Letter successfully generated and sent' })

  } catch (err: any) {
    console.error('Error processing WhatsApp webhook:', err)
    
    // Attempt to notify user of failure if phone is known
    try {
      const parsedBody = rawBody ? JSON.parse(rawBody) : null
      const phone = parsedBody?.contact?.phone
      if (phone) {
        await sendRespondMessage(phone, {
          type: 'text',
          text: `Hubo un error al generar tu carta: ${err.message || err}. Por favor intenta de nuevo o comunícate con soporte.`
        })
      }
    } catch (e) {
      console.error('Failed to send error notification:', e)
    }

    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
