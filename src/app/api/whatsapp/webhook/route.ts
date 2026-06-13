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

    // 3. Fetch all available product lines for the parser
    const allLines = await prisma.catalog_lines.findMany()

    // 4. Query Gemini to parse the message
    const prompt = `Un miembro del personal de Arthromed está enviando un mensaje de WhatsApp en lenguaje natural para solicitar la generación de una Carta de Distribución para un distribuidor.

Mensaje del usuario:
"${messageText}"

Líneas de producto disponibles en el sistema (nombre e ID):
${allLines.map((l: any) => `- Nombre: "${l.name}" (ID: "${l.id}") ${l.description ? ` - Descripcion: "${l.description}"` : ''}`).join('\n')}

Por favor, analiza el mensaje en lenguaje natural y extrae la información estructurada necesaria:
1. "isLetterRequest": Debe ser true si el mensaje solicita generar/crear/mandar una carta de distribución. De lo contrario, false.
2. "distributorQuery": El nombre, ID de distribuidor, código o RFC del distribuidor/cliente para el cual se solicita la carta (ej. "Juan Pérez", "Artromed del Norte", "DIST002"). Este dato es OBLIGATORIO para buscar al cliente en la base de datos. Si no se menciona o no está claro a qué distribuidor se refiere, pon null.
3. "institutionName": El nombre de la institución, hospital, clínica o doctor destinatario al cual va dirigida la carta (ej. "Hospital Ángeles", "IMSS", "ISSSTE"). Si no se especifica o está ausente, pon null.
4. "distributorName": Si se especifica una razón social o nombre exacto para imprimir en la carta que sea diferente al nombre comercial del distribuidor, extráelo aquí. De lo contrario, pon null.
5. "rfc": Si se menciona un RFC específico para usar en la carta, extráelo. De lo contrario, pon null.
6. "selectedLinesIds": Compara las líneas solicitadas en el mensaje con la lista de líneas disponibles en el sistema. Selecciona los IDs de aquellas líneas que coincidan con lo solicitado (por ejemplo, si pide "plasma" coincide con "Bonss Plasma", si pide "shaver" coincide con "Bonss Shaver", etc.). Si no solicita ninguna línea específica o no coincide con ninguna, deja la lista vacía.
7. "expirationDate": Fecha de vencimiento específica en formato YYYY-MM-DD si se menciona en el mensaje. De lo contrario, pon null.
8. "missingInformation": Si "isLetterRequest" es true pero falta el distribuidor ("distributorQuery"), la institución ("institutionName") o las líneas de producto, escribe un mensaje explicativo y amigable en español solicitando los datos faltantes.`

    const parsed = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: z.object({
        isLetterRequest: z.boolean(),
        distributorQuery: z.string().nullable(),
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

    // 5. Handle cases based on extraction result
    if (!extraction.isLetterRequest) {
      console.log('Message is not a letter request. Sending general instructions.')
      await sendRespondMessage(phone, {
        type: 'text',
        text: `¡Hola! Soy el asistente inteligente de Arthromed ERP. Puedo ayudarte a generar Cartas de Distribución directamente desde aquí.\n\nPara generar una, pídeme lo siguiente en un solo mensaje:\n1. El distribuidor (ej. Juan Pérez, o su código de distribuidor).\n2. La institución o destinatario (ej. Hospital Ángeles).\n3. Las líneas de producto (ej. Plasma, Shaver).\n\nEjemplo: 'Por favor genérame la carta para el distribuidor Juan Pérez dirigida al Hospital Ángeles con las líneas Plasma y Shaver.'`
      })
      return NextResponse.json({ success: true, message: 'General instructions sent' })
    }

    if (!extraction.distributorQuery) {
      console.log('Distributor name or query is missing.')
      const replyText = extraction.missingInformation || 'Por favor, confírmame el nombre o código del distribuidor para el cual deseas generar la carta.'
      await sendRespondMessage(phone, {
        type: 'text',
        text: replyText
      })
      return NextResponse.json({ success: true, message: 'Missing distributor name request sent' })
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
      return NextResponse.json({ success: true, message: 'Client not found, reply sent' })
    }

    // 7. Verify other required fields
    if (!extraction.institutionName || extraction.selectedLinesIds.length === 0) {
      console.log('Letter request is missing required fields (institution or lines). Replying to ask for info.')
      const replyText = extraction.missingInformation || `Encontré al distribuidor **${client.name}**, pero necesito que me confirmes la institución destinataria y las líneas de producto que deseas incluir (ej. Plasma, Shaver).`
      await sendRespondMessage(phone, {
        type: 'text',
        text: replyText
      })
      return NextResponse.json({ success: true, message: 'Missing institution or lines request sent' })
    }

    // 8. Calculate final expiration date
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

    // 9. Generate and send the letter
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
        content: `Carta de Distribución generada vía WhatsApp por personal para ${extraction.institutionName} (Líneas: ${extraction.selectedLinesIds.join(', ')})`
      }
    })

    // Reply with text and attachment
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
          text: `Hubo un error al generar la carta: ${err.message || err}. Por favor intenta de nuevo o comunícate con soporte.`
        })
      }
    } catch (e) {
      console.error('Failed to send error notification:', e)
    }

    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
