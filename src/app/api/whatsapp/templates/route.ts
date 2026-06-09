import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const RESPOND_API_TOKEN = process.env.RESPOND_API_TOKEN
  const RESPOND_CHANNEL_ID = process.env.RESPOND_CHANNEL_ID

  if (!RESPOND_API_TOKEN || !RESPOND_CHANNEL_ID) {
    console.error('Missing RESPOND_API_TOKEN or RESPOND_CHANNEL_ID')
    return NextResponse.json({ error: 'Missing respond.io configuration' }, { status: 500 })
  }

  try {
    const url = `https://api.respond.io/v2/space/channel/${RESPOND_CHANNEL_ID}/template`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${RESPOND_API_TOKEN}`,
        'Accept': 'application/json'
      }
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('Respond.io error fetching templates:', res.status, errorText)
      return NextResponse.json({ error: errorText || 'Failed to fetch templates' }, { status: res.status })
    }

    const data = await res.json()
    // Filter templates to only return approved ones
    const approvedTemplates = (data.items || []).filter((item: any) => item.status === 'approved')
    return NextResponse.json({ data: approvedTemplates })
  } catch (err) {
    console.error('Error fetching templates:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
