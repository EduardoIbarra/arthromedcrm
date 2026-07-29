import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fabricante = searchParams.get('fabricante')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: any = {
      deleted_at: null,
    }

    if (fabricante && fabricante !== 'ALL') {
      where.fabricante = { contains: fabricante, mode: 'insensitive' }
    }

    if (status && status !== 'ALL') {
      where.status = status
    }

    if (search) {
      where.OR = [
        { folio: { contains: search, mode: 'insensitive' } },
        { producto: { contains: search, mode: 'insensitive' } },
        { numero_serie_lote: { contains: search, mode: 'insensitive' } },
        { tipo_falla: { contains: search, mode: 'insensitive' } },
        { descripcion_detalle: { contains: search, mode: 'insensitive' } },
        { observaciones: { contains: search, mode: 'insensitive' } },
      ]
    }

    const registros = await prisma.mantenimiento_registros.findMany({
      where,
      include: {
        reporte: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    return NextResponse.json(registros)
  } catch (error: any) {
    console.error('Error fetching maintenance records:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener registros de mantenimiento' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      producto,
      numero_serie_lote,
      tipo_falla,
      descripcion_detalle,
      frecuencia = 1,
      observaciones = '',
      fabricante = 'BONSS',
      periodo_evaluado = '',
      evidencias = [],
      fecha_reporte,
    } = body

    if (!producto || !numero_serie_lote || !tipo_falla || !descripcion_detalle) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios (producto, número de serie/lote, tipo de falla, descripción)' },
        { status: 400 }
      )
    }

    // Auto-generate Folio safely by fetching highest existing folio number for current year
    const year = new Date().getFullYear()
    const prefix = `FAIL-${year}-`
    const lastRecord = await prisma.mantenimiento_registros.findFirst({
      where: { folio: { startsWith: prefix } },
      orderBy: { folio: 'desc' },
      select: { folio: true }
    })

    let nextNum = 1
    if (lastRecord?.folio) {
      const parts = lastRecord.folio.split('-')
      const numPart = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(numPart)) {
        nextNum = numPart + 1
      }
    }

    const folio = `${prefix}${String(nextNum).padStart(4, '0')}`

    const nuevoRegistro = await prisma.mantenimiento_registros.create({
      data: {
        folio,
        producto: producto.trim(),
        numero_serie_lote: numero_serie_lote.trim(),
        tipo_falla: tipo_falla.trim(),
        descripcion_detalle: descripcion_detalle.trim(),
        frecuencia: Number(frecuencia) || 1,
        observaciones: observaciones?.trim() || null,
        fabricante: fabricante?.trim() || 'Arthromed',
        periodo_evaluado: periodo_evaluado?.trim() || null,
        evidencias: evidencias || [],
        fecha_reporte: fecha_reporte ? new Date(fecha_reporte) : new Date(),
        status: 'REGISTRADO',
      },
    })

    return NextResponse.json(nuevoRegistro, { status: 201 })
  } catch (error: any) {
    console.error('Error creating maintenance record:', error)
    return NextResponse.json(
      { error: error.message || 'Error al crear registro de mantenimiento' },
      { status: 500 }
    )
  }
}
