import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const email = process.env.ALEGRA_API_EMAIL
    const token = process.env.ALEGRA_API_TOKEN

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Las credenciales de Alegra no están configuradas.' },
        { status: 400 }
      )
    }

    // Load previo + items + client info
    const previo = await prisma.previos.findUnique({
      where: { id },
      include: {
        detalle_previo: true,
        clientes: { select: { id: true, rfc: true, nombre: true } },
      },
    })

    if (!previo) {
      return NextResponse.json({ error: 'Previo no encontrado' }, { status: 404 })
    }

    const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`

    // ── Resolve the Alegra contact ID ────────────────────────────────────────
    let alegraContactId: string | number | null = null

    const clienteRfc  = previo.clientes?.rfc?.trim()
    const clienteNombre = (previo.clientes?.nombre || previo.cliente_nombre || '').trim()

    // Search by RFC first
    if (clienteRfc) {
      const rfcRes = await fetch(
        `https://api.alegra.com/api/v1/contacts?identification=${encodeURIComponent(clienteRfc)}`,
        { headers: { Authorization: authHeader, Accept: 'application/json' } }
      )
      if (rfcRes.ok) {
        const rfcData = await rfcRes.json()
        const contacts = Array.isArray(rfcData) ? rfcData : []
        if (contacts.length > 0) alegraContactId = contacts[0].id
      }
    }

    // Fallback: search by name
    if (!alegraContactId && clienteNombre) {
      const nameRes = await fetch(
        `https://api.alegra.com/api/v1/contacts?name=${encodeURIComponent(clienteNombre)}`,
        { headers: { Authorization: authHeader, Accept: 'application/json' } }
      )
      if (nameRes.ok) {
        const nameData = await nameRes.json()
        const contacts = Array.isArray(nameData) ? nameData : []
        if (contacts.length > 0) alegraContactId = contacts[0].id
      }
    }

    type DetallePrevioItem = typeof previo.detalle_previo[number]

    // ── Resolve Alegra item IDs for each line ────────────────────────────────
    // Build a map: consecutivo_alg → alegra item id
    const productIds = previo.detalle_previo
      .filter((d: DetallePrevioItem) => d.producto_id)
      .map((d: DetallePrevioItem) => d.producto_id!)

    type LocalProduct = {
      id: string
      consecutivo_alg: string | null
      alegra_id: string | null
      nombre: string
    }

    const localProducts: LocalProduct[] = productIds.length > 0
      ? await prisma.productos.findMany({
          where: { id: { in: productIds } },
          select: { id: true, consecutivo_alg: true, alegra_id: true, nombre: true },
        })
      : []

    const productMap = new Map<string, LocalProduct>(localProducts.map((p) => [p.id, p]))

    // ── Build Alegra estimate payload ────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10)

    const alegraItems = previo.detalle_previo.map((item: DetallePrevioItem) => {
      const prod = item.producto_id ? productMap.get(item.producto_id) : null
      const itemPayload: any = {
        quantity: Number(item.cantidad),
        price:    Number(item.precio_unitario),
        description: item.descripcion || prod?.nombre || 'Producto',
      }

      if (prod?.alegra_id) {
        itemPayload.id = parseInt(prod.alegra_id, 10) || prod.alegra_id
      }
      if (prod?.consecutivo_alg) {
        itemPayload.reference = prod.consecutivo_alg
      }
      if (Number(item.descuento_porcentaje) > 0) {
        itemPayload.discount = Number(item.descuento_porcentaje)
      }

      return itemPayload
    })

    const estimatePayload: any = {
      date: today,
      items: alegraItems,
      observations: `Generado desde Previo ${previo.folio}`,
    }

    if (alegraContactId) {
      estimatePayload.client = { id: alegraContactId }
    }

    // ── POST to Alegra estimates ─────────────────────────────────────────────
    const alegraRes = await fetch('https://api.alegra.com/api/v1/estimates', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(estimatePayload),
    })

    const alegraData = await alegraRes.json()

    if (!alegraRes.ok) {
      console.error('Alegra estimates error:', alegraData)
      return NextResponse.json(
        { error: alegraData?.message || alegraData?.error || 'Error al crear cotización en Alegra' },
        { status: alegraRes.status }
      )
    }

    const alegraId    = alegraData.id?.toString()
    const numeroCot   = alegraData.numberTemplate?.formattedNumber
      || alegraData.numberTemplate?.number
      || alegraData.number
      || `COT-${alegraId}`

    const subtotal = Number(alegraData.subtotal || previo.total_sin_descuento)
    const total    = Number(alegraData.total    || previo.total_con_descuento)
    const iva      = total - subtotal

    // ── Persist the cotización locally ───────────────────────────────────────
    const cotizacion = await prisma.cotizaciones.create({
      data: {
        alegra_id:         alegraId,
        numero_cotizacion: numeroCot,
        cliente_id:        previo.cliente_id || null,
        cliente_nombre:    previo.clientes?.nombre || previo.cliente_nombre || 'Sin nombre',
        cliente_rfc:       previo.clientes?.rfc || null,
        fecha_expedicion:  new Date(today),
        estado:            'pendiente',
        subtotal,
        iva,
        total,
        observaciones:     `Generado desde Previo ${previo.folio}`,
        productos: {
          createMany: {
            data: previo.detalle_previo.map((item: DetallePrevioItem) => {
              const prod = item.producto_id ? productMap.get(item.producto_id) : null
              return {
                producto_id:     item.producto_id || null,
                producto_nombre: item.descripcion || prod?.nombre || 'Producto',
                producto_codigo: prod?.consecutivo_alg || null,
                cantidad:        Math.round(Number(item.cantidad)) || 1,
                precio_unitario: Number(item.precio_unitario),
                importe:         Number(item.importe),
              }
            }),
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      cotizacion_id: cotizacion.id,
      alegra_id: alegraId,
      numero: numeroCot,
    })
  } catch (error: any) {
    console.error('Error in POST /api/previos/[id]/to-cotizacion:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
