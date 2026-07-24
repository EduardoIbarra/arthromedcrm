import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 401 })
    }

    const { id } = await params

    const vacacion = await prisma.vacaciones.findUnique({
      where: { id },
      include: {
        logs: {
          orderBy: { fecha: 'desc' }
        }
      }
    })

    if (!vacacion || vacacion.deleted_at) {
      return NextResponse.json({ error: 'Solicitud de vacaciones no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ data: vacacion })
  } catch (error: any) {
    console.error('Error en GET /api/vacaciones/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const vacacionExistente = await prisma.vacaciones.findUnique({ where: { id } })
    if (!vacacionExistente || vacacionExistente.deleted_at) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    const {
      // Solicitud edits if editing
      fecha_solicitud,
      empleado_id,
      empleado_nombre,
      empleado_cargo,
      dias_solicitados,
      periodo_correspondiente,
      fecha_inicio,
      fecha_fin,
      fecha_regreso,
      observaciones,

      // Autorización actions
      action, // 'AUTHORIZE' | 'REJECT' | 'UPDATE' | 'CANCEL'
      status,
      fecha_autorizacion,
      autorizador_id,
      autorizador_nombre,
      autorizador_cargo,
      periodo_autorizado_inicio,
      periodo_autorizado_fin,
      dias_autorizados,
      motivo_rechazo,

      log_usuario
    } = body

    const updateData: any = {
      updated_at: new Date()
    }

    let accionLog = 'ACTUALIZADO'
    let detallesLog = 'Solicitud actualizada'

    if (action === 'AUTHORIZE' || status === 'AUTORIZADO') {
      updateData.status = 'AUTORIZADO'
      updateData.fecha_autorizacion = fecha_autorizacion ? new Date(fecha_autorizacion) : new Date()
      updateData.autorizador_id = autorizador_id && autorizador_id !== 'otro' ? autorizador_id : null
      updateData.autorizador_nombre = autorizador_nombre
      updateData.autorizador_cargo = autorizador_cargo
      updateData.periodo_autorizado_inicio = periodo_autorizado_inicio ? new Date(periodo_autorizado_inicio) : new Date(vacacionExistente.fecha_inicio)
      updateData.periodo_autorizado_fin = periodo_autorizado_fin ? new Date(periodo_autorizado_fin) : new Date(vacacionExistente.fecha_fin)
      updateData.dias_autorizados = dias_autorizados ? Number(dias_autorizados) : vacacionExistente.dias_solicitados

      accionLog = 'AUTORIZADO'
      detallesLog = `Solicitud autorizada por ${autorizador_nombre || 'Autorizador'}`
    } else if (action === 'REJECT' || status === 'RECHAZADO') {
      updateData.status = 'RECHAZADO'
      updateData.fecha_autorizacion = fecha_autorizacion ? new Date(fecha_autorizacion) : new Date()
      updateData.autorizador_id = autorizador_id && autorizador_id !== 'otro' ? autorizador_id : null
      updateData.autorizador_nombre = autorizador_nombre
      updateData.autorizador_cargo = autorizador_cargo
      updateData.motivo_rechazo = motivo_rechazo || null

      accionLog = 'RECHAZADO'
      detallesLog = `Solicitud rechazada por ${autorizador_nombre || 'Autorizador'}. Motivo: ${motivo_rechazo || 'N/A'}`
    } else if (action === 'CANCEL' || status === 'CANCELADO') {
      updateData.status = 'CANCELADO'
      accionLog = 'CANCELADO'
      detallesLog = 'Solicitud de vacaciones cancelada'
    } else {
      // General update of fields
      if (fecha_solicitud) updateData.fecha_solicitud = new Date(fecha_solicitud)
      if (empleado_nombre) updateData.empleado_nombre = empleado_nombre
      if (empleado_cargo) updateData.empleado_cargo = empleado_cargo
      if (empleado_id !== undefined) updateData.empleado_id = empleado_id && empleado_id !== 'otro' ? empleado_id : null
      if (dias_solicitados) updateData.dias_solicitados = Number(dias_solicitados)
      if (periodo_correspondiente) updateData.periodo_correspondiente = String(periodo_correspondiente)
      if (fecha_inicio) updateData.fecha_inicio = new Date(fecha_inicio)
      if (fecha_fin) updateData.fecha_fin = new Date(fecha_fin)
      if (fecha_regreso) updateData.fecha_regreso = new Date(fecha_regreso)
      if (observaciones !== undefined) updateData.observaciones = observaciones
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const record = await tx.vacaciones.update({
        where: { id },
        data: updateData
      })

      await tx.vacaciones_logs.create({
        data: {
          vacacion_id: id,
          usuario: log_usuario || user.email || 'Sistema',
          accion: accionLog,
          detalles: detallesLog
        }
      })

      return record
    })

    return NextResponse.json({ data: updated })
  } catch (error: any) {
    console.error('Error en PUT /api/vacaciones/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 401 })
    }

    const { id } = await params

    await prisma.vacaciones.update({
      where: { id },
      data: { deleted_at: new Date() }
    })

    return NextResponse.json({ message: 'Solicitud eliminada con éxito' })
  } catch (error: any) {
    console.error('Error en DELETE /api/vacaciones/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
