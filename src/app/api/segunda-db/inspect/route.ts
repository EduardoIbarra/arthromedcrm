import { NextRequest, NextResponse } from 'next/server'
import { querySegundaDB } from '@/lib/segundaDB'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'tables'

    if (action === 'tables') {
      const rows = await querySegundaDB(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `)
      return NextResponse.json({ tables: rows })
    }

    if (action === 'cols') {
      const table = searchParams.get('table') || 'ordenes_compra'
      const rows = await querySegundaDB(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table])
      return NextResponse.json({ columns: rows })
    }

    if (action === 'sample') {
      const table = searchParams.get('table') || 'ordenes_compra'
      const rows = await querySegundaDB(`SELECT * FROM ${table} LIMIT 3`)
      return NextResponse.json({ rows })
    }

    if (action === 'distinct') {
      const table = searchParams.get('table') || 'ordenes_compra'
      const col = searchParams.get('col') || 'estado'
      const rows = await querySegundaDB(`SELECT DISTINCT ${col} FROM ${table} ORDER BY ${col}`)
      return NextResponse.json({ rows })
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
