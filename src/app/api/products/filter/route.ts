import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const specialtyIds = searchParams.getAll('specialty_ids')

  try {
    const products = await prisma.productos.findMany({
      where: specialtyIds.length > 0 ? {
        specialty_ids: {
          hasSome: specialtyIds
        }
      } : {},
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
