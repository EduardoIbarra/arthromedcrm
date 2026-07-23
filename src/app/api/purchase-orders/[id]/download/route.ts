import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import path from 'path'
import fs from 'fs/promises'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Fetch order details
    const order = await prisma.ordenes_compra.findUnique({
      where: { id },
      include: {
        orden_productos: {
          where: { deleted_at: null },
          include: {
            productos: true
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 })
    }

    const orderDate = order.fecha_orden ? order.fecha_orden.toISOString() : (order.created_at ? order.created_at.toISOString() : new Date().toISOString())

    // 2. Format date: MM/DD/YYYY
    let formattedDate = ''
    try {
      const dt = new Date(orderDate)
      const month = String(dt.getMonth() + 1).padStart(2, '0')
      const day = String(dt.getDate()).padStart(2, '0')
      const year = dt.getFullYear()
      formattedDate = `${month}/${day}/${year}`
    } catch {
      const dt = new Date()
      formattedDate = `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${dt.getFullYear()}`
    }

    // 3. Load Excel workbook from repo template
    const templatePath = path.join(process.cwd(), 'scripts', 'PO_BONSS_Medical_actualizado.xlsx')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(templatePath)

    const ws = wb.worksheets[0] || wb.getWorksheet(1)
    if (!ws) throw new Error('Worksheet not found in template')

    // Row 1: Logo area
    ws.getRow(1).height = 75
    ws.getRow(1).eachCell({ includeEmpty: false }, cell => { cell.value = null })

    const logoPath = path.join(process.cwd(), 'scripts', 'arthromed_logo.png')
    try {
      const logoBuffer = await fs.readFile(logoPath)
      const logoId = wb.addImage({ buffer: logoBuffer as any, extension: 'png' })

      ws.addImage(logoId, {
        tl: { col: 1.2, row: 0.08 } as any,
        ext: { width: 240, height: 127 },
      })
    } catch {
      // Logo missing — skip gracefully
    }

    ws.getCell('E3').value = `Date ${formattedDate}`
    ws.getCell('A4').value = `Pre-Order ${order.numero_orden}`

    const orderedItems = new Map<string, number>()
    for (const item of (order.orden_productos || [])) {
      const m = String(item.productos?.model || '').trim().toLowerCase()
      const c = String(item.productos?.order_code || '').trim().toLowerCase()
      orderedItems.set(`${m}:${c}`, item.cantidad_ordenada || 0)
    }

    let nextAvailableRow = 143

    for (let r = 7; r <= 142; r++) {
      const row = ws.getRow(r)
      const modelVal = String(row.getCell(2).value || '').trim().toLowerCase()
      const codeVal = String(row.getCell(3).value || '').trim().toLowerCase()

      const key = `${modelVal}:${codeVal}`

      if (orderedItems.has(key)) {
        const qty = orderedItems.get(key)!
        row.getCell(5).value = qty
        orderedItems.delete(key)
      } else {
        row.getCell(5).value = 0
      }
    }

    for (const [key, qty] of orderedItems.entries()) {
      const [m, c] = key.split(':')
      const row = ws.getRow(nextAvailableRow)
      row.getCell(1).value = nextAvailableRow - 6
      row.getCell(2).value = m.toUpperCase()
      row.getCell(3).value = c.toUpperCase()
      row.getCell(4).value = 'Item Adicional'
      row.getCell(5).value = qty
      nextAvailableRow++
    }

    const buffer = await wb.xlsx.writeBuffer()

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="PO_${order.numero_orden}.xlsx"`
      }
    })
  } catch (error: any) {
    console.error('Error downloading PO Excel:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
