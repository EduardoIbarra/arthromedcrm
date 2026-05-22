import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await prisma.products.findUnique({ where: { id } })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const data = await prisma.products.update({
      where: { id },
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
        updated_at: new Date(),
      },
    })

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('Error in PUT /api/products/[id]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.products.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error in DELETE /api/products/[id]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
