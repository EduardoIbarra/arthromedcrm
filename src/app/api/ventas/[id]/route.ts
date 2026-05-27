import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const record = await prisma.facturas_cliente.findUnique({
      where: { id }
    })

    if (!record) {
      return NextResponse.json({ error: 'Registro de venta no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        id: record.id,
        cliente_id: record.cliente_id || '',
        cliente_nombre: record.cliente_nombre,
        anio: new Date(record.fecha_expedicion).getFullYear(),
        mes: new Date(record.fecha_expedicion).getMonth() + 1,
        monto: Number(record.total),
        created_at: record.created_at || record.fecha_expedicion
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

    const current = await prisma.facturas_cliente.findUnique({
      where: { id }
    })

    if (!current) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
    }

    const updateData: any = {}
    
    if (cliente_id !== undefined) {
      updateData.cliente_id = cliente_id
      // Try to lookup RFC
      const clientRecord = await prisma.clientes.findUnique({
        where: { id: cliente_id }
      })
      if (clientRecord) {
        updateData.cliente_rfc = clientRecord.rfc || null
      }
    }
    if (cliente_nombre !== undefined) {
      updateData.cliente_nombre = cliente_nombre
    }

    const checkAnio = anio !== undefined ? parseInt(anio, 10) : new Date(current.fecha_expedicion).getFullYear()
    const checkMes = mes !== undefined ? parseInt(mes, 10) : new Date(current.fecha_expedicion).getMonth() + 1

    if (anio !== undefined || mes !== undefined) {
      const newDate = new Date(checkAnio, checkMes - 1, 1)
      updateData.fecha_expedicion = newDate
      updateData.fecha_vencimiento = newDate
    }

    if (monto !== undefined) {
      const fMonto = parseFloat(monto)
      updateData.subtotal = fMonto
      updateData.total = fMonto
      updateData.iva = 0
    }

    updateData.updated_at = new Date()

    const updated = await prisma.facturas_cliente.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({
      data: {
        id: updated.id,
        cliente_id: updated.cliente_id || '',
        cliente_nombre: updated.cliente_nombre,
        anio: new Date(updated.fecha_expedicion).getFullYear(),
        mes: new Date(updated.fecha_expedicion).getMonth() + 1,
        monto: Number(updated.total),
        created_at: updated.created_at || updated.fecha_expedicion
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
    await prisma.facturas_cliente.delete({
      where: { id }
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/ventas/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
