import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const anio = searchParams.get('anio')
    const mes = searchParams.get('mes')
    const clienteId = searchParams.get('cliente_id')
    const search = searchParams.get('search')

    const where: any = {
      estado: { notIn: ['anulado', 'cancelada'] }
    }

    if (clienteId) {
      where.cliente_id = clienteId
    }
    if (search) {
      where.cliente_nombre = {
        contains: search,
        mode: 'insensitive'
      }
    }

    if (anio) {
      const yearNum = parseInt(anio, 10)
      if (mes) {
        const monthNum = parseInt(mes, 10)
        const startDate = new Date(yearNum, monthNum - 1, 1)
        const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999)
        where.fecha_expedicion = {
          gte: startDate,
          lte: endDate
        }
      } else {
        const startDate = new Date(yearNum, 0, 1)
        const endDate = new Date(yearNum, 11, 31, 23, 59, 59, 999)
        where.fecha_expedicion = {
          gte: startDate,
          lte: endDate
        }
      }
    } else if (mes) {
      const currentYear = new Date().getFullYear()
      const monthNum = parseInt(mes, 10)
      const startDate = new Date(currentYear, monthNum - 1, 1)
      const endDate = new Date(currentYear, monthNum, 0, 23, 59, 59, 999)
      where.fecha_expedicion = {
        gte: startDate,
        lte: endDate
      }
    }

    const rawData = await prisma.facturas_cliente.findMany({
      where,
      orderBy: {
        fecha_expedicion: 'desc'
      }
    })

    const data = rawData.map((item: any) => ({
      id: item.id,
      cliente_id: item.cliente_id || '',
      cliente_nombre: item.cliente_nombre,
      anio: new Date(item.fecha_expedicion).getFullYear(),
      mes: new Date(item.fecha_expedicion).getMonth() + 1,
      monto: Number(item.total),
      created_at: item.created_at || item.fecha_expedicion
    }))

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Error in GET /api/ventas:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cliente_id, cliente_nombre, anio, mes, monto } = body

    if (!cliente_id || !cliente_nombre || anio === undefined || mes === undefined || monto === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const nAnio = parseInt(anio, 10)
    const nMes = parseInt(mes, 10)
    const fMonto = parseFloat(monto)

    // Try to lookup client to get RFC
    const clientRecord = await prisma.clientes.findUnique({
      where: { id: cliente_id }
    })

    const rawNewRecord = await prisma.facturas_cliente.create({
      data: {
        numero_factura: `Manual-${nAnio}${String(nMes).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`,
        cliente_id,
        cliente_nombre,
        cliente_rfc: clientRecord?.rfc || null,
        fecha_expedicion: new Date(nAnio, nMes - 1, 1),
        fecha_vencimiento: new Date(nAnio, nMes - 1, 1),
        estado: 'pagada',
        subtotal: fMonto,
        iva: 0,
        total: fMonto,
        observaciones: 'Registro manual de ventas',
        created_at: new Date(),
        updated_at: new Date()
      }
    })

    const newRecord = {
      id: rawNewRecord.id,
      cliente_id: rawNewRecord.cliente_id || '',
      cliente_nombre: rawNewRecord.cliente_nombre,
      anio: new Date(rawNewRecord.fecha_expedicion).getFullYear(),
      mes: new Date(rawNewRecord.fecha_expedicion).getMonth() + 1,
      monto: Number(rawNewRecord.total),
      created_at: rawNewRecord.created_at || rawNewRecord.fecha_expedicion
    }

    return NextResponse.json({ data: newRecord }, { status: 201 })
  } catch (err: any) {
    console.error('Error in POST /api/ventas:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
