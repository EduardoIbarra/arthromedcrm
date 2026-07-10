import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { attachDeliveryLimitFields } from '@/lib/delivery-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    // 1. Fetch CRM client details
    const client = await prisma.clients.findUnique({
      where: { id }
    })
    
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // 2. Fetch matched invoices (not cancelled)
    const whereConditions: any[] = []
    if (client.rfc) {
      whereConditions.push({ cliente_rfc: { equals: client.rfc, mode: 'insensitive' } })
    }
    if (client.name) {
      whereConditions.push({ cliente_nombre: { equals: client.name, mode: 'insensitive' } })
    }

    if (whereConditions.length === 0) {
      return NextResponse.json({
        client: {
          id: client.id,
          name: client.name,
          rfc: client.rfc,
          phone: client.phone,
          email: client.email_primary || client.email_billing,
          salesperson: client.assigned_to || 'No asignado',
          states: client.states || []
        },
        kpis: {
          salesPeriod: 0,
          salesPrevPeriod: 0,
          growthPercent: 0,
          orderCount: 0,
          aov: 0,
          firstPurchaseDate: null
        },
        salesTrends: [],
        breakdown: {
          topProducts: []
        },
        paymentStatusSummary: [],
        recentOrders: []
      })
    }

    const invoices = await prisma.facturas_cliente.findMany({
      where: {
        OR: whereConditions,
        estado: { notIn: ['anulado', 'cancelada'] }
      },
      include: {
        factura_productos: {
          include: {
            productos: true
          }
        },
        planes_pago: {
          include: {
            parcialidades: {
              orderBy: { numero: 'asc' },
            },
          },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        fecha_expedicion: 'desc'
      }
    })

    const matchedInvoices = invoices.map((inv: any) => ({
      ...inv,
      totalNum: Number(inv.total) || 0
    }))

    // Parse date filter query parameters
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    const today = new Date('2026-06-08')
    let rangeStart = startDateParam ? new Date(startDateParam) : new Date('2026-01-01')
    let rangeEnd = endDateParam ? new Date(endDateParam) : new Date('2026-12-31')

    if (isNaN(rangeStart.getTime())) rangeStart = new Date('2026-01-01')
    if (isNaN(rangeEnd.getTime())) rangeEnd = new Date('2026-12-31')

    rangeStart.setHours(0, 0, 0, 0)
    rangeEnd.setHours(23, 59, 59, 999)

    const diffTime = Math.abs(rangeEnd.getTime() - rangeStart.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1

    const prevRangeStart = new Date(rangeStart)
    prevRangeStart.setFullYear(rangeStart.getFullYear() - 1)
    const prevRangeEnd = new Date(rangeEnd)
    prevRangeEnd.setFullYear(rangeEnd.getFullYear() - 1)

    // Filter by period
    const periodInvoices = matchedInvoices.filter((inv: any) => {
      const invDate = new Date(inv.fecha_expedicion)
      return invDate >= rangeStart && invDate <= rangeEnd
    })

    const prevPeriodInvoices = matchedInvoices.filter((inv: any) => {
      const invDate = new Date(inv.fecha_expedicion)
      return invDate >= prevRangeStart && invDate <= prevRangeEnd
    })

    const salesPeriod = periodInvoices.reduce((sum: number, inv: any) => sum + inv.totalNum, 0)
    const salesPrevPeriod = prevPeriodInvoices.reduce((sum: number, inv: any) => sum + inv.totalNum, 0)

    const growthPercent = salesPrevPeriod > 0 
      ? ((salesPeriod - salesPrevPeriod) / salesPrevPeriod) * 100 
      : 0

    const orderCount = periodInvoices.length
    const aov = orderCount > 0 ? salesPeriod / orderCount : 0

    // First purchase ever
    let firstPurchaseDate: string | null = null
    if (matchedInvoices.length > 0) {
      const oldestInvoice = matchedInvoices[matchedInvoices.length - 1]
      firstPurchaseDate = oldestInvoice.fecha_expedicion
    }

    // Dynamic resolution trend chart (daily or monthly)
    let trendData: { month: string; date: string; revenue: number; prevRevenue: number }[] = []

    if (diffDays <= 31) {
      const current = new Date(rangeStart)
      while (current <= rangeEnd) {
        const dateStr = current.toDateString()
        const dayLabel = current.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

        const daySales = matchedInvoices
          .filter((inv: any) => new Date(inv.fecha_expedicion).toDateString() === dateStr)
          .reduce((sum: number, inv: any) => sum + inv.totalNum, 0)

        const offsetTime = current.getTime() - rangeStart.getTime()
        const prevDayDate = new Date(prevRangeStart.getTime() + offsetTime)
        const prevDayDateStr = prevDayDate.toDateString()
        const prevDaySales = matchedInvoices
          .filter((inv: any) => new Date(inv.fecha_expedicion).toDateString() === prevDayDateStr)
          .reduce((sum: number, inv: any) => sum + inv.totalNum, 0)

        trendData.push({
          date: current.toISOString(),
          month: dayLabel,
          revenue: daySales,
          prevRevenue: prevDaySales
        })

        current.setDate(current.getDate() + 1)
      }
    } else {
      const startYear = rangeStart.getFullYear()
      const startMonth = rangeStart.getMonth()
      const endYear = rangeEnd.getFullYear()
      const endMonth = rangeEnd.getMonth()

      let year = startYear
      let month = startMonth

      while (year < endYear || (year === endYear && month <= endMonth)) {
        const monthLabel = new Date(year, month, 1).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })

        const currentSales = matchedInvoices
          .filter((inv: any) => {
            const d = new Date(inv.fecha_expedicion)
            return d.getFullYear() === year && d.getMonth() === month && d >= rangeStart && d <= rangeEnd
          })
          .reduce((sum: number, inv: any) => sum + inv.totalNum, 0)

        const prevYearSales = matchedInvoices
          .filter((inv: any) => {
            const d = new Date(inv.fecha_expedicion)
            return d.getFullYear() === (year - 1) && d.getMonth() === month
          })
          .reduce((sum: number, inv: any) => sum + inv.totalNum, 0)

        trendData.push({
          date: new Date(year, month, 1).toISOString(),
          month: monthLabel,
          revenue: currentSales,
          prevRevenue: prevYearSales
        })

        month++
        if (month > 11) {
          month = 0
          year++
        }
      }
    }

    // Product breakdown
    const productRevenue: Record<string, number> = {}
    periodInvoices.forEach((inv: any) => {
      inv.factura_productos.forEach((fp: any) => {
        const prodName = fp.producto_nombre || 'Desconocido'
        const revenue = Number(fp.importe) || 0
        productRevenue[prodName] = (productRevenue[prodName] || 0) + revenue
      })
    })

    const topProducts = Object.entries(productRevenue)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    // Payments status summary
    const statusMap: Record<string, number> = {}
    periodInvoices.forEach((inv: any) => {
      statusMap[inv.estado] = (statusMap[inv.estado] || 0) + inv.totalNum
    })

    const paymentStatusSummary = Object.entries(statusMap).map(([name, value]) => ({ name, value }))

    // Recent orders/invoices list formatted (include delivery limit from first payment)
    const recentOrders = periodInvoices.map((inv: any) => {
      const withDelivery = attachDeliveryLimitFields({
        ...inv,
        total: inv.totalNum,
      })
      return {
        id: inv.id,
        numero_factura: inv.numero_factura,
        fecha_expedicion: inv.fecha_expedicion,
        subtotal: Number(inv.subtotal) || 0,
        iva: Number(inv.iva) || 0,
        total: inv.totalNum,
        estado: inv.estado,
        estado_surtido: inv.estado_surtido,
        fecha_pago: inv.fecha_pago,
        delivery_limit_date: withDelivery.delivery_limit_date,
        delivery_is_reference: withDelivery.delivery_is_reference,
        delivery_qualifies: withDelivery.delivery_qualifies,
        first_payment_date: withDelivery.first_payment_date,
        first_payment_percent: withDelivery.first_payment_percent,
      }
    })

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.name,
        rfc: client.rfc,
        phone: client.phone,
        email: client.email_primary || client.email_billing,
        salesperson: client.assigned_to || 'No asignado',
        states: client.states || []
      },
      kpis: {
        salesPeriod,
        salesPrevPeriod,
        growthPercent,
        orderCount,
        aov,
        firstPurchaseDate
      },
      salesTrends: trendData,
      breakdown: {
        topProducts
      },
      paymentStatusSummary,
      recentOrders
    })
  } catch (err: any) {
    console.error('Error fetching client report data:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
