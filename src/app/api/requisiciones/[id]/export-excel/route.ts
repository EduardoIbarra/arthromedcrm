import { NextRequest } from 'next/server'
import ExcelJS from 'exceljs'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('es-MX', { timeZone: 'America/Monterrey' })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Access Denied', { status: 401 })
    }

    const requisicion = await prisma.requisiciones.findFirst({
      where: { id, deleted_at: null },
      include: {
        items: {
          where: { deleted_at: null },
          orderBy: { created_at: 'asc' }
        },
        logs: {
          orderBy: { fecha: 'desc' }
        }
      }
    })

    if (!requisicion) {
      return new Response('Requisition not found', { status: 404 })
    }

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Requisición')

    // Title block
    sheet.mergeCells('A1:E1')
    const titleCell = sheet.getCell('A1')
    titleCell.value = 'ARTHROMED - REQUISICIÓND DE COMPRA'
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0763A9' } // Arthromed Blue
    }
    sheet.getRow(1).height = 30

    // Info metadata block
    sheet.addRow([])
    sheet.addRow(['Folio Requisición:', requisicion.folio, '', 'Fecha Solicitud:', formatDate(requisicion.fecha_solicitud)])
    sheet.addRow(['Departamento:', requisicion.departamento, '', 'Fecha Requerida:', formatDate(requisicion.fecha_requerida)])
    sheet.addRow(['Solicitante:', requisicion.solicitante_nombre, '', 'Teléfono:', requisicion.solicitante_telefono || '—'])
    sheet.addRow(['Estado Requisición:', requisicion.status, '', 'Aprobado Por:', requisicion.aprobacion_nombre || '—'])
    sheet.addRow(['Autorizado Por:', requisicion.autorizacion_nombre || '—', '', 'Fecha Autorización:', requisicion.autorizacion_fecha ? formatDate(new Date(requisicion.autorizacion_fecha)) : '—'])
    
    // Formatting metadata block labels as bold
    for (let r = 3; r <= 7; r++) {
      sheet.getCell(`A${r}`).font = { bold: true }
      sheet.getCell(`D${r}`).font = { bold: true }
    }

    sheet.addRow([])
    
    // Items table header
    const headerRow = sheet.addRow(['Descripción de Bienes o Servicios', 'Cantidad', 'Unidad', 'Costo Unitario Estimado', 'Costo Total Estimado'])
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B3C5D' } // Darker blue
    }
    
    let total = 0
    let lastRowIndex = 8

    requisicion.items.forEach((item: any) => {
      const lineTotal = item.cantidad * item.costo_estimado
      total += lineTotal

      const row = sheet.addRow([
        item.descripcion,
        item.cantidad,
        item.unidad || 'Pieza',
        item.costo_estimado,
        lineTotal
      ])

      row.getCell(4).numFmt = '$#,##0.00'
      row.getCell(5).numFmt = '$#,##0.00'
      lastRowIndex++
    });

    // Total Row
    const totalRow = sheet.addRow(['TOTAL ESTIMADO', '', '', '', total])
    sheet.mergeCells(`A${lastRowIndex + 1}:D${lastRowIndex + 1}`)
    totalRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    totalRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0763A9' }
    }
    totalRow.getCell(5).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    totalRow.getCell(5).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0763A9' }
    }
    totalRow.getCell(5).numFmt = '$#,##0.00'
    lastRowIndex++

    sheet.addRow([])
    lastRowIndex++

    // Log/Historial Section
    const logHeaderRow = sheet.addRow(['Historial de Acciones / Log'])
    sheet.mergeCells(`A${lastRowIndex + 2}:E${lastRowIndex + 2}`)
    logHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    logHeaderRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF475569' } // Slate Gray
    }
    lastRowIndex++

    const logTableHeader = sheet.addRow(['Fecha y Hora', 'Usuario/Persona', 'Acción Realizada'])
    sheet.mergeCells(`C${lastRowIndex + 2}:E${lastRowIndex + 2}`)
    logTableHeader.font = { bold: true }
    lastRowIndex++

    requisicion.logs.forEach((log: any) => {
      const row = sheet.addRow([
        new Date(log.fecha).toLocaleString('es-MX', { timeZone: 'America/Monterrey' }),
        log.usuario,
        log.accion
      ])
      sheet.mergeCells(`C${lastRowIndex + 2}:E${lastRowIndex + 2}`)
      lastRowIndex++
    })

    // Adjust column widths
    sheet.getColumn(1).width = 40
    sheet.getColumn(2).width = 12
    sheet.getColumn(3).width = 12
    sheet.getColumn(4).width = 25
    sheet.getColumn(5).width = 25

    const buffer = await workbook.xlsx.writeBuffer()

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="requisicion_${requisicion.folio}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error('Failed to export Excel:', error)
    return new Response(error.message || 'Error exporting Excel', { status: 500 })
  }
}
