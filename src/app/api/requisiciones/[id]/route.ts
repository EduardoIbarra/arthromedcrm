import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Access denied' }, { status: 401 })
    }

    const requisicion = await prisma.requisiciones.findFirst({
      where: { id, deleted_at: null },
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

    if (!requisicion) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 })
    }

    return NextResponse.json({ data: requisicion })
  } catch (error: any) {
    console.error('Error in GET /api/requisiciones/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
      aprobacion_fecha,
      autorizacion_nombre,
      autorizacion_fecha,
      items,
      log_usuario,
      log_accion
    } = body

    const existing = await prisma.requisiciones.findFirst({
      where: { id, deleted_at: null }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Manage approval and authorization fields based on status
      let finalAprobacionNombre = existing.aprobacion_nombre
      let finalAprobacionFecha = existing.aprobacion_fecha
      let finalAutorizacionNombre = existing.autorizacion_nombre
      let finalAutorizacionFecha = existing.autorizacion_fecha

      const targetStatus = status || existing.status

      if (targetStatus === 'APROBADA' || targetStatus === 'COMPRADA') {
        finalAprobacionNombre = aprobacion_nombre !== undefined ? aprobacion_nombre : (existing.aprobacion_nombre || log_usuario || 'Aprobador')
        finalAprobacionFecha = finalAprobacionFecha || new Date()
        
        finalAutorizacionNombre = autorizacion_nombre !== undefined ? autorizacion_nombre : (existing.autorizacion_nombre || null)
        finalAutorizacionFecha = finalAutorizacionNombre ? (finalAutorizacionFecha || new Date()) : null
      } else if (targetStatus === 'PENDIENTE' || targetStatus === 'RECHAZADA') {
        finalAprobacionNombre = null
        finalAprobacionFecha = null
        finalAutorizacionNombre = null
        finalAutorizacionFecha = null
      }

      // Update main requisition
      const updated = await tx.requisiciones.update({
        where: { id },
        data: {
          fecha_solicitud: fecha_solicitud ? new Date(fecha_solicitud) : undefined,
          departamento: departamento || undefined,
          fecha_requerida: fecha_requerida ? new Date(fecha_requerida) : undefined,
          solicitante_nombre: solicitante_nombre || undefined,
          solicitante_telefono: solicitante_telefono !== undefined ? solicitante_telefono : undefined,
          observaciones: observaciones !== undefined ? observaciones : undefined,
          status: status || undefined,
          aprobacion_nombre: finalAprobacionNombre,
          aprobacion_fecha: finalAprobacionFecha,
          autorizacion_nombre: finalAutorizacionNombre,
          autorizacion_fecha: finalAutorizacionFecha,
          updated_at: new Date()
        }
      })

      // Update items if provided
      if (items && Array.isArray(items)) {
        // Delete all old items first
        await tx.requisicion_items.deleteMany({
          where: { requisicion_id: id }
        })

        // Recreate new items
        for (const item of items) {
          await tx.requisicion_items.create({
            data: {
              requisicion_id: id,
              descripcion: item.descripcion,
              cantidad: parseInt(item.cantidad),
              unidad: item.unidad || 'Pieza',
              costo_estimado: parseFloat(item.costo_estimado)
            }
          })
        }
      }

      // Add log entry
      if (log_usuario) {
        let actionDesc = log_accion || 'Actualizó la requisición'
        if (status && status !== existing.status) {
          actionDesc = `Cambió el estado a ${status}`
        }
        await tx.requisicion_logs.create({
          data: {
            requisicion_id: id,
            usuario: log_usuario,
            accion: actionDesc
          }
        })
      }

      return updated
    })

    return NextResponse.json({ data: result })
  } catch (error: any) {
    console.error('Error in PUT /api/requisiciones/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Access denied' }, { status: 401 })
    }

    // Logical delete handled by the middleware / Prisma soft delete handler or explicitly
    const deleted = await prisma.requisiciones.update({
      where: { id },
      data: { deleted_at: new Date() }
    })

    return NextResponse.json({ data: deleted })
  } catch (error: any) {
    console.error('Error in DELETE /api/requisiciones/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
