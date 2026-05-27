import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/cirugias — list all surgeries with summary data
export async function GET() {
  try {
    const data = await prisma.cirugias.findMany({
      include: {
        cirugia_equipo: true,
        cirugia_productos: {
          include: { productos: { select: { nombre: true, precio_unitario: true } } },
        },
        cirugia_conceptos: true,
      },
      orderBy: { fecha: 'desc' },
    })
    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('[GET /api/cirugias]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/cirugias — create a new surgery
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      nombre,
      medico,
      descripcion,
      fecha,
      estado,
      notas,
      equipo,       // [{ user_id, rol }]
      productos,    // [{ producto_id, cantidad, es_consumible, tipo_uso, precio_unitario }]
      conceptos,    // [{ concepto, cantidad, precio_unitario, subtotal }]
    } = body

    if (!nombre || !medico || !fecha) {
      return NextResponse.json({ error: 'Nombre, médico y fecha son requeridos.' }, { status: 400 })
    }

    const cirugia = await prisma.cirugias.create({
      data: {
        nombre,
        medico,
        descripcion: descripcion || null,
        fecha: new Date(fecha),
        estado: estado || 'programada',
        notas: notas || null,
        cirugia_equipo: {
          create: (equipo || []).map((e: any) => ({
            user_id: e.user_id,
            rol: e.rol || null,
          })),
        },
        cirugia_productos: {
          create: (productos || []).map((p: any) => ({
            producto_id: p.producto_id,
            cantidad: Number(p.cantidad) || 1,
            es_consumible: Boolean(p.es_consumible),
            tipo_uso: p.tipo_uso || 'venta',
            precio_unitario: p.precio_unitario != null ? Number(p.precio_unitario) : null,
          })),
        },
        cirugia_conceptos: {
          create: (conceptos || []).map((c: any) => ({
            concepto: c.concepto,
            cantidad: Number(c.cantidad) || 1,
            precio_unitario: Number(c.precio_unitario) || 0,
            subtotal: Number(c.subtotal) || 0,
          })),
        },
      },
      include: {
        cirugia_equipo: true,
        cirugia_productos: true,
        cirugia_conceptos: true,
      },
    })

    return NextResponse.json({ data: cirugia }, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/cirugias]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
