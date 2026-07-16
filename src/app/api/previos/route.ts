import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const search = searchParams.get('search')?.toLowerCase() || ''

    const skip = (page - 1) * pageSize

    let where: any = {}

    if (search) {
      const isNumeric = !isNaN(parseFloat(search))
      where = {
        OR: [
          { folio: { contains: search, mode: 'insensitive' } },
          { cliente_nombre: { contains: search, mode: 'insensitive' } },
          ...(isNumeric ? [{ total_con_descuento: { equals: parseFloat(search) } }] : []),
          ...(isNumeric ? [{ total_sin_descuento: { equals: parseFloat(search) } }] : []),
        ]
      }
    }

    const [previos, count] = await Promise.all([
      prisma.previos.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.previos.count({ where })
    ])

    return NextResponse.json({ data: previos, count })
  } catch (error) {
    console.error('Error in /api/previos:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// ─── POST /api/previos — Create a new previo ────────────────────────────────

interface PrevioItem {
  producto_id?: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  iva_porcentaje: number          // e.g. 16
  descuento_porcentaje?: number   // e.g. 10
}

interface CreatePrevioBody {
  cliente_id?: string | null
  cliente_nombre: string
  items: PrevioItem[]
}

async function generateFolio(): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')

  const startOfDay = new Date(today.setHours(0, 0, 0, 0))
  const endOfDay   = new Date(today.setHours(23, 59, 59, 999))

  const count = await prisma.previos.count({
    where: {
      fecha: { gte: startOfDay, lte: endOfDay },
      folio: { startsWith: `PRE-${dateStr}` },
    },
  })

  const seq = String(count + 1).padStart(3, '0')
  return `PRE-${dateStr}-${seq}`
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreatePrevioBody = await request.json()
    const { cliente_id, cliente_nombre, items } = body

    if (!cliente_nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre del cliente es requerido' }, { status: 400 })
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un producto' }, { status: 400 })
    }

    // Map client_id (from supabase clients table) to clientes postgres table id
    let targetClienteId: string | null = null

    if (cliente_id) {
      // Find matching record in postgres 'clientes' table using client_id if possible
      // (or fallback to match by RFC or exact Name)
      const crmClient = await prisma.clients.findUnique({
        where: { id: cliente_id },
        select: { name: true, rfc: true }
      })

      if (crmClient) {
        const conds: any[] = []
        if (crmClient.rfc) conds.push({ rfc: crmClient.rfc })
        conds.push({ nombre: { equals: crmClient.name, mode: 'insensitive' } })

        const dbCliente = await prisma.clientes.findFirst({
          where: { OR: conds },
          select: { id: true }
        })
        if (dbCliente) {
          targetClienteId = dbCliente.id
        }
      }
    }

    const folio = await generateFolio()

    // Compute per-item values
    let totalSinDescuento = 0
    let totalConDescuento = 0
    let totalDescuentoMonto = 0

    const itemsData = items.map((item) => {
      const cantidad    = Number(item.cantidad) || 1
      const precio      = Number(item.precio_unitario) || 0
      const ivaPct      = Number(item.iva_porcentaje) || 0
      const descPct     = Number(item.descuento_porcentaje) || 0

      const importe          = cantidad * precio
      const descuentoMonto   = importe * (descPct / 100)
      const importeNeto      = importe - descuentoMonto
      const ivaMonto         = importeNeto * (ivaPct / 100)
      const subtotal         = importeNeto + ivaMonto

      totalSinDescuento += importe
      totalConDescuento += subtotal
      totalDescuentoMonto += descuentoMonto

      return {
        producto_id:          item.producto_id || null,
        descripcion:          item.descripcion,
        cantidad:             cantidad,
        precio_unitario:      precio,
        importe,
        descuento_porcentaje: descPct,
        descuento_monto:      descuentoMonto,
        iva_porcentaje:       ivaPct,
        iva_monto:            ivaMonto,
        subtotal,
      }
    })

    const previo = await prisma.$transaction(async (tx: typeof prisma) => {
      const created = await tx.previos.create({
        data: {
          folio,
          fecha: new Date(),
          cliente_id:                 targetClienteId || null,
          cliente_nombre,
          total_sin_descuento:        totalSinDescuento,
          total_con_descuento:        totalConDescuento,
          descuento_total_monto:      totalDescuentoMonto,
          descuento_total_porcentaje: totalSinDescuento > 0
            ? (totalDescuentoMonto / totalSinDescuento) * 100
            : 0,
          detalle_previo: {
            createMany: { data: itemsData },
          },
        },
        include: { detalle_previo: true },
      })
      return created
    })

    return NextResponse.json({ data: previo }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/previos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
