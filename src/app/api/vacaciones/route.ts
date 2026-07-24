import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: any = { deleted_at: null }

    if (status && status !== 'TODOS') {
      where.status = status
    }

    if (search) {
      where.OR = [
        { folio: { contains: search, mode: 'insensitive' } },
        { empleado_nombre: { contains: search, mode: 'insensitive' } },
        { empleado_cargo: { contains: search, mode: 'insensitive' } },
        { autorizador_nombre: { contains: search, mode: 'insensitive' } },
        { periodo_correspondiente: { contains: search, mode: 'insensitive' } },
      ]
    }

    const vacaciones = await prisma.vacaciones.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        logs: {
          orderBy: { fecha: 'desc' }
        }
      }
    })

    return NextResponse.json({ data: vacaciones })
  } catch (error: any) {
    console.error('Error en GET /api/vacaciones:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
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
      log_usuario
    } = body

    if (
      !fecha_solicitud ||
      !empleado_nombre ||
      !empleado_cargo ||
      !dias_solicitados ||
      !periodo_correspondiente ||
      !fecha_inicio ||
      !fecha_fin ||
      !fecha_regreso
    ) {
      return NextResponse.json(
        { error: 'Todos los campos requeridos de la solicitud deben ser completados.' },
        { status: 400 }
      )
    }

    // Generate folio VAC-YYYYMMDD-XXX
    const dateObj = new Date(fecha_solicitud)
    const yearStr = dateObj.getFullYear()
    const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0')
    const dayStr = String(dateObj.getDate()).padStart(2, '0')
    const datePrefix = `${yearStr}${monthStr}${dayStr}`

    const count = await prisma.vacaciones.count({
      where: {
        folio: { startsWith: `VAC-${datePrefix}-` }
      }
    })
    const nextNum = String(count + 1).padStart(3, '0')
    const folio = `VAC-${datePrefix}-${nextNum}`

    const result = await prisma.$transaction(async (tx: any) => {
      const nuevaVacacion = await tx.vacaciones.create({
        data: {
          folio,
          fecha_solicitud: new Date(fecha_solicitud),
          empleado_id: empleado_id && empleado_id !== 'otro' ? empleado_id : null,
          empleado_nombre,
          empleado_cargo,
          dias_solicitados: Number(dias_solicitados),
          periodo_correspondiente: String(periodo_correspondiente),
          fecha_inicio: new Date(fecha_inicio),
          fecha_fin: new Date(fecha_fin),
          fecha_regreso: new Date(fecha_regreso),
          observaciones: observaciones || null,
          status: 'PENDIENTE',
          created_by: user.id
        }
      })

      // Create log
      await tx.vacaciones_logs.create({
        data: {
          vacacion_id: nuevaVacacion.id,
          usuario: log_usuario || user.email || 'Sistema',
          accion: 'SOLICITANTE_CREO',
          detalles: `Solicitud de vacaciones de ${dias_solicitados} días creada con folio ${folio}`
        }
      })

      return nuevaVacacion
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error: any) {
    console.error('Error en POST /api/vacaciones:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
