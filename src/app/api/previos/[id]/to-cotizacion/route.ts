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

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

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

    // Fallback 2: Create contact in Alegra if not found and we have a name
    if (!alegraContactId && clienteNombre) {
      try {
        const createContactRes = await fetch('https://api.alegra.com/api/v1/contacts', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            name: clienteNombre,
            identification: clienteRfc || undefined,
          }),
        })
        if (createContactRes.ok) {
          const newContact = await createContactRes.json()
          if (newContact?.id) {
            alegraContactId = newContact.id
          }
        }
      } catch (e) {
        console.warn('Could not auto-create contact in Alegra:', e)
      }
    }

    type DetallePrevioItem = typeof previo.detalle_previo[number]

    // ── Resolve Alegra item IDs for each line ────────────────────────────────
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

    // ── Calculate dates ─────────────────────────────────────────────────────
    const now = new Date()
    const today = now.toISOString().slice(0, 10)

    let dueDateStr = body.dueDate || body.fecha_vencimiento
    if (!dueDateStr) {
      const days = Number(body.dias_vencimiento) || 30
      const dueDateObj = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
      dueDateStr = dueDateObj.toISOString().slice(0, 10)
    }

    // ── Build Alegra estimate payload ────────────────────────────────────────
    const alegraItems = previo.detalle_previo.map((item: DetallePrevioItem) => {
      const prod = item.producto_id ? productMap.get(item.producto_id) : null
      const itemPayload: any = {
        quantity: Math.max(1, Math.round(Number(item.cantidad) || 1)),
        price:    Number(item.precio_unitario) || 0,
        description: item.descripcion || prod?.nombre || 'Producto',
      }

      if (prod?.alegra_id) {
        itemPayload.id = parseInt(prod.alegra_id, 10) || prod.alegra_id
      } else {
        // Fallback to generic item ID '2' (ANTICIPO DE BIEN O SERVICIO / VARIOS) in Alegra when no specific product link exists
        itemPayload.id = 2
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
      dueDate: dueDateStr,
      items: alegraItems,
      observations: body.observaciones || `Generado desde Previo ${previo.folio}`,
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
        { error: alegraData?.message || alegraData?.error || (Array.isArray(alegraData) ? alegraData.map((e: any) => e.message || e).join(', ') : 'Error al crear cotización en Alegra') },
        { status: alegraRes.status }
      )
    }

    const alegraId    = alegraData.id?.toString()
    const numeroCot   = alegraData.numberTemplate?.formattedNumber
      || alegraData.numberTemplate?.number
      || alegraData.number
      || `COT-${alegraId}`

    const subtotal = Number(alegraData.subtotal || previo.total_sin_descuento || 0)
    const total    = Number(alegraData.total    || previo.total_con_descuento || 0)
    const iva      = total - subtotal

    // ── Persist the cotización locally ───────────────────────────────────────
    const cotizacion = await prisma.cotizaciones.create({
      data: {
        alegra_id:         alegraId,
        numero_cotizacion: numeroCot,
        cliente_id:        body.cliente_id || previo.cliente_id || null,
        cliente_nombre:    previo.clientes?.nombre || previo.cliente_nombre || 'Sin nombre',
        cliente_rfc:       previo.clientes?.rfc || null,
        fecha_expedicion:  new Date(today),
        fecha_vencimiento: new Date(dueDateStr),
        estado:            'pendiente',
        subtotal,
        iva,
        total,
        observaciones:     body.observaciones || `Generado desde Previo ${previo.folio}`,
        cfdi_id:           body.cfdi_id || previo.cfdi_id || null,
        metodo_pago_id:    body.metodo_pago_id || previo.metodo_pago_id || null,
        forma_pago_id:     body.forma_pago_id || previo.forma_pago_id || null,
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

