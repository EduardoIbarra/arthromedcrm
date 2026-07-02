import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [data, catalogLines] = await Promise.all([
      prisma.productos.findMany({
        orderBy: [
          { orden: 'asc' },
          { nombre: 'asc' }
        ]
      }),
      prisma.catalog_lines.findMany({
        select: { name: true, color: true }
      })
    ])

    const lineColors = new Map<string, string>()
    for (const line of catalogLines) {
      lineColors.set(line.name.toLowerCase(), line.color)
    }

    const mapped = data.map((p: any) => ({
      ...p,
      description: p.nombre,
      sale_price: p.precio_unitario !== null ? Number(p.precio_unitario) : null,
      base_hospital_price: p.base_hospital_price !== null ? Number(p.base_hospital_price) : null,
      category: p.categoria,
      type: p.tipo,
      line_color: p.line ? (lineColors.get(p.line.toLowerCase()) || null) : null
    }))
    return NextResponse.json({ data: mapped })
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
      subtipo,
      category,
      specialty_ids,
      image_urls,
    } = body

    if (!description) {
      return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 })
    }

    const data = await prisma.productos.create({
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
      },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    console.error('Error in POST /api/products:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
