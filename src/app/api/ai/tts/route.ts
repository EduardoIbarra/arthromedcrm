import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Handle GET for direct audio element streaming
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const text = searchParams.get('text')
    const voice = 'nova' // Hardcoded to Nova as requested

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 })
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3'
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('OpenAI TTS API error:', errText)
      return NextResponse.json({ error: 'Failed to generate speech' }, { status: response.status })
    }

    // Return direct stream from OpenAI
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked'
      }
    })
  } catch (error: any) {
    console.error('Error in TTS GET Route:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}

// Keep POST for compatibility or fallback
export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 })
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: 'nova', // Force Nova voice
        response_format: 'mp3'
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('OpenAI TTS API error:', errText)
      return NextResponse.json({ error: 'Failed to generate speech from OpenAI' }, { status: response.status })
    }

    const audioBuffer = await response.arrayBuffer()
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString()
      }
    })
  } catch (error: any) {
    console.error('Error in TTS POST Route:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}
