import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, PDFPage, PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import prisma from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const PAGE_W = 612
const PAGE_H = 792
const LEFT = 54
const RIGHT = 558
const CONTENT_W = RIGHT - LEFT

const DARK = rgb(0.12, 0.12, 0.14)
const GRAY = rgb(0.35, 0.37, 0.38)
const LIGHT_GRAY = rgb(0.94, 0.94, 0.95)
const HEADER_NAVY = rgb(0.12, 0.22, 0.38)
const ACCENT_BLUE = rgb(0.07, 0.39, 0.66)
const TEAL = rgb(0.05, 0.45, 0.45)
const FOOTER_MIN_Y = 55

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const dateObj = new Date(d)
  const day = String(dateObj.getUTCDate()).padStart(2, '0')
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
  const year = dateObj.getUTCFullYear()
  return `${day}/${month}/${year}`
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const raw = (text || '').replace(/\s+/g, ' ').trim()
  if (!raw) return ['']

  const words = raw.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
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

    const vacacion = await prisma.vacaciones.findFirst({
      where: { id, deleted_at: null }
    })

    if (!vacacion) {
      return NextResponse.json({ error: 'Solicitud de vacaciones no encontrada' }, { status: 404 })
    }

    // Load PDF background assets and fonts (same as requisiciones PDF)
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

    // Validation QR Code
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = host.startsWith('localhost') ? 'http' : 'https'
    const validationUrl = `${protocol}://${host}/vacaciones/${id}`

    let qrImage: any = null
    try {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(validationUrl)}`
      const qrRes = await fetch(qrApiUrl)
      if (qrRes.ok) {
        qrImage = await pdf.embedPng(new Uint8Array(await qrRes.arrayBuffer()))
      }
    } catch (qrErr) {
      console.error('Failed to generate QR Code:', qrErr)
    }

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

    // ════════════════════════════════════════════════════════════
    // PAGE 1: FORMATO SOLICITUD DE VACACIONES
    // ════════════════════════════════════════════════════════════
    const page1 = pdf.addPage([PAGE_W, PAGE_H])
    page1.drawImage(bg1, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
    drawFooter(page1)

    // Logo & Header
    {
      const logoScale = Math.min(125 / logoImage.width, 40 / logoImage.height)
      const lw = logoImage.width * logoScale
      const lh = logoImage.height * logoScale
      page1.drawImage(logoImage, {
        x: LEFT - 4,
        y: PAGE_H - 16 - lh,
        width: lw,
        height: lh,
      })
    }

    page1.drawText('ARTHROMED', {
      x: RIGHT - bold.widthOfTextAtSize('ARTHROMED', 11),
      y: PAGE_H - 38,
      size: 11,
      font: bold,
      color: DARK,
    })

    const titleStr1 = 'FORMATO SOLICITUD DE VACACIONES'
    page1.drawText(titleStr1, {
      x: (PAGE_W - bold.widthOfTextAtSize(titleStr1, 13)) / 2,
      y: PAGE_H - 95,
      size: 13,
      font: bold,
      color: DARK,
    })

    // QR Image placement
    if (qrImage) {
      page1.drawImage(qrImage, {
        x: RIGHT - 56,
        y: PAGE_H - 150,
        width: 56,
        height: 56,
      })
    }

    // Info Grid
    let y = PAGE_H - 125
    const colLeft1 = LEFT + 5
    const colLeft2 = LEFT + 240

    const drawField1 = (label: string, value: string, gx: number, gy: number) => {
      page1.drawText(label, { x: gx, y: gy, size: 8.5, font: bold, color: DARK })
      page1.drawText(value || '—', { x: gx + 115, y: gy, size: 8.5, font: regular, color: GRAY })
    }

    const tipoText = (vacacion as any).tipo === 'PERMISO' ? 'PERMISO' : 'VACACIONES'
    const goceText = (vacacion as any).con_goce_sueldo === false ? 'SIN GOCE DE SUELDO' : 'CON GOCE DE SUELDO'

    drawField1('No. de Folio:', vacacion.folio, colLeft1, y)
    drawField1('Fecha de Solicitud:', formatDate(vacacion.fecha_solicitud), colLeft2, y)
    y -= 15
    drawField1('Nombre Empleado:', vacacion.empleado_nombre, colLeft1, y)
    drawField1('Cargo que Desempeña:', vacacion.empleado_cargo, colLeft2, y)
    y -= 15
    drawField1('Tipo de Solicitud:', tipoText, colLeft1, y)
    drawField1('Goce de Sueldo:', goceText, colLeft2, y)
    y -= 15
    drawField1('Días Solicitados:', `${vacacion.dias_solicitados} días`, colLeft1, y)
    drawField1('Año / Ejercicio:', vacacion.periodo_correspondiente, colLeft2, y)

    y -= 30

    // Legal Statement Box
    page1.drawRectangle({
      x: LEFT,
      y: y - 55,
      width: CONTENT_W,
      height: 55,
      color: LIGHT_GRAY,
      borderColor: GRAY,
      borderWidth: 0.5,
    })

    const conceptoStr = tipoText === 'PERMISO' ? 'permiso de ausencia' : 'vacaciones'
    const legalText = `Por medio del presente y de conformidad con los artículos 76, 77, y 78 de la Ley Federal del Trabajo, solicito la autorización de ${vacacion.dias_solicitados} días por concepto de ${conceptoStr} (${goceText.toLowerCase()}) correspondientes del ${vacacion.periodo_correspondiente}, las cuales deseo gozar en el siguiente periodo:`
    const legalLines = wrapText(legalText, regular, 8, CONTENT_W - 20)

    let ly = y - 18
    for (const lLine of legalLines) {
      page1.drawText(lLine, { x: LEFT + 10, y: ly, size: 8, font: regular, color: DARK })
      ly -= 12
    }

    y -= 75

    // Dates Header Bar
    page1.drawRectangle({
      x: LEFT,
      y: y - 18,
      width: CONTENT_W,
      height: 18,
      color: HEADER_NAVY,
    })

    page1.drawText('PERIODO SOLICITADO', {
      x: LEFT + 10,
      y: y - 12,
      size: 8,
      font: bold,
      color: rgb(1, 1, 1),
    })

    y -= 18

    // Period Details Table Box
    page1.drawRectangle({
      x: LEFT,
      y: y - 45,
      width: CONTENT_W,
      height: 45,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: GRAY,
      borderWidth: 0.5,
    })

    const py = y - 20
    page1.drawText('FECHA INICIA:', { x: LEFT + 15, y: py, size: 8.5, font: bold, color: DARK })
    page1.drawText(formatDate(vacacion.fecha_inicio), { x: LEFT + 85, y: py, size: 8.5, font: regular, color: DARK })

    page1.drawText('FECHA TERMINA:', { x: LEFT + 170, y: py, size: 8.5, font: bold, color: DARK })
    page1.drawText(formatDate(vacacion.fecha_fin), { x: LEFT + 250, y: py, size: 8.5, font: regular, color: DARK })

    page1.drawText('REGRESANDO A LABORES EL DÍA:', { x: LEFT + 325, y: py, size: 8.5, font: bold, color: TEAL })
    page1.drawText(formatDate(vacacion.fecha_regreso), { x: LEFT + 450, y: py, size: 8.5, font: bold, color: TEAL })

    y -= 70

    // Observaciones Section
    page1.drawText('Observaciones:', { x: LEFT, y, size: 8.5, font: bold, color: DARK })
    const obsText = vacacion.observaciones || 'Sin observaciones.'
    const obsLines = wrapText(obsText, regular, 8, CONTENT_W)
    let obsY = y - 14
    for (const oLine of obsLines.slice(0, 4)) {
      page1.drawText(oLine, { x: LEFT, y: obsY, size: 8, font: regular, color: GRAY })
      obsY -= 12
    }

    // Signature Block Page 1
    const sigY1 = 140
    page1.drawLine({
      start: { x: (PAGE_W / 2) - 100, y: sigY1 },
      end: { x: (PAGE_W / 2) + 100, y: sigY1 },
      thickness: 0.75,
      color: DARK,
    })

    const sigName1 = vacacion.empleado_nombre
    const sigNameW1 = bold.widthOfTextAtSize(sigName1, 8.5)
    page1.drawText(sigName1, { x: (PAGE_W - sigNameW1) / 2, y: sigY1 - 12, size: 8.5, font: bold, color: DARK })

    const sigLabel1 = 'Firma del Empleado'
    const sigLabelW1 = regular.widthOfTextAtSize(sigLabel1, 8)
    page1.drawText(sigLabel1, { x: (PAGE_W - sigLabelW1) / 2, y: sigY1 - 24, size: 8, font: regular, color: GRAY })


    // ════════════════════════════════════════════════════════════
    // PAGE 2: FORMATO AUTORIZACIÓN DE VACACIONES
    // ════════════════════════════════════════════════════════════
    const page2 = pdf.addPage([PAGE_W, PAGE_H])
    page2.drawImage(bg2, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
    drawFooter(page2)

    // Logo & Header
    {
      const logoScale = Math.min(125 / logoImage.width, 40 / logoImage.height)
      const lw = logoImage.width * logoScale
      const lh = logoImage.height * logoScale
      page2.drawImage(logoImage, {
        x: LEFT - 4,
        y: PAGE_H - 16 - lh,
        width: lw,
        height: lh,
      })
    }

    page2.drawText('ARTHROMED', {
      x: RIGHT - bold.widthOfTextAtSize('ARTHROMED', 11),
      y: PAGE_H - 38,
      size: 11,
      font: bold,
      color: DARK,
    })

    const titleStr2 = 'FORMATO AUTORIZACIÓN DE VACACIONES'
    page2.drawText(titleStr2, {
      x: (PAGE_W - bold.widthOfTextAtSize(titleStr2, 13)) / 2,
      y: PAGE_H - 95,
      size: 13,
      font: bold,
      color: DARK,
    })

    // QR Image placement Page 2
    if (qrImage) {
      page2.drawImage(qrImage, {
        x: RIGHT - 56,
        y: PAGE_H - 150,
        width: 56,
        height: 56,
      })
    }

    // Info Grid Page 2
    y = PAGE_H - 125

    const drawField2 = (label: string, value: string, gx: number, gy: number, isStatus: boolean = false) => {
      page2.drawText(label, { x: gx, y: gy, size: 8.5, font: bold, color: DARK })
      const valColor = isStatus
        ? (value === 'AUTORIZADO' ? TEAL : value === 'RECHAZADO' ? rgb(0.8, 0.1, 0.1) : GRAY)
        : GRAY
      page2.drawText(value || '—', { x: gx + 135, y: gy, size: 8.5, font: isStatus ? bold : regular, color: valColor })
    }

    drawField2('No. de Folio:', vacacion.folio, colLeft1, y)
    drawField2('Estatus de la Solicitud:', vacacion.status, colLeft2, y, true)
    y -= 15
    drawField2('Tipo de Solicitud:', tipoText, colLeft1, y)
    drawField2('Goce de Sueldo:', goceText, colLeft2, y)
    y -= 15
    drawField2('Fecha de Autorización:', formatDate(vacacion.fecha_autorizacion), colLeft1, y)
    drawField2('Días Autorizados:', vacacion.dias_autorizados ? `${vacacion.dias_autorizados} días` : `${vacacion.dias_solicitados} días`, colLeft2, y)
    y -= 15
    drawField2('Nombre Autorizador:', vacacion.autorizador_nombre || '—', colLeft1, y)
    drawField2('Cargo que Desempeña:', vacacion.autorizador_cargo || '—', colLeft2, y)

    y -= 30

    // Authorized Period Header Bar
    page2.drawRectangle({
      x: LEFT,
      y: y - 18,
      width: CONTENT_W,
      height: 18,
      color: HEADER_NAVY,
    })

    page2.drawText('PERIODO AUTORIZADO PARA GOCE DE VACACIONES', {
      x: LEFT + 10,
      y: y - 12,
      size: 8,
      font: bold,
      color: rgb(1, 1, 1),
    })

    y -= 18

    // Authorized Period Details Box
    page2.drawRectangle({
      x: LEFT,
      y: y - 45,
      width: CONTENT_W,
      height: 45,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: GRAY,
      borderWidth: 0.5,
    })

    const py2 = y - 20
    const autStart = vacacion.periodo_autorizado_inicio || vacacion.fecha_inicio
    const autEnd = vacacion.periodo_autorizado_fin || vacacion.fecha_fin

    page2.drawText('FECHA INICIA:', { x: LEFT + 20, y: py2, size: 8.5, font: bold, color: DARK })
    page2.drawText(formatDate(autStart), { x: LEFT + 95, y: py2, size: 8.5, font: regular, color: DARK })

    page2.drawText('FECHA TERMINA:', { x: LEFT + 220, y: py2, size: 8.5, font: bold, color: DARK })
    page2.drawText(formatDate(autEnd), { x: LEFT + 305, y: py2, size: 8.5, font: regular, color: DARK })

    page2.drawText('DÍAS AUTORIZADOS:', { x: LEFT + 400, y: py2, size: 8.5, font: bold, color: TEAL })
    page2.drawText(`${vacacion.dias_autorizados || vacacion.dias_solicitados}`, { x: LEFT + 490, y: py2, size: 8.5, font: bold, color: TEAL })

    y -= 70

    // Motivo de rechazo box if rejected
    if (vacacion.status === 'RECHAZADO' || vacacion.motivo_rechazo) {
      page2.drawText('Motivo de Rechazo:', { x: LEFT, y, size: 8.5, font: bold, color: rgb(0.8, 0.1, 0.1) })
      const rejText = vacacion.motivo_rechazo || 'Sin especificar.'
      const rejLines = wrapText(rejText, regular, 8, CONTENT_W)
      let rejY = y - 14
      for (const rLine of rejLines.slice(0, 4)) {
        page2.drawText(rLine, { x: LEFT, y: rejY, size: 8, font: regular, color: DARK })
        rejY -= 12
      }
    }

    // Signature Block Page 2
    const sigY2 = 140
    page2.drawLine({
      start: { x: (PAGE_W / 2) - 100, y: sigY2 },
      end: { x: (PAGE_W / 2) + 100, y: sigY2 },
      thickness: 0.75,
      color: DARK,
    })

    const sigName2 = vacacion.autorizador_nombre || 'Firma de quien Autoriza'
    const sigNameW2 = bold.widthOfTextAtSize(sigName2, 8.5)
    page2.drawText(sigName2, { x: (PAGE_W - sigNameW2) / 2, y: sigY2 - 12, size: 8.5, font: bold, color: DARK })

    const sigLabel2 = 'Firma de quien Autoriza'
    const sigLabelW2 = regular.widthOfTextAtSize(sigLabel2, 8)
    page2.drawText(sigLabel2, { x: (PAGE_W - sigLabelW2) / 2, y: sigY2 - 24, size: 8, font: regular, color: GRAY })

    // Generate PDF bytes
    const pdfBytes = await pdf.save()
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="vacaciones_${vacacion.folio}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating Vacaciones PDF:', error)
    return NextResponse.json({ error: error.message || 'Error al exportar PDF' }, { status: 500 })
  }
}
