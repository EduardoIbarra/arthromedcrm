import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await prisma.productos.findUnique({ where: { id } })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: { ...data, description: data.nombre, sale_price: data.precio_unitario, category: data.categoria, type: data.tipo } })
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
      subtipo,
      category,
      specialty_ids,
      image_urls,
      measurement_unit,
      height,
      width,
      depth,
      weight,
    } = body

    if (!description) {
      return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 })
    }

    const data = await prisma.productos.update({
      where: { id },
      data: {
        nombre: description,
        model: model || null,
        order_code: order_code || null,
        invoice_concept: invoice_concept || null,
        generic_description: generic_description || null,
        new_alg_description: new_alg_description || null,
        measurements: measurements || null,
        alg_description: alg_description || null,
        precio_unitario: sale_price !== '' && sale_price !== null ? Number(sale_price) : null,
        base_hospital_price: base_hospital_price !== '' && base_hospital_price !== null ? Number(base_hospital_price) : null,
        line: line || null,
        tipo: type || 'consumable',
        subtipo: subtipo || null,
        categoria: category || null,
        specialty_ids: specialty_ids || [],
        image_urls: image_urls || [],
        measurement_unit: measurement_unit || null,
        height: height !== '' && height !== null && height !== undefined ? Number(height) : null,
        width: width !== '' && width !== null && width !== undefined ? Number(width) : null,
        depth: depth !== '' && depth !== null && depth !== undefined ? Number(depth) : null,
        weight: weight !== '' && weight !== null && weight !== undefined ? Number(weight) : null,
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
    await prisma.productos.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error in DELETE /api/products/[id]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
