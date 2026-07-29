import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const reportes = await prisma.mantenimiento_reportes.findMany({
      where: { deleted_at: null },
      include: {
        registros: true,
      },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json(reportes)
  } catch (error: any) {
    console.error('Error fetching maintenance reports:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      registro_ids,
      titulo = 'PRODUCT FAILURE REPORTING',
      fabricante = 'Arthromed',
      periodo_evaluado,
      elaborado_por,
      empresa = 'Arthromed',
      causas_posibles = '',
      acciones_tomadas = '',
      idioma = 'en',
    } = body

    if (!registro_ids || !Array.isArray(registro_ids) || registro_ids.length === 0) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos un registro de falla' },
        { status: 400 }
      )
    }

    if (!periodo_evaluado || !elaborado_por) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: periodo evaluado y elaborado por' },
        { status: 400 }
      )
    }

    const year = new Date().getFullYear()
    const prefix = `REP-FAIL-${year}-`
    const reports = await prisma.mantenimiento_reportes.findMany({
      where: { folio: { startsWith: prefix } },
      select: { folio: true }
    })

    let maxNum = 0
    const folioRegex = new RegExp(`^REP-FAIL-${year}-(\\d+)$`)
    for (const r of reports) {
      const match = r.folio.match(folioRegex)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNum) maxNum = num
      }
    }

    const folio = `${prefix}${String(maxNum + 1).padStart(4, '0')}`

    // Create report and link records in transaction
    const reporte = await prisma.mantenimiento_reportes.create({
      data: {
        folio,
        titulo: titulo.trim(),
        fabricante: fabricante.trim(),
        periodo_evaluado: periodo_evaluado.trim(),
        elaborado_por: elaborado_por.trim(),
        empresa: empresa.trim(),
        causas_posibles: causas_posibles?.trim() || null,
        acciones_tomadas: acciones_tomadas?.trim() || null,
        idioma: idioma || 'en',
        registros: {
          connect: registro_ids.map((id: string) => ({ id })),
        },
      },
      include: {
        registros: true,
      },
    })

    // Update status of linked records to EN_REPORTE
    await prisma.mantenimiento_registros.updateMany({
      where: { id: { in: registro_ids } },
      data: { status: 'EN_REPORTE' },
    })

    return NextResponse.json(reporte, { status: 201 })
  } catch (error: any) {
    console.error('Error creating maintenance report:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
