import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { extractAlegraFileUrl, fetchAlegraInvoice } from '@/lib/alegra'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const factura = await prisma.facturas_cliente.findUnique({
      where: { id },
      select: { alegra_id: true, numero_factura: true, estado: true },
    })

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (!factura.alegra_id) {
      return NextResponse.json(
        { error: 'Esta factura no tiene un ID de Alegra asociado' },
        { status: 400 }
      )
    }

    const alegraInvoice = await fetchAlegraInvoice(factura.alegra_id, 'pdf')
    const pdfUrl = extractAlegraFileUrl(alegraInvoice, 'pdf')

    if (!pdfUrl) {
      return NextResponse.json(
        { error: 'PDF no disponible. Las facturas en borrador no generan PDF en Alegra.' },
        { status: 404 }
      )
    }

    const pdfRes = await fetch(pdfUrl)
    if (!pdfRes.ok) {
      return NextResponse.json(
        { error: 'No se pudo descargar el PDF desde Alegra' },
        { status: 502 }
      )
    }

    const pdfBuffer = await pdfRes.arrayBuffer()
    const safeName = (factura.numero_factura || factura.alegra_id).replace(/[^a-zA-Z0-9._-]/g, '_')

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Factura_${safeName}.pdf"`,
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (error: any) {
    console.error('Error downloading invoice PDF:', error)
    return NextResponse.json(
      { error: error.message || 'Error al descargar PDF de factura' },
      { status: 500 }
    )
  }
}