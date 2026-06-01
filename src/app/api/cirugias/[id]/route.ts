import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendNotificationToUser } from '@/lib/respond'

export const dynamic = 'force-dynamic'

// GET /api/cirugias/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await prisma.cirugias.findUnique({
      where: { id },
      include: {
        cirugia_equipo: true,
        cirugia_productos: {
          include: {
            productos: {
              select: {
                id: true,
                nombre: true,
                precio_unitario: true,
                categoria: true,
                tipo: true,
              },
            },
          },
        },
        cirugia_conceptos: true,
      },
    })
    if (!data) return NextResponse.json({ error: 'No encontrada.' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('[GET /api/cirugias/:id]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/cirugias/[id] — full replace (fields + nested)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const {
      nombre,
      medico,
      descripcion,
      fecha,
      estado,
      notas,
      equipo,
      productos,
      conceptos,
    } = body

    // Fetch existing team to notify only new members
    const existingEquipo = await prisma.cirugia_equipo.findMany({ where: { cirugia_id: id } })
    const existingUserIds = existingEquipo.map((e: any) => e.user_id)

    // Delete & recreate nested items (simplest full-replace strategy)
    await prisma.cirugia_equipo.deleteMany({ where: { cirugia_id: id } })
    await prisma.cirugia_productos.deleteMany({ where: { cirugia_id: id } })
    await prisma.cirugia_conceptos.deleteMany({ where: { cirugia_id: id } })

    const data = await prisma.cirugias.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(medico !== undefined && { medico }),
        ...(descripcion !== undefined && { descripcion }),
        ...(fecha !== undefined && { fecha: new Date(fecha) }),
        ...(estado !== undefined && { estado }),
        ...(notas !== undefined && { notas }),
        updated_at: new Date(),
        cirugia_equipo: {
          create: (equipo || []).map((e: any) => ({
            user_id: e.user_id,
            rol: e.rol || null,
          })),
        },
        cirugia_productos: {
          create: (productos || []).map((p: any) => ({
            producto_id: p.producto_id,
            cantidad: Number(p.cantidad) || 1,
            es_consumible: Boolean(p.es_consumible),
            tipo_uso: p.tipo_uso || 'venta',
            precio_unitario: p.precio_unitario != null ? Number(p.precio_unitario) : null,
          })),
        },
        cirugia_conceptos: {
          create: (conceptos || []).map((c: any) => ({
            concepto: c.concepto,
            cantidad: Number(c.cantidad) || 1,
            precio_unitario: Number(c.precio_unitario) || 0,
            subtotal: Number(c.subtotal) || 0,
          })),
        },
      },
      include: {
        cirugia_equipo: true,
        cirugia_productos: {
          include: {
            productos: { select: { id: true, nombre: true, precio_unitario: true, categoria: true, tipo: true } },
          },
        },
        cirugia_conceptos: true,
      },
    })

    const newUsers = (equipo || []).filter((e: any) => !existingUserIds.includes(e.user_id))
    const remainingUsers = (equipo || []).filter((e: any) => existingUserIds.includes(e.user_id))
    
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    if (baseUrl.includes('localhost')) {
      baseUrl = 'https://dev.erp.arthromed.com.mx';
    }
    const url = `${baseUrl}/cirugias/${data.id}`;
    const fechaFormat = new Date(data.fecha).toLocaleString('es-MX', {
      timeZone: 'America/Monterrey',
      dateStyle: 'full',
      timeStyle: 'short',
    });

    if (newUsers.length > 0) {
      const messageNew = `¡Hola! Has sido asignado al equipo asistente de la cirugía "${data.nombre}" con el ${data.medico}. \nFecha y hora: ${fechaFormat}\nPuedes ver los detalles aquí: ${url}`;
      for (const e of newUsers) {
        if (e.user_id) {
          await sendNotificationToUser(e.user_id, messageNew);
        }
      }
    }

    if (remainingUsers.length > 0) {
      const messageUpdate = `¡Hola! Los detalles de la cirugía "${data.nombre}" han sido actualizados. \nFecha y hora: ${fechaFormat}\nPuedes ver los detalles aquí: ${url}`;
      for (const e of remainingUsers) {
        if (e.user_id) {
          await sendNotificationToUser(e.user_id, messageUpdate);
        }
      }
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('[PATCH /api/cirugias/:id]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/cirugias/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.cirugias.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[DELETE /api/cirugias/:id]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
