import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const RESPOND_API_TOKEN = process.env.RESPOND_API_TOKEN
  const RESPOND_CHANNEL_ID = process.env.RESPOND_CHANNEL_ID

  const { to, template, language = 'es_MX', components = [], text } = await request.json()

  if (!to) {
    return NextResponse.json({ error: 'Missing to' }, { status: 400 })
  }
  if (!template && !text) {
    return NextResponse.json({ error: 'Missing template or text' }, { status: 400 })
  }
  
  if (!RESPOND_API_TOKEN) {
    console.error('Missing RESPOND_API_TOKEN in environment')
    return NextResponse.json({ error: 'Missing RESPOND_API_TOKEN' }, { status: 500 })
  }

  const phoneClean = to.replace(/\D/g, '')
  const phone = phoneClean.startsWith('52') ? phoneClean : `52${phoneClean}`
  const targetNumber = `phone:+${phone}`

  // Prepare payload for Respond.io
  const payload: any = {
    message: {}
  }

  if (RESPOND_CHANNEL_ID) {
    payload.channelId = parseInt(RESPOND_CHANNEL_ID, 10)
  }

  if (template) {
    payload.message.type = 'whatsapp_template'
    
    // Respond.io uses languageCode and mirrors Meta's component structure.
    // Ensure both subType and sub_type are passed just in case.
    const mappedComponents = components.map((c: any) => {
      const comp = { ...c }
      if (comp.sub_type) comp.subType = comp.sub_type
      if (comp.subType) comp.sub_type = comp.subType
      return comp
    })

    payload.message.template = {
      name: template,
      languageCode: language,
      components: mappedComponents,
    }
  } else if (text) {
    payload.message.type = 'text'
    payload.message.text = text
  }

  try {
    const res = await fetch(`https://api.respond.io/v2/contact/${encodeURIComponent(targetNumber)}/message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESPOND_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    
    if (!res.ok) {
      const errorText = await res.text()
      console.error('Respond.io error:', res.status, errorText)
      return NextResponse.json({ error: errorText || 'Failed to send via Respond.io' }, { status: res.status })
    }
    
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('Error hitting Respond.io:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

