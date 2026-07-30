import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, PDFPage, PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import prisma from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import QRCode from 'qrcode'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'

const PAGE_W = 612
const PAGE_H = 792
const LEFT = 54
const RIGHT = 558
const CONTENT_W = RIGHT - LEFT
const FOOTER_MIN_Y = 55

const DARK = rgb(0.12, 0.12, 0.14)
const GRAY = rgb(0.35, 0.37, 0.38)
const LIGHT_GRAY = rgb(0.95, 0.95, 0.96)
const HEADER_NAVY = rgb(0.07, 0.22, 0.42)
const ACCENT_BLUE = rgb(0.07, 0.39, 0.66)
const BORDER_COLOR = rgb(0.85, 0.87, 0.90)

// ─── TRANSLATIONS ─────────────────────────────────────────────────────────────
const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    title: 'PRODUCT FAILURE REPORTING',
    company: 'Company:',
    report_folio: 'Report Folio:',
    report_date: 'Report Date:',
    evaluated_period: 'Evaluated Period:',
    prepared_by: 'Prepared by:',
    manufacturer_brand: 'Manufacturer / Brand:',
    faults_subtitle: 'Description of faults by product',
    col_no: 'No.',
    col_product: 'Product',
    col_series: 'Series/Lot',
    col_fault_type: 'Fault Type',
    col_description: 'Detailed Description',
    col_date: 'Date',
    col_freq: 'Freq.',
    col_obs: 'Observations',
    analysis_title: 'General analysis of failures',
    possible_causes: 'Possible causes:',
    actions_taken: 'Actions taken:',
    annex_title: 'ANNEX / PHOTOGRAPHIC EVIDENCE',
    evidence_title: 'Photographic Evidence',
    annex_label: 'Annex',
    annex_cont: 'ANNEX / PHOTOGRAPHIC EVIDENCE (Cont.)',
    analysis_cont: 'Analysis',
    no_image: '[Evidence image not available]',
    verified: 'Verified Document',
    traceability: 'Traceability QR',
  },
  es: {
    title: 'REPORTE DE FALLAS DE PRODUCTO',
    company: 'Empresa:',
    report_folio: 'Folio de Reporte:',
    report_date: 'Fecha de Reporte:',
    evaluated_period: 'Periodo Evaluado:',
    prepared_by: 'Elaborado por:',
    manufacturer_brand: 'Fabricante / Marca:',
    faults_subtitle: 'Descripción de fallas por producto',
    col_no: 'N°',
    col_product: 'Producto',
    col_series: 'Serie/Lote',
    col_fault_type: 'Tipo de Falla',
    col_description: 'Descripción Detallada',
    col_date: 'Fecha',
    col_freq: 'Frec.',
    col_obs: 'Observaciones',
    analysis_title: 'Análisis general de fallas',
    possible_causes: 'Causas posibles:',
    actions_taken: 'Acciones tomadas:',
    annex_title: 'ANEXO DE EVIDENCIAS FOTOGRÁFICAS',
    evidence_title: 'Evidencia Fotográfica',
    annex_label: 'Anexo',
    annex_cont: 'ANEXO DE EVIDENCIAS (Cont.)',
    analysis_cont: 'Análisis',
    no_image: '[Imagen de evidencia no disponible]',
    verified: 'Documento Verificado',
    traceability: 'QR de Trazabilidad',
  },
  zh: {
    title: '产品故障报告',
    company: '公司名称：',
    report_folio: '报告编号：',
    report_date: '报告日期：',
    evaluated_period: '评估周期：',
    prepared_by: '编制人：',
    manufacturer_brand: '制造商/品牌：',
    faults_subtitle: '产品故障描述',
    col_no: '序号',
    col_product: '产品',
    col_series: '序列号/批号',
    col_fault_type: '故障类型',
    col_description: '详细描述',
    col_date: '日期',
    col_freq: '频率',
    col_obs: '观察',
    analysis_title: '故障综合分析',
    possible_causes: '可能原因：',
    actions_taken: '已采取措施：',
    annex_title: '附件：照片证据',
    evidence_title: '照片证据',
    annex_label: '附件',
    annex_cont: '附件（续）',
    analysis_cont: '分析',
    no_image: '[证据图像不可用]',
    verified: '文件已核实',
    traceability: '追溯二维码',
  },
}

function t(lang: string, key: string): string {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key] || key
}

// ─── MIXED FONT TEXT DRAWING ───────────────────────────────────────────────────
// Determines if a codepoint is CJK (needs Chinese font)
function isCJK(cp: number): boolean {
  return (
    (cp >= 0x4E00 && cp <= 0x9FFF) ||   // CJK Unified Ideographs
    (cp >= 0x3400 && cp <= 0x4DBF) ||   // CJK Extension A
    (cp >= 0x20000 && cp <= 0x2A6DF) || // CJK Extension B
    (cp >= 0x2A700 && cp <= 0x2CEAF) || // CJK Extensions C/D/E
    (cp >= 0xF900 && cp <= 0xFAFF) ||   // CJK Compatibility Ideographs
    (cp >= 0x3000 && cp <= 0x303F) ||   // CJK Symbols and Punctuation
    (cp >= 0xFF00 && cp <= 0xFFEF)      // Halfwidth and Fullwidth Forms
  )
}

interface FontSet {
  regular: PDFFont
  bold: PDFFont
  chinese: PDFFont | null
}

// Draw text with automatic CJK/Latin font switching
// Returns the total width used
function drawMixedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  fonts: FontSet,
  color: ReturnType<typeof rgb>,
  useBold = false,
  lang = 'en'
): number {
  if (!text) return 0

  // For non-Chinese languages, always use Roboto
  if (lang !== 'zh' || !fonts.chinese) {
    const font = useBold ? fonts.bold : fonts.regular
    try {
      page.drawText(text, { x, y, size, font, color })
      return font.widthOfTextAtSize(text, size)
    } catch {
      return 0
    }
  }

  // For Chinese: segment text by CJK vs Latin and draw with appropriate font
  let curX = x
  let i = 0

  while (i < text.length) {
    const cp = text.codePointAt(i) || 0
    const charIsCJK = isCJK(cp)
    const charLen = cp > 0xFFFF ? 2 : 1

    // Collect run of same type
    let j = i + charLen
    while (j < text.length) {
      const cp2 = text.codePointAt(j) || 0
      if (isCJK(cp2) !== charIsCJK) break
      j += cp2 > 0xFFFF ? 2 : 1
    }

    const segment = text.slice(i, j)
    const font = charIsCJK ? fonts.chinese! : (useBold ? fonts.bold : fonts.regular)

    try {
      // For CJK in headers, slightly larger feels better
      const segSize = charIsCJK ? size : size
      page.drawText(segment, { x: curX, y, size: segSize, font, color })
      curX += font.widthOfTextAtSize(segment, segSize)
    } catch {
      // Skip unrenderable chars
      curX += size * 0.6 * segment.length
    }

    i = j
  }

  return curX - x
}

// Measure mixed-font text width without drawing
function measureMixedText(text: string, size: number, fonts: FontSet, useBold = false, lang = 'en'): number {
  if (!text) return 0

  if (lang !== 'zh' || !fonts.chinese) {
    const font = useBold ? fonts.bold : fonts.regular
    try { return font.widthOfTextAtSize(text, size) } catch { return 0 }
  }

  let totalWidth = 0
  let i = 0
  while (i < text.length) {
    const cp = text.codePointAt(i) || 0
    const charIsCJK = isCJK(cp)
    const charLen = cp > 0xFFFF ? 2 : 1

    let j = i + charLen
    while (j < text.length) {
      const cp2 = text.codePointAt(j) || 0
      if (isCJK(cp2) !== charIsCJK) break
      j += cp2 > 0xFFFF ? 2 : 1
    }

    const segment = text.slice(i, j)
    const font = charIsCJK ? fonts.chinese! : (useBold ? fonts.bold : fonts.regular)
    try { totalWidth += font.widthOfTextAtSize(segment, size) } catch { totalWidth += size * 0.6 * segment.length }
    i = j
  }
  return totalWidth
}

// Word-wrap with mixed font measurement
function wrapMixed(text: string, size: number, maxWidth: number, fonts: FontSet, lang: string): string[] {
  const raw = (text || '').replace(/\s+/g, ' ').trim()
  if (!raw) return ['']

  // For Chinese: split by character (no spaces between words)
  if (lang === 'zh' && fonts.chinese) {
    const lines: string[] = []
    let current = ''

    for (const ch of raw) {
      const test = current + ch
      if (measureMixedText(test, size, fonts, false, lang) <= maxWidth) {
        current = test
      } else {
        if (current) lines.push(current)
        current = ch
      }
    }
    if (current) lines.push(current)
    return lines.length ? lines : ['']
  }

  // For other languages: word-by-word
  const words = raw.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (measureMixedText(test, size, fonts, false, lang) <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const dateObj = new Date(d)
  const day = String(dateObj.getUTCDate()).padStart(2, '0')
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
  const year = dateObj.getUTCFullYear()
  return `${day}/${month}/${year}`
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

    const reporte = await prisma.mantenimiento_reportes.findFirst({
      where: { id, deleted_at: null },
      include: {
        registros: {
          where: { deleted_at: null },
          orderBy: { created_at: 'asc' },
        },
      },
    })

    if (!reporte) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
    }

    const lang = (reporte as any).idioma || 'en'

    // ── Load assets ──────────────────────────────────────────────────────────
    const machote1Bytes = fs.readFileSync(path.join(process.cwd(), 'resources', 'img', 'machote1.jpeg'))
    const machote2Bytes = fs.readFileSync(path.join(process.cwd(), 'resources', 'img', 'machote2.jpeg'))

    let logoBytes: Buffer
    const logoPath = path.join(process.cwd(), 'resources', 'img', 'ARTHROMED OFICIAL.png')
    logoBytes = fs.existsSync(logoPath)
      ? fs.readFileSync(logoPath)
      : fs.readFileSync(path.join(process.cwd(), 'public', 'logo.png'))

    const robotoRegularBytes = fs.readFileSync(path.join(process.cwd(), 'resources', 'fonts', 'Roboto-Regular.ttf'))
    const robotoBoldBytes = fs.readFileSync(path.join(process.cwd(), 'resources', 'fonts', 'Roboto-Bold.ttf'))

    const pdf = await PDFDocument.create()
    pdf.registerFontkit(fontkit)

    const regular = await pdf.embedFont(robotoRegularBytes)
    const bold = await pdf.embedFont(robotoBoldBytes)

    // Chinese font: only load for zh language (subset includes CJK + Latin Extended)
    let chineseFont: PDFFont | null = null
    if (lang === 'zh') {
      const chineseFontPath = path.join(process.cwd(), 'resources', 'fonts', 'STHeitiLight-Subset.ttf')
      if (fs.existsSync(chineseFontPath)) {
        const chineseFontBytes = fs.readFileSync(chineseFontPath)
        chineseFont = await pdf.embedFont(chineseFontBytes)
      }
    }

    const fonts: FontSet = { regular, bold, chinese: chineseFont }

    const bg1 = await pdf.embedJpg(machote1Bytes)
    const bg2 = await pdf.embedJpg(machote2Bytes)
    const logoImage = await pdf.embedPng(logoBytes)

    // ── QR Code ──────────────────────────────────────────────────────────────
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const validationUrl = `${protocol}://${host}/mantenimiento/reportes/${id}`
    let qrImage: any = null
    try {
      const qrPngBuffer = await QRCode.toBuffer(validationUrl, {
        width: 200, margin: 1, color: { dark: '#122340', light: '#FFFFFF' },
      })
      qrImage = await pdf.embedPng(qrPngBuffer)
    } catch (qrErr) {
      console.error('QR Code error:', qrErr)
    }

    // ── Page helpers ──────────────────────────────────────────────────────────
    const drawFooter = (page: PDFPage) => {
      const lines = [
        'Av. Zacatecas #128, Constituyentes del 17, San Nicolás de los Garza, CP 66410 Nuevo León, México. Tel.',
        '812-429-5408 | 812-429-8573',
        'gerencia@arthromed.com.mx',
      ]
      let fy = 38
      for (const line of lines) {
        const w = regular.widthOfTextAtSize(line, 7)
        page.drawText(line, { x: (PAGE_W - w) / 2, y: fy, size: 7, font: regular, color: GRAY })
        fy -= 9
      }
    }

    const drawPageHeader = (page: PDFPage, bg: any, title: string) => {
      page.drawImage(bg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
      drawFooter(page)

      // Logo
      const logoScale = Math.min(130 / logoImage.width, 42 / logoImage.height)
      page.drawImage(logoImage, {
        x: LEFT,
        y: PAGE_H - 18 - logoImage.height * logoScale,
        width: logoImage.width * logoScale,
        height: logoImage.height * logoScale,
      })

      // Company name (always Roboto)
      page.drawText('ARTHROMED', {
        x: RIGHT - bold.widthOfTextAtSize('ARTHROMED', 11),
        y: PAGE_H - 35,
        size: 11, font: bold, color: HEADER_NAVY,
      })

      // Report title (mixed font)
      const titleW = measureMixedText(title, 13, fonts, true, lang)
      drawMixedText(page, title, (PAGE_W - titleW) / 2, PAGE_H - 85, 13, fonts, HEADER_NAVY, true, lang)

      // QR
      if (qrImage) {
        page.drawImage(qrImage, { x: RIGHT - 55, y: PAGE_H - 145, width: 55, height: 55 })
      }
    }

    // ── PAGE 1: GENERAL INFO + FAULT TABLE ────────────────────────────────────
    let currentPage = pdf.addPage([PAGE_W, PAGE_H])
    const mainTitle = reporte.titulo || t(lang, 'title')
    drawPageHeader(currentPage, bg1, mainTitle)

    let y = PAGE_H - 115

    // General information fields
    // Label (bold) + value (regular), each using mixed font rendering
    const drawField = (label: string, value: string, gx: number, gy: number) => {
      drawMixedText(currentPage, label, gx, gy, 8.5, fonts, DARK, true, lang)
      drawMixedText(currentPage, value || '—', gx + 120, gy, 8.5, fonts, GRAY, false, lang)
    }

    drawField(t(lang, 'company'), reporte.empresa || 'Arthromed', LEFT + 5, y)
    drawField(t(lang, 'report_folio'), reporte.folio, LEFT + 240, y)
    y -= 14
    drawField(t(lang, 'report_date'), formatDate(reporte.fecha_reporte), LEFT + 5, y)
    drawField(t(lang, 'evaluated_period'), reporte.periodo_evaluado, LEFT + 240, y)
    y -= 14
    drawField(t(lang, 'prepared_by'), reporte.elaborado_por, LEFT + 5, y)
    drawField(t(lang, 'manufacturer_brand'), reporte.fabricante, LEFT + 240, y)
    y -= 25

    // Subtitle
    drawMixedText(currentPage, t(lang, 'faults_subtitle'), LEFT, y, 10, fonts, ACCENT_BLUE, true, lang)
    y -= 15

    // Table columns
    const cols = [
      { key: 'col_no', w: 20 },
      { key: 'col_product', w: 65 },
      { key: 'col_series', w: 75 },
      { key: 'col_fault_type', w: 75 },
      { key: 'col_description', w: 144 },
      { key: 'col_date', w: 50 },
      { key: 'col_freq', w: 25 },
      { key: 'col_obs', w: 50 },
    ]

    const drawTableHeader = (p: PDFPage, startY: number) => {
      p.drawRectangle({ x: LEFT, y: startY - 16, width: CONTENT_W, height: 18, color: HEADER_NAVY })
      let curX = LEFT + 3
      for (const col of cols) {
        drawMixedText(p, t(lang, col.key), curX, startY - 11, lang === 'zh' ? 6 : 7.5, fonts, rgb(1, 1, 1), true, lang)
        curX += col.w
      }
      return startY - 18
    }

    y = drawTableHeader(currentPage, y)

    // Table rows
    let itemNumber = 1
    for (const reg of reporte.registros) {
      const cellSize = lang === 'zh' ? 6.5 : 7
      const prodLines = wrapMixed(reg.produto ?? reg.producto, cellSize, cols[1].w - 4, fonts, lang)
      const serieLines = wrapMixed(reg.numero_serie_lote, cellSize, cols[2].w - 4, fonts, lang)
      const tipoLines = wrapMixed(reg.tipo_falla, cellSize, cols[3].w - 4, fonts, lang)
      const descLines = wrapMixed(reg.descripcion_detalle, cellSize - 0.2, cols[4].w - 4, fonts, lang)
      const obsLines = wrapMixed(reg.observaciones || '', cellSize - 0.2, cols[7].w - 4, fonts, lang)

      const maxLines = Math.max(prodLines.length, serieLines.length, tipoLines.length, descLines.length, obsLines.length, 1)
      const lineH = lang === 'zh' ? 8.5 : 9
      const rowHeight = maxLines * lineH + 8

      if (y - rowHeight < FOOTER_MIN_Y + 120) {
        currentPage = pdf.addPage([PAGE_W, PAGE_H])
        drawPageHeader(currentPage, bg2, `${mainTitle} (cont.)`)
        y = PAGE_H - 120
        y = drawTableHeader(currentPage, y)
      }

      if (itemNumber % 2 === 0) {
        currentPage.drawRectangle({ x: LEFT, y: y - rowHeight, width: CONTENT_W, height: rowHeight, color: LIGHT_GRAY })
      }
      currentPage.drawRectangle({ x: LEFT, y: y - rowHeight, width: CONTENT_W, height: rowHeight, borderColor: BORDER_COLOR, borderWidth: 0.5 })

      let curX = LEFT + 3
      const textY = y - 10

      // N°
      currentPage.drawText(String(itemNumber), { x: curX, y: textY, size: 7.5, font: bold, color: DARK })
      curX += cols[0].w

      // Producto
      let ty = textY
      for (const line of prodLines) {
        drawMixedText(currentPage, line, curX, ty, cellSize, fonts, DARK, true, lang)
        ty -= lineH
      }
      curX += cols[1].w

      // Serie/Lote
      ty = textY
      for (const line of serieLines) {
        drawMixedText(currentPage, line, curX, ty, cellSize, fonts, DARK, false, lang)
        ty -= lineH
      }
      curX += cols[2].w

      // Tipo Falla
      ty = textY
      for (const line of tipoLines) {
        drawMixedText(currentPage, line, curX, ty, cellSize, fonts, DARK, false, lang)
        ty -= lineH
      }
      curX += cols[3].w

      // Descripción
      ty = textY
      for (const line of descLines) {
        drawMixedText(currentPage, line, curX, ty, cellSize - 0.2, fonts, DARK, false, lang)
        ty -= lineH
      }
      curX += cols[4].w

      // Fecha (always Roboto)
      currentPage.drawText(formatDate(reg.fecha_reporte), { x: curX, y: textY, size: 6.8, font: regular, color: DARK })
      curX += cols[5].w

      // Frecuencia (always Roboto)
      currentPage.drawText(String(reg.frecuencia || 1), { x: curX + 5, y: textY, size: 7, font: regular, color: DARK })
      curX += cols[6].w

      // Observaciones
      ty = textY
      for (const line of obsLines) {
        drawMixedText(currentPage, line, curX, ty, cellSize - 0.2, fonts, GRAY, false, lang)
        ty -= lineH
      }

      y -= rowHeight
      itemNumber++
    }

    y -= 20

    // ── ANALYSIS SECTION ──────────────────────────────────────────────────────
    if (y < FOOTER_MIN_Y + 160) {
      currentPage = pdf.addPage([PAGE_W, PAGE_H])
      drawPageHeader(currentPage, bg2, `${mainTitle} - ${t(lang, 'analysis_cont')}`)
      y = PAGE_H - 120
    }

    drawMixedText(currentPage, t(lang, 'analysis_title'), LEFT, y, 10, fonts, ACCENT_BLUE, true, lang)
    y -= 15

    if (reporte.causas_posibles) {
      drawMixedText(currentPage, t(lang, 'possible_causes'), LEFT + 5, y, 8.5, fonts, DARK, true, lang)
      y -= 12
      const causeLines = wrapMixed(reporte.causas_posibles, 8, CONTENT_W - 10, fonts, lang)
      for (const line of causeLines) {
        drawMixedText(currentPage, line, LEFT + 10, y, 8, fonts, GRAY, false, lang)
        y -= 11
      }
      y -= 8
    }

    if (reporte.acciones_tomadas) {
      drawMixedText(currentPage, t(lang, 'actions_taken'), LEFT + 5, y, 8.5, fonts, DARK, true, lang)
      y -= 12
      const actionLines = wrapMixed(reporte.acciones_tomadas, 8, CONTENT_W - 10, fonts, lang)
      for (const line of actionLines) {
        drawMixedText(currentPage, line, LEFT + 10, y, 8, fonts, GRAY, false, lang)
        y -= 11
      }
      y -= 8
    }

    // ── PHOTOGRAPHIC EVIDENCE ─────────────────────────────────────────────────
    const allEvidencias: { url: string; title?: string; description?: string; producto?: string }[] = []
    for (const reg of reporte.registros) {
      if (reg.evidencias && Array.isArray(reg.evidencias)) {
        for (const ev of reg.evidencias as any[]) {
          if (ev.url) {
            allEvidencias.push({
              url: ev.url,
              title: ev.title || ev.caption || `${t(lang, 'annex_label')} - ${reg.producto ?? reg.producto}`,
              description: ev.description || reg.descripcion_detalle,
              producto: reg.producto ?? reg.produto,
            })
          }
        }
      }
    }

    if (allEvidencias.length > 0) {
      currentPage = pdf.addPage([PAGE_W, PAGE_H])
      drawPageHeader(currentPage, bg2, t(lang, 'annex_title'))
      y = PAGE_H - 120

      drawMixedText(currentPage, t(lang, 'evidence_title'), LEFT, y, 11, fonts, ACCENT_BLUE, true, lang)
      y -= 25

      const COL_WIDTH = 240
      const MAX_IMG_H = 125

      for (let i = 0; i < allEvidencias.length; i += 2) {
        if (y - 180 < FOOTER_MIN_Y + 20) {
          currentPage = pdf.addPage([PAGE_W, PAGE_H])
          drawPageHeader(currentPage, bg2, t(lang, 'annex_cont'))
          y = PAGE_H - 120
        }

        const rowEvidencias = allEvidencias.slice(i, i + 2)
        let maxRowHeightUsed = 0

        for (let colIdx = 0; colIdx < rowEvidencias.length; colIdx++) {
          const ev = rowEvidencias[colIdx]
          const globalIdx = i + colIdx
          const colX = colIdx === 0 ? LEFT + 5 : LEFT + 255
          let curY = y

          const annexLabel = `${t(lang, 'annex_label')} ${globalIdx + 1}: ${ev.title || t(lang, 'annex_label')}`
          drawMixedText(currentPage, annexLabel, colX, curY, 8.5, fonts, HEADER_NAVY, true, lang)
          curY -= 12

          if (ev.description) {
            const evDescLines = wrapMixed(ev.description, 7.5, COL_WIDTH - 10, fonts, lang)
            for (const line of evDescLines) {
              drawMixedText(currentPage, line, colX, curY, 7.5, fonts, GRAY, false, lang)
              curY -= 9
            }
          }
          curY -= 6

          try {
            const embeddedImg = await embedImage(pdf, ev.url)

            if (embeddedImg) {
              const scale = Math.min((COL_WIDTH - 10) / embeddedImg.width, MAX_IMG_H / embeddedImg.height)
              const iw = embeddedImg.width * scale
              const ih = embeddedImg.height * scale

              currentPage.drawRectangle({
                x: colX, y: curY - ih - 4, width: iw + 4, height: ih + 4,
                borderColor: BORDER_COLOR, borderWidth: 0.5, color: LIGHT_GRAY,
              })
              currentPage.drawImage(embeddedImg, { x: colX + 2, y: curY - ih - 2, width: iw, height: ih })
              curY -= (ih + 12)
            } else {
              drawMixedText(currentPage, t(lang, 'no_image'), colX, curY, 7.5, fonts, GRAY, false, lang)
              curY -= 15
            }
          } catch (imgErr) {
            console.error('Failed to embed evidence image:', imgErr)
            drawMixedText(currentPage, t(lang, 'no_image'), colX, curY, 7.5, fonts, GRAY, false, lang)
            curY -= 15
          }

          const heightUsed = y - curY
          if (heightUsed > maxRowHeightUsed) maxRowHeightUsed = heightUsed
        }

        y -= (Math.max(maxRowHeightUsed, 150) + 15)
      }
    }

    const pdfBytes = await pdf.save()
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${reporte.folio}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating maintenance PDF report:', error)
    return NextResponse.json({ error: error.message || 'Error generando reporte PDF' }, { status: 500 })
  }
}
