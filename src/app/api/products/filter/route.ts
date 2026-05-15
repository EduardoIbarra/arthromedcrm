import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const specialtyIds = searchParams.getAll('specialty_ids')

  try {
    const products = await prisma.products.findMany({
      where: specialtyIds.length > 0 ? {
        specialty_ids: {
          hasSome: specialtyIds
        }
      } : {},
      orderBy: {
        description: 'asc'
      }
    })
    return NextResponse.json({ data: products })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
