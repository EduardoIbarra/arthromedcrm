import { NextRequest, NextResponse } from 'next/server'
import { querySegundaDB } from '@/lib/segundaDB'
import path from 'path'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Fetch order details
    const orderRows = await querySegundaDB(`
      SELECT id, numero_orden, created_at, fecha_orden
      FROM ordenes_compra
      WHERE id = $1
    `, [id])

    if (orderRows.length === 0) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 })
    }

    const order = orderRows[0]
    const orderDate = order.fecha_orden || order.created_at || new Date().toISOString()

    // 2. Fetch order products, resolved with model and order_code from second DB productos
    const items = await querySegundaDB(`
      SELECT op.cantidad_ordenada as quantity, p.model, p.order_code as code
      FROM orden_productos op
      LEFT JOIN productos p ON p.id = op.producto_id
      WHERE op.orden_id = $1
    `, [id])

    // Format date: month/day/year
    let formattedDate = ''
    try {
      const dt = new Date(orderDate)
      const month = String(dt.getMonth() + 1).padStart(2, '0')
      const day = String(dt.getDate()).padStart(2, '0')
      const year = dt.getFullYear()
      formattedDate = `${month}/${day}/${year}`
    } catch (e) {
      const dt = new Date()
      const month = String(dt.getMonth() + 1).padStart(2, '0')
      const day = String(dt.getDate()).padStart(2, '0')
      const year = dt.getFullYear()
      formattedDate = `${month}/${day}/${year}`
    }

    // 3. Load Excel workbook from local repo template
    const templatePath = path.join(process.cwd(), 'scripts', 'PO_BONSS_Medical_actualizado.xlsx')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(templatePath)
    
    // Get the first worksheet
    const ws = wb.worksheets[0] || wb.getWorksheet(1)
    if (!ws) {
      throw new Error('Worksheet not found in template')
    }

    // Update date in E3
    ws.getCell('E3').value = `Date ${formattedDate}`

    // Update title in A4
    ws.getCell('A4').value = `Pre-Order ${order.numero_orden}`

    // Map ordered items by model:code
    const orderedItems = new Map<string, number>()
    for (const item of items) {
      const m = String(item.model || '').trim().toLowerCase()
      const c = String(item.code || '').trim().toLowerCase()
      orderedItems.set(`${m}:${c}`, item.quantity || 0)
    }

    const rowsToDelete: number[] = []

    // Product rows go from 142 down to 7
    for (let r = 142; r >= 7; r--) {
      const cellModel = ws.getCell(`B${r}`).value
      const cellCode = ws.getCell(`C${r}`).value

      const mKey = cellModel ? String(cellModel).trim().toLowerCase() : ''
      const cKey = cellCode ? String(cellCode).trim().toLowerCase() : ''

      let qty: number | null = null

      if (orderedItems.has(`${mKey}:${cKey}`)) {
        qty = orderedItems.get(`${mKey}:${cKey}`)!
      } else {
        // Try match by model only
        for (const [key, val] of orderedItems.entries()) {
          const [m, c] = key.split(':')
          if (mKey && m === mKey) {
            qty = val
            break
          }
        }
        // Try match by code only
        if (qty === null) {
          for (const [key, val] of orderedItems.entries()) {
            const [m, c] = key.split(':')
            if (cKey && c === cKey) {
              qty = val
              break
            }
          }
        }
      }

      if (qty !== null && qty > 0) {
        ws.getCell(`E${r}`).value = qty
      } else {
        rowsToDelete.push(r)
      }
    }

    // Delete rows (already in descending order)
    for (const r of rowsToDelete) {
      ws.spliceRows(r, 1)
    }

    // Find the new total row
    let totalRow: number | null = null
    for (let r = 7; r <= ws.rowCount; r++) {
      const val = ws.getCell(`A${r}`).value
      if (val === 'TOTAL') {
        totalRow = r
        break
      }
    }

    if (totalRow) {
      ws.getCell(`E${totalRow}`).value = {
        formula: `SUM(E7:E${totalRow - 1})`
      }
    }

    // 4. Generate buffer
    const fileBuffer = await wb.xlsx.writeBuffer()

    // 5. Return response
    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="PO_${order.numero_orden}.xlsx"`,
        'Cache-Control': 'no-store, max-age=0'
      }
    })

  } catch (error: any) {
    console.error('Error generating Excel download:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
