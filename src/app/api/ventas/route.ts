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

    const where: any = {}

    if (anio) {
      where.anio = parseInt(anio, 10)
    }
    if (mes) {
      where.mes = parseInt(mes, 10)
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

    const rawData = await prisma.ventas_mensuales_cliente.findMany({
      where,
      orderBy: [
        { anio: 'desc' },
        { mes: 'desc' }
      ]
    })

    // Map BigInt id to string to avoid JSON serialization errors
    const data = rawData.map((item: any) => ({
      ...item,
      id: item.id.toString()
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

    // Check if a record already exists for this client, year, and month
    const existing = await prisma.ventas_mensuales_cliente.findUnique({
      where: {
        cliente_id_anio_mes: {
          cliente_id,
          anio: nAnio,
          mes: nMes
        }
      }
    })

    if (existing) {
      return NextResponse.json({ 
        error: `Ya existe un registro de ventas para ${cliente_nombre} en ${nMes}/${nAnio}.` 
      }, { status: 409 })
    }

    const rawNewRecord = await prisma.ventas_mensuales_cliente.create({
      data: {
        cliente_id,
        cliente_nombre,
        anio: nAnio,
        mes: nMes,
        monto: fMonto,
        created_at: new Date()
      }
    })

    const newRecord = {
      ...rawNewRecord,
      id: rawNewRecord.id.toString()
    }

    return NextResponse.json({ data: newRecord }, { status: 201 })
  } catch (err: any) {
    console.error('Error in POST /api/ventas:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
