import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendInternalNotification } from '@/lib/respond'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { items, motivo, autorizador_id } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Debe proporcionar al menos un producto para la salida.' }, { status: 400 })
    }

    // Process transaction
    const results = await prisma.$transaction(async (tx: any) => {
      const processed = []

      for (const item of items) {
        const { producto_id, inventario_id, cantidad } = item
        const cant = parseInt(cantidad, 10)

        if (!producto_id || !inventario_id || isNaN(cant) || cant <= 0) {
          throw new Error('Datos inválidos. La cantidad debe ser mayor a 0.')
        }

        const inventarioProducto = await tx.inventario_productos.findUnique({
          where: {
            tipo_inventario_id_producto_id: {
              tipo_inventario_id: inventario_id,
              producto_id: producto_id,
            }
          },
          include: {
            productos: true,
            tipos_inventario: true,
          }
        })

        if (!inventarioProducto || inventarioProducto.stock_actual < cant) {
          throw new Error(`Stock insuficiente para el producto ${inventarioProducto?.productos.nombre || producto_id} en el inventario seleccionado.`)
        }

        // 1. Decrement stock
        await tx.inventario_productos.update({
          where: { id: inventarioProducto.id },
          data: { stock_actual: { decrement: cant }, stock_updated_at: new Date() }
        })

        // 2. Log movement
        await tx.inventario_movimientos.create({
          data: {
            tipo_movimiento: 'SALIDA_MANUAL',
            producto_id,
            tipo_inventario_id: inventario_id,
            cantidad: cant,
            motivo,
            usuario_id: user.id,
            autorizador_id: autorizador_id || null,
          }
        })

        processed.push({
          producto: inventarioProducto.productos.nombre,
          inventario: inventarioProducto.tipos_inventario.nombre,
          cantidad: cant
        })
      }

      return processed
    })

    // Fetch user details for notification
    const profile = await prisma.user_profiles.findUnique({ where: { id: user.id }, select: { email: true } })
    const autorizador = autorizador_id ? await prisma.user_profiles.findUnique({ where: { id: autorizador_id }, select: { email: true } }) : null

    // Build notification message
    let msg = `🚨 *Salida Global de Inventario*\nRegistró: ${profile?.email || user.email}\nAutorizó: ${autorizador?.email || 'N/A'}\nMotivo: ${motivo || 'N/A'}\n\n*Productos:*`
    results.forEach((r: any) => {
      msg += `\n- ${r.cantidad}x ${r.producto} (${r.inventario})`
    })

    sendInternalNotification(msg, 'inventario_salidas').catch(err => {
      console.error('Failed to send WhatsApp notification:', err)
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[POST /api/inventario/salidas]', err)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
