import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({
      data: [
        { id: 'segunda-db-stock', nombre: 'Almacén Segunda DB' }
      ]
    })
  } catch (err: any) {
    console.error('[GET /api/inventario/tipos]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
