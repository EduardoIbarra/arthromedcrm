import { NextRequest, NextResponse } from 'next/server'
import { generateClientLetter } from '@/lib/services/letter'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params
    const body = await request.json()
    const {
      institutionName,
      distributorName,
      rfc,
      selectedLines, // Array of line IDs
      expirationDate,
      createdBy,
      coverage
    } = body

    if (!institutionName || !selectedLines || selectedLines.length === 0) {
      return NextResponse.json({ error: 'Faltan campos obligatorios: Institución y Líneas de producto' }, { status: 400 })
    }

    const host = request.headers.get('host') || 'localhost:3000'

    const result = await generateClientLetter({
      clientId,
      institutionName,
      distributorName,
      rfc,
      selectedLines,
      expirationDate,
      createdBy,
      host,
      coverage
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Error generating letter PDF:', err)
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}
