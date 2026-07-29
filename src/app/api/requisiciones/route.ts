import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Access denied' }, { status: 401 })
    }

    const requisiciones = await prisma.requisiciones.findMany({
      where: { deleted_at: null },
      orderBy: { created_at: 'desc' },
      include: {
        items: {
          where: { deleted_at: null },
          orderBy: { created_at: 'asc' }
        },
        logs: {
          orderBy: { fecha: 'desc' }
        }
      }
    })

    return NextResponse.json({ data: requisiciones })
  } catch (error: any) {
    console.error('Error in GET /api/requisiciones:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Access denied' }, { status: 401 })
    }

    const body = await request.json()
    const {
      fecha_solicitud,
      departamento,
      fecha_requerida,
      solicitante_nombre,
      solicitante_telefono,
      observaciones,
      status,
      aprobacion_nombre,
      autorizacion_nombre,
      items,
      log_usuario // Who performed the action (for logs)
    } = body

    if (!fecha_solicitud || !departamento || !fecha_requerida || !solicitante_nombre || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Generate folio REQ-YYYYMMDD-XXX
    const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const count = await prisma.requisiciones.count({
      where: {
        folio: { startsWith: `REQ-${todayStr}-` }
      }
    })
    const nextNum = String(count + 1).padStart(3, '0')
    const folio = `REQ-${todayStr}-${nextNum}`

    // Create inside a Prisma Transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const req = await tx.requisiciones.create({
        data: {
          folio,
          fecha_solicitud: new Date(fecha_solicitud),
          departamento,
          fecha_requerida: new Date(fecha_requerida),
          solicitante_nombre,
          solicitante_telefono: solicitante_telefono || null,
          observaciones: observaciones || null,
          status: status || 'PENDIENTE',
          aprobacion_nombre: aprobacion_nombre || null,
          aprobacion_fecha: aprobacion_nombre ? new Date() : null,
          autorizacion_nombre: autorizacion_nombre || null,
          autorizacion_fecha: autorizacion_nombre ? new Date() : null
        }
      })

      // Add items
      for (const item of items) {
        await tx.requisicion_items.create({
          data: {
            requisicion_id: req.id,
            descripcion: item.descripcion,
            cantidad: parseInt(item.cantidad),
            unidad: item.unidad || 'Pieza',
            costo_estimado: parseFloat(item.costo_estimado)
          }
        })
      }

      // Add initial log entry
      await tx.requisicion_logs.create({
        data: {
          requisicion_id: req.id,
          usuario: log_usuario || solicitante_nombre || 'Sistema',
          accion: 'Creó la requisición de compra'
        }
      })

      return req
    })

    return NextResponse.json({ data: result })
  } catch (error: any) {
    console.error('Error in POST /api/requisiciones:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
