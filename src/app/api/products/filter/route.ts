import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const specialtyIds = searchParams.getAll('specialty_ids')
  const lineIds = searchParams.getAll('line_ids')

  try {
    let lineNames: string[] = []
    if (lineIds.length > 0) {
      const lines = await prisma.catalog_lines.findMany({
        where: { id: { in: lineIds } },
        select: { name: true }
      })
      lineNames = lines.map((l: any) => l.name)
    }

    const whereClause: any = {}
    if (specialtyIds.length > 0 && lineNames.length > 0) {
      whereClause.OR = [
        { specialty_ids: { hasSome: specialtyIds } },
        { line: { in: lineNames, mode: 'insensitive' } }
      ]
    } else if (specialtyIds.length > 0) {
      whereClause.specialty_ids = { hasSome: specialtyIds }
    } else if (lineNames.length > 0) {
      whereClause.line = { in: lineNames, mode: 'insensitive' }
    }

    const products = await prisma.productos.findMany({
      where: whereClause,
      orderBy: {
        nombre: 'asc'
      }
    })
    const mapped = products.map((p: any) => ({
      ...p,
      description: p.nombre,
      sale_price: p.precio_unitario !== null ? Number(p.precio_unitario) : null,
      base_hospital_price: p.base_hospital_price !== null ? Number(p.base_hospital_price) : null,
      category: p.categoria,
      type: p.tipo
    }))
    return NextResponse.json({ data: mapped })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
