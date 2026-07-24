import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, PDFPage, PDFFont, RGB } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import prisma from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const PAGE_W = 612
const PAGE_H = 792
const LEFT = 72
const RIGHT = 540
const CONTENT_W = RIGHT - LEFT

const DARK = rgb(0.12, 0.12, 0.14)
const GRAY = rgb(0.35, 0.37, 0.38)
const LIGHT_GRAY = rgb(0.94, 0.94, 0.95)
const HEADER_NAVY = rgb(0.12, 0.22, 0.38)
const ACCENT_BLUE = rgb(0.07, 0.39, 0.66)
const FOOTER_MIN_Y = 55

const COL_W = {
  desc: 260,
  qty: 40,
  unit: 60,
  cost: 108,
}

const LINE_H = 10
const BODY_SIZE = 7.5
const PAD_Y = 6

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const raw = (text || '').replace(/\s+/g, ' ').trim()
  if (!raw) return ['']

  const words = raw.split(' ')
  const lines: string[] = []
  let current = ''

  const hardBreak = (token: string) => {
    let chunk = ''
    for (const ch of token) {
      const test = chunk + ch
      if (font.widthOfTextAtSize(test, size) > maxWidth && chunk) {
        lines.push(chunk)
        chunk = ch
      } else {
        chunk = test
      }
    }
    current = chunk
  }

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test
      continue
    }
    if (current) lines.push(current)
    current = ''
    if (font.widthOfTextAtSize(word, size) > maxWidth) hardBreak(word)
    else current = word
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch requisition details
    const requisicion = await prisma.requisiciones.findFirst({
      where: { id, deleted_at: null },
      include: {
        items: {
          where: { deleted_at: null },
          orderBy: { created_at: 'asc' }
        }
      }
    })

    if (!requisicion) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 })
    }

    // Load PDF assets
    const machote1Bytes = fs.readFileSync(path.join(process.cwd(), 'resources', 'img', 'machote1.jpeg'))
    const machote2Bytes = fs.readFileSync(path.join(process.cwd(), 'resources', 'img', 'machote2.jpeg'))
    const logoBytes = fs.readFileSync(path.join(process.cwd(), 'resources', 'img', 'ARTHROMED OFICIAL.png'))
    const robotoRegularBytes = fs.readFileSync(path.join(process.cwd(), 'resources', 'fonts', 'Roboto-Regular.ttf'))
    const robotoBoldBytes = fs.readFileSync(path.join(process.cwd(), 'resources', 'fonts', 'Roboto-Bold.ttf'))

    const pdf = await PDFDocument.create()
    pdf.registerFontkit(fontkit)

    const regular = await pdf.embedFont(robotoRegularBytes)
    const bold = await pdf.embedFont(robotoBoldBytes)
    const bg1 = await pdf.embedJpg(machote1Bytes)
    const bg2 = await pdf.embedJpg(machote2Bytes)
    const logoImage = await pdf.embedPng(logoBytes)

    // QR points to the public verification page
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = host.startsWith('localhost') ? 'http' : 'https'
    const validationUrl = `${protocol}://${host}/requisiciones/verificar/${id}`

    let qrImage: any = null
    try {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(validationUrl)}`
      const qrRes = await fetch(qrApiUrl)
      if (qrRes.ok) {
        qrImage = await pdf.embedPng(new Uint8Array(await qrRes.arrayBuffer()))
      }
    } catch (qrErr) {
      console.error('Failed to generate or embed QR Code:', qrErr)
    }

    let pageNum = 1
    let page = pdf.addPage([PAGE_W, PAGE_H])
    page.drawImage(bg1, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })

    const drawFooter = (currentPage: PDFPage) => {
      const lines = [
        'Av. Zacatecas #128, Constituyentes del 17, San Nicolás de los Garza, CP 66410 Nuevo León, México. Tel.',
        '812-429-5408 | 812-429-8573',
        'gerencia@arthromed.com.mx',
      ]
      let fy = 40
      for (const line of lines) {
        const w = regular.widthOfTextAtSize(line, 7)
        currentPage.drawText(line, {
          x: (PAGE_W - w) / 2,
          y: fy,
          size: 7,
          font: regular,
          color: GRAY,
        })
        fy -= 10
      }
    }

    drawFooter(page)

    // ── Logo and Title ──
    {
      const logoScale = Math.min(125 / logoImage.width, 40 / logoImage.height)
      const lw = logoImage.width * logoScale
      const lh = logoImage.height * logoScale
      page.drawImage(logoImage, {
        x: LEFT - 4,
        y: PAGE_H - 16 - lh,
        width: lw,
        height: lh,
      })
    }

    page.drawText('ARTHROMED', {
      x: RIGHT - bold.widthOfTextAtSize('ARTHROMED', 11),
      y: PAGE_H - 38,
      size: 11,
      font: bold,
      color: DARK,
    })

    const titleStr = 'REQUISICIÓN DE COMPRA'
    page.drawText(titleStr, {
      x: (PAGE_W - bold.widthOfTextAtSize(titleStr, 13)) / 2,
      y: PAGE_H - 95,
      size: 13,
      font: bold,
      color: DARK,
    })

    // QR Image placement
    if (qrImage) {
      page.drawImage(qrImage, {
        x: RIGHT - 56,
        y: PAGE_H - 150,
        width: 56,
        height: 56,
      })
    }

    // ── Info Grid ──
    let y = PAGE_H - 120
    const colLeft1 = LEFT + 5
    const colLeft2 = LEFT + 220

    const drawGridField = (label: string, value: string, gx: number, gy: number) => {
      page.drawText(label, { x: gx, y: gy, size: 8, font: bold, color: DARK })
      page.drawText(value, { x: gx + 95, y: gy, size: 8, font: regular, color: GRAY })
    }

    drawGridField('No. de Requisición:', requisicion.folio, colLeft1, y)
    drawGridField('Fecha de Solicitud:', formatDate(requisicion.fecha_solicitud), colLeft2, y)
    y -= 14
    drawGridField('Depto. Solicitante:', requisicion.departamento, colLeft1, y)
    drawGridField('Fecha Requerida:', formatDate(requisicion.fecha_requerida), colLeft2, y)
    y -= 14
    drawGridField('Nombre Solicitante:', requisicion.solicitante_nombre, colLeft1, y)
    drawGridField('Teléfono:', requisicion.solicitante_telefono || '—', colLeft2, y)

    y -= 30

    // ── Table Geometry ──
    const colX = {
      desc: LEFT + 5,
      qty: LEFT + COL_W.desc + 5,
      unit: LEFT + COL_W.desc + COL_W.qty + 5,
      costRight: RIGHT - 8,
    }
    const colMax = {
      desc: COL_W.desc - 12,
    }

    const drawColumnHeader = () => {
      const h = 18
      const bottom = y - h
      page.drawRectangle({
        x: LEFT,
        y: bottom,
        width: CONTENT_W,
        height: h,
        color: LIGHT_GRAY,
      })
      const textY = bottom + 5
      page.drawText('DESCRIPCIÓN DE BIENES O SERVICIOS', { x: colX.desc, y: textY, size: 8, font: bold, color: DARK })
      page.drawText('CANT.', { x: colX.qty, y: textY, size: 8, font: bold, color: DARK })
      page.drawText('UNIDAD', { x: colX.unit, y: textY, size: 8, font: bold, color: DARK })
      const costHeader = 'COSTO ESTIMADO'
      page.drawText(costHeader, {
        x: colX.costRight - bold.widthOfTextAtSize(costHeader, 8),
        y: textY,
        size: 8,
        font: bold,
        color: DARK,
      })
      y = bottom
    }

    const newPage = () => {
      page = pdf.addPage([PAGE_W, PAGE_H])
      pageNum++
      page.drawImage(bg2, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
      drawFooter(page)
      y = PAGE_H - 70
    }

    const ensureSpace = (needed: number) => {
      if (y - needed >= FOOTER_MIN_Y + 120) return // reserve bottom space for signatures/totals
      newPage()
      drawColumnHeader()
    }

    drawColumnHeader()

    let total = 0
    let rowIndex = 0

    for (const item of requisicion.items) {
      const descLines = wrapText(item.descripcion, regular, BODY_SIZE, colMax.desc)
      const lineCount = Math.max(descLines.length, 1)
      const rowH = Math.max(20, lineCount * LINE_H + PAD_Y * 2)

      ensureSpace(rowH)

      // Zebra striping
      const rowBg = rowIndex % 2 === 0 ? rgb(0.98, 0.98, 0.99) : rgb(0.94, 0.94, 0.95)
      const rowBottom = y - rowH

      page.drawRectangle({
        x: LEFT,
        y: rowBottom,
        width: CONTENT_W,
        height: rowH,
        color: rowBg,
      })

      const blockH = lineCount * LINE_H
      let textY = rowBottom + (rowH - blockH) / 2 + (lineCount - 1) * LINE_H + 1

      // Draw Description (multi-line)
      for (let i = 0; i < lineCount; i++) {
        if (descLines[i]) {
          page.drawText(descLines[i], { x: colX.desc, y: textY, size: BODY_SIZE, font: regular, color: DARK })
        }
        textY -= LINE_H
      }

      // Draw Cantidad, Unidad, Costo Estimado (centered vertically)
      const centerY = rowBottom + (rowH - 8) / 2 + 1
      page.drawText(String(item.cantidad), { x: colX.qty + 5, y: centerY, size: 8, font: regular, color: DARK })
      page.drawText(item.unidad || 'Pieza', { x: colX.unit, y: centerY, size: 8, font: regular, color: DARK })

      const costText = formatCurrency(item.costo_estimado)
      const costW = regular.widthOfTextAtSize(costText, 8)
      page.drawText(costText, {
        x: colX.costRight - costW,
        y: centerY,
        size: 8,
        font: regular,
        color: DARK,
      })

      total += item.cantidad * item.costo_estimado
      y = rowBottom
      rowIndex++
    }

    // ── Total Row ──
    ensureSpace(20)
    y -= 4
    page.drawRectangle({
      x: LEFT,
      y: y - 18,
      width: CONTENT_W,
      height: 18,
      color: HEADER_NAVY,
    })
    page.drawText('TOTAL ESTIMADO', {
      x: colX.desc,
      y: y - 12,
      size: 8,
      font: bold,
      color: rgb(1, 1, 1),
    })
    const totalText = formatCurrency(total)
    const totalW = bold.widthOfTextAtSize(totalText, 8)
    page.drawText(totalText, {
      x: colX.costRight - totalW,
      y: y - 12,
      size: 8,
      font: bold,
      color: rgb(1, 1, 1),
    })
    y -= 18

    // ── Signatures & Observations Section (stays at bottom or on next page if needed) ──
    const authBoxH = 110
    if (y - authBoxH < FOOTER_MIN_Y) {
      newPage()
    }

    y -= 20
    // Draw approval / observations layout
    // Observations block (full width)
    page.drawText('Observaciones:', { x: LEFT, y, size: 8, font: bold, color: DARK })
    const obsLines = wrapText(requisicion.observaciones || 'Sin observaciones.', regular, 8, CONTENT_W)
    let obsY = y - 12
    for (const oLine of obsLines.slice(0, 4)) {
      page.drawText(oLine, { x: LEFT, y: obsY, size: 8, font: regular, color: GRAY })
      obsY -= 10
    }

    // Centered Signature block below observations
    const authHeaderY = obsY - 20
    page.drawText('Autorizaciones:', { x: LEFT, y: authHeaderY, size: 8, font: bold, color: DARK })
    page.drawLine({
      start: { x: LEFT, y: authHeaderY - 4 },
      end: { x: RIGHT, y: authHeaderY - 4 },
      thickness: 0.5,
      color: GRAY,
    })

    const sigBlockY = authHeaderY - 20
    const hasAuth = !!requisicion.autorizacion_nombre
    const sigY = sigBlockY - 55

    if (hasAuth) {
      // Centered Authorizer block
      const authTitle = 'Autorización de Dirección:'
      const authTitleW = bold.widthOfTextAtSize(authTitle, 8)
      page.drawText(authTitle, { x: 306 - authTitleW / 2, y: sigBlockY, size: 8, font: bold, color: DARK })

      const authText = `Autorizado por: ${requisicion.autorizacion_nombre}`
      const authTextW = regular.widthOfTextAtSize(authText, 8)
      page.drawText(authText, { x: 306 - authTextW / 2, y: sigBlockY - 12, size: 8, font: regular, color: ACCENT_BLUE })

      if (requisicion.autorizacion_fecha) {
        const dateText = `Fecha: ${formatDate(new Date(requisicion.autorizacion_fecha))}`
        const dateTextW = regular.widthOfTextAtSize(dateText, 8)
        page.drawText(dateText, { x: 306 - dateTextW / 2, y: sigBlockY - 24, size: 8, font: regular, color: GRAY })
      }

      page.drawLine({
        start: { x: 306 - 90, y: sigY },
        end: { x: 306 + 90, y: sigY },
        thickness: 0.75,
        color: GRAY,
      })
      const signatureLabel = 'Firma de Autorización'
      const sigLabelW = regular.widthOfTextAtSize(signatureLabel, 7)
      page.drawText(signatureLabel, { x: 306 - sigLabelW / 2, y: sigY - 10, size: 7, font: regular, color: GRAY })
    } else {
      // Centered Aprobación block (Generic approval)
      const isApproved = requisicion.status === 'APROBADA' || requisicion.status === 'COMPRADA'
      const appTitle = 'Aprobación de Compras:'
      const appTitleW = bold.widthOfTextAtSize(appTitle, 8)
      page.drawText(appTitle, { x: 306 - appTitleW / 2, y: sigBlockY, size: 8, font: bold, color: DARK })

      const statusText = isApproved ? `Aprobado por: ${requisicion.aprobacion_nombre || 'Compras'}` : `Estado: ${requisicion.status}`
      const statusTextW = regular.widthOfTextAtSize(statusText, 8)
      page.drawText(statusText, { x: 306 - statusTextW / 2, y: sigBlockY - 12, size: 8, font: regular, color: isApproved ? ACCENT_BLUE : GRAY })

      if (isApproved && requisicion.aprobacion_fecha) {
        const dateText = `Fecha: ${formatDate(new Date(requisicion.aprobacion_fecha))}`
        const dateTextW = regular.widthOfTextAtSize(dateText, 8)
        page.drawText(dateText, { x: 306 - dateTextW / 2, y: sigBlockY - 24, size: 8, font: regular, color: GRAY })
      }

      page.drawLine({
        start: { x: 306 - 90, y: sigY },
        end: { x: 306 + 90, y: sigY },
        thickness: 0.75,
        color: GRAY,
      })
      const signatureLabel = 'Firma de Aprobación'
      const sigLabelW = regular.widthOfTextAtSize(signatureLabel, 7)
      page.drawText(signatureLabel, { x: 306 - sigLabelW / 2, y: sigY - 10, size: 7, font: regular, color: GRAY })
    }

    const pdfBytes = await pdf.save()
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="requisicion_${requisicion.folio}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Failed to export Requisition PDF:', error)
    return NextResponse.json({ error: error.message || 'Error exporting PDF' }, { status: 500 })
  }
}
