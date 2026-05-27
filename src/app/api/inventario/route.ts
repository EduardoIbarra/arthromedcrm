import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/inventario — returns all productos with stock info
export async function GET() {
  try {
    const productos = await prisma.$queryRaw<
      {
        id: string
        nombre: string
        categoria: string | null
        tipo: string | null
        activo: boolean | null
        stock_actual: number
        precio_unitario: number
        stock_updated_at: string | null
      }[]
    >`
      SELECT
        id,
        nombre,
        categoria,
        tipo,
        activo,
        COALESCE(stock_actual, 0)::int AS stock_actual,
        precio_unitario::numeric AS precio_unitario,
        stock_updated_at
      FROM public.productos
      ORDER BY nombre ASC
    `

    return NextResponse.json({ data: productos })
  } catch (err: any) {
    console.error('[GET /api/inventario]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
