import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import prisma from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import QRCode from 'qrcode'

export const dynamic = 'force-dynamic'

const PAGE_W = 612
const PAGE_H = 792
const LEFT = 54
const RIGHT = 558
const CONTENT_W = RIGHT - LEFT

const DARK = rgb(0.14, 0.14, 0.16)
const BLUE = rgb(0.027, 0.388, 0.663)
const GRAY = rgb(0.45, 0.47, 0.48)
const LIGHT_GRAY = rgb(0.96, 0.96, 0.98)
const BORDER_COLOR = rgb(0.88, 0.90, 0.92)

function formatCurrency(val: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
}

function formatDate(date: Date) {
  return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const previo = await prisma.previos.findUnique({
      where: { id },
      include: {
        detalle_previo: true,
        clientes: true,
      }
    })

    if (!previo) {
      return NextResponse.json({ error: 'Previo no encontrado' }, { status: 404 })
    }

    // 1. Load background image template (machote1) and logo
    const machotePath = path.join(process.cwd(), 'resources', 'img', 'machote1.jpeg')
    const logoCandidates = [
      path.join(process.cwd(), 'resources', 'img', 'ARTHROMED OFICIAL.png'),
      path.join(process.cwd(), 'public', 'logo.png'),
      path.join(process.cwd(), 'scripts', 'arthromed_logo.png'),
    ]
    let bg1: any = null
    let logoImage: any = null
    
    const pdf = await PDFDocument.create()
    const regular = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

    if (fs.existsSync(machotePath)) {
      const machoteBytes = fs.readFileSync(machotePath)
      bg1 = await pdf.embedJpg(machoteBytes)
    }

    const logoPath = logoCandidates.find(p => fs.existsSync(p))
    if (logoPath) {
      const logoBytes = fs.readFileSync(logoPath)
      logoImage = await pdf.embedPng(logoBytes)
    }

    const page = pdf.addPage([PAGE_W, PAGE_H])

    // Draw background
    if (bg1) {
      page.drawImage(bg1, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
    }

    // Draw Logo (upper left corner)
    if (logoImage) {
      const maxWidth = 140
      const maxHeight = 50
      const logoScale = Math.min(maxWidth / logoImage.width, maxHeight / logoImage.height)
      const lw = logoImage.width * logoScale
      const lh = logoImage.height * logoScale
      page.drawImage(logoImage, {
        x: LEFT - 15,
        y: PAGE_H - 20 - lh,
        width: lw,
        height: lh
      })
    }

    // 2. Draw Previo header/folio (top right)
    const titleText = 'PREVIO DE COMPRA'
    const titleWidth = bold.widthOfTextAtSize(titleText, 16)
    page.drawText(titleText, {
      x: RIGHT - titleWidth,
      y: PAGE_H - 90,
      size: 16,
      font: bold,
      color: BLUE
    })

    const folioText = `Folio: ${previo.folio}`
    const folioWidth = bold.widthOfTextAtSize(folioText, 11)
    page.drawText(folioText, {
      x: RIGHT - folioWidth,
      y: PAGE_H - 105,
      size: 11,
      font: bold,
      color: DARK
    })

    const fechaText = `Fecha: ${formatDate(new Date(previo.fecha))}`
    const fechaWidth = regular.widthOfTextAtSize(fechaText, 9)
    page.drawText(fechaText, {
      x: RIGHT - fechaWidth,
      y: PAGE_H - 120,
      size: 9,
      font: regular,
      color: GRAY
    })

    // 3. Draw Client detail card (middle)
    let y = PAGE_H - 160

    // Client Info Box Background
    page.drawRectangle({
      x: LEFT,
      y: y - 75,
      width: CONTENT_W,
      height: 75,
      color: LIGHT_GRAY,
      borderColor: BORDER_COLOR,
      borderWidth: 1
    })

    page.drawText('DATOS DEL CLIENTE', {
      x: LEFT + 12,
      y: y - 16,
      size: 9,
      font: bold,
      color: BLUE
    })

    page.drawText(`Cliente: ${previo.cliente_nombre || 'No especificado'}`, {
      x: LEFT + 12,
      y: y - 32,
      size: 10,
      font: bold,
      color: DARK
    })

    if (previo.clientes?.rfc) {
      page.drawText(`RFC: ${previo.clientes.rfc}`, {
        x: LEFT + 12,
        y: y - 46,
        size: 9,
        font: regular,
        color: GRAY
      })
    }

    if (previo.clientes?.direccion) {
      page.drawText(`Dirección: ${previo.clientes.direccion}`, {
        x: LEFT + 12,
        y: y - 60,
        size: 8,
        font: regular,
        color: GRAY
      })
    }

    y -= 90

    // 4. Products table
    // Table Header
    page.drawRectangle({
      x: LEFT,
      y: y - 20,
      width: CONTENT_W,
      height: 20,
      color: BLUE
    })

    const colCodeX = LEFT + 8
    const colDescX = LEFT + 85
    const colCantX = LEFT + 325
    const colPriceX = LEFT + 425
    const colImporteX = RIGHT - 8

    page.drawText('CÓDIGO', { x: colCodeX, y: y - 14, size: 8, font: bold, color: rgb(1,1,1) })
    page.drawText('DESCRIPCIÓN', { x: colDescX, y: y - 14, size: 8, font: bold, color: rgb(1,1,1) })
    
    const cantHeader = 'CANT'
    page.drawText(cantHeader, { x: colCantX - bold.widthOfTextAtSize(cantHeader, 8), y: y - 14, size: 8, font: bold, color: rgb(1,1,1) })
    
    const priceHeader = 'P. UNITARIO'
    page.drawText(priceHeader, { x: colPriceX - bold.widthOfTextAtSize(priceHeader, 8), y: y - 14, size: 8, font: bold, color: rgb(1,1,1) })
    
    const impHeader = 'IMPORTE'
    page.drawText(impHeader, { x: colImporteX - bold.widthOfTextAtSize(impHeader, 8), y: y - 14, size: 8, font: bold, color: rgb(1,1,1) })

    y -= 20

    // Draw rows
    if (previo.detalle_previo && previo.detalle_previo.length > 0) {
      for (const item of previo.detalle_previo) {
        // Draw grid lines
        page.drawRectangle({
          x: LEFT,
          y: y - 22,
          width: CONTENT_W,
          height: 22,
          color: rgb(1,1,1),
          borderColor: BORDER_COLOR,
          borderWidth: 0.5
        })

        const code = item.producto_id ? item.producto_id.substring(0, 8) : '-'
        const desc = item.descripcion || 'Producto'
        const qty = String(item.cantidad)
        const price = formatCurrency(Number(item.precio_unitario || 0))
        const imp = formatCurrency(Number(item.importe || 0))

        page.drawText(code.substring(0, 16), { x: colCodeX, y: y - 15, size: 8, font: regular, color: DARK })
        page.drawText(desc.substring(0, 40), { x: colDescX, y: y - 15, size: 8, font: regular, color: DARK })
        page.drawText(qty, { x: colCantX - regular.widthOfTextAtSize(qty, 8), y: y - 15, size: 8, font: regular, color: DARK })
        page.drawText(price, { x: colPriceX - regular.widthOfTextAtSize(price, 8), y: y - 15, size: 8, font: regular, color: DARK })
        page.drawText(imp, { x: colImporteX - bold.widthOfTextAtSize(imp, 8), y: y - 15, size: 8, font: bold, color: DARK })

        y -= 22

        if (y < 120) {
          break
        }
      }
    } else {
      page.drawRectangle({
        x: LEFT,
        y: y - 30,
        width: CONTENT_W,
        height: 30,
        color: rgb(1,1,1),
        borderColor: BORDER_COLOR,
        borderWidth: 0.5
      })
      page.drawText('No se encontraron partidas en este previo.', {
        x: LEFT + 20,
        y: y - 18,
        size: 9,
        font: regular,
        color: GRAY
      })
      y -= 30
    }

    // Generate QR Code pointing to this previo's page
    const host = request.headers.get('host') || 'erp.arthromed.com.mx'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const qrUrl = `${protocol}://${host}/previos/${previo.id}`
    const qrBuffer = await QRCode.toBuffer(qrUrl, { type: 'png', margin: 1, width: 100 })
    const qrImage = await pdf.embedPng(qrBuffer)

    // 5. Draw totals box
    y -= 15
    const totalsW = 200
    const totalsX = RIGHT - totalsW

    page.drawRectangle({
      x: totalsX,
      y: y - 55,
      width: totalsW,
      height: 55,
      color: LIGHT_GRAY,
      borderColor: BORDER_COLOR,
      borderWidth: 1
    })

    const subStr = formatCurrency(Number(previo.total_sin_descuento || 0))
    const descStr = formatCurrency(Number(previo.descuento_total_monto || 0))
    const totStr = formatCurrency(Number(previo.total_con_descuento || 0))

    page.drawText('Subtotal:', { x: totalsX + 10, y: y - 15, size: 8, font: regular, color: GRAY })
    page.drawText(subStr, { x: RIGHT - 10 - regular.widthOfTextAtSize(subStr, 8), y: y - 15, size: 8, font: regular, color: DARK })

    page.drawText('Descuento:', { x: totalsX + 10, y: y - 28, size: 8, font: regular, color: GRAY })
    page.drawText(descStr, { x: RIGHT - 10 - regular.widthOfTextAtSize(descStr, 8), y: y - 28, size: 8, font: regular, color: DARK })

    page.drawText('Total:', { x: totalsX + 10, y: y - 44, size: 9, font: bold, color: BLUE })
    page.drawText(totStr, { x: RIGHT - 10 - bold.widthOfTextAtSize(totStr, 10), y: y - 44, size: 10, font: bold, color: BLUE })

    // Draw QR code next to totals box (aligned to the bottom of the totals box)
    const qrSize = 70
    page.drawImage(qrImage, {
      x: LEFT,
      y: y - 62,
      width: qrSize,
      height: qrSize
    })

    const pdfBytes = await pdf.save()

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PrevioFactura_${previo.folio}.pdf"`
      }
    })
  } catch (err: any) {
    console.error('[GET /api/previos/[id]/pdf] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
