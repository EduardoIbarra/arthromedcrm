import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, PDFPage, PDFFont, RGB } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import prisma from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

// Letter size — same as reference PDF
const PAGE_W = 612
const PAGE_H = 792

// Column layout calibrated to the official Lista de precios
const LEFT = 72
const RIGHT = 540
const CONTENT_W = RIGHT - LEFT

// PRODUCTO | REFERENCIA | DESCRIPCIÓN | IMPORTE  (matches ref ~77/200/289/494)
const COL_W = {
  model: 118,
  ref: 90,
  desc: 200,
  price: 60,
}

const DARK = rgb(0.12, 0.12, 0.14)
const GRAY = rgb(0.35, 0.37, 0.38)
const LIGHT_GRAY = rgb(0.94, 0.94, 0.95)
const HEADER_NAVY = rgb(0.12, 0.22, 0.38)
const FOOTER_MIN_Y = 55

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const LINE_H = 10 // vertical advance between wrapped lines
const BODY_SIZE = 7.5
const DESC_SIZE = 7.2
const PAD_Y = 6 // top+bottom padding inside a row

function hexToRgb(hex: string): RGB {
  const cleanHex = hex.replace('#', '')
  if (cleanHex.length !== 6) return rgb(0.07, 0.39, 0.66)
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255
  return rgb(r, g, b)
}

function formatCurrency(val: number | null, currency = 'MXN'): string {
  if (val === null || val === undefined) return '-'
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

function formatDateES(d: Date): string {
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`
}

function parseExportDate(raw: string | null): Date {
  if (!raw) return new Date()
  // Accept YYYY-MM-DD (date input) without timezone shift
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function formatMoneyAmount(val: number, currency: string): string {
  const formatted = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
  return `${formatted} ${currency}`
}

type MixedWord = { text: string; font: PDFFont }

/** Justify a mixed-font paragraph (bold + regular segments). Last line left-aligned. */
function drawJustifiedMixedParagraph(
  page: PDFPage,
  segments: MixedWord[],
  x: number,
  y: number,
  size: number,
  maxW: number,
  lineHeight: number,
  color: RGB
): number {
  // Flatten segments into words (preserving font per word)
  const words: MixedWord[] = []
  for (const seg of segments) {
    for (const w of seg.text.split(/\s+/)) {
      if (w) words.push({ text: w, font: seg.font })
    }
  }

  // Wrap into lines
  const lines: MixedWord[][] = []
  let cur: MixedWord[] = []
  let curW = 0
  const spaceOf = (font: PDFFont) => font.widthOfTextAtSize(' ', size)

  for (const word of words) {
    const wordW = word.font.widthOfTextAtSize(word.text, size)
    const gap = cur.length === 0 ? 0 : spaceOf(word.font)
    if (curW + gap + wordW > maxW && cur.length > 0) {
      lines.push(cur)
      cur = [word]
      curW = wordW
    } else {
      cur.push(word)
      curW += gap + wordW
    }
  }
  if (cur.length) lines.push(cur)

  let currentY = y
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isLast = i === lines.length - 1

    if (isLast || line.length <= 1) {
      let cx = x
      for (const word of line) {
        page.drawText(word.text, { x: cx, y: currentY, size, font: word.font, color })
        cx += word.font.widthOfTextAtSize(word.text, size) + spaceOf(word.font)
      }
    } else {
      let totalWordsW = 0
      for (const word of line) {
        totalWordsW += word.font.widthOfTextAtSize(word.text, size)
      }
      const spaceW = (maxW - totalWordsW) / (line.length - 1)
      let cx = x
      for (const word of line) {
        page.drawText(word.text, { x: cx, y: currentY, size, font: word.font, color })
        cx += word.font.widthOfTextAtSize(word.text, size) + spaceW
      }
    }
    currentY -= lineHeight
  }
  return currentY
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

function tint(accent: RGB, strength: number): RGB {
  // strength 0 = white, 1 = full accent
  const s = Math.max(0, Math.min(1, strength))
  return rgb(
    accent.red * s + (1 - s),
    accent.green * s + (1 - s),
    accent.blue * s + (1 - s)
  )
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hospitalId = searchParams.get('hospitalId')

    // Export options (defaults match the official letter / reference price list)
    const listDate = parseExportDate(searchParams.get('date'))
    const includeIva = searchParams.get('includeIva') === 'true' || searchParams.get('includeIva') === '1'
    const currency = (searchParams.get('currency') || 'MXN').toUpperCase().slice(0, 8)
    const minPurchaseRaw = searchParams.get('minPurchase')
    const minPurchase =
      minPurchaseRaw !== null && minPurchaseRaw !== '' && !Number.isNaN(Number(minPurchaseRaw))
        ? Number(minPurchaseRaw)
        : 72500
    const deliveryTime = (searchParams.get('deliveryTime') || '15 días hábiles').trim() || '15 días hábiles'
    // Vigencia: default 1 year after document date
    let vigenciaDate = parseExportDate(searchParams.get('vigencia'))
    if (!searchParams.get('vigencia')) {
      vigenciaDate = new Date(listDate)
      vigenciaDate.setFullYear(vigenciaDate.getFullYear() + 1)
    }

    let hospitalName = 'Lista General de Distribuidor'
    if (hospitalId && hospitalId !== 'base') {
      const hospital = await prisma.hospitals.findUnique({ where: { id: hospitalId } })
      if (!hospital) {
        return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
      }
      hospitalName = hospital.name
    }

    // Use UTC noon to avoid timezone day-shift when stored as DATE
    const asUtcNoon = (d: Date) =>
      new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0))

    // Reuse existing publication (download latest / re-download) without creating a new version
    const existingPublicationId = searchParams.get('publicationId')
    let publication: {
      id: string
      hospital_name: string
      document_date: Date
      vigencia: Date
      include_iva: boolean
      currency: string
      min_purchase: any
      delivery_time: string
    }

    if (existingPublicationId) {
      const existing = await prisma.price_list_publications.findUnique({
        where: { id: existingPublicationId },
      })
      if (!existing) {
        return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 })
      }
      if (hospitalId && hospitalId !== 'base' && existing.hospital_id && existing.hospital_id !== hospitalId) {
        return NextResponse.json({ error: 'La publicación no pertenece a este hospital' }, { status: 403 })
      }
      publication = existing
      hospitalName = existing.hospital_name
      // Prefer stored publication options for a consistent re-download
    } else {
      // Create a new public publication record so the QR can be validated / revoked later
      publication = await prisma.price_list_publications.create({
        data: {
          hospital_id: hospitalId && hospitalId !== 'base' ? hospitalId : null,
          hospital_name: hospitalName,
          document_date: asUtcNoon(listDate),
          vigencia: asUtcNoon(vigenciaDate),
          status: 'active',
          include_iva: includeIva,
          currency,
          min_purchase: minPurchase,
          delivery_time: deliveryTime,
        },
      })
    }

    // Effective options: when reusing a publication, take its stored metadata
    const effectiveListDate =
      existingPublicationId && publication.document_date
        ? new Date(publication.document_date)
        : listDate
    const effectiveIncludeIva = existingPublicationId ? publication.include_iva : includeIva
    const effectiveCurrency = existingPublicationId
      ? (publication.currency || 'MXN').toUpperCase()
      : currency
    const effectiveMinPurchase = existingPublicationId
      ? Number(publication.min_purchase)
      : minPurchase
    const effectiveDeliveryTime = existingPublicationId
      ? publication.delivery_time || deliveryTime
      : deliveryTime

    const productsData = await prisma.products.findMany({
      where: { sort_order: { not: null } },
      orderBy: { sort_order: 'asc' },
    })

    // Prefer hospital-specific price, fall back to base list price from reference
    const priceMap = new Map<string, number>()
    if (hospitalId && hospitalId !== 'base') {
      const hospitalPrices = await prisma.hospital_prices.findMany({
        where: { hospital_id: hospitalId },
      })
      hospitalPrices.forEach((hp: { product_id: string; price: unknown }) =>
        priceMap.set(hp.product_id, Number(hp.price))
      )
    }

    const items = productsData.map((p: any) => {
      const hospitalPrice = priceMap.get(p.id)
      const finalPrice =
        hospitalPrice !== undefined
          ? hospitalPrice
          : p.base_hospital_price != null
            ? Number(p.base_hospital_price)
            : null
      return {
        description: p.description || '',
        model: p.model || '',
        order_code: p.order_code || '',
        line: p.line || 'General',
        price: finalPrice,
      }
    })

    const linesDb = await prisma.catalog_lines.findMany()
    const colorMap = new Map<string, RGB>()
    linesDb.forEach((l: any) => {
      if (l.color) colorMap.set(l.name.toUpperCase(), hexToRgb(l.color))
    })

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

    // QR points to the public verification page (not the ERP)
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = host.startsWith('localhost') ? 'http' : 'https'
    const validationUrl = `${protocol}://${host}/lista-precios/${publication.id}`

    let qrImage: Awaited<ReturnType<typeof pdf.embedPng>> | null = null
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

    // ── Page-1 header (logo + brand + date + legal copy + QR) ───────────
    {
      const maxWidth = 125
      const maxHeight = 40
      const logoScale = Math.min(maxWidth / logoImage.width, maxHeight / logoImage.height)
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

    const dateStr = formatDateES(effectiveListDate)
    page.drawText(dateStr, {
      x: RIGHT - regular.widthOfTextAtSize(dateStr, 9),
      y: PAGE_H - 54,
      size: 9,
      font: regular,
      color: rgb(0.15, 0.35, 0.55),
    })

    if (qrImage) {
      page.drawImage(qrImage, {
        x: RIGHT - 56,
        y: PAGE_H - 128,
        width: 56,
        height: 56,
      })
    }

    let y = PAGE_H - 98
    {
      const title = 'PRODUCTOS BONSS MEDICAL'
      page.drawText(title, {
        x: (PAGE_W - bold.widthOfTextAtSize(title, 13)) / 2,
        y,
        size: 13,
        font: bold,
        color: DARK,
      })
    }

    y -= 22
    // Legal intro — justified, leave room for QR on the right
    const introMaxW = CONTENT_W - (qrImage ? 68 : 0)
    const introSegs: MixedWord[] = [
      { text: 'ARTHROMED SA DE CV', font: bold },
      { text: 'único importador y representante en el territorio mexicano del fabricante', font: regular },
      { text: 'JIANGSU BONSS MEDICAL TECHNOLOGY CO LTD', font: bold },
      { text: 'y su línea de productos', font: regular },
      { text: 'BONSS MEDICAL.', font: bold },
      { text: 'Registros sanitarios', font: regular },
      { text: '1903E2019 SSA / 1790E2025 SSA.', font: bold },
    ]
    y = drawJustifiedMixedParagraph(page, introSegs, LEFT, y, 9, introMaxW, 12, DARK)

    y -= 6
    const ivaLine = effectiveIncludeIva ? 'Precios con IVA incluido.' : 'Precios sin IVA incluido.'
    page.drawText(ivaLine, {
      x: LEFT,
      y,
      size: 9,
      font: bold,
      color: DARK,
    })
    y -= 20

    // ── Table geometry ──────────────────────────────────────────────────
    const colX = {
      model: LEFT + 5,
      ref: LEFT + COL_W.model + 5,
      desc: LEFT + COL_W.model + COL_W.ref + 5,
      priceRight: RIGHT - 8,
    }
    const colMax = {
      model: COL_W.model - 12,
      ref: COL_W.ref - 12,
      desc: COL_W.desc - 12,
    }

    const newPage = () => {
      page = pdf.addPage([PAGE_W, PAGE_H])
      pageNum++
      page.drawImage(bg2, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
      drawFooter(page)
      y = PAGE_H - 70
    }

    const drawColumnHeader = () => {
      const h = 18
      // y is the top of free space; header occupies [y-h, y]
      const bottom = y - h
      page.drawRectangle({
        x: LEFT,
        y: bottom,
        width: CONTENT_W,
        height: h,
        color: LIGHT_GRAY,
      })
      const textY = bottom + 5
      page.drawText('PRODUCTO', { x: colX.model, y: textY, size: 8, font: bold, color: DARK })
      page.drawText('REFERENCIA', { x: colX.ref, y: textY, size: 8, font: bold, color: DARK })
      page.drawText('DESCRIPCIÓN', { x: colX.desc, y: textY, size: 8, font: bold, color: DARK })
      const imp = 'IMPORTE'
      page.drawText(imp, {
        x: colX.priceRight - bold.widthOfTextAtSize(imp, 8),
        y: textY,
        size: 8,
        font: bold,
        color: DARK,
      })
      y = bottom
    }

    const drawGroupHeader = (groupName: string) => {
      const h = 18
      const bottom = y - h
      page.drawRectangle({
        x: LEFT,
        y: bottom,
        width: CONTENT_W,
        height: h,
        color: HEADER_NAVY,
      })
      const label = groupName.toUpperCase()
      page.drawText(label, {
        x: LEFT + (CONTENT_W - bold.widthOfTextAtSize(label, 8)) / 2,
        y: bottom + 5,
        size: 8,
        font: bold,
        color: rgb(1, 1, 1),
      })
      y = bottom
    }

    const resolveAccent = (line: string): RGB | undefined => {
      // Map PDF section names → catalog_lines keys.
      // Never use bare includes('ENT') — "INSTRUMENTAL" contains "ENT".
      const key = (line || '').toUpperCase()
      let mapKey: string | undefined
      if (key.includes('SPORTS MEDICINE')) mapKey = 'SPORTS MEDICINE'
      else if (key.includes('UBE KIT')) mapKey = 'UBE' // no separate catalog color yet
      else if (key.includes('UBE')) mapKey = 'UBE'
      else if (key.includes('SPINE')) mapKey = 'SPINE'
      else if (key.startsWith('ENT') || key.includes('ENT (')) mapKey = 'ENT'
      else if (key.includes('URO')) mapKey = 'URO & GYN'
      else if (key.includes('SHAVER') || key.includes('PINZAS') || key.includes('BUR')) mapKey = 'Systems'
      return mapKey ? colorMap.get(mapKey) : undefined
    }

    const ensureSpace = (needed: number) => {
      if (y - needed >= FOOTER_MIN_Y) return
      newPage()
      drawColumnHeader()
    }

    const drawNotes = () => {
      // Only if there is room; reference places notes under each category block
      if (y < FOOTER_MIN_Y + 40) return
      y -= 14
      const minPurchaseLabel = formatMoneyAmount(effectiveMinPurchase, effectiveCurrency)
      // Minimum-purchase clause always notes IVA like the official letter (list prices use includeIva separately)
      const notes = [
        `Precio en ${effectiveCurrency}.`,
        `Precio sujeto a una compra mínima de ${minPurchaseLabel} (IVA incluido).`,
        `Tiempo de entrega de ${effectiveDeliveryTime}.`,
      ]
      for (const note of notes) {
        if (y < FOOTER_MIN_Y + 10) break
        page.drawText(note, { x: LEFT, y, size: 8, font: regular, color: GRAY })
        y -= 11
      }
    }

    let currentGroup = ''
    let rowIndexInGroup = 0

    for (const item of items) {
      if (item.line !== currentGroup) {
        // Notes after previous group when leaving it (reference style on page 1)
        if (currentGroup) {
          drawNotes()
          // Prefer starting a new major group with breathing room
          if (y < FOOTER_MIN_Y + 80) {
            newPage()
          } else {
            y -= 14
          }
        }

        currentGroup = item.line
        rowIndexInGroup = 0
        ensureSpace(50)
        drawGroupHeader(currentGroup)
        drawColumnHeader()
      }

      // Wrap columns — description is the one that typically goes multi-line (like the reference)
      const modelLines = wrapText(item.model, bold, BODY_SIZE, colMax.model)
      const refLines = wrapText(item.order_code, regular, BODY_SIZE, colMax.ref)
      const descLines = wrapText(item.description, regular, DESC_SIZE, colMax.desc)
      const lineCount = Math.max(modelLines.length, refLines.length, descLines.length, 1)
      const rowH = Math.max(22, lineCount * LINE_H + PAD_Y * 2)

      ensureSpace(rowH)

      // Background: system/first row light gray; subsequent rows tinted by line color (alt strength)
      const accent = resolveAccent(item.line)
      let rowBg = rgb(0.98, 0.98, 0.99)
      if (rowIndexInGroup === 0 && (item.model || '').toLowerCase().includes('sistema')) {
        rowBg = rgb(0.96, 0.96, 0.97)
      } else if (accent) {
        rowBg = tint(accent, rowIndexInGroup % 2 === 0 ? 0.22 : 0.32)
      } else {
        rowBg = rowIndexInGroup % 2 === 0 ? rgb(0.99, 0.99, 1) : rgb(0.96, 0.96, 0.97)
      }

      // CRITICAL: non-overlapping geometry
      // y = top of free space. Row occupies [y - rowH, y]. Next row starts at y - rowH.
      const rowTop = y
      const rowBottom = y - rowH

      page.drawRectangle({
        x: LEFT,
        y: rowBottom,
        width: CONTENT_W,
        height: rowH,
        color: rowBg,
      })

      // Vertically center the text block inside the row
      const blockH = lineCount * LINE_H
      let textY = rowBottom + (rowH - blockH) / 2 + (lineCount - 1) * LINE_H + 1

      for (let i = 0; i < lineCount; i++) {
        const m = modelLines[i]
        const r = refLines[i]
        const d = descLines[i]
        if (m) {
          page.drawText(m, { x: colX.model, y: textY, size: BODY_SIZE, font: bold, color: DARK })
        }
        if (r) {
          page.drawText(r, { x: colX.ref, y: textY, size: BODY_SIZE, font: regular, color: DARK })
        }
        if (d) {
          page.drawText(d, { x: colX.desc, y: textY, size: DESC_SIZE, font: regular, color: DARK })
        }
        textY -= LINE_H
      }

      // Price: always dark (no green), right-aligned, vertically centered
      const priceText = formatCurrency(item.price)
      const priceW = regular.widthOfTextAtSize(priceText, 8)
      const priceY = rowBottom + (rowH - 8) / 2 + 1
      page.drawText(priceText, {
        x: colX.priceRight - priceW,
        y: priceY,
        size: 8,
        font: regular,
        color: DARK,
      })

      y = rowBottom // next row starts exactly at this bottom — no overlap
      rowIndexInGroup++
    }

    // Final notes
    drawNotes()

    const pdfBytes = await pdf.save()
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="lista_de_precios_${hospitalName.toLowerCase().replace(/\s+/g, '_')}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Failed to export price list PDF:', error)
    return NextResponse.json({ error: error.message || 'Error exporting PDF' }, { status: 500 })
  }
}
