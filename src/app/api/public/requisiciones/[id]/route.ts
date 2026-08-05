import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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
    console.error('Error in GET /api/public/requisiciones/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, authorizer_name, note, items } = body

    const existing = await prisma.requisiciones.findFirst({
      where: { id, deleted_at: null },
      include: { items: { where: { deleted_at: null } } }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 })
    }

    const userName = authorizer_name?.trim() || 'Usuario (Enlace Compartido)'

    const updated = await prisma.$transaction(async (tx: any) => {
      if (action === 'APROBAR') {
        await tx.requisiciones.update({
          where: { id },
          data: {
            status: 'APROBADA',
            autorizacion_nombre: userName,
            autorizacion_fecha: new Date(),
            aprobacion_nombre: existing.aprobacion_nombre || userName,
            aprobacion_fecha: existing.aprobacion_fecha || new Date(),
            updated_at: new Date()
          }
        })

        await tx.requisicion_logs.create({
          data: {
            requisicion_id: id,
            usuario: userName,
            accion: `Autorizó la requisición. ${note ? 'Nota: ' + note : ''}`.trim()
          }
        })
      } else if (action === 'RECHAZAR') {
        await tx.requisiciones.update({
          where: { id },
          data: {
            status: 'RECHAZADA',
            updated_at: new Date()
          }
        })

        await tx.requisicion_logs.create({
          data: {
            requisicion_id: id,
            usuario: userName,
            accion: `Rechazó la requisición. ${note ? 'Motivo: ' + note : ''}`.trim()
          }
        })
      } else if (action === 'MODIFICAR') {
        if (Array.isArray(items)) {
          // Soft delete items no longer present
          const itemIdsToKeep = items.filter((i: any) => i.id).map((i: any) => i.id)
          await tx.requisicion_items.updateMany({
            where: {
              requisicion_id: id,
              id: { notIn: itemIdsToKeep },
              deleted_at: null
            },
            data: { deleted_at: new Date() }
          })

          // Upsert items
          for (const item of items) {
            if (item.id) {
              await tx.requisicion_items.update({
                where: { id: item.id },
                data: {
                  descripcion: item.descripcion,
                  cantidad: Number(item.cantidad) || 1,
                  unidad: item.unidad || 'Pieza',
                  costo_estimado: Number(item.costo_estimado) || 0,
                  updated_at: new Date()
                }
              })
            } else {
              await tx.requisicion_items.create({
                data: {
                  requisicion_id: id,
                  descripcion: item.descripcion,
                  cantidad: Number(item.cantidad) || 1,
                  unidad: item.unidad || 'Pieza',
                  costo_estimado: Number(item.costo_estimado) || 0
                }
              })
            }
          }
        }

        await tx.requisiciones.update({
          where: { id },
          data: { updated_at: new Date() }
        })

        await tx.requisicion_logs.create({
          data: {
            requisicion_id: id,
            usuario: userName,
            accion: `Modificó la requisición. ${note ? 'Nota: ' + note : ''}`.trim()
          }
        })
      } else if (action === 'ADD_NOTE') {
        await tx.requisicion_logs.create({
          data: {
            requisicion_id: id,
            usuario: userName,
            accion: `Nota: ${note || ''}`.trim()
          }
        })
      } else {
        throw new Error('Acción no válida')
      }

      return tx.requisiciones.findFirst({
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
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Error in POST /api/public/requisiciones/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
