import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, RGB } from 'pdf-lib'
import { supabaseAdmin } from '@/lib/supabase/serverSide'
import prisma from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

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
const BLUE = rgb(0.027, 0.388, 0.663)
const GRAY = rgb(0.35, 0.37, 0.38)

interface TextSegment {
  text: string
  font: PDFFont
}

function hexToDarkerRgb(hex: string): RGB {
  const cleanHex = hex.replace('#', '')
  if (cleanHex.length !== 6) return rgb(0.07, 0.39, 0.66)
  let r = parseInt(cleanHex.substring(0, 2), 16) / 255
  let g = parseInt(cleanHex.substring(2, 4), 16) / 255
  let b = parseInt(cleanHex.substring(4, 6), 16) / 255

  // Convert to HSL
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  let l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  // Force lightness to a lower range (e.g. 0.22) for high readability on white background
  l = 0.22
  // Ensure we maintain/boost saturation so colors remain vibrant
  s = Math.max(s, 0.75)

  // Convert HSL back to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  r = hue2rgb(p, q, h + 1/3)
  g = hue2rgb(p, q, h)
  b = hue2rgb(p, q, h - 1/3)

  return rgb(r, g, b)
}

function formatDateES(dateStr: string | Date): string {
  if (typeof dateStr === 'string') {
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const monthIndex = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      return `${day} de ${MONTHS_ES[monthIndex]} de ${year}`
    }
  }
  const d = new Date(dateStr)
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`
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

function drawJustifiedLine(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  maxW: number,
  color: RGB
) {
  const words = text.split(' ').filter(Boolean)
  if (words.length <= 1) {
    page.drawText(text, { x, y, size, font, color })
    return
  }

  let totalWordsWidth = 0
  for (const word of words) {
    totalWordsWidth += font.widthOfTextAtSize(word, size)
  }

  const remainingSpace = maxW - totalWordsWidth
  const spaceWidth = remainingSpace / (words.length - 1)

  let currentX = x
  for (const word of words) {
    page.drawText(word, { x: currentX, y, size, font, color })
    currentX += font.widthOfTextAtSize(word, size) + spaceWidth
  }
}

function drawJustifiedParagraph(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  maxW: number,
  lineHeight: number,
  color: RGB
): number {
  const lines = wrapText(text, font, size, maxW)
  let currentY = y
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isLastLine = i === lines.length - 1
    if (isLastLine || line.split(' ').filter(Boolean).length <= 1) {
      page.drawText(line, { x, y: currentY, size, font, color })
    } else {
      drawJustifiedLine(page, line, font, size, x, currentY, maxW, color)
    }
    currentY -= lineHeight
  }
  return currentY
}

function drawJustifiedMixedParagraph(
  page: PDFPage,
  segments: TextSegment[],
  x: number,
  y: number,
  size: number,
  maxW: number,
  lineHeight: number,
  color: RGB
): number {
  const words: { text: string; font: PDFFont }[] = []
  for (const seg of segments) {
    const splitWords = seg.text.split(' ')
    for (let i = 0; i < splitWords.length; i++) {
      const w = splitWords[i]
      if (w || i === 0 || i === splitWords.length - 1) {
        words.push({ text: w, font: seg.font })
      }
    }
  }

  // Wrap words into lines based on visual width
  const lines: { text: string; font: PDFFont }[][] = []
  let currentLine: { text: string; font: PDFFont }[] = []
  let currentLineWidth = 0

  for (const word of words) {
    const wordW = word.font.widthOfTextAtSize(word.text, size)
    const spaceW = word.font.widthOfTextAtSize(' ', size)
    const testWidth = currentLineWidth === 0 ? wordW : currentLineWidth + spaceW + wordW

    if (testWidth > maxW && currentLine.length > 0) {
      lines.push(currentLine)
      currentLine = [word]
      currentLineWidth = wordW
    } else {
      currentLine.push(word)
      currentLineWidth = testWidth
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine)
  }

  let currentY = y
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isLastLine = i === lines.length - 1

    if (isLastLine || line.length <= 1) {
      // Draw standard left-aligned for last line
      let currentX = x
      for (const word of line) {
        if (word.text) {
          page.drawText(word.text, { x: currentX, y: currentY, size, font: word.font, color })
        }
        currentX += word.font.widthOfTextAtSize(word.text, size) + word.font.widthOfTextAtSize(' ', size)
      }
    } else {
      // Draw justified
      let totalWordsWidth = 0
      for (const word of line) {
        totalWordsWidth += word.font.widthOfTextAtSize(word.text, size)
      }
      const remainingSpace = maxW - totalWordsWidth
      const spaceWidth = remainingSpace / (line.length - 1)

      let currentX = x
      for (const word of line) {
        if (word.text) {
          page.drawText(word.text, { x: currentX, y: currentY, size, font: word.font, color })
        }
        currentX += word.font.widthOfTextAtSize(word.text, size) + spaceWidth
      }
    }
    currentY -= lineHeight
  }

  return currentY
}

export interface GenerateLetterParams {
  clientId: string
  institutionName: string
  distributorName?: string
  rfc?: string
  selectedLines: string[] // Array of line IDs
  expirationDate: string | Date
  createdBy?: string | null
  host?: string
}

export async function generateClientLetter({
  clientId,
  institutionName,
  distributorName,
  rfc,
  selectedLines,
  expirationDate,
  createdBy = null,
  host = 'localhost:3000'
}: GenerateLetterParams) {
  // 1. Fetch client from DB
  const client = await prisma.clients.findUnique({
    where: { id: clientId }
  })
  if (!client) {
    throw new Error('Cliente no encontrado')
  }

  const finalDistName = distributorName || client.name
  const finalRfc = rfc || client.rfc || 'SIN RFC REGISTRADO'

  // 2. Fetch lines details from DB
  const linesDb = await prisma.catalog_lines.findMany({
    where: {
      id: { in: selectedLines }
    }
  })

  if (linesDb.length === 0) {
    throw new Error('No se encontraron las líneas de producto seleccionadas')
  }

  // Sort lines to match requested order in selectedLines
  const lines = selectedLines
    .map((id: string) => linesDb.find((l: any) => l.id === id))
    .filter(Boolean) as typeof linesDb

  // 3. Load files
  const machotePath = path.join(process.cwd(), 'resources', 'img', 'machote1.jpeg')
  const firmaEricPath = path.join(process.cwd(), 'resources', 'img', 'firmaEric.jpg')
  const firmaRicardoPath = path.join(process.cwd(), 'resources', 'img', 'firmaRicardoReyes.png')
  const logoPath = path.join(process.cwd(), 'resources', 'img', 'ARTHROMED OFICIAL.png')

  if (!fs.existsSync(machotePath) || !fs.existsSync(firmaEricPath) || !fs.existsSync(firmaRicardoPath) || !fs.existsSync(logoPath)) {
    throw new Error('Falta alguna imagen de recurso (machote, firmas o logo en resources/img)')
  }

  const machoteBytes = fs.readFileSync(machotePath)
  const firmaEricBytes = fs.readFileSync(firmaEricPath)
  const firmaRicardoBytes = fs.readFileSync(firmaRicardoPath)
  const logoBytes = fs.readFileSync(logoPath)

  // 4. Create PDF Document
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  
  const bg1 = await pdf.embedJpg(machoteBytes)
  const imgEric = await pdf.embedJpg(firmaEricBytes)
  const imgRicardo = await pdf.embedPng(firmaRicardoBytes)
  const logoImage = await pdf.embedPng(logoBytes)

  // Generate QR Code containing verification URL
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const validationUrl = `${protocol}://${host}/distribuidores?search=${finalRfc}`

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

  // Page creation
  const page = pdf.addPage([PAGE_W, PAGE_H])
  page.drawImage(bg1, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })

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

  // Code Pill (top right)
  const codeText = client.distributor_id || 'SIN CÓDIGO'
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
  const now = new Date()
  const dateStr = formatDateES(now)
  const dateW = regular.widthOfTextAtSize(dateStr, 9)
  page.drawText(dateStr, {
    x: RIGHT - dateW,
    y: pillY - 14,
    size: 9,
    font: regular,
    color: rgb(0.3, 0.3, 0.3)
  })

  // QR Code below the date
  if (qrImage) {
    page.drawImage(qrImage, {
      x: RIGHT - 60,
      y: PAGE_H - 145,
      width: 60,
      height: 60
    })
  }

  // Destination
  y = PAGE_H - 140
  page.drawText(institutionName.toUpperCase() + '.', {
    x: LEFT,
    y,
    size: 10,
    font: bold,
    color: DARK
  })
  y -= 15
  page.drawText('Presente.', {
    x: LEFT,
    y,
    size: 10,
    font: bold,
    color: DARK
  })

  // Paragraph 1 (Justified)
  y -= 30
  const p1Segments = [
    { text: 'ARTHROMED SA DE CV', font: bold },
    { text: ' único importador y representante en el territorio mexicano del fabricante ', font: regular },
    { text: 'JIANGSU BONSS MEDICAL TECHNOLOGY CO LTD', font: bold },
    { text: ' y su línea de productos ', font: regular },
    { text: 'BONSS MEDICAL.', font: bold },
    { text: ' Registros sanitarios ', font: regular },
    { text: '1903E2019 SSA y 1790E2025 SSA.', font: bold }
  ]
  y = drawJustifiedMixedParagraph(page, p1Segments, LEFT, y, 10, CONTENT_W, 14, DARK)

  // Paragraph 2 (Justified)
  y -= 20
  const p2Segments = [
    { text: 'Por medio de la presente, hacemos constar que la empresa ', font: regular },
    { text: finalDistName.toUpperCase(), font: bold },
    { text: ' , con RFC: ', font: regular },
    { text: finalRfc.toUpperCase(), font: bold },
    { text: ', cuenta con nuestra autorización para fungir como ', font: regular },
    { text: 'Distribuidor Autorizado', font: bold },
    { text: ' ante su institución.', font: regular }
  ]
  y = drawJustifiedMixedParagraph(page, p2Segments, LEFT, y, 10, CONTENT_W, 14, DARK)

  // Paragraph 3 (Justified)
  y -= 20
  const p3 = 'Le otorgamos facultades para la distribución, venta y comercialización de los productos BONSS Medical correspondientes a las siguientes líneas:'
  y = drawJustifiedParagraph(page, p3, regular, 10, LEFT, y, CONTENT_W, 14, DARK)

  // Selected product lines
  // Align name right-aligned and description left-aligned in a mathematically centered table block
  y -= 8
  const gap = 15
  let maxNameW = 0
  let maxDescW = 0

  for (const line of lines) {
    const lineName = line.name.toUpperCase()
    const lineDesc = line.description ? ` (${line.description})` : ''
    
    const nameW = bold.widthOfTextAtSize(lineName, 9.5)
    const descW = lineDesc ? regular.widthOfTextAtSize(lineDesc, 9.5) : 0
    
    if (nameW > maxNameW) maxNameW = nameW
    if (descW > maxDescW) maxDescW = descW
  }

  const tableW = maxNameW + gap + maxDescW
  const tableX = (PAGE_W - tableW) / 2
  const splitX = tableX + maxNameW

  for (const line of lines) {
    const lineName = line.name.toUpperCase()
    const lineDesc = line.description ? ` (${line.description})` : ''
    
    const nameW = bold.widthOfTextAtSize(lineName, 9.5)
    
    // Convert hex color to HSL-darkened high-contrast RGB
    const lineColor = hexToDarkerRgb(line.color)
    
    // Draw Name: right-aligned to splitX
    page.drawText(lineName, {
      x: splitX - nameW,
      y,
      size: 9.5,
      font: bold,
      color: lineColor
    })

    // Draw Description: left-aligned to splitX + gap
    if (lineDesc) {
      page.drawText(lineDesc, {
        x: splitX + gap,
        y,
        size: 9.5,
        font: regular,
        color: DARK
      })
    }

    y -= 15
  }

  // Paragraph 4 (Justified)
  y -= 5
  const p4 = 'El Distribuidor Autorizado no tiene la facultad de negociar ni modificar los precios de venta establecidos por el Importador.'
  y = drawJustifiedParagraph(page, p4, regular, 10, LEFT, y, CONTENT_W, 14, DARK)

  // Paragraph 5 (Justified)
  y -= 5
  const p5 = 'La presente autorización permanecerá vigente durante el periodo señalado en esta carta. No obstante, el Importador se reserva el derecho de revocarla de manera anticipada.'
  y = drawJustifiedParagraph(page, p5, regular, 10, LEFT, y, CONTENT_W, 14, DARK)

  // Paragraph 6 (Justified)
  y -= 5
  const p6 = 'Agradeciendo de antemano la atención prestada a la presente, quedo a sus órdenes para cualquier duda y/o aclaración.'
  y = drawJustifiedParagraph(page, p6, regular, 10, LEFT, y, CONTENT_W, 14, DARK)

  // Expiration date
  y -= 15
  const expDateFormatted = formatDateES(expirationDate)
  const validityText = `Vigencia al ${expDateFormatted}`
  page.drawText(validityText, {
    x: LEFT,
    y,
    size: 10,
    font: bold,
    color: DARK
  })

  // Signatures
  const nameY = 85
  const labelY1 = nameY - 10
  const labelY2 = labelY1 - 10

  // Left signer: Eric Ai
  page.drawText('Eric Ai', { x: LEFT + 45, y: nameY, size: 8.5, font: bold, color: DARK })
  page.drawText('Gerente LATAM', { x: LEFT + 32, y: labelY1, size: 8.5, font: regular, color: GRAY })
  page.drawText('For Jiangsu Bonss Medical Technology Co. Ltd', { x: LEFT + 5, y: labelY2, size: 7, font: regular, color: GRAY })

  // Draw Eric's signature (and stamp)
  page.drawImage(imgEric, {
    x: LEFT + 15,
    y: nameY + 10,
    width: 110,
    height: 55
  })

  // Right signer: Dr. Ricardo Reyes Reyes
  page.drawText('Dr. Ricardo Reyes Reyes', { x: RIGHT - 150, y: nameY, size: 8.5, font: bold, color: DARK })
  page.drawText('Director General', { x: RIGHT - 138, y: labelY1, size: 8.5, font: regular, color: GRAY })
  page.drawText('ARTHROMED', { x: RIGHT - 128, y: labelY2, size: 8.5, font: regular, color: GRAY })

  // Draw Ricardo's signature - bigger while preserving aspect ratio
  const rWidth = 140
  const rHeight = (imgRicardo.height / imgRicardo.width) * rWidth
  
  page.drawImage(imgRicardo, {
    x: RIGHT - 175, // Adjust positioning so it's centered nicely above his name
    y: nameY + 10,
    width: rWidth,
    height: rHeight
  })

  // 5. Save PDF bytes
  const pdfBytes = await pdf.save()

  // 6. Upload PDF to Supabase Storage
  const ext = 'pdf'
  const fileName = `carta_${clientId}_${Date.now()}.${ext}`
  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from('documents')
    .upload(`distribuidores/${fileName}`, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true
    })

  if (uploadError) {
    throw new Error(`Error al subir PDF a Storage: ${uploadError.message}`)
  }

  // Get public URL
  const { data: publicUrlData } = supabaseAdmin.storage
    .from('documents')
    .getPublicUrl(uploadData.path)
  
  const pdfUrl = publicUrlData.publicUrl

  // 7. Update client detail in DB
  const finalExpDate = new Date(expirationDate)
  const updatedClient = await prisma.clients.update({
    where: { id: clientId },
    data: {
      letter_url: pdfUrl,
      letter_created_at: now,
      letter_expires_at: finalExpDate
    }
  })

  // 8. Create a record in `cartas_distribucion`
  const lineNames = lines.map((l: any) => l.name)
  const record = await prisma.cartas_distribucion.create({
    data: {
      empresa_nombre: finalDistName,
      rfc: finalRfc,
      estado_region: client.states ? client.states.join(', ') : '',
      lineas_producto: lineNames,
      vigencia: finalExpDate,
      destinatario: institutionName,
      codigo: client.distributor_id || null,
      created_by: createdBy || null
    }
  })

  return {
    success: true,
    pdfUrl,
    client: updatedClient,
    letterRecord: record
  }
}
