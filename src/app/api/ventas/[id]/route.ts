import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const record = await prisma.ventas_mensuales_cliente.findUnique({
      where: { id: BigInt(id) }
    })

    if (!record) {
      return NextResponse.json({ error: 'Registro de venta no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        ...record,
        id: record.id.toString()
      }
    })
  } catch (error: any) {
    console.error('Error in GET /api/ventas/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { cliente_id, cliente_nombre, anio, mes, monto } = body

    const updateData: any = {}
    if (cliente_id !== undefined) updateData.cliente_id = cliente_id
    if (cliente_nombre !== undefined) updateData.cliente_nombre = cliente_nombre
    if (anio !== undefined) updateData.anio = parseInt(anio, 10)
    if (mes !== undefined) updateData.mes = parseInt(mes, 10)
    if (monto !== undefined) updateData.monto = parseFloat(monto)

    // Check unique constraint if cliente_id, anio, or mes are being modified
    if (cliente_id !== undefined || anio !== undefined || mes !== undefined) {
      // Get current values
      const current = await prisma.ventas_mensuales_cliente.findUnique({
        where: { id: BigInt(id) }
      })
      if (!current) {
        return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
      }
      
      const checkClientId = cliente_id !== undefined ? cliente_id : current.cliente_id
      const checkAnio = anio !== undefined ? parseInt(anio, 10) : current.anio
      const checkMes = mes !== undefined ? parseInt(mes, 10) : current.mes

      const existing = await prisma.ventas_mensuales_cliente.findFirst({
        where: {
          cliente_id: checkClientId,
          anio: checkAnio,
          mes: checkMes,
          NOT: {
            id: BigInt(id)
          }
        }
      })

      if (existing) {
        return NextResponse.json({ 
          error: `Ya existe un registro de ventas para ese cliente en ${checkMes}/${checkAnio}.` 
        }, { status: 409 })
      }
    }

    const updated = await prisma.ventas_mensuales_cliente.update({
      where: { id: BigInt(id) },
      data: updateData
    })

    return NextResponse.json({
      data: {
        ...updated,
        id: updated.id.toString()
      }
    })
  } catch (error: any) {
    console.error('Error in PATCH /api/ventas/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.ventas_mensuales_cliente.delete({
      where: { id: BigInt(id) }
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/ventas/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
