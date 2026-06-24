import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, PDFPage, PDFFont, RGB } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import prisma from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

const PAGE_W = 612
const PAGE_H = 792
const LEFT = 85
const RIGHT = 525
const CONTENT_W = RIGHT - LEFT
const DARK = rgb(0.14, 0.14, 0.16)
const GRAY = rgb(0.35, 0.37, 0.38)
const PRIMARY = rgb(0.07, 0.39, 0.66)

function formatDateES(date: Date): string {
  return `${date.getDate()} de ${MONTHS_ES[date.getMonth()]} de ${date.getFullYear()}`
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(test, size) > maxW && cur) {
      lines.push(cur)
      cur = w
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const idsParam = url.searchParams.get('ids')
    const selectedIds = idsParam ? idsParam.split(',').filter(Boolean) : []

    if (selectedIds.length === 0) {
      return NextResponse.json({ error: 'No se especificaron IDs de checklist' }, { status: 400 })
    }

    // 1. Fetch checklist history setting from prisma
    const setting = await prisma.app_settings.findUnique({
      where: { key: 'checklist_history' }
    })

    const history = setting ? (setting.value as any[]) : []
    
    // Filter and sort the selected logs by date (oldest to newest)
    const entries = history
      .filter(e => selectedIds.includes(e.id))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No se encontraron registros coincidentes en el historial' }, { status: 404 })
    }

    // 2. Load background image assets and font assets
    const machote1Path = path.join(process.cwd(), 'resources', 'img', 'machote1.jpeg')
    const machote2Path = path.join(process.cwd(), 'resources', 'img', 'machote2.jpeg')
    const logoPath = path.join(process.cwd(), 'resources', 'img', 'ARTHROMED OFICIAL.png')
    const robotoRegularPath = path.join(process.cwd(), 'resources', 'fonts', 'Roboto-Regular.ttf')
    const robotoBoldPath = path.join(process.cwd(), 'resources', 'fonts', 'Roboto-Bold.ttf')

    if (
      !fs.existsSync(machote1Path) ||
      !fs.existsSync(machote2Path) ||
      !fs.existsSync(logoPath) ||
      !fs.existsSync(robotoRegularPath) ||
      !fs.existsSync(robotoBoldPath)
    ) {
      return NextResponse.json({ error: 'Faltan recursos del sistema (plantillas o fuentes)' }, { status: 500 })
    }

    const machote1Bytes = fs.readFileSync(machote1Path)
    const machote2Bytes = fs.readFileSync(machote2Path)
    const logoBytes = fs.readFileSync(logoPath)
    const robotoRegularBytes = fs.readFileSync(robotoRegularPath)
    const robotoBoldBytes = fs.readFileSync(robotoBoldPath)

    // 3. Create PDF Document
    const pdf = await PDFDocument.create()
    pdf.registerFontkit(fontkit)

    const regular = await pdf.embedFont(robotoRegularBytes)
    const bold = await pdf.embedFont(robotoBoldBytes)
    const bg1 = await pdf.embedJpg(machote1Bytes)
    const bg2 = await pdf.embedJpg(machote2Bytes)
    const logoImage = await pdf.embedPng(logoBytes)

    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = host.startsWith('localhost') ? 'http' : 'https'

    let globalPageNum = 0

    // Footer helper
    const drawFooter = (currentPage: PDFPage, num: number) => {
      const footerLine1 = 'Av. Zacatecas #128, Constituyentes del 17, San Nicolás de los Garza, CP 66410 Nuevo León, México. Tel. 812-429-5408 | 812-429-8573'
      const footerLine2 = 'gerencia@arthromed.com.mx'
      
      const footerSize = 7.5
      const w1 = regular.widthOfTextAtSize(footerLine1, footerSize)
      const w2 = regular.widthOfTextAtSize(footerLine2, footerSize)

      currentPage.drawText(footerLine1, {
        x: (PAGE_W - w1) / 2,
        y: 35,
        size: footerSize,
        font: regular,
        color: GRAY
      })

      currentPage.drawText(footerLine2, {
        x: (PAGE_W - w2) / 2,
        y: 23,
        size: footerSize,
        font: regular,
        color: GRAY
      })

      const pageStr = `Pág. ${num}`
      currentPage.drawText(pageStr, {
        x: RIGHT - regular.widthOfTextAtSize(pageStr, 8),
        y: 35,
        size: 8,
        font: regular,
        color: GRAY
      })
    }

    // Process each checklist history entry
    for (const entry of entries) {
      let page = pdf.addPage([PAGE_W, PAGE_H])
      page.drawImage(bg1, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
      globalPageNum++
      drawFooter(page, globalPageNum)

      // Fetch validation QR code for this specific entry
      const validationUrl = `${protocol}://${host}/inventario/checklists?historyId=${entry.id}`
      let qrImage = null
      try {
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(validationUrl)}`
        const qrRes = await fetch(qrApiUrl)
        if (qrRes.ok) {
          const qrBytes = new Uint8Array(await qrRes.arrayBuffer())
          qrImage = await pdf.embedPng(qrBytes)
        }
      } catch (qrErr) {
        console.error('Failed to generate or embed QR Code:', qrErr)
      }

      let y = PAGE_H - 55

      // Logo
      if (logoImage) {
        const maxWidth = 140
        const maxHeight = 45
        const logoScale = Math.min(maxWidth / logoImage.width, maxHeight / logoImage.height)
        const lw = logoImage.width * logoScale
        const lh = logoImage.height * logoScale
        page.drawImage(logoImage, { x: LEFT - 15, y: PAGE_H - 20 - lh, width: lw, height: lh })
      }

      // Document Code Pill (top right)
      const codeText = `CHKL-${entry.id.replace('hlog_', '').substring(0, 10)}`
      const codeW = bold.widthOfTextAtSize(codeText, 9)
      const pillW = codeW + 20
      const pillH = 18
      const pillX = RIGHT - pillW
      const pillY = PAGE_H - 52
      page.drawRectangle({
        x: pillX,
        y: pillY,
        width: pillW,
        height: pillH,
        color: rgb(0.93, 0.93, 0.94),
        borderColor: rgb(0.85, 0.85, 0.86),
        borderWidth: 0.5
      })
      page.drawText(codeText, {
        x: pillX + 10,
        y: pillY + 5,
        size: 9,
        font: bold,
        color: rgb(0.2, 0.2, 0.2)
      })

      // Date
      const logDate = new Date(entry.date)
      const dateStr = formatDateES(logDate)
      const dateW = regular.widthOfTextAtSize(dateStr, 9)
      page.drawText(dateStr, {
        x: RIGHT - dateW,
        y: pillY - 14,
        size: 9,
        font: regular,
        color: rgb(0.3, 0.3, 0.3)
      })

      // QR Code
      if (qrImage) {
        page.drawImage(qrImage, {
          x: RIGHT - 60,
          y: PAGE_H - 145,
          width: 60,
          height: 60
        })
      }

      // Destination Block
      y = PAGE_H - 140
      page.drawText('REPORTE DE INSPECCIÓN.', {
        x: LEFT,
        y,
        size: 11,
        font: bold,
        color: DARK
      })
      y -= 15
      page.drawText('Presente.', {
        x: LEFT,
        y,
        size: 11,
        font: bold,
        color: DARK
      })

      // General Metainfo Block
      y -= 30
      const metaBoxH = 65
      page.drawRectangle({
        x: LEFT,
        y: y - metaBoxH,
        width: CONTENT_W,
        height: metaBoxH,
        color: rgb(0.96, 0.97, 0.98),
        borderColor: rgb(0.88, 0.9, 0.92),
        borderWidth: 0.5
      })

      let metaY = y - 16
      page.drawText('Checklist:', { x: LEFT + 12, y: metaY, size: 9, font: bold, color: GRAY })
      page.drawText(String(entry.checklistName || '').toUpperCase(), { x: LEFT + 85, y: metaY, size: 9, font: bold, color: DARK })

      metaY -= 14
      page.drawText('Realizado por:', { x: LEFT + 12, y: metaY, size: 9, font: bold, color: GRAY })
      page.drawText(String(entry.user || ''), { x: LEFT + 85, y: metaY, size: 9, font: regular, color: DARK })

      metaY -= 14
      page.drawText('Fecha:', { x: LEFT + 12, y: metaY, size: 9, font: bold, color: GRAY })
      const formattedTime = logDate.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      page.drawText(formattedTime, { x: LEFT + 85, y: metaY, size: 9, font: regular, color: DARK })

      metaY -= 14
      page.drawText('Estatus:', { x: LEFT + 12, y: metaY, size: 9, font: bold, color: GRAY })
      const percent = entry.totalCount > 0 ? Math.round((entry.checkedCount / entry.totalCount) * 100) : 0
      page.drawText(`${entry.checkedCount} de ${entry.totalCount} listos (${percent}%)`, { x: LEFT + 85, y: metaY, size: 9, font: bold, color: rgb(0.04, 0.48, 0.28) })

      y -= (metaBoxH + 15)

      // Notes Box
      if (entry.notes && entry.notes.trim()) {
        const notesText = entry.notes.trim()
        const wrappedNotes = wrapText(notesText, regular, 8.5, CONTENT_W - 24)
        const notesH = 15 + wrappedNotes.length * 12
        
        page.drawRectangle({
          x: LEFT,
          y: y - notesH,
          width: CONTENT_W,
          height: notesH,
          color: rgb(0.98, 0.98, 0.94),
          borderColor: rgb(0.94, 0.92, 0.84),
          borderWidth: 0.5
        })
        
        let notesY = y - 14
        page.drawText('Notas / Observaciones generales:', { x: LEFT + 12, y: notesY, size: 8.5, font: bold, color: rgb(0.6, 0.4, 0.0) })
        
        for (const line of wrappedNotes) {
          notesY -= 12
          page.drawText(line, { x: LEFT + 12, y: notesY, size: 8.5, font: regular, color: DARK })
        }
        y -= (notesH + 15)
      }

      // Table Setup
      const colMaterialW = 165
      const colModeloW = 60
      const colExpectedW = 45
      const colCountedW = 45
      const colStatusW = 45
      const colObsW = 80

      const colMaterialX = LEFT
      const colModeloX = colMaterialX + colMaterialW
      const colExpectedX = colModeloX + colModeloW
      const colCountedX = colExpectedX + colExpectedW
      const colStatusX = colCountedX + colCountedW
      const colObsX = colStatusX + colStatusW

      const tableHeaderH = 20

      const newPage = () => {
        page = pdf.addPage([PAGE_W, PAGE_H])
        page.drawImage(bg2, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
        globalPageNum++

        if (logoImage) {
          const maxWidth = 140
          const maxHeight = 45
          const logoScale = Math.min(maxWidth / logoImage.width, maxHeight / logoImage.height)
          const lw = logoImage.width * logoScale
          const lh = logoImage.height * logoScale
          page.drawImage(logoImage, { x: LEFT - 15, y: PAGE_H - 20 - lh, width: lw, height: lh })
        }

        const hdr = 'ARTHROMED'
        page.drawText(hdr, {
          x: RIGHT - bold.widthOfTextAtSize(hdr, 11),
          y: PAGE_H - 42,
          size: 11,
          font: bold,
          color: DARK
        })

        drawFooter(page, globalPageNum)
        y = PAGE_H - 85
      }

      const ensureSpace = (needed: number, repeatHeader = false) => {
        if (y - needed < 85) {
          newPage()
          if (repeatHeader) {
            y -= tableHeaderH
            page.drawRectangle({
              x: LEFT,
              y,
              width: CONTENT_W,
              height: tableHeaderH,
              color: PRIMARY
            })
            const headerY = y + 6
            page.drawText('Material / Artículo', { x: colMaterialX + 5, y: headerY, size: 7.5, font: bold, color: rgb(1, 1, 1) })
            page.drawText('Modelo', { x: colModeloX + 5, y: headerY, size: 7.5, font: bold, color: rgb(1, 1, 1) })
            page.drawText('Esperado', { x: colExpectedX + 5, y: headerY, size: 7.5, font: bold, color: rgb(1, 1, 1) })
            page.drawText('Contado', { x: colCountedX + 5, y: headerY, size: 7.5, font: bold, color: rgb(1, 1, 1) })
            page.drawText('Estado', { x: colStatusX + 5, y: headerY, size: 7.5, font: bold, color: rgb(1, 1, 1) })
            page.drawText('Observaciones', { x: colObsX + 5, y: headerY, size: 7.5, font: bold, color: rgb(1, 1, 1) })
          }
        }
      }

      // Draw Initial Table Header
      ensureSpace(tableHeaderH + 15, false)
      y -= tableHeaderH
      page.drawRectangle({
        x: LEFT,
        y,
        width: CONTENT_W,
        height: tableHeaderH,
        color: PRIMARY
      })
      const initHeaderY = y + 6
      page.drawText('Material / Artículo', { x: colMaterialX + 5, y: initHeaderY, size: 7.5, font: bold, color: rgb(1, 1, 1) })
      page.drawText('Modelo', { x: colModeloX + 5, y: initHeaderY, size: 7.5, font: bold, color: rgb(1, 1, 1) })
      page.drawText('Esperado', { x: colExpectedX + 5, y: initHeaderY, size: 7.5, font: bold, color: rgb(1, 1, 1) })
      page.drawText('Contado', { x: colCountedX + 5, y: initHeaderY, size: 7.5, font: bold, color: rgb(1, 1, 1) })
      page.drawText('Estado', { x: colStatusX + 5, y: initHeaderY, size: 7.5, font: bold, color: rgb(1, 1, 1) })
      page.drawText('Observaciones', { x: colObsX + 5, y: initHeaderY, size: 7.5, font: bold, color: rgb(1, 1, 1) })

      // Draw Rows
      const items = entry.items || []
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx]
        const wrappedMaterial = wrapText(item.material || '', regular, 7, colMaterialW - 10)
        const wrappedObs = wrapText(item.observaciones || '', regular, 7, colObsW - 10)
        
        const linesCount = Math.max(wrappedMaterial.length, wrappedObs.length, 1)
        const rowHeight = 12 + (linesCount - 1) * 8.5

        ensureSpace(rowHeight + 5, true)

        const isEven = idx % 2 === 0
        const bgCol = isEven ? rgb(0.96, 0.97, 0.98) : rgb(1, 1, 1)

        page.drawRectangle({
          x: LEFT,
          y: y - rowHeight,
          width: CONTENT_W,
          height: rowHeight,
          color: bgCol
        })

        page.drawRectangle({
          x: LEFT,
          y: y - rowHeight,
          width: CONTENT_W,
          height: rowHeight,
          borderWidth: 0.2,
          borderColor: rgb(0.88, 0.88, 0.88)
        })

        const textY = y - 9.5
        // Draw wrapped Material
        let matLineY = textY
        for (const line of wrappedMaterial) {
          page.drawText(line, { x: colMaterialX + 5, y: matLineY, size: 7, font: regular, color: DARK })
          matLineY -= 8.5
        }

        // Draw Modelo
        if (item.modelo) {
          page.drawText(item.modelo, { x: colModeloX + 5, y: textY, size: 7, font: regular, color: DARK })
        }

        // Draw Esperado
        const expectedStr = String(item.cantidad !== undefined ? item.cantidad : '-')
        page.drawText(expectedStr, { x: colExpectedX + 5, y: textY, size: 7, font: regular, color: DARK })

        // Draw Contado
        const countedStr = String(item.cantidadContada !== undefined ? item.cantidadContada : '-')
        const isMismatch = item.cantidadContada !== undefined && item.cantidad !== undefined && item.cantidadContada !== item.cantidad
        const countedColor = isMismatch ? rgb(0.75, 0.1, 0.1) : DARK
        page.drawText(countedStr, { x: colCountedX + 5, y: textY, size: 7, font: isMismatch ? bold : regular, color: countedColor })

        // Draw Status
        const statusText = item.checked ? 'Listo' : 'Faltante'
        const statusColor = item.checked ? rgb(0.04, 0.48, 0.28) : rgb(0.75, 0.1, 0.1)
        page.drawText(statusText, { x: colStatusX + 5, y: textY, size: 7, font: bold, color: statusColor })

        // Draw wrapped Observaciones
        let obsLineY = textY
        for (const line of wrappedObs) {
          page.drawText(line, { x: colObsX + 5, y: obsLineY, size: 7, font: regular, color: DARK })
          obsLineY -= 8.5
        }

        y -= rowHeight
      }
    }

    // Save and stream the PDF
    const pdfBytes = await pdf.save()

    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Reporte_Checklists_Masivo.pdf"',
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  } catch (err: any) {
    console.error('Error generating bulk checklist PDF:', err)
    return NextResponse.json({ error: err.message || 'Error interno al generar PDF masivo' }, { status: 500 })
  }
}
