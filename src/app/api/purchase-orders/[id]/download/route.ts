import { NextRequest, NextResponse } from 'next/server'
import { querySegundaDB } from '@/lib/segundaDB'
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

    // 2. Fetch order products
    const items = await querySegundaDB(`
      SELECT op.cantidad_ordenada as quantity, p.model, p.order_code as code
      FROM orden_productos op
      LEFT JOIN productos p ON p.id = op.producto_id
      WHERE op.orden_id = $1
    `, [id])

    // Format date: MM/DD/YYYY
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

    // ── Row 1: Logo area ─────────────────────────────────────
    // The template already has row 1 as the logo placeholder (#VALUE!).
    // Clear its content and make it taller; existing merges in rows 2+ stay intact.
    ws.getRow(1).height = 75  // ~56pt ≈ 75px — room for a nice logo

    // Clear any existing value/formula in row 1 cells
    ws.getRow(1).eachCell({ includeEmpty: false }, cell => { cell.value = null })

    // Embed logo — use tl + ext to control exact pixel dimensions (not tl/br which stretches)
    // Logo source: 438×231px. We'll render at 210×111 (same ratio, narrower feel).
    const logoPath = path.join(process.cwd(), 'scripts', 'arthromed_logo.png')
    try {
      const logoBuffer = await fs.readFile(logoPath)
      const logoId = wb.addImage({ buffer: logoBuffer as any, extension: 'png' })

      // Center horizontally: columns A–E span roughly 620px in this sheet.
      // Logo width = 210px → left offset = (620 - 210) / 2 ≈ 205px.
      // Col A ≈ 64px wide → we start at col 1 (B) + a tiny offset.
      ws.addImage(logoId, {
        tl: { col: 1.2, row: 0.08 } as any,
        ext: { width: 240, height: 127 },  // 438:231 ratio → 240:127
      })
    } catch {
      // Logo missing — skip gracefully
    }

    // ── Rows 2–5: keep existing merges & update values ───────
    // Row 2: "ARTHROMED SA DE CV" — already merged A2:F2 in template, leave as-is
    // Row 3: Date goes in E3 (already the correct cell)
    ws.getCell('E3').value = `Date ${formattedDate}`

    // Row 4: Pre-Order — already merged A4:F4 in template
    ws.getCell('A4').value = `Pre-Order ${order.numero_orden}`

    // ── Rows 7–142: product rows (original range, no offset) ─
    const orderedItems = new Map<string, number>()
    for (const item of items) {
      const m = String(item.model || '').trim().toLowerCase()
      const c = String(item.code || '').trim().toLowerCase()
      orderedItems.set(`${m}:${c}`, item.quantity || 0)
    }

    const rowsToDelete: number[] = []

    for (let r = 142; r >= 7; r--) {
      const mKey = ws.getCell(`B${r}`).value ? String(ws.getCell(`B${r}`).value).trim().toLowerCase() : ''
      const cKey = ws.getCell(`C${r}`).value ? String(ws.getCell(`C${r}`).value).trim().toLowerCase() : ''

      let qty: number | null = null

      if (orderedItems.has(`${mKey}:${cKey}`)) {
        qty = orderedItems.get(`${mKey}:${cKey}`)!
      } else {
        for (const [key, val] of orderedItems.entries()) {
          const [m] = key.split(':')
          if (mKey && m === mKey) { qty = val; break }
        }
        if (qty === null) {
          for (const [key, val] of orderedItems.entries()) {
            const [, c] = key.split(':')
            if (cKey && c === cKey) { qty = val; break }
          }
        }
      }

      if (qty !== null && qty > 0) {
        ws.getCell(`E${r}`).value = qty
      } else {
        rowsToDelete.push(r)
      }
    }

    // Delete non-ordered rows (descending order preserves indices)
    for (const r of rowsToDelete) {
      ws.spliceRows(r, 1)
    }

    // Update TOTAL SUM formula to match new last row
    let totalRow: number | null = null
    for (let r = 7; r <= ws.rowCount; r++) {
      if (ws.getCell(`A${r}`).value === 'TOTAL') { totalRow = r; break }
    }
    if (totalRow) {
      ws.getCell(`E${totalRow}`).value = { formula: `SUM(E7:E${totalRow - 1})` }
    }

    // 4. Stream buffer back
    const fileBuffer = await wb.xlsx.writeBuffer()

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
