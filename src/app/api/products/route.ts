import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await prisma.products.findMany({
      orderBy: { description: 'asc' },
    })
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      description,
      model,
      order_code,
      invoice_concept,
      generic_description,
      new_alg_description,
      measurements,
      alg_description,
      sale_price,
      base_hospital_price,
      line,
      type,
      category,
      specialty_ids,
    } = body

    if (!description) {
      return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 })
    }

    const data = await prisma.products.create({
      data: {
        description,
        model: model || null,
        order_code: order_code || null,
        invoice_concept: invoice_concept || null,
        generic_description: generic_description || null,
        new_alg_description: new_alg_description || null,
        measurements: measurements || null,
        alg_description: alg_description || null,
        sale_price: sale_price !== '' && sale_price !== null ? Number(sale_price) : null,
        base_hospital_price: base_hospital_price !== '' && base_hospital_price !== null ? Number(base_hospital_price) : null,
        line: line || null,
        type: type || 'consumable',
        category: category || null,
        specialty_ids: specialty_ids || [],
      },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    console.error('Error in POST /api/products:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
