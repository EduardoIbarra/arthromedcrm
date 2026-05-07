import { NextRequest, NextResponse } from 'next/server'

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!

export async function POST(request: NextRequest) {
  const { to, template, language = 'es_MX', components = [] } = await request.json()

  if (!to || !template) {
    return NextResponse.json({ error: 'Missing to or template' }, { status: 400 })
  }

  const phoneClean = to.replace(/\D/g, '')
  const phone = phoneClean.startsWith('52') ? phoneClean : `52${phoneClean}`

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'template',
    template: {
      name: template,
      language: { code: language },
      components,
    },
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data }, { status: res.status })
    }
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
