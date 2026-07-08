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
      select: { alegra_id: true, numero_factura: true, xml_original: true },
    })

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    const safeName = (factura.numero_factura || factura.alegra_id || id).replace(/[^a-zA-Z0-9._-]/g, '_')

    if (factura.alegra_id) {
      try {
        const alegraInvoice = await fetchAlegraInvoice(factura.alegra_id, 'xml')
        const xmlUrl = extractAlegraFileUrl(alegraInvoice, 'xml')

        if (xmlUrl) {
          const xmlRes = await fetch(xmlUrl)
          if (xmlRes.ok) {
            const xmlBuffer = await xmlRes.arrayBuffer()
            return new NextResponse(xmlBuffer, {
              headers: {
                'Content-Type': 'application/xml',
                'Content-Disposition': `attachment; filename="Factura_${safeName}.xml"`,
                'Cache-Control': 'private, no-cache',
              },
            })
          }
        }
      } catch (alegraError) {
        console.warn('Alegra XML fetch failed, trying xml_original fallback:', alegraError)
      }
    }

    if (factura.xml_original) {
      return new NextResponse(factura.xml_original, {
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="Factura_${safeName}.xml"`,
          'Cache-Control': 'private, no-cache',
        },
      })
    }

    return NextResponse.json(
      { error: 'XML no disponible para esta factura' },
      { status: 404 }
    )
  } catch (error: any) {
    console.error('Error downloading invoice XML:', error)
    return NextResponse.json(
      { error: error.message || 'Error al descargar XML de factura' },
      { status: 500 }
    )
  }
}