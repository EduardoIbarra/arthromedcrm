import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendInternalNotification } from '@/lib/respond'

export const dynamic = 'force-dynamic'

// GET /api/garantias - List all warranties with optional search & filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const estado = searchParams.get('estado')

    const where: any = {}

    if (estado && estado !== 'all') {
      where.estado = estado
    }

    if (search) {
      where.OR = [
        { cliente_nombre: { contains: search, mode: 'insensitive' } },
        { producto_nombre: { contains: search, mode: 'insensitive' } },
        { numero_serie: { contains: search, mode: 'insensitive' } },
        { modelo: { contains: search, mode: 'insensitive' } },
      ]
    }

    const warranties = await prisma.garantias.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        clients: {
          select: {
            name: true,
            email_primary: true,
            phone: true,
          },
        },
        productos: {
          select: {
            nombre: true,
            categoria: true,
          },
        },
      },
    })

    return NextResponse.json({ data: warranties })
  } catch (err: any) {
    console.error('[GET /api/garantias] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/garantias - Create a new warranty record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      cliente_id,
      cliente_nombre,
      producto_id,
      producto_nombre,
      numero_serie,
      modelo,
      descripcion_falla,
      estado,
      notas,
    } = body

    if (!cliente_nombre || !producto_nombre || !descripcion_falla) {
      return NextResponse.json(
        { error: 'El nombre del cliente, nombre del producto y descripción de la falla son campos obligatorios.' },
        { status: 400 }
      )
    }

    const warranty = await prisma.garantias.create({
      data: {
        cliente_id: cliente_id || null,
        cliente_nombre,
        producto_id: producto_id || null,
        producto_nombre,
        numero_serie: numero_serie || null,
        modelo: modelo || null,
        descripcion_falla,
        estado: estado || 'recibido',
        notas: notas || null,
        fecha_recepcion: new Date(),
      },
      include: {
        clients: {
          select: {
            name: true,
            email_primary: true,
            phone: true,
          },
        },
        productos: {
          select: {
            nombre: true,
            categoria: true,
          },
        },
      },
    })

    // Send WhatsApp notification
    let origin = new URL(request.url).origin;
    if (origin.includes('localhost')) {
      origin = 'https://arthromed.com.mx'; // Prevent AWS WAF blocking "localhost" and allow WhatsApp to generate previews
    }
    const recordUrl = `${origin}/garantias/${warranty.id}`;
    const notificationMessage = `Nueva garantía registrada:\nCliente: ${cliente_nombre}\nProducto: ${producto_nombre}\nFalla: ${descripcion_falla}\n\nVer detalles:\n${recordUrl}`;
    sendInternalNotification(notificationMessage, 'garantias').catch(console.error);

    return NextResponse.json({ data: warranty }, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/garantias] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
