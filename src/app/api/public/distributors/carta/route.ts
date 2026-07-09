import { NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, RGB } from 'pdf-lib'
import { supabase } from '@/lib/supabase'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

const PAGE_W = 612
const PAGE_H = 792
const LEFT = 85
const RIGHT = 525
const CONTENT_W = RIGHT - LEFT
const DARK = rgb(0.14, 0.14, 0.16)
const BLUE = rgb(0.027, 0.388, 0.663)
const GRAY = rgb(0.35, 0.37, 0.38)
const LINE_COLOR = rgb(0.85, 0.88, 0.92)

interface TextSegment {
  text: string
  font: PDFFont
}

function drawMixedLine(
  page: PDFPage,
  segments: TextSegment[],
  x: number,
  y: number,
  size: number,
  maxWidth: number,
  lineHeight: number,
  color: RGB
): number {
  // Build a flat list of words, each knowing its font
  const words: { text: string; font: PDFFont }[] = []
  for (const seg of segments) {
    for (const w of seg.text.split(' ').filter(s => s)) {
      words.push({ text: w, font: seg.font })
    }
  }

  let lineX = x
  let curY = y

  for (const word of words) {
    const ww = word.font.widthOfTextAtSize(word.text, size)
    if (lineX + ww > x + maxWidth && lineX > x) {
      curY -= lineHeight
      lineX = x
    }
    page.drawText(word.text, { x: lineX, y: curY, size, font: word.font, color })
    lineX += ww + word.font.widthOfTextAtSize(' ', size)
  }

  return curY
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

export async function GET() {
  try {
    const { data: distributors, error } = await supabase
      .from('clients')
      .select('name, rfc, distributor_id')
      .eq('status', 'Activo')
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const machote1 = fs.readFileSync(path.join(process.cwd(), 'resources', 'img', 'machote1.jpeg'))
    const machote2 = fs.readFileSync(path.join(process.cwd(), 'resources', 'img', 'machote2.jpeg'))

    const pdf = await PDFDocument.create()
    const regular = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const italic = await pdf.embedFont(StandardFonts.HelveticaOblique)
    const bg1 = await pdf.embedJpg(new Uint8Array(machote1))
    const bg2 = await pdf.embedJpg(new Uint8Array(machote2))

    const logoPath = path.join(process.cwd(), 'resources', 'img', 'ARTHROMED OFICIAL.png')
    const logoBytes = fs.readFileSync(logoPath)
    const logoImage = await pdf.embedPng(logoBytes)

    let page = pdf.addPage([PAGE_W, PAGE_H])
    page.drawImage(bg1, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
    let y = PAGE_H - 55
    let pageNum = 1

    const newPage = () => {
      page = pdf.addPage([PAGE_W, PAGE_H])
      page.drawImage(bg2, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
      pageNum++

      let headerHeight = 60 // Minimum space

      // Logo and header on every page
      if (logoImage) {
        const maxWidth = 140
        const maxHeight = 45
        const logoScale = Math.min(maxWidth / logoImage.width, maxHeight / logoImage.height)
        const lw = logoImage.width * logoScale
        const lh = logoImage.height * logoScale
        page.drawImage(logoImage, { x: LEFT - 15, y: PAGE_H - 20 - lh, width: lw, height: lh })
        headerHeight = Math.max(headerHeight, 20 + lh + 10) // 20 margin + logo height + 10 padding
      }

      const hdr = 'ARTHROMED'
      page.drawText(hdr, {
        x: RIGHT - bold.widthOfTextAtSize(hdr, 13),
        y: PAGE_H - 52,
        size: 13, font: bold, color: DARK,
      })

      y = PAGE_H - headerHeight - 20 // Start text below the header area
    }

    const ensureSpace = (needed: number) => {
      if (y - needed < 85) newPage()
    }

    // === PAGE 1 HEADER ===
    let headerHeight = 60
    if (logoImage) {
      const maxWidth = 140
      const maxHeight = 45
      const logoScale = Math.min(maxWidth / logoImage.width, maxHeight / logoImage.height)
      const lw = logoImage.width * logoScale
      const lh = logoImage.height * logoScale
      page.drawImage(logoImage, { x: LEFT - 15, y: PAGE_H - 20 - lh, width: lw, height: lh })
      headerHeight = Math.max(headerHeight, 20 + lh + 10)
    }

    // "ARTHROMED" top right
    const hdr = 'ARTHROMED'
    page.drawText(hdr, {
      x: RIGHT - bold.widthOfTextAtSize(hdr, 13),
      y: PAGE_H - 52,
      size: 13, font: bold, color: DARK,
    })

    // Date right-aligned
    const now = new Date()
    const dateStr = `${now.getDate()} de ${MONTHS[now.getMonth()]} de ${now.getFullYear()}`
    y = Math.min(PAGE_H - 85, PAGE_H - headerHeight)
    page.drawText(dateStr, {
      x: RIGHT - regular.widthOfTextAtSize(dateStr, 10),
      y, size: 10, font: regular, color: DARK,
    })

    // Title
    y -= 40
    const year = now.getFullYear()
    const title = `DISTRIBUIDORES AUTORIZADOS ${year}`
    const tw = bold.widthOfTextAtSize(title, 14)
    page.drawText(title, {
      x: (PAGE_W - tw) / 2 - 15, y,
      size: 14, font: bold, color: DARK,
    })

    // Subtitle
    y -= 18
    const sub = 'Estados Unidos Mexicanos'
    const sw = italic.widthOfTextAtSize(sub, 12)
    page.drawText(sub, {
      x: (PAGE_W - sw) / 2 - 15, y,
      size: 12, font: italic, color: BLUE,
    })

    // Intro paragraph 1 (mixed bold/regular)
    y -= 28
    const p1: TextSegment[] = [
      { text: 'ARTHROMED SA DE CV', font: bold },
      { text: 'único importador y representante en el territorio mexicano del fabricante', font: regular },
      { text: 'JIANGSU BONSS MEDICAL TECHNOLOGY CO LTD', font: bold },
      { text: 'y su línea de productos', font: regular },
      { text: 'BONSS MEDICAL.', font: bold },
      { text: 'Registros sanitarios', font: regular },
      { text: '1903E2019 SSA / 1790E2025 SSA.', font: bold },
    ]
    y = drawMixedLine(page, p1, LEFT, y, 10, CONTENT_W, 14, DARK)

    // Intro paragraph 2
    y -= 20
    const p2 = `Por medio de la presente ponemos a su disposición la siguiente lista con los actuales distribuidores autorizados para comercializar los productos BONSS MEDICAL en el territorio mexicano durante el año ${year}.`
    const p2Lines = wrapText(p2, regular, 10, CONTENT_W)
    for (const line of p2Lines) {
      page.drawText(line, { x: LEFT, y, size: 10, font: regular, color: DARK })
      y -= 14
    }

    // Distributor list
    y -= 10
    const entryH = 16
    const idColW = 110

    for (const dist of distributors || []) {
      ensureSpace(entryH + 4)


      // Distributor ID (left)
      if (dist.distributor_id) {
        page.drawText(dist.distributor_id, {
          x: LEFT + 15,
          y, size: 8, font: bold, color: GRAY,
        })
      }

      // Name
      const nameX = LEFT + 15 + (dist.distributor_id ? idColW : 0)
      const maxNameW = RIGHT - nameX - 110
      let displayName = dist.name || ''
      // Truncate if too wide
      while (regular.widthOfTextAtSize(displayName, 10) > maxNameW && displayName.length > 3) {
        displayName = displayName.slice(0, -1)
      }
      page.drawText(displayName, {
        x: nameX, y, size: 10, font: regular, color: DARK,
      })

      // RFC (right-aligned)
      if (dist.rfc) {
        const rfcW = regular.widthOfTextAtSize(dist.rfc, 10)
        page.drawText(dist.rfc, {
          x: RIGHT - rfcW, y, size: 10, font: regular, color: DARK,
        })
      }

      y -= entryH
    }

    // Closing paragraph
    ensureSpace(80)
    y -= 20
    const closing = 'Agradecemos su atención a la presente. Para cualquier aclaración adicional respecto a la autorización de los distribuidores aquí mencionados, así como sobre nuestros productos, quedamos a su disposición a través de nuestros canales oficiales de contacto.'
    const cLines = wrapText(closing, regular, 10, CONTENT_W)
    for (const line of cLines) {
      page.drawText(line, { x: LEFT, y, size: 10, font: regular, color: DARK })
      y -= 14
    }

    // Footer on last page
    const footerLines = [
      'Av. Zacatecas #128, Constituyentes del 17, San Nicolás de los Garza, CP 66410 Nuevo León, México.',
      'Tel. 812-429-5408 | 812-429-8573',
      'gerencia@arthromed.com.mx',
    ]
    const footerY = 55
    for (let i = 0; i < footerLines.length; i++) {
      const fl = footerLines[i]
      const flw = regular.widthOfTextAtSize(fl, 8)
      page.drawText(fl, {
        x: (PAGE_W - flw) / 2 - 10,
        y: footerY - i * 12,
        size: 8, font: regular, color: GRAY,
      })
    }

    const pdfBytes = await pdf.save()

    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Distribuidores_Autorizados_${year}.pdf"`,
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: 'Error generating PDF' }, { status: 500 })
  }
}
