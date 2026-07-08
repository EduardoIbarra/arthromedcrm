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

    const quote = await prisma.cotizaciones.findUnique({
      where: { id },
      include: {
        clientes: true,
        cfdi: true,
        metodo_pago: true,
        forma_pago: true,
        productos: {
          orderBy: { created_at: 'asc' }
        }
      }
    })

    if (!quote) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    }

    // 1. Load background image template and logo
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

    // 2. Draw Cotización header/folio (top right)
    const titleText = 'PREVIO DE FACTURA'
    const titleWidth = bold.widthOfTextAtSize(titleText, 16)
    page.drawText(titleText, {
      x: RIGHT - titleWidth,
      y: PAGE_H - 90,
      size: 16,
      font: bold,
      color: BLUE
    })

    const folioText = `Folio: ${quote.numero_cotizacion}`
    const folioWidth = bold.widthOfTextAtSize(folioText, 11)
    page.drawText(folioText, {
      x: RIGHT - folioWidth,
      y: PAGE_H - 105,
      size: 11,
      font: bold,
      color: DARK
    })

    const fechaText = `Fecha: ${formatDate(new Date(quote.fecha_expedicion))}`
    const fechaWidth = regular.widthOfTextAtSize(fechaText, 9)
    page.drawText(fechaText, {
      x: RIGHT - fechaWidth,
      y: PAGE_H - 120,
      size: 9,
      font: regular,
      color: GRAY
    })

    if (quote.fecha_vencimiento) {
      const venceText = `Vence: ${formatDate(new Date(quote.fecha_vencimiento))}`
      const venceWidth = regular.widthOfTextAtSize(venceText, 9)
      page.drawText(venceText, {
        x: RIGHT - venceWidth,
        y: PAGE_H - 132,
        size: 9,
        font: regular,
        color: GRAY
      })
    }

    // 3. Draw Client / Invoice detail card (middle)
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

    page.drawText(`Cliente: ${quote.cliente_nombre}`, {
      x: LEFT + 12,
      y: y - 32,
      size: 10,
      font: bold,
      color: DARK
    })

    if (quote.cliente_rfc) {
      page.drawText(`RFC: ${quote.cliente_rfc}`, {
        x: LEFT + 12,
        y: y - 46,
        size: 9,
        font: regular,
        color: GRAY
      })
    }

    if (quote.clientes?.direccion) {
      page.drawText(`Dirección: ${quote.clientes.direccion}`, {
        x: LEFT + 12,
        y: y - 60,
        size: 8,
        font: regular,
        color: GRAY
      })
    }

    y -= 90

    // 4. CFDI / Metodo / Forma de pago details (small grid)
    page.drawRectangle({
      x: LEFT,
      y: y - 45,
      width: CONTENT_W,
      height: 40,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: BORDER_COLOR,
      borderWidth: 1
    })

    const cfdiText = quote.cfdi ? `${quote.cfdi.id} - ${quote.cfdi.descripcion}` : 'No especificado'
    const metodoText = quote.metodo_pago ? `${quote.metodo_pago.id} - ${quote.metodo_pago.descripcion}` : 'No especificado'
    const formaText = quote.forma_pago ? `${quote.forma_pago.id} - ${quote.forma_pago.descripcion}` : 'No especificado'

    page.drawText('Uso CFDI:', { x: LEFT + 10, y: y - 16, size: 8, font: bold, color: DARK })
    page.drawText(cfdiText.substring(0, 32), { x: LEFT + 10, y: y - 30, size: 8, font: regular, color: GRAY })

    page.drawText('Método de Pago:', { x: LEFT + 180, y: y - 16, size: 8, font: bold, color: DARK })
    page.drawText(metodoText.substring(0, 32), { x: LEFT + 180, y: y - 30, size: 8, font: regular, color: GRAY })

    page.drawText('Forma de Pago:', { x: LEFT + 350, y: y - 16, size: 8, font: bold, color: DARK })
    page.drawText(formaText.substring(0, 32), { x: LEFT + 350, y: y - 30, size: 8, font: regular, color: GRAY })

    y -= 60

    // 5. Products table
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
    if (quote.productos && quote.productos.length > 0) {
      for (const prod of quote.productos) {
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

        const code = prod.producto_codigo || '-'
        const desc = prod.producto_nombre || 'Producto'
        const qty = String(prod.cantidad)
        const price = formatCurrency(Number(prod.precio_unitario || 0))
        const imp = formatCurrency(Number(prod.importe || 0))

        page.drawText(code.substring(0, 16), { x: colCodeX, y: y - 15, size: 8, font: regular, color: DARK })
        page.drawText(desc.substring(0, 40), { x: colDescX, y: y - 15, size: 8, font: regular, color: DARK })
        page.drawText(qty, { x: colCantX - regular.widthOfTextAtSize(qty, 8), y: y - 15, size: 8, font: regular, color: DARK })
        page.drawText(price, { x: colPriceX - regular.widthOfTextAtSize(price, 8), y: y - 15, size: 8, font: regular, color: DARK })
        page.drawText(imp, { x: colImporteX - bold.widthOfTextAtSize(imp, 8), y: y - 15, size: 8, font: bold, color: DARK })

        y -= 22

        // Avoid overflow (basic wrapper)
        if (y < 120) {
          // If we run out of page space, just break or handle multi-page. 
          // For quotes, a single page is standard, so we truncate list or keep it compact.
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
      page.drawText('No se encontraron partidas en esta cotización.', {
        x: LEFT + 20,
        y: y - 18,
        size: 9,
        font: regular,
        color: GRAY
      })
      y -= 30
    }

    // Generate QR Code
    const host = request.headers.get('host') || 'erp.arthromed.com.mx'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const qrUrl = `${protocol}://${host}/cotizaciones/${quote.id}`
    const qrBuffer = await QRCode.toBuffer(qrUrl, { type: 'png', margin: 1, width: 100 })
    const qrImage = await pdf.embedPng(qrBuffer)

    // 6. Draw totals box
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

    const subStr = formatCurrency(Number(quote.subtotal || 0))
    const ivaStr = formatCurrency(Number(quote.iva || 0))
    const totStr = formatCurrency(Number(quote.total || 0))

    page.drawText('Subtotal:', { x: totalsX + 10, y: y - 15, size: 8, font: regular, color: GRAY })
    page.drawText(subStr, { x: RIGHT - 10 - regular.widthOfTextAtSize(subStr, 8), y: y - 15, size: 8, font: regular, color: DARK })

    page.drawText('IVA:', { x: totalsX + 10, y: y - 28, size: 8, font: regular, color: GRAY })
    page.drawText(ivaStr, { x: RIGHT - 10 - regular.widthOfTextAtSize(ivaStr, 8), y: y - 28, size: 8, font: regular, color: DARK })

    page.drawText('Total:', { x: totalsX + 10, y: y - 44, size: 9, font: bold, color: BLUE })
    page.drawText(totStr, { x: RIGHT - 10 - bold.widthOfTextAtSize(totStr, 10), y: y - 44, size: 10, font: bold, color: BLUE })

    // Draw QR code next to totals box (aligned to the bottom of the totals box)
    const qrSize = 55
    page.drawImage(qrImage, {
      x: LEFT,
      y: y - 55,
      width: qrSize,
      height: qrSize
    })

    y -= 70

    // Observations
    if (quote.observaciones) {
      page.drawText('Observaciones:', { x: LEFT, y: y, size: 8, font: bold, color: DARK })
      page.drawText(quote.observaciones.substring(0, 120), { x: LEFT, y: y - 14, size: 8, font: regular, color: GRAY })
    }

    const pdfBytes = await pdf.save()

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PrevioFactura_${quote.numero_cotizacion}.pdf"`
      }
    })
  } catch (err: any) {
    console.error('[GET /api/cotizaciones/[id]/pdf] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
