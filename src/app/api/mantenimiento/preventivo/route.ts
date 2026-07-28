import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cliente = searchParams.get('cliente')
    const status = searchParams.get('status')

    const records = await prisma.mantenimiento_preventivo.findMany({
      where: {
        deleted_at: null,
        ...(cliente ? { cliente: { contains: cliente, mode: 'insensitive' } } : {}),
        ...(status && status !== 'ALL' ? { status } : {}),
      },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json(records)
  } catch (error: any) {
    console.error('Error fetching preventivo records:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      cliente,
      cliente_id,
      producto,
      numero_serie,
      fecha_servicio,
      elaborado_por = 'Ing. Fernando Castro',
      revisado_por = 'Ing. Ricardo Puente Aranda',
      observaciones,
      tareas = [],
      idioma = 'es',
    } = body

    if (!cliente || !producto || !numero_serie || !fecha_servicio) {
      return NextResponse.json(
        { error: 'Campos obligatorios: cliente, producto, número de serie, fecha de servicio' },
        { status: 400 }
      )
    }

    const year = new Date().getFullYear()
    const count = await prisma.mantenimiento_preventivo.count()
    const folio = `MT-${year}-${String(count + 1).padStart(4, '0')}`

    const record = await prisma.mantenimiento_preventivo.create({
      data: {
        folio,
        cliente: cliente.trim(),
        cliente_id: cliente_id || null,
        producto: producto.trim(),
        numero_serie: numero_serie.trim(),
        fecha_servicio: new Date(fecha_servicio),
        elaborado_por: elaborado_por.trim(),
        revisado_por: revisado_por.trim(),
        observaciones: observaciones?.trim() || null,
        tareas,
        idioma: idioma || 'es',
        status: 'COMPLETADO',
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error: any) {
    console.error('Error creating preventivo record:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
