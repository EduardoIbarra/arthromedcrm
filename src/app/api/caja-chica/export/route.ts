import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import ExcelJS from 'exceljs'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function formatCurrency(val: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
}

function formatDate(date: Date) {
  return new Date(date).toLocaleString('es-MX', { timeZone: 'America/Monterrey' })
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Access Denied', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'excel'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Fetch data
    const whereClause: any = { deleted_at: null }
    if (startDate) {
      whereClause.date = { ...whereClause.date, gte: new Date(startDate) }
    }
    if (endDate) {
      whereClause.date = { ...whereClause.date, lte: new Date(endDate) }
    }

    const transactions = await prisma.caja_chica_transactions.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
      include: {
        users: {
          select: { first_name: true, last_name: true, email: true }
        }
      }
    })

    const conteos = await prisma.caja_chica_conteos.findMany({
      where: { deleted_at: null },
      orderBy: { date: 'desc' },
      include: {
        users: {
          select: { first_name: true, last_name: true, email: true }
        }
      }
    })

    // Calculate sums
    const allTimeSums = await prisma.caja_chica_transactions.groupBy({
      by: ['type'],
      _sum: { amount: true },
      where: { deleted_at: null }
    })

    let totalInputs = 0
    let totalOutputs = 0
    for (const group of allTimeSums) {
      if (group.type === 'INPUT') {
        totalInputs = group._sum.amount || 0
      } else if (group.type === 'OUTPUT') {
        totalOutputs = group._sum.amount || 0
      }
    }

    // Calculate current balance based on latest physical count
    const lastConteo = await prisma.caja_chica_conteos.findFirst({
      where: { deleted_at: null },
      orderBy: { date: 'desc' }
    })

    let baseAmount = 0
    let lastConteoDate: Date | null = null
    if (lastConteo) {
      baseAmount = lastConteo.real_amount
      lastConteoDate = new Date(lastConteo.date)
    }

    const postConteoSums = await prisma.caja_chica_transactions.groupBy({
      by: ['type'],
      _sum: { amount: true },
      where: {
        deleted_at: null,
        ...(lastConteoDate ? { date: { gt: lastConteoDate } } : {})
      }
    })

    let postConteoInputs = 0
    let postConteoOutputs = 0
    for (const group of postConteoSums) {
      if (group.type === 'INPUT') {
        postConteoInputs = group._sum.amount || 0
      } else if (group.type === 'OUTPUT') {
        postConteoOutputs = group._sum.amount || 0
      }
    }

    const currentBalance = baseAmount + postConteoInputs - postConteoOutputs

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook()
      
      // Sheet 1: Transacciones
      const sheet = workbook.addWorksheet('Transacciones')
      sheet.columns = [
        { header: 'Fecha y Hora', key: 'date', width: 22 },
        { header: 'Tipo de Movimiento', key: 'type', width: 20 },
        { header: 'Monto', key: 'amount', width: 15 },
        { header: 'Entregó', key: 'giver', width: 25 },
        { header: 'Recibió', key: 'receiver', width: 25 },
        { header: 'Concepto / Nota', key: 'note', width: 40 },
        { header: 'Registrado Por', key: 'created_by', width: 30 }
      ]

      // Format header row
      const headerRow = sheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0763A9' } // Arthromed Blue
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'left' }

      transactions.forEach((tx: any) => {
        const creatorName = tx.users
          ? `${tx.users.first_name || ''} ${tx.users.last_name || ''}`.trim() || tx.users.email
          : 'Sistema'

        const row = sheet.addRow({
          date: formatDate(tx.date),
          type: tx.type === 'INPUT' ? 'Ingreso (+)' : 'Egreso (-)',
          amount: tx.amount,
          giver: tx.giver,
          receiver: tx.receiver,
          note: tx.note || '-',
          created_by: creatorName
        })

        // Format amount column
        row.getCell('amount').numFmt = '$#,##0.00'
        if (tx.type === 'INPUT') {
          row.getCell('type').font = { color: { argb: 'FF10B981' }, bold: true }
        } else {
          row.getCell('type').font = { color: { argb: 'FEF59E0B' }, bold: true }
        }
      })

      // Summary block at the top or bottom of transactions
      sheet.addRow([])
      const summaryStart = sheet.addRow(['Resumen de Caja Chica'])
      summaryStart.font = { bold: true, size: 14 }
      sheet.addRow(['Total Ingresos (Depósitos):', totalInputs]).getCell(2).numFmt = '$#,##0.00'
      sheet.addRow(['Total Egresos (Retiros):', totalOutputs]).getCell(2).numFmt = '$#,##0.00'
      const balRow = sheet.addRow(['Saldo de Sistema Actual:', currentBalance])
      balRow.getCell(2).numFmt = '$#,##0.00'
      balRow.font = { bold: true }

      // Sheet 2: Conteos
      const sheetConteos = workbook.addWorksheet('Conteos y Auditoría')
      sheetConteos.columns = [
        { header: 'Fecha y Hora', key: 'date', width: 22 },
        { header: 'Auditor', key: 'auditor', width: 30 },
        { header: 'Monto Esperado (Sistema)', key: 'system_amount', width: 25 },
        { header: 'Monto Físico (Real)', key: 'real_amount', width: 25 },
        { header: 'Diferencia (Discrepancia)', key: 'discrepancy', width: 25 },
        { header: 'Notas / Observaciones', key: 'note', width: 40 }
      ]

      const headerRowC = sheetConteos.getRow(1)
      headerRowC.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRowC.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' } // Slate Gray
      }
      headerRowC.alignment = { vertical: 'middle', horizontal: 'left' }

      conteos.forEach((c: any) => {
        const auditorName = c.users
          ? `${c.users.first_name || ''} ${c.users.last_name || ''}`.trim() || c.users.email
          : 'Sistema'

        const row = sheetConteos.addRow({
          date: formatDate(c.date),
          auditor: auditorName,
          system_amount: c.system_amount,
          real_amount: c.real_amount,
          discrepancy: c.discrepancy,
          note: c.note || '-'
        })

        row.getCell('system_amount').numFmt = '$#,##0.00'
        row.getCell('real_amount').numFmt = '$#,##0.00'
        row.getCell('discrepancy').numFmt = '$#,##0.00'

        if (c.discrepancy < 0) {
          row.getCell('discrepancy').font = { color: { argb: 'FFEF4444' }, bold: true } // Red for shortage
        } else if (c.discrepancy > 0) {
          row.getCell('discrepancy').font = { color: { argb: 'FF10B981' }, bold: true } // Green for overage
        }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      return new NextResponse(buffer, {
        headers: {
          'Content-Disposition': 'attachment; filename="Caja_Chica_Reporte.xlsx"',
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      })
    } else if (format === 'pdf') {
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

      // Layout constants
      const PAGE_W = 612
      const PAGE_H = 792
      const MARGIN = 40
      
      let page = pdfDoc.addPage([PAGE_W, PAGE_H])
      let y = PAGE_H - MARGIN

      // Header Banner
      page.drawRectangle({
        x: MARGIN,
        y: y - 50,
        width: PAGE_W - 2 * MARGIN,
        height: 50,
        color: rgb(0.027, 0.388, 0.663) // Blue banner
      })

      page.drawText('Reporte de Caja Chica - Arthromed ERP', {
        x: MARGIN + 15,
        y: y - 32,
        size: 16,
        font: boldFont,
        color: rgb(1, 1, 1)
      })

      y -= 70

      // Summary Cards
      const cardW = (PAGE_W - 2 * MARGIN - 20) / 3
      const drawCard = (x: number, title: string, value: string, isPositive: boolean) => {
        page.drawRectangle({
          x,
          y: y - 50,
          width: cardW,
          height: 50,
          color: rgb(0.96, 0.97, 0.98),
          borderColor: rgb(0.88, 0.9, 0.92),
          borderWidth: 1
        })
        page.drawText(title, {
          x: x + 10,
          y: y - 18,
          size: 8,
          font: boldFont,
          color: rgb(0.3, 0.3, 0.3)
        })
        page.drawText(value, {
          x: x + 10,
          y: y - 40,
          size: 14,
          font: boldFont,
          color: isPositive ? rgb(0.06, 0.46, 0.28) : rgb(0.7, 0.2, 0.2)
        })
      }

      drawCard(MARGIN, 'SALDO DE SISTEMA', formatCurrency(currentBalance), currentBalance >= 0)
      drawCard(MARGIN + cardW + 10, 'TOTAL INGRESOS', formatCurrency(totalInputs), true)
      drawCard(MARGIN + 2 * cardW + 20, 'TOTAL EGRESOS', formatCurrency(totalOutputs), false)

      y -= 75

      // Transactions Table Section Title
      page.drawText('HISTORIAL DE MOVIMIENTOS', {
        x: MARGIN,
        y,
        size: 11,
        font: boldFont,
        color: rgb(0.12, 0.22, 0.38)
      })
      y -= 15

      // Draw table headers
      const cols = [
        { name: 'Fecha/Hora', w: 100 },
        { name: 'Tipo', w: 50 },
        { name: 'Monto', w: 70 },
        { name: 'Entregó / Recibió', w: 150 },
        { name: 'Concepto / Nota', w: 162 }
      ]

      let curX = MARGIN
      cols.forEach(col => {
        page.drawText(col.name, {
          x: curX,
          y,
          size: 8,
          font: boldFont,
          color: rgb(0.1, 0.1, 0.1)
        })
        curX += col.w
      })

      // Underline header
      page.drawLine({
        start: { x: MARGIN, y: y - 4 },
        end: { x: PAGE_W - MARGIN, y: y - 4 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8)
      })

      y -= 18

      // Draw transaction rows
      transactions.forEach((tx: any, idx: number) => {
        if (y < MARGIN + 40) {
          // Add new page
          page = pdfDoc.addPage([PAGE_W, PAGE_H])
          y = PAGE_H - MARGIN - 20
          
          // Re-draw small header on subsequent pages
          page.drawText('Reporte de Caja Chica - Historial (Cont.)', {
            x: MARGIN,
            y,
            size: 10,
            font: boldFont,
            color: rgb(0.3, 0.3, 0.3)
          })
          y -= 25
        }

        // Zebra striping
        if (idx % 2 === 0) {
          page.drawRectangle({
            x: MARGIN,
            y: y - 10,
            width: PAGE_W - 2 * MARGIN,
            height: 16,
            color: rgb(0.97, 0.98, 0.99)
          })
        }

        // Print row details
        page.drawText(formatDate(tx.date), { x: MARGIN, y, size: 7.5, font })
        
        const typeStr = tx.type === 'INPUT' ? 'Ingreso' : 'Egreso'
        const typeColor = tx.type === 'INPUT' ? rgb(0.06, 0.46, 0.28) : rgb(0.7, 0.2, 0.2)
        page.drawText(typeStr, { x: MARGIN + 100, y, size: 7.5, font: boldFont, color: typeColor })

        page.drawText(formatCurrency(tx.amount), { x: MARGIN + 150, y, size: 7.5, font })

        const parties = `E: ${tx.giver.substring(0, 16)} / R: ${tx.receiver.substring(0, 16)}`
        page.drawText(parties, { x: MARGIN + 220, y, size: 7.5, font })

        const cleanNote = (tx.note || '-').replace(/\n/g, ' ').substring(0, 40)
        page.drawText(cleanNote, { x: MARGIN + 370, y, size: 7.5, font })

        y -= 16
      })

      const pdfBytes = await pdfDoc.save()
      return new Response(Buffer.from(pdfBytes), {
        headers: {
          'Content-Disposition': 'attachment; filename="Caja_Chica_Reporte.pdf"',
          'Content-Type': 'application/pdf'
        }
      })
    }

    return new Response('Unsupported format', { status: 400 })
  } catch (error: any) {
    console.error('Error in GET /api/caja-chica/export:', error)
    return new Response(error.message, { status: 500 })
  }
}
