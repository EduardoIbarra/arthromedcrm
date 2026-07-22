import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { Client } from '@/types/database'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

export async function POST(request: NextRequest) {
  const { clientId } = await request.json()

  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      client_activities (*),
      client_custom_fields (*)
    `)
    .eq('id', clientId)
    .order('created_at', { foreignTable: 'client_activities', ascending: false })
    .limit(10, { foreignTable: 'client_activities' })
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const client = data as any

  const activitiesText = client.client_activities?.map((a: any) => `- [${a.type}] ${a.content}`).join('\n') || 'Sin actividad reciente'
  const customFieldsText = client.client_custom_fields?.map((f: any) => `- ${f.field_name}: ${f.field_value}`).join('\n') || 'Sin campos adicionales'

  const prompt = `Eres un asistente de ERP para Arthromed, empresa mexicana de equipo médico.
Genera un resumen ejecutivo conciso (máximo 3 oraciones) del siguiente distribuidor médico:

Nombre: ${client.name}
RFC: ${client.rfc || 'N/A'}
Estatus: ${client.status}
Origen: ${client.source || 'N/A'}
Estados: ${client.states?.join(', ') || 'N/A'}
Especialidades: ${client.specialties?.join(', ') || 'N/A'}
Notas Principales: ${client.notes || 'Sin notas'}

Actividad Reciente:
${activitiesText}

Datos Adicionales:
${customFieldsText}

El resumen debe sintetizar tanto los datos generales como la actividad reciente para identificar el estado actual de la relación, intereses clave del cliente y oportunidades. Sé directo y profesional.`

  try {
    const { text } = await generateText({
      model: google('gemini-1.5-flash'),
      prompt,
    })
    return NextResponse.json({ summary: text })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
