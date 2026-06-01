import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const clienteId = searchParams.get('cliente_id') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '15', 10)

    const where: any = {}

    if (status) {
      where.estado = status
    }
    if (clienteId) {
      where.cliente_id = clienteId
    }
    
    if (startDate || endDate) {
      where.fecha_expedicion = {}
      if (startDate) {
        where.fecha_expedicion.gte = new Date(startDate)
      }
      if (endDate) {
        // Set end date to end of day to include all invoices on that day
        const endOfDay = new Date(endDate)
        endOfDay.setHours(23, 59, 59, 999)
        where.fecha_expedicion.lte = endOfDay
      }
    }

    if (search) {
      const searchTerms = search.split(',').map(s => s.trim()).filter(Boolean)
      if (searchTerms.length > 1) {
        const cleanedTerms = searchTerms.map(s => s.replace(/^F-/i, ''))
        where.OR = [
          { numero_factura: { in: searchTerms } },
          ...cleanedTerms.map(term => ({ numero_factura: { contains: term, mode: 'insensitive' } }))
        ]
      } else {
        const singleTerm = searchTerms[0] || search
        const singleCleaned = singleTerm.replace(/^F-/i, '')
        where.OR = [
          { numero_factura: { contains: singleTerm, mode: 'insensitive' } },
          { numero_factura: { contains: singleCleaned, mode: 'insensitive' } },
          { cliente_nombre: { contains: singleTerm, mode: 'insensitive' } },
          { cliente_rfc: { contains: singleTerm, mode: 'insensitive' } }
        ]
      }
    }

    const total = await prisma.facturas_cliente.count({ where })
    
    const invoices = await prisma.facturas_cliente.findMany({
      where,
      include: {
        factura_productos: true
      },
      orderBy: {
        fecha_expedicion: 'desc'
      },
      skip: (page - 1) * pageSize,
      take: pageSize
    })

    return NextResponse.json({
      data: invoices,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (error: any) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
