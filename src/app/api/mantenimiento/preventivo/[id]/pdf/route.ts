import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, PDFPage, PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import prisma from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import QRCode from 'qrcode'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'

// ─── PAGE GEOMETRY ────────────────────────────────────────────────────────────
const PAGE_W = 612
const PAGE_H = 792
const LEFT = 50
const RIGHT = 562
const CONTENT_W = RIGHT - LEFT
const FOOTER_MIN_Y = 60

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C_DARK       = rgb(0.10, 0.10, 0.12)
const C_GRAY       = rgb(0.35, 0.37, 0.40)
const C_LIGHT_GRAY = rgb(0.95, 0.95, 0.96)
const C_NAVY       = rgb(0.07, 0.22, 0.42)
const C_ACCENT     = rgb(0.07, 0.39, 0.66)
const C_BORDER     = rgb(0.80, 0.83, 0.88)
const C_WHITE      = rgb(1, 1, 1)
const C_GREEN      = rgb(0.10, 0.55, 0.30)
const C_HEADER_BG  = rgb(0.07, 0.22, 0.42)   // navy header cells

// ─── TAREA STRUCTURE ─────────────────────────────────────────────────────────
interface Tarea {
  tarea: string
  descripcion_ot: string
  descripcion_reporte?: string
  observacion_ot?: string
  realizado?: boolean
  evidencias?: { url: string; caption?: string }[]
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatDateES(d: Date | string): string {
  const months = ['enero','febrero','marzo','abril','mayo','junio',
                  'julio','agosto','septiembre','octubre','noviembre','diciembre']
  const date = new Date(d)
  return `${date.getUTCDate()} de ${months[date.getUTCMonth()]} de ${date.getUTCFullYear()}`
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const raw = (text || '').replace(/\s+/g, ' ').trim()
  if (!raw) return ['']
  const words = raw.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    try {
      if (font.widthOfTextAtSize(test, size) <= maxW) { cur = test }
      else { if (cur) lines.push(cur); cur = w }
    } catch { if (cur) lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

function textH(lines: number, size: number, leading = 1.35): number {
  return lines * size * leading
}

// Draw a simple bordered rectangle with optional fill
function drawBox(
  page: PDFPage,
  x: number, y: number, w: number, h: number,
  opts: { fill?: ReturnType<typeof rgb>; border?: ReturnType<typeof rgb>; borderW?: number } = {}
) {
  page.drawRectangle({
    x, y, width: w, height: h,
    color: opts.fill,
    borderColor: opts.border ?? C_BORDER,
    borderWidth: opts.borderW ?? 0.6,
  })
}

// Draw text safely
function dt(
  page: PDFPage,
  text: string,
  x: number, y: number,
  size: number,
  font: PDFFont,
  color = C_DARK
) {
  if (!text) return
  try { page.drawText(text, { x, y, size, font, color }) } catch { /* skip missing glyphs */ }
}

async function embedImage(pdf: PDFDocument, imgInput: string | Buffer | Uint8Array) {
  try {
    let imgBuffer: Buffer | null = null
    if (typeof imgInput === 'string') {
      if (imgInput.startsWith('data:image/')) {
        const base64Data = imgInput.split(',')[1]
        if (base64Data) {
          imgBuffer = Buffer.from(base64Data, 'base64')
        }
      } else if (imgInput.startsWith('http://') || imgInput.startsWith('https://')) {
        const imgRes = await fetch(imgInput)
        if (imgRes.ok) {
          imgBuffer = Buffer.from(await imgRes.arrayBuffer())
        }
      }
    } else if (imgInput) {
      imgBuffer = Buffer.from(imgInput)
    }

    if (!imgBuffer || imgBuffer.length === 0) return null

    const isPng = imgBuffer.length >= 4 && imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50 && imgBuffer[2] === 0x4E && imgBuffer[3] === 0x47
    const isJpg = imgBuffer.length >= 3 && imgBuffer[0] === 0xFF && imgBuffer[1] === 0xD8 && imgBuffer[2] === 0xFF

    if (isPng) {
      try {
        return await pdf.embedPng(imgBuffer)
      } catch (e) {
        // Fallback to sharp
      }
    } else if (isJpg) {
      try {
        return await pdf.embedJpg(imgBuffer)
      } catch (e) {
        // Fallback to sharp
      }
    }

    const convertedJpeg = await sharp(imgBuffer).jpeg({ quality: 85 }).toBuffer()
    return await pdf.embedJpg(convertedJpeg)
  } catch (err) {
    console.error('embedImage error:', err)
    return null
  }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const record = await prisma.mantenimiento_preventivo.findFirst({
      where: { id, deleted_at: null },
    })

    if (!record) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
    }

    const tareas: Tarea[] = Array.isArray(record.tareas) ? record.tareas as Tarea[] : []

    // ── Load assets ────────────────────────────────────────────────────────────
    const resDir = path.join(process.cwd(), 'resources')
    const machote1Bytes = fs.readFileSync(path.join(resDir, 'img', 'machote1.jpeg'))
    const machote2Bytes = fs.readFileSync(path.join(resDir, 'img', 'machote2.jpeg'))

    const logoPath = path.join(resDir, 'img', 'ARTHROMED OFICIAL.png')
    const logoBytes = fs.existsSync(logoPath)
      ? fs.readFileSync(logoPath)
      : fs.readFileSync(path.join(process.cwd(), 'public', 'logo.png'))

    const regularBytes = fs.readFileSync(path.join(resDir, 'fonts', 'Roboto-Regular.ttf'))
    const boldBytes    = fs.readFileSync(path.join(resDir, 'fonts', 'Roboto-Bold.ttf'))

    const pdf = await PDFDocument.create()
    pdf.registerFontkit(fontkit)

    const regular = await pdf.embedFont(regularBytes)
    const bold    = await pdf.embedFont(boldBytes)
    const bg1     = await pdf.embedJpg(machote1Bytes)
    const bg2     = await pdf.embedJpg(machote2Bytes)
    const logo    = await pdf.embedPng(logoBytes)

    // ── QR Code ────────────────────────────────────────────────────────────────
    const host = request.headers.get('host') || 'localhost:3000'
    const proto = host.includes('localhost') ? 'http' : 'https'
    const qrUrl = `${proto}://${host}/mantenimiento/preventivo/${id}`
    let qrImg: any = null
    try {
      const buf = await QRCode.toBuffer(qrUrl, { width: 180, margin: 1, color: { dark: '#122340', light: '#FFFFFF' } })
      qrImg = await pdf.embedPng(buf)
    } catch { /* QR optional */ }

    // ── Shared drawing utilities ───────────────────────────────────────────────
    const drawFooter = (page: PDFPage) => {
      const lines = [
        'Av. Zacatecas #128, Constituyentes del 17, San Nicolás de los Garza, CP 66410 Nuevo León, México.',
        'Tel. 81 2752 6075  |  81 8688 9100  |  servicio@arthromed.mx',
      ]
      let fy = 44
      for (const line of lines) {
        dt(page, line, (PAGE_W - regular.widthOfTextAtSize(line, 7)) / 2, fy, 7, regular, C_GRAY)
        fy -= 10
      }
      // separator line above footer
      page.drawLine({ start: { x: LEFT, y: 58 }, end: { x: RIGHT, y: 58 }, thickness: 0.5, color: C_BORDER })
    }

    const drawPageFrame = (page: PDFPage, bg: any) => {
      page.drawImage(bg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
      drawFooter(page)

      // Logo top-left
      const lScale = Math.min(130 / logo.width, 44 / logo.height)
      const lw = logo.width * lScale, lh = logo.height * lScale
      page.drawImage(logo, { x: LEFT, y: PAGE_H - 20 - lh, width: lw, height: lh })

      // QR top-right (size 65, right edge aligned precisely with RIGHT = 562)
      const QR_SIZE = 65
      if (qrImg) {
        page.drawImage(qrImg, { x: RIGHT - QR_SIZE, y: PAGE_H - 18 - QR_SIZE, width: QR_SIZE, height: QR_SIZE })
        const labelW = regular.widthOfTextAtSize('Trazabilidad', 6)
        dt(page, 'Trazabilidad', RIGHT - (QR_SIZE + labelW) / 2, PAGE_H - 22 - QR_SIZE, 6, regular, C_GRAY)
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 1:  ORDEN DE TRABAJO
    // ══════════════════════════════════════════════════════════════════════════
    const otPage = pdf.addPage([PAGE_W, PAGE_H])
    drawPageFrame(otPage, bg1)

    // Initial content start given more vertical room below header (PAGE_H - 105)
    let y = PAGE_H - 105

    // ── OT Title ──────────────────────────────────────────────────────────────
    // Folio label left, title centered
    dt(otPage, `Folio: ${record.folio}`, LEFT, y, 9.5, bold, C_NAVY)
    const otTitle = 'Orden de Trabajo'
    dt(otPage, otTitle, (PAGE_W - bold.widthOfTextAtSize(otTitle, 12)) / 2, y, 12, bold, C_NAVY)
    y -= 18

    // ── DATOS GENERALES ───────────────────────────────────────────────────────
    const SECTION_H = 18
    // Header band
    drawBox(otPage, LEFT, y - SECTION_H + 4, CONTENT_W, SECTION_H, { fill: C_HEADER_BG, border: C_HEADER_BG })
    const dgTitle = 'DATOS GENERALES'
    dt(otPage, dgTitle, (PAGE_W - bold.widthOfTextAtSize(dgTitle, 9)) / 2, y - SECTION_H + 7, 9, bold, C_WHITE)
    y -= SECTION_H

    const ROW_H = 20
    // Two-column data rows
    const col1x = LEFT, col2x = LEFT + CONTENT_W / 2
    const colW = CONTENT_W / 2

    // Row 1: Cliente | Fecha
    drawBox(otPage, col1x, y - ROW_H, colW, ROW_H)
    drawBox(otPage, col2x, y - ROW_H, colW, ROW_H)
    dt(otPage, 'Cliente:', col1x + 4, y - 13, 8, bold, C_DARK)
    dt(otPage, record.cliente, col1x + 48, y - 13, 8, regular, C_DARK)
    dt(otPage, 'Fecha:', col2x + 4, y - 13, 8, bold, C_DARK)
    dt(otPage, formatDateES(record.fecha_servicio), col2x + 42, y - 13, 8, regular, C_DARK)
    y -= ROW_H

    // Row 2: Producto | No. Serie / Lote
    drawBox(otPage, col1x, y - ROW_H, colW, ROW_H)
    drawBox(otPage, col2x, y - ROW_H, colW, ROW_H)
    dt(otPage, 'Producto:', col1x + 4, y - 13, 8, bold, C_DARK)
    dt(otPage, record.producto, col1x + 52, y - 13, 8, regular, C_DARK)
    dt(otPage, 'No. Serie / Lote:', col2x + 4, y - 13, 8, bold, C_DARK)
    dt(otPage, record.numero_serie, col2x + 88, y - 13, 8, regular, C_DARK)
    y -= ROW_H + 10

    // ── MANTENIMIENTO PREVENTIVO TABLE ────────────────────────────────────────
    drawBox(otPage, LEFT, y - SECTION_H + 4, CONTENT_W, SECTION_H, { fill: C_HEADER_BG, border: C_HEADER_BG })
    const mpTitle = 'MANTENIMIENTO PREVENTIVO'
    dt(otPage, mpTitle, (PAGE_W - bold.widthOfTextAtSize(mpTitle, 9)) / 2, y - SECTION_H + 7, 9, bold, C_WHITE)
    y -= SECTION_H

    // Column widths: TAREAS=130, DESCRIPCION=230, OBSERVACIONES=152 → total=512
    const TC = { tareas: 130, desc: 230, obs: CONTENT_W - 130 - 230 }
    const tcx = { tareas: LEFT, desc: LEFT + TC.tareas, obs: LEFT + TC.tareas + TC.desc }

    // Column headers
    const COL_HEADER_H = 16
    drawBox(otPage, tcx.tareas, y - COL_HEADER_H, TC.tareas, COL_HEADER_H, { fill: C_LIGHT_GRAY })
    drawBox(otPage, tcx.desc,   y - COL_HEADER_H, TC.desc,   COL_HEADER_H, { fill: C_LIGHT_GRAY })
    drawBox(otPage, tcx.obs,    y - COL_HEADER_H, TC.obs,    COL_HEADER_H, { fill: C_LIGHT_GRAY })
    dt(otPage, 'TAREAS',         tcx.tareas + 4,  y - 11, 7.5, bold, C_NAVY)
    dt(otPage, 'DESCRIPCION',    tcx.desc   + 4,  y - 11, 7.5, bold, C_NAVY)
    dt(otPage, 'OBSERVACIONES',  tcx.obs    + 4,  y - 11, 7.5, bold, C_NAVY)
    y -= COL_HEADER_H

    // Task rows
    for (let i = 0; i < tareas.length; i++) {
      const tarea = tareas[i]
      const descLines = wrapText(tarea.descripcion_ot, regular, 7.5, TC.desc - 8)
      const obsLines  = wrapText(tarea.observacion_ot || '', regular, 7.5, TC.obs - 8)
      const rowLines  = Math.max(descLines.length, obsLines.length, 2)
      const rowH      = rowLines * 10 + 8

      // Overflow to new page
      if (y - rowH < FOOTER_MIN_Y + 100) {
        break
      }

      const rowFill = i % 2 === 0 ? undefined : C_LIGHT_GRAY
      drawBox(otPage, tcx.tareas, y - rowH, TC.tareas, rowH, { fill: rowFill })
      drawBox(otPage, tcx.desc,   y - rowH, TC.desc,   rowH, { fill: rowFill })
      drawBox(otPage, tcx.obs,    y - rowH, TC.obs,    rowH, { fill: rowFill })

      // Checkmark + task name
      const check = tarea.realizado !== false ? '✓ ' : '○ '
      const taskLabel = `${check}${tarea.tarea}`
      const taskLines = wrapText(taskLabel, bold, 7.5, TC.tareas - 8)
      let ty = y - 10
      for (const line of taskLines) {
        const col = line.startsWith('✓') ? C_GREEN : (line.startsWith('○') ? C_GRAY : C_DARK)
        dt(otPage, line, tcx.tareas + 4, ty, 7.5, bold, col)
        ty -= 10
      }

      // Description
      ty = y - 10
      for (const line of descLines) {
        dt(otPage, line, tcx.desc + 4, ty, 7.5, regular, C_DARK)
        ty -= 10
      }

      // Observation (italic-style via smaller size)
      ty = y - 10
      for (const line of obsLines) {
        dt(otPage, line, tcx.obs + 4, ty, 7.5, regular, C_GRAY)
        ty -= 10
      }

      y -= rowH
    }

    y -= 14

    // ── Other observations box ─────────────────────────────────────────────────
    if (y < FOOTER_MIN_Y + 80) y = FOOTER_MIN_Y + 80
    dt(otPage, 'Otras observaciones', LEFT, y, 8.5, bold, C_DARK)
    y -= 6
    const obsBoxH = 60
    drawBox(otPage, LEFT, y - obsBoxH, CONTENT_W, obsBoxH, { fill: rgb(0.99, 0.99, 1) })
    if (record.observaciones) {
      const obsLines = wrapText(record.observaciones, regular, 8, CONTENT_W - 12)
      let ty = y - 12
      for (const line of obsLines.slice(0, 5)) {
        dt(otPage, line, LEFT + 6, ty, 8, regular, C_DARK)
        ty -= 11
      }
    }
    y -= obsBoxH + 14

    // ── Signature blocks ──────────────────────────────────────────────────────
    if (y < FOOTER_MIN_Y + 55) y = FOOTER_MIN_Y + 55
    const sigW = CONTENT_W / 2 - 10
    // Left sig
    page_drawSignatureBlock(otPage, LEFT, y, sigW, record.elaborado_por, 'Elaborado por:', bold, regular)
    // Right sig
    page_drawSignatureBlock(otPage, LEFT + CONTENT_W / 2 + 10, y, sigW, record.revisado_por, 'Revisado por:', bold, regular)

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 2+: REPORTE DE MANTENIMIENTO PREVENTIVO (narrative + photos)
    // ══════════════════════════════════════════════════════════════════════════
    let curPage = pdf.addPage([PAGE_W, PAGE_H])
    drawPageFrame(curPage, bg2)

    y = PAGE_H - 105

    // Report title
    const rTitle = 'Reporte de Mantenimiento Preventivo'
    dt(curPage, rTitle, (PAGE_W - bold.widthOfTextAtSize(rTitle, 13)) / 2, y, 13, bold, C_NAVY)
    y -= 6
    curPage.drawLine({ start: { x: LEFT, y: y }, end: { x: RIGHT, y: y }, thickness: 1, color: C_ACCENT })
    y -= 16

    // Datos generales rows on Page 2 (2x2 grid with ample width)
    dt(curPage, `Folio: ${record.folio}`, LEFT, y, 8.5, bold, C_NAVY)
    y -= 14

    const p2Col1X = LEFT
    const p2Col2X = LEFT + 260

    // Row 1: Cliente | Fecha
    dt(curPage, 'Cliente:', p2Col1X, y, 8, bold, C_DARK)
    dt(curPage, record.cliente, p2Col1X + 48, y, 8, regular, C_DARK)

    dt(curPage, 'Fecha:', p2Col2X, y, 8, bold, C_DARK)
    dt(curPage, formatDateES(record.fecha_servicio), p2Col2X + 40, y, 8, regular, C_DARK)
    y -= 14

    // Row 2: Producto | No. Serie / Lote
    dt(curPage, 'Producto:', p2Col1X, y, 8, bold, C_DARK)
    dt(curPage, record.producto, p2Col1X + 52, y, 8, regular, C_DARK)

    dt(curPage, 'No. Serie / Lote:', p2Col2X, y, 8, bold, C_DARK)
    dt(curPage, record.numero_serie, p2Col2X + 85, y, 8, regular, C_DARK)
    y -= 16

    // ── TAREAS TABLE (3 columns: TAREAS | DESCRIPCION | EVIDENCIA) ───────────
    // Column widths
    const RT = {
      tareas: 118,
      desc:   200,
      evid:   CONTENT_W - 118 - 200,  // ~194
    }
    const rtx = { tareas: LEFT, desc: LEFT + RT.tareas, evid: LEFT + RT.tareas + RT.desc }

    // Draw table headers
    const drawReporteTableHeader = (p: PDFPage, startY: number) => {
      const hh = 18
      drawBox(p, rtx.tareas, startY - hh, RT.tareas, hh, { fill: C_HEADER_BG, border: C_HEADER_BG })
      drawBox(p, rtx.desc,   startY - hh, RT.desc,   hh, { fill: C_HEADER_BG, border: C_HEADER_BG })
      drawBox(p, rtx.evid,   startY - hh, RT.evid,   hh, { fill: C_HEADER_BG, border: C_HEADER_BG })
      dt(p, 'TAREAS',    rtx.tareas + 4, startY - 12, 8, bold, C_WHITE)
      dt(p, 'DESCRIPCION', rtx.desc + 4, startY - 12, 8, bold, C_WHITE)
      dt(p, 'EVIDENCIA', rtx.evid  + 4, startY - 12, 8, bold, C_WHITE)
      return startY - hh
    }

    y = drawReporteTableHeader(curPage, y)

    // Task rows with photos
    for (let i = 0; i < tareas.length; i++) {
      const tarea = tareas[i]
      const narrativeText = tarea.descripcion_reporte || tarea.descripcion_ot || ''
      const descLines = wrapText(narrativeText, regular, 7.5, RT.desc - 8)
      const evidencias = tarea.evidencias || []

      // Calculate evidence column height (images only, no caption)
      const MAX_EVID_IMG_H = 90
      const EVID_IMG_W = RT.evid - 12
      let evidColH = 0
      for (const ev of evidencias.slice(0, 3)) {
        evidColH += MAX_EVID_IMG_H + 6
      }
      if (evidencias.length === 0) evidColH = 10

      const descTextH = descLines.length * 10 + 8
      const taskLines = wrapText(tarea.tarea, bold, 8, RT.tareas - 8)
      const taskTextH = taskLines.length * 11 + 8

      const rowH = Math.max(taskTextH, descTextH, evidColH) + 8

      // Page overflow check
      if (y - rowH < FOOTER_MIN_Y + 40) {
        curPage = pdf.addPage([PAGE_W, PAGE_H])
        drawPageFrame(curPage, bg2)
        y = PAGE_H - 105
        y = drawReporteTableHeader(curPage, y)
      }

      // Row backgrounds
      const rowFill = i % 2 === 0 ? undefined : rgb(0.97, 0.97, 0.99)
      drawBox(curPage, rtx.tareas, y - rowH, RT.tareas, rowH, { fill: rowFill })
      drawBox(curPage, rtx.desc,   y - rowH, RT.desc,   rowH, { fill: rowFill })
      drawBox(curPage, rtx.evid,   y - rowH, RT.evid,   rowH, { fill: rowFill })

      // Task name
      let ty = y - 11
      for (const line of taskLines) {
        dt(curPage, line, rtx.tareas + 4, ty, 8, bold, C_NAVY)
        ty -= 11
      }

      // Description (narrative)
      ty = y - 10
      for (const line of descLines) {
        dt(curPage, line, rtx.desc + 4, ty, 7.5, regular, C_DARK)
        ty -= 10
      }

      // Evidence photos (up to 3 per task, image frame only, no photo name/caption text)
      let evidY = y - 8
      for (let j = 0; j < Math.min(evidencias.length, 3); j++) {
        const ev = evidencias[j]
        try {
          const img = ev.url ? await embedImage(pdf, ev.url) : null
          if (img) {
            const scale = Math.min(EVID_IMG_W / img.width, MAX_EVID_IMG_H / img.height)
            const iw = img.width * scale, ih = img.height * scale
            // small border frame
            drawBox(curPage, rtx.evid + 4, evidY - ih - 2, iw + 2, ih + 2, { fill: C_LIGHT_GRAY, border: C_BORDER, borderW: 0.4 })
            curPage.drawImage(img, { x: rtx.evid + 5, y: evidY - ih - 1, width: iw, height: ih })
            evidY -= (ih + 6)
          }
        } catch { /* skip bad image */ }
      }

      y -= rowH
    }

    y -= 18

    // ── Observations ─────────────────────────────────────────────────────────
    if (y < FOOTER_MIN_Y + 120) {
      curPage = pdf.addPage([PAGE_W, PAGE_H])
      drawPageFrame(curPage, bg2)
      y = PAGE_H - 80
    }

    dt(curPage, 'Observaciones:', LEFT, y, 9, bold, C_ACCENT)
    y -= 12
    if (record.observaciones) {
      const obsLines = wrapText(record.observaciones, regular, 8.5, CONTENT_W)
      for (const line of obsLines) {
        dt(curPage, line, LEFT, y, 8.5, regular, C_DARK)
        y -= 12
      }
    } else {
      dt(curPage, '—', LEFT, y, 8.5, regular, C_GRAY)
      y -= 12
    }

    y -= 20

    // ── Sign-off ──────────────────────────────────────────────────────────────
    dt(curPage, 'Reporte realizado por:', LEFT, y, 8.5, bold, C_DARK)
    y -= 28
    // Underline for signature space
    curPage.drawLine({ start: { x: LEFT, y: y }, end: { x: LEFT + 180, y: y }, thickness: 0.7, color: C_DARK })
    y -= 10
    dt(curPage, record.elaborado_por, LEFT, y, 8.5, bold, C_NAVY)

    // ─────────────────────────────────────────────────────────────────────────
    const pdfBytes = await pdf.save()
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${record.folio}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating preventivo PDF:', error)
    return NextResponse.json({ error: error.message || 'Error generando PDF' }, { status: 500 })
  }
}

// ─── SIGNATURE BLOCK HELPER ───────────────────────────────────────────────────
function page_drawSignatureBlock(
  page: PDFPage,
  x: number, y: number, w: number,
  name: string, label: string,
  bold: PDFFont, regular: PDFFont
) {
  try {
    page.drawText(label, { x, y, size: 8, font: bold, color: C_DARK })
    // Signature line
    const lineY = y - 28
    page.drawLine({ start: { x, y: lineY }, end: { x: x + w, y: lineY }, thickness: 0.7, color: C_DARK })
    // Name below line
    page.drawText(name, { x, y: lineY - 12, size: 8, font: regular, color: C_GRAY })
  } catch { /* skip */ }
}
