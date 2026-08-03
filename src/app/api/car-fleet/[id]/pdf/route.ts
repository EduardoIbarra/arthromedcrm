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
const ACCENT_BLUE = rgb(0.027, 0.388, 0.663)
const LINE_COLOR = rgb(0.85, 0.88, 0.92)
const FOOTER_MIN_Y = 55

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const dateObj = new Date(d)
  const day = String(dateObj.getUTCDate()).padStart(2, '0')
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
  const year = dateObj.getUTCFullYear()
  return `${day}/${month}/${year}`
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return `$${Number(amount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
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

    const car = await prisma.car_fleet.findUnique({
      where: { id },
      include: {
        assigned_to: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            position: true,
            whatsapp: true
          }
        },
        maintenance_logs: {
          orderBy: { date: 'desc' }
        },
        incident_logs: {
          include: {
            reported_by: {
              select: {
                first_name: true,
                last_name: true,
                email: true
              }
            }
          },
          orderBy: { date: 'desc' }
        },
        cirugia_equipo: {
          include: {
            cirugias: {
              select: {
                id: true,
                nombre: true,
                fecha: true,
                paciente: true,
                hospital: true,
                estado: true,
                medico: true
              }
            }
          }
        },
        congreso_members: {
          include: {
            congresos: {
              select: {
                id: true,
                name: true,
                start_date: true,
                end_date: true,
                location: true
              }
            },
            user_profiles: {
              select: {
                first_name: true,
                last_name: true,
                email: true
              }
            }
          }
        },
        congreso_temp_staff: {
          include: {
            congresos: {
              select: {
                id: true,
                name: true,
                start_date: true,
                end_date: true,
                location: true
              }
            }
          }
        },
        congress_workshop_members: {
          include: {
            congress_workshops: {
              select: {
                id: true,
                name: true,
                date_time: true,
                congress_id: true,
                congresos: {
                  select: {
                    name: true,
                    location: true
                  }
                }
              }
            },
            user_profiles: {
              select: {
                first_name: true,
                last_name: true,
                email: true
              }
            }
          }
        },
        workshop_temp_staff: {
          include: {
            congress_workshops: {
              select: {
                id: true,
                name: true,
                date_time: true,
                congress_id: true,
                congresos: {
                  select: {
                    name: true,
                    location: true
                  }
                }
              }
            }
          }
        },
        usage_records: {
          include: {
            user_profiles: {
              select: {
                first_name: true,
                last_name: true,
                email: true
              }
            }
          },
          orderBy: { date_time: 'desc' }
        }
      }
    })

    if (!car) {
      return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 })
    }

    // Build synthesized usage logs
    const usageLogs: Array<{
      type: string
      title: string
      date: string
      location: string
      driverName: string
    }> = []

    car.usage_records?.forEach((ur: any) => {
      const driver = ur.user_profiles
        ? `${ur.user_profiles.first_name || ''} ${ur.user_profiles.last_name || ''}`.trim() || ur.user_profiles.email
        : '—'
      usageLogs.push({
        type: 'Registro Manual',
        title: ur.title,
        date: formatDate(ur.date_time || ur.created_at),
        location: ur.location || '—',
        driverName: driver
      })
    })

    car.cirugia_equipo.forEach((eq: any) => {
      if (eq.cirugias) {
        usageLogs.push({
          type: 'Cirugía',
          title: eq.cirugias.paciente ? `Cirugía - ${eq.cirugias.paciente}` : `Cirugía - ${eq.cirugias.nombre}`,
          date: formatDate(eq.cirugias.fecha || eq.created_at),
          location: eq.cirugias.hospital || '—',
          driverName: eq.guest_name || '—'
        })
      }
    })

    car.congreso_members.forEach((cm: any) => {
      if (cm.congresos) {
        const staff = cm.user_profiles ? `${cm.user_profiles.first_name || ''} ${cm.user_profiles.last_name || ''}`.trim() || cm.user_profiles.email : '—'
        usageLogs.push({
          type: 'Congreso',
          title: `Congreso: ${cm.congresos.name}`,
          date: formatDate(cm.congresos.start_date),
          location: cm.congresos.location || '—',
          driverName: staff
        })
      }
    })

    car.congreso_temp_staff.forEach((cts: any) => {
      if (cts.congresos) {
        usageLogs.push({
          type: 'Congreso',
          title: `Congreso: ${cts.congresos.name}`,
          date: formatDate(cts.congresos.start_date || cts.created_at),
          location: cts.congresos.location || '—',
          driverName: cts.name || '—'
        })
      }
    })

    car.congress_workshop_members.forEach((wm: any) => {
      if (wm.congress_workshops) {
        const staff = wm.user_profiles ? `${wm.user_profiles.first_name || ''} ${wm.user_profiles.last_name || ''}`.trim() || wm.user_profiles.email : '—'
        usageLogs.push({
          type: 'Taller',
          title: `Taller: ${wm.congress_workshops.name}`,
          date: formatDate(wm.congress_workshops.date_time),
          location: wm.congress_workshops.congresos?.location || '—',
          driverName: staff
        })
      }
    })

    car.workshop_temp_staff.forEach((wts: any) => {
      if (wts.congress_workshops) {
        usageLogs.push({
          type: 'Taller',
          title: `Taller: ${wts.congress_workshops.name}`,
          date: formatDate(wts.congress_workshops.date_time || wts.created_at),
          location: wts.congress_workshops.congresos?.location || '—',
          driverName: wts.name || '—'
        })
      }
    })

    // Assets & Fonts
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

    // Generate QR Code URL
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = host.startsWith('localhost') ? 'http' : 'https'
    const vehicleUrl = `${protocol}://${host}/car-fleet/${id}`

    let qrImage: any = null
    try {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(vehicleUrl)}`
      const qrRes = await fetch(qrApiUrl)
      if (qrRes.ok) {
        qrImage = await pdf.embedPng(new Uint8Array(await qrRes.arrayBuffer()))
      }
    } catch (qrErr) {
      console.error('Failed to generate QR Code:', qrErr)
    }

    let page = pdf.addPage([PAGE_W, PAGE_H])
    page.drawImage(bg1, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
    let y = PAGE_H - 55
    let pageNum = 1

    const newPage = () => {
      page = pdf.addPage([PAGE_W, PAGE_H])
      page.drawImage(bg2, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
      pageNum++

      let headerHeight = 60
      if (logoImage) {
        const maxWidth = 130
        const maxHeight = 40
        const logoScale = Math.min(maxWidth / logoImage.width, maxHeight / logoImage.height)
        const lw = logoImage.width * logoScale
        const lh = logoImage.height * logoScale
        page.drawImage(logoImage, { x: LEFT, y: PAGE_H - 20 - lh, width: lw, height: lh })
        headerHeight = Math.max(headerHeight, 20 + lh + 10)
      }

      const hdr = 'ARTHROMED ERP | EXPEDIENTE VEHICULAR'
      page.drawText(hdr, {
        x: RIGHT - bold.widthOfTextAtSize(hdr, 9),
        y: PAGE_H - 45,
        size: 9,
        font: bold,
        color: GRAY,
      })

      y = PAGE_H - headerHeight - 20
    }

    const ensureSpace = (needed: number) => {
      if (y - needed < FOOTER_MIN_Y + 20) {
        newPage()
      }
    }

    // === PAGE 1 HEADER ===
    let headerHeight = 60
    if (logoImage) {
      const maxWidth = 130
      const maxHeight = 40
      const logoScale = Math.min(maxWidth / logoImage.width, maxHeight / logoImage.height)
      const lw = logoImage.width * logoScale
      const lh = logoImage.height * logoScale
      page.drawImage(logoImage, { x: LEFT, y: PAGE_H - 20 - lh, width: lw, height: lh })
      headerHeight = Math.max(headerHeight, 20 + lh + 10)
    }

    // Top Right Info Block
    const now = new Date()
    const dateStr = `Fecha de Emisión: ${formatDate(now)}`
    page.drawText('EXPEDIENTE VEHICULAR', {
      x: RIGHT - bold.widthOfTextAtSize('EXPEDIENTE VEHICULAR', 12),
      y: PAGE_H - 42,
      size: 12,
      font: bold,
      color: ACCENT_BLUE,
    })
    page.drawText(dateStr, {
      x: RIGHT - regular.widthOfTextAtSize(dateStr, 9),
      y: PAGE_H - 56,
      size: 9,
      font: regular,
      color: GRAY,
    })

    y = PAGE_H - headerHeight - 25

    // Title Section
    const titleText = (car.alias || `${car.make} ${car.model}`).toUpperCase()
    page.drawText(titleText, {
      x: LEFT,
      y,
      size: 16,
      font: bold,
      color: DARK
    })
    y -= 16

    const subtitleText = `${car.make} ${car.model} (${car.year}) — PLACAS: ${car.plate_number}`
    page.drawText(subtitleText, {
      x: LEFT,
      y,
      size: 10,
      font: bold,
      color: ACCENT_BLUE
    })
    y -= 25

    // === GENERAL INFO & QR CARD BLOCK ===
    const cardHeight = 100
    page.drawRectangle({
      x: LEFT,
      y: y - cardHeight,
      width: CONTENT_W,
      height: cardHeight,
      color: LIGHT_GRAY,
      borderColor: LINE_COLOR,
      borderWidth: 1
    })

    // Draw Conductor & Specs
    let infoY = y - 18
    const infoX = LEFT + 15

    const statusLabel = car.status === 'available' ? 'Disponible' : car.status === 'in_use' ? 'En Uso' : 'Mantenimiento'
    const conductorName = car.assigned_to
      ? `${car.assigned_to.first_name || ''} ${car.assigned_to.last_name || ''}`.trim() || car.assigned_to.email
      : 'No asignado'

    const infoRows = [
      { label: 'Estatus Actual:', val: statusLabel },
      { label: 'Conductor Asignado:', val: conductorName },
      { label: 'Color:', val: car.color || 'No especificado' },
      { label: 'Notas:', val: car.notes || 'Sin observaciones' }
    ]

    for (const r of infoRows) {
      page.drawText(r.label, { x: infoX, y: infoY, size: 9, font: bold, color: HEADER_NAVY })
      const labelW = bold.widthOfTextAtSize(r.label, 9)
      const valLines = wrapText(r.val, regular, 9, CONTENT_W - 155)
      page.drawText(valLines[0], { x: infoX + labelW + 6, y: infoY, size: 9, font: regular, color: DARK })
      infoY -= 18
    }

    // Embed QR Code inside Card (Right side)
    if (qrImage) {
      const qrSize = 75
      const qrX = RIGHT - 15 - qrSize
      const qrY = y - cardHeight + (cardHeight - qrSize) / 2
      page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })

      page.drawText('Escanear QR', {
        x: qrX + (qrSize - bold.widthOfTextAtSize('Escanear QR', 7)) / 2,
        y: qrY - 10,
        size: 7,
        font: bold,
        color: GRAY
      })
    }

    y -= cardHeight + 30

    // Helper: Draw Section Header Bar
    const drawSectionHeader = (title: string) => {
      ensureSpace(35)
      page.drawRectangle({
        x: LEFT,
        y: y - 18,
        width: CONTENT_W,
        height: 22,
        color: HEADER_NAVY
      })
      page.drawText(title, {
        x: LEFT + 10,
        y: y - 13,
        size: 10,
        font: bold,
        color: rgb(1, 1, 1)
      })
      y -= 30
    }

    // === SECTION 1: MANTENIMIENTOS ===
    drawSectionHeader('HISTORIAL DE MANTENIMIENTOS Y SERVICIOS')

    if (car.maintenance_logs && car.maintenance_logs.length > 0) {
      // Table Header
      ensureSpace(20)
      page.drawRectangle({ x: LEFT, y: y - 16, width: CONTENT_W, height: 18, color: LIGHT_GRAY })
      page.drawText('Servicio / Título', { x: LEFT + 8, y: y - 12, size: 8, font: bold, color: GRAY })
      page.drawText('Fecha', { x: LEFT + 190, y: y - 12, size: 8, font: bold, color: GRAY })
      page.drawText('Estatus', { x: LEFT + 270, y: y - 12, size: 8, font: bold, color: GRAY })
      page.drawText('Próx. Fecha', { x: LEFT + 340, y: y - 12, size: 8, font: bold, color: GRAY })
      page.drawText('Costo', { x: RIGHT - 75, y: y - 12, size: 8, font: bold, color: GRAY })
      y -= 22

      for (const log of car.maintenance_logs) {
        ensureSpace(18)
        const titleLine = wrapText(log.title, regular, 8, 175)[0]
        const stLabel = log.status === 'completed' ? 'Completado' : log.status === 'in_progress' ? 'En Proceso' : 'Programado'

        page.drawText(titleLine, { x: LEFT + 8, y, size: 8, font: regular, color: DARK })
        page.drawText(formatDate(log.date), { x: LEFT + 190, y, size: 8, font: regular, color: DARK })
        page.drawText(stLabel, { x: LEFT + 270, y, size: 8, font: regular, color: DARK })
        page.drawText(formatDate(log.next_due_date), { x: LEFT + 340, y, size: 8, font: regular, color: DARK })
        page.drawText(formatCurrency(log.cost ? Number(log.cost) : null), { x: RIGHT - 75, y, size: 8, font: bold, color: DARK })

        page.drawLine({ start: { x: LEFT, y: y - 4 }, end: { x: RIGHT, y: y - 4 }, thickness: 0.5, color: LINE_COLOR })
        y -= 16
      }
      y -= 15
    } else {
      ensureSpace(20)
      page.drawText('Sin registros de mantenimiento.', { x: LEFT + 10, y, size: 9, font: regular, color: GRAY })
      y -= 25
    }

    // === SECTION 2: INCIDENCIAS ===
    drawSectionHeader('REPORTES DE INCIDENCIAS Y PERCANCES')

    if (car.incident_logs && car.incident_logs.length > 0) {
      ensureSpace(20)
      page.drawRectangle({ x: LEFT, y: y - 16, width: CONTENT_W, height: 18, color: LIGHT_GRAY })
      page.drawText('Incidencia', { x: LEFT + 8, y: y - 12, size: 8, font: bold, color: GRAY })
      page.drawText('Gravedad', { x: LEFT + 180, y: y - 12, size: 8, font: bold, color: GRAY })
      page.drawText('Fecha', { x: LEFT + 260, y: y - 12, size: 8, font: bold, color: GRAY })
      page.drawText('Estatus', { x: LEFT + 330, y: y - 12, size: 8, font: bold, color: GRAY })
      page.drawText('Costo / Daño', { x: RIGHT - 75, y: y - 12, size: 8, font: bold, color: GRAY })
      y -= 22

      for (const inc of car.incident_logs) {
        ensureSpace(18)
        const incTitle = wrapText(inc.title, regular, 8, 165)[0]
        const sevLabel = inc.severity === 'minor' ? 'Leve' : inc.severity === 'moderate' ? 'Moderada' : 'Grave'
        const stLabel = inc.status === 'resolved' ? 'Resuelto' : inc.status === 'under_review' ? 'En Revisión' : 'Abierto'

        page.drawText(incTitle, { x: LEFT + 8, y, size: 8, font: regular, color: DARK })
        page.drawText(sevLabel, { x: LEFT + 180, y, size: 8, font: regular, color: DARK })
        page.drawText(formatDate(inc.date), { x: LEFT + 260, y, size: 8, font: regular, color: DARK })
        page.drawText(stLabel, { x: LEFT + 330, y, size: 8, font: regular, color: DARK })
        page.drawText(formatCurrency(inc.cost ? Number(inc.cost) : null), { x: RIGHT - 75, y, size: 8, font: bold, color: DARK })

        page.drawLine({ start: { x: LEFT, y: y - 4 }, end: { x: RIGHT, y: y - 4 }, thickness: 0.5, color: LINE_COLOR })
        y -= 16
      }
      y -= 15
    } else {
      ensureSpace(20)
      page.drawText('Sin incidencias ni percances reportados.', { x: LEFT + 10, y, size: 9, font: regular, color: GRAY })
      y -= 25
    }

    // === SECTION 3: USAGE LOGS (CIRUGIAS, TALLERES, CONGRESOS) ===
    drawSectionHeader('HISTORIAL DE USO (CIRUGÍAS, TALLERES Y CONGRESOS)')

    if (usageLogs.length > 0) {
      ensureSpace(20)
      page.drawRectangle({ x: LEFT, y: y - 16, width: CONTENT_W, height: 18, color: LIGHT_GRAY })
      page.drawText('Evento / Tipo', { x: LEFT + 8, y: y - 12, size: 8, font: bold, color: GRAY })
      page.drawText('Fecha', { x: LEFT + 220, y: y - 12, size: 8, font: bold, color: GRAY })
      page.drawText('Sede / Ubicación', { x: LEFT + 300, y: y - 12, size: 8, font: bold, color: GRAY })
      page.drawText('Conductor / Staff', { x: RIGHT - 100, y: y - 12, size: 8, font: bold, color: GRAY })
      y -= 22

      for (const uLog of usageLogs) {
        ensureSpace(18)
        const eventTitle = wrapText(uLog.title, regular, 8, 205)[0]
        const locLine = wrapText(uLog.location, regular, 8, 90)[0]
        const driverLine = wrapText(uLog.driverName, regular, 8, 95)[0]

        page.drawText(eventTitle, { x: LEFT + 8, y, size: 8, font: regular, color: DARK })
        page.drawText(uLog.date, { x: LEFT + 220, y, size: 8, font: regular, color: DARK })
        page.drawText(locLine, { x: LEFT + 300, y, size: 8, font: regular, color: DARK })
        page.drawText(driverLine, { x: RIGHT - 100, y, size: 8, font: regular, color: DARK })

        page.drawLine({ start: { x: LEFT, y: y - 4 }, end: { x: RIGHT, y: y - 4 }, thickness: 0.5, color: LINE_COLOR })
        y -= 16
      }
    } else {
      ensureSpace(20)
      page.drawText('Sin registros de asignación en eventos.', { x: LEFT + 10, y, size: 9, font: regular, color: GRAY })
      y -= 25
    }

    // === FOOTER ON ALL PAGES ===
    const totalPages = pageNum
    const pages = pdf.getPages()

    for (let i = 0; i < totalPages; i++) {
      const p = pages[i]
      const footerLines = [
        'Av. Zacatecas #128, Constituyentes del 17, San Nicolás de los Garza, CP 66410 Nuevo León, México.',
        'Tel. 812-429-5408 | 812-429-8573  •  gerencia@arthromed.com.mx',
      ]
      let fy = 48
      for (const fl of footerLines) {
        const flw = regular.widthOfTextAtSize(fl, 7.5)
        p.drawText(fl, {
          x: (PAGE_W - flw) / 2,
          y: fy,
          size: 7.5,
          font: regular,
          color: GRAY,
        })
        fy -= 10
      }

      const pgStr = `Página ${i + 1} de ${totalPages}`
      p.drawText(pgStr, {
        x: RIGHT - regular.widthOfTextAtSize(pgStr, 7.5),
        y: 28,
        size: 7.5,
        font: regular,
        color: GRAY,
      })
    }

    const pdfBytes = await pdf.save()
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })

    const filename = `Expediente_${car.plate_number || car.id}.pdf`

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`
      }
    })
  } catch (err: any) {
    console.error('Error generating vehicle PDF:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
