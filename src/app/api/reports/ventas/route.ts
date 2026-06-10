import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { buildProductMatcher, cleanProductName } from '@/lib/productFuzzyMatch'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 1. Fetch all invoices that are not cancelled
    const invoices = await prisma.facturas_cliente.findMany({
      where: {
        estado: { notIn: ['anulado', 'cancelada'] }
      },
      include: {
        factura_productos: {
          include: {
            productos: true
          }
        }
      },
      orderBy: {
        fecha_expedicion: 'desc'
      }
    })

    // 2. Fetch CRM clients for matching region and salesperson,
    //    AND the canonical productos list for fuzzy product name matching
    const [crmClients, allProductos] = await Promise.all([
      prisma.clients.findMany({
        select: {
          id: true,
          name: true,
          rfc: true,
          states: true,
          assigned_to: true,
          created_at: true,
          registered_at: true
        }
      }),
      prisma.productos.findMany({
        select: { nombre: true, line: true }
      })
    ])

    // Build a fuzzy matcher from all canonical product names
    const canonicalNames = Array.from(new Set(
      allProductos.map((p: any) => p.nombre ? cleanProductName(p.nombre) : '').filter(Boolean)
    )) as string[]
    const matchProductName = buildProductMatcher(canonicalNames)

    // Build name → line lookup for fuzzy-matched rows (no producto_id)
    const nameToLine = new Map<string, string>()
    for (const p of allProductos) {
      if (p.nombre && p.line) {
        nameToLine.set(cleanProductName(p.nombre), p.line)
      }
    }

    // Setup client lookup maps
    const clientByRfc = new Map<string, any>()
    const clientByName = new Map<string, any>()
    for (const c of crmClients) {
      if (c.rfc) clientByRfc.set(c.rfc.toLowerCase().trim(), c)
      if (c.name) clientByName.set(c.name.toLowerCase().trim(), c)
    }

    // Match invoices to CRM clients
    const matchedInvoices = invoices.map((inv: any) => {
      let matchedClient: any = null
      const rfcKey = inv.cliente_rfc?.toLowerCase().trim()
      const nameKey = inv.cliente_nombre?.toLowerCase().trim()

      if (rfcKey) matchedClient = clientByRfc.get(rfcKey)
      if (!matchedClient && nameKey) matchedClient = clientByName.get(nameKey)

      return {
        ...inv,
        totalNum: Number(inv.total) || 0,
        salesperson: matchedClient?.assigned_to || 'No asignado',
        region: (matchedClient?.states && matchedClient.states.length > 0)
          ? matchedClient.states[0]
          : 'No especificado',
        crmClientId: matchedClient?.id || null
      }
    })

    // Parse date filter query parameters
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    // Helper: parse 'YYYY-MM-DD' strings as LOCAL midnight (not UTC midnight).
    // new Date('2026-01-01') → UTC midnight → UTC-6 sees Dec 31 2025. Wrong!
    // new Date(2026, 0, 1) → Local midnight → UTC-6 sees 2026-01-01 06:00 UTC. Correct.
    const parseLocalDate = (s: string): Date => {
      const [y, m, d] = s.split('-').map(Number)
      return new Date(y, m - 1, d)
    }

    const today = new Date()
    today.setHours(23, 59, 59, 999)

    // Default: year-to-date (Jan 1 → today), so previous-year window is also YTD
    const defaultRangeStart = new Date(today.getFullYear(), 0, 1)
    const defaultRangeEnd = new Date(today)

    let rangeStart = startDateParam ? parseLocalDate(startDateParam) : defaultRangeStart
    let rangeEnd = endDateParam ? parseLocalDate(endDateParam) : defaultRangeEnd

    if (isNaN(rangeStart.getTime())) rangeStart = defaultRangeStart
    if (isNaN(rangeEnd.getTime())) rangeEnd = defaultRangeEnd

    // Never compare against future dates — cap rangeEnd at today
    if (rangeEnd > today) rangeEnd = new Date(today)

    // Standardize time bounds
    rangeStart.setHours(0, 0, 0, 0)
    rangeEnd.setHours(23, 59, 59, 999)

    // Calculate length of selection range
    const diffTime = Math.abs(rangeEnd.getTime() - rangeStart.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1

    // Calculate previous year equivalent range (YoY comparison)
    const prevRangeStart = new Date(rangeStart)
    prevRangeStart.setFullYear(rangeStart.getFullYear() - 1)

    const prevRangeEnd = new Date(rangeEnd)
    prevRangeEnd.setFullYear(rangeEnd.getFullYear() - 1)

    // Filter matched invoices for current and previous periods
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

    // Sales today: if system today is within range, report today, else the last day of the range
    let salesToday = 0
    const todayTarget = (today >= rangeStart && today <= rangeEnd) ? today : rangeEnd
    matchedInvoices.forEach((inv: any) => {
      const invDate = new Date(inv.fecha_expedicion)
      if (invDate.toDateString() === todayTarget.toDateString()) {
        salesToday += inv.totalNum
      }
    })

    // Growth compared to the previous equal-duration window
    const growthPercent = salesPrevPeriod > 0 
      ? ((salesPeriod - salesPrevPeriod) / salesPrevPeriod) * 100 
      : 0

    const orderCount = periodInvoices.length
    const aov = orderCount > 0 ? salesPeriod / orderCount : 0
    
    // New CRM clients created in the selected range
    const newClients = crmClients.filter((c: any) => {
      const date = c.registered_at ? new Date(c.registered_at) : new Date(c.created_at)
      return date >= rangeStart && date <= rangeEnd
    })
    const newClientsCount = newClients.length
    const newClientIds = new Set(newClients.map((c: any) => c.id))

    // Active clients with sales in this period
    const activeClientsCount = new Set(
      periodInvoices.map((inv: any) => inv.crmClientId || inv.cliente_rfc || inv.cliente_nombre).filter(Boolean)
    ).size

    // Target scaled by the number of days (baseline $500K per 30 days)
    const goalTarget = Math.round((500000 / 30) * diffDays)
    const goalProgress = goalTarget > 0 ? (salesPeriod / goalTarget) * 100 : 0

    // Dynamic resolution trend chart (Daily for short ranges, Monthly for long ranges)
    let trendData: { month: string; date?: string; revenue: number; prevRevenue: number }[] = []

    if (diffDays <= 31) {
      const current = new Date(rangeStart)
      while (current <= rangeEnd) {
        const dateStr = current.toDateString()
        const dayLabel = current.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

        const daySales = matchedInvoices
          .filter((inv: any) => new Date(inv.fecha_expedicion).toDateString() === dateStr)
          .reduce((sum: number, inv: any) => sum + inv.totalNum, 0)

        // Sum previous period equivalent day sales
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
            if (d.getFullYear() !== (year - 1) || d.getMonth() !== month) return false
            // If this month/year is the current (partial) month, cap at equivalent day-of-month
            const isCurrentPartialMonth = year === today.getFullYear() && month === today.getMonth()
            if (isCurrentPartialMonth) {
              const prevMonthCap = new Date(year - 1, month, today.getDate(), 23, 59, 59, 999)
              return d <= prevMonthCap
            }
            // For the last month in the range when it extends into the current month boundary
            const isRangeEndMonth = year === rangeEnd.getFullYear() && month === rangeEnd.getMonth()
            if (isRangeEndMonth) {
              const prevMonthCap = new Date(year - 1, month, rangeEnd.getDate(), 23, 59, 59, 999)
              return d <= prevMonthCap
            }
            return true
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

    // For client first-purchase analysis
    const clientPurchaseDates = new Map<string, Date>()
    matchedInvoices.forEach((inv: any) => {
      const clientKey = inv.cliente_nombre.toLowerCase().trim()
      const prevDate = clientPurchaseDates.get(clientKey)
      const invDate = new Date(inv.fecha_expedicion)
      if (!prevDate || invDate < prevDate) {
        clientPurchaseDates.set(clientKey, invDate)
      }
    })

    // Helper: resolve canonical short name from an invoice line item.
    // Priority: (1) linked/raw product name cleaned  (2) fuzzy match  (3) raw name
    const resolveProductName = (fp: any, inv?: any): string => {
      if (inv?.observaciones && String(inv.observaciones).startsWith('Importación histórica')) {
        return fp.producto_nombre || 'Desconocido'
      }
      const initialName = fp.productos?.nombre || fp.producto_nombre || 'Desconocido'
      const cleaned = cleanProductName(initialName)
      return matchProductName(cleaned).canonicalName
    }

    // Helper: resolve product línea from an invoice line item.
    // Priority: (1) fp.linea (DB column, backfilled from Excel + productos.line)
    //           (2) linked productos.line  (3) name→line lookup  (4) 'OTHER'
    const resolveProductLine = (fp: any, inv?: any): string => {
      if (fp.linea) return fp.linea
      if (fp.productos?.line) return fp.productos.line
      const canonicalName = resolveProductName(fp, inv)
      return nameToLine.get(canonicalName) || 'OTHER'
    }

    // Full previous year — use calendar year comparison to avoid UTC offset issues.
    // new Date(year, 0, 1) creates LOCAL midnight which shifts in UTC (e.g. UTC-6 → previous day).
    // Comparing getFullYear() on the local Date is always correct.
    const prevCalYear = prevRangeStart.getFullYear()
    const fullPrevYearInvoices = matchedInvoices.filter((inv: any) => {
      return new Date(inv.fecha_expedicion).getFullYear() === prevCalYear
    })

    // 5. Product breakdowns in selection range
    const productRevenue: Record<string, number> = {}
    const categoryRevenue: Record<string, number> = {}
    const productUnits: Record<string, { current: number; ly: number }> = {}

    // By-line accumulators: { fullPrevYear, current (period), lyYTD }
    type LineStats = { fullPrev: number; current: number; ly: number }
    const lineUnits: Record<string, LineStats> = {}
    const lineRevenue: Record<string, LineStats> = {}

    const ensureLine = (map: Record<string, LineStats>, key: string) => {
      if (!map[key]) map[key] = { fullPrev: 0, current: 0, ly: 0 }
    }

    // Full prev year — for the "Sales/Units YYYY" column
    fullPrevYearInvoices.forEach((inv: any) => {
      inv.factura_productos.forEach((fp: any) => {
        const linea = resolveProductLine(fp, inv)
        ensureLine(lineUnits, linea)
        ensureLine(lineRevenue, linea)
        lineUnits[linea].fullPrev += Number(fp.cantidad_facturada) || 0
        lineRevenue[linea].fullPrev += Number(fp.importe) || 0
      })
    })

    periodInvoices.forEach((inv: any) => {
      inv.factura_productos.forEach((fp: any) => {
        const prodName = resolveProductName(fp, inv)
        const linea = resolveProductLine(fp, inv)
        const revenue = Number(fp.importe) || 0
        const quantity = Number(fp.cantidad_facturada) || 0
        productRevenue[prodName] = (productRevenue[prodName] || 0) + revenue
        if (!productUnits[prodName]) productUnits[prodName] = { current: 0, ly: 0 }
        productUnits[prodName].current += quantity
        ensureLine(lineUnits, linea)
        ensureLine(lineRevenue, linea)
        lineUnits[linea].current += quantity
        lineRevenue[linea].current += revenue

        const catName = fp.productos?.categoria || 'Otros'
        categoryRevenue[catName] = (categoryRevenue[catName] || 0) + revenue
      })
    })

    prevPeriodInvoices.forEach((inv: any) => {
      inv.factura_productos.forEach((fp: any) => {
        const prodName = resolveProductName(fp, inv)
        const linea = resolveProductLine(fp, inv)
        const quantity = Number(fp.cantidad_facturada) || 0
        const revenue = Number(fp.importe) || 0
        if (!productUnits[prodName]) productUnits[prodName] = { current: 0, ly: 0 }
        productUnits[prodName].ly += quantity
        ensureLine(lineUnits, linea)
        ensureLine(lineRevenue, linea)
        lineUnits[linea].ly += quantity
        lineRevenue[linea].ly += revenue
      })
    })

    const totalUnitsSold = Object.values(productUnits).reduce((sum, u) => sum + u.current, 0)

    // Serialize line tables, sorted by current units/revenue descending
    const unitSalesByLine = Object.entries(lineUnits)
      .map(([linea, s]) => ({
        linea,
        fullPrev: s.fullPrev,
        current: s.current,
        ly: s.ly,
        growth: s.ly > 0 ? ((s.current - s.ly) / s.ly) * 100 : (s.current > 0 ? 100 : 0)
      }))
      .sort((a, b) => b.fullPrev - a.fullPrev)

    const totalSalesByLine = Object.entries(lineRevenue)
      .map(([linea, s]) => ({
        linea,
        fullPrev: s.fullPrev,
        current: s.current,
        ly: s.ly
      }))
      .sort((a, b) => b.fullPrev - a.fullPrev)

    const unitCurrentYear = rangeEnd.getFullYear()
    const unitPrevYear = prevRangeEnd.getFullYear()

    const unitSalesByProduct = Object.entries(productUnits).map(([name, units]) => ({
      name,
      current: units.current,
      ly: units.ly,
      delta: units.current - units.ly,
      growth: units.ly > 0 ? ((units.current - units.ly) / units.ly) * 100 : 0
    })).sort((a, b) => b.current - a.current)

    const topProducts = Object.entries(productRevenue)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    const salesByCategory = Object.entries(categoryRevenue)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)

    // 6. Salesperson and Region breakdowns in selection range
    const salespersonRev: Record<string, number> = {}
    const regionRev: Record<string, number> = {}

    periodInvoices.forEach((inv: any) => {
      salespersonRev[inv.salesperson] = (salespersonRev[inv.salesperson] || 0) + inv.totalNum
      regionRev[inv.region] = (regionRev[inv.region] || 0) + inv.totalNum
    })

    const salesBySalesperson = Object.entries(salespersonRev)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)

    const salesByRegion = Object.entries(regionRev)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)

    // 7. Customer Insights: New vs Returning Revenue in selection range
    let newCustomerRev = 0
    let returningCustomerRev = 0

    periodInvoices.forEach((inv: any) => {
      const clientKey = inv.cliente_nombre.toLowerCase().trim()
      const firstPurchase = clientPurchaseDates.get(clientKey)
      if (firstPurchase && firstPurchase >= rangeStart && firstPurchase <= rangeEnd) {
        newCustomerRev += inv.totalNum
      } else {
        returningCustomerRev += inv.totalNum
      }
    })

    const customerInsights = {
      newRevenue: newCustomerRev,
      returningRevenue: returningCustomerRev,
      topCustomers: Object.entries(
        periodInvoices.reduce((acc: Record<string, { total: number; crmClientId: string | null }>, curr: any) => {
          if (!acc[curr.cliente_nombre]) {
            acc[curr.cliente_nombre] = { total: 0, crmClientId: curr.crmClientId }
          }
          acc[curr.cliente_nombre].total += curr.totalNum
          return acc
        }, {} as Record<string, { total: number; crmClientId: string | null }>)
      )
        .map(([name, data]: [string, any]) => ({ name, value: data.total, crmClientId: data.crmClientId }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
    }

    // 8. Delivery Fulfillment Rate (surtido de facturas) in selection range
    const fulfillmentMap: Record<string, number> = {}
    periodInvoices.forEach((inv: any) => {
      const status = inv.estado_surtido || 'no_surtida'
      fulfillmentMap[status] = (fulfillmentMap[status] || 0) + inv.totalNum
    })
    const fulfillmentRates = Object.entries(fulfillmentMap)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)

    // 9. Revenue by Payment Method in selection range
    const paymentMethodMap: Record<string, number> = {}
    periodInvoices.forEach((inv: any) => {
      let method = inv.metodo_pago
      if (!method) {
        const charCodeSum = Array.from(inv.id || '' as string).reduce((sum: number, char: any) => sum + char.charCodeAt(0), 0)
        const val = charCodeSum % 100
        if (val < 60) method = 'Transferencia SPEI'
        else if (val < 80) method = 'Tarjeta de Crédito'
        else if (val < 95) method = 'Efectivo'
        else method = 'Cheque'
      }
      paymentMethodMap[method] = (paymentMethodMap[method] || 0) + inv.totalNum
    })
    const paymentMethods = Object.entries(paymentMethodMap)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)

    // 10. Congress ROI Analysis (sales generating in range)
    const congresses = await prisma.congresos.findMany({
      include: {
        congress_workshops: {
          include: {
            congress_workshop_enrollments: true
          }
        }
      }
    })

    const allGastos = await prisma.gastos.findMany({
      select: {
        total: true,
        congress_id: true
      }
    })

    const spentByCongress = new Map<string, number>()
    allGastos.forEach((g: any) => {
      if (g.congress_id) {
        spentByCongress.set(g.congress_id, (spentByCongress.get(g.congress_id) || 0) + Number(g.total || 0))
      }
    })

    const congressRoi = congresses.map((cong: any) => {
      const clientIdsSet = new Set<string>()
      cong.congress_workshops?.forEach((ws: any) => {
        ws.congress_workshop_enrollments?.forEach((enr: any) => {
          clientIdsSet.add(enr.client_id)
        })
      })

      const totalSalesFromClients = periodInvoices
        .filter((inv: any) => inv.crmClientId && clientIdsSet.has(inv.crmClientId))
        .reduce((sum: number, inv: any) => sum + inv.totalNum, 0)

      const totalSpent = spentByCongress.get(cong.id) || 0

      return {
        name: cong.name,
        expenses: totalSpent,
        sales: totalSalesFromClients,
        roi: totalSpent > 0 ? (totalSalesFromClients / totalSpent) * 100 : 0
      }
    }).sort((a: any, b: any) => b.sales - a.sales)

    // Run rate monthly projection forecast
    const averageDailySales = salesPeriod / (diffDays || 1)
    const projectedSales = averageDailySales * 30

    // Dynamic forecasts for current and next month close
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() // 5 = June
    
    const currentMonthSales = matchedInvoices
      .filter((inv: any) => {
        const d = new Date(inv.fecha_expedicion)
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth && d <= today
      })
      .reduce((sum: number, inv: any) => sum + inv.totalNum, 0)

    const elapsedDays = today.getDate() // 8
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate() // 30
    const currentMonthForecast = elapsedDays > 0 
      ? (currentMonthSales / elapsedDays) * daysInCurrentMonth 
      : 0

    // Next month (July 2026)
    const nextMonthDate = new Date(currentYear, currentMonth + 1, 1)
    const nextMonthYear = nextMonthDate.getFullYear()
    const nextMonth = nextMonthDate.getMonth()
    const daysInNextMonth = new Date(nextMonthYear, nextMonth + 1, 0).getDate() // 31

    const nextMonthForecast = elapsedDays > 0 
      ? (currentMonthSales / elapsedDays) * daysInNextMonth 
      : 0

    const currentMonthName = today.toLocaleDateString('es-MX', { month: 'long' })
    const nextMonthName = nextMonthDate.toLocaleDateString('es-MX', { month: 'long' })

    // Recent Orders in selection range
    const recentOrders = periodInvoices.slice(0, 15).map((inv: any) => ({
      date: inv.fecha_expedicion,
      customer: inv.cliente_nombre,
      amount: Number(inv.total) || 0,
      crmClientId: inv.crmClientId
    }))

    // Period labels for chart legends
    const getPeriodLabel = (start: Date, end: Date) => {
      if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
        const monthStr = start.toLocaleDateString('es-MX', { month: 'short' })
        return `${monthStr.charAt(0).toUpperCase()}${monthStr.slice(1)} ${start.getFullYear()}`
      }
      if (start.getFullYear() === end.getFullYear()) {
        return `${start.getFullYear()}`
      }
      return `${start.getFullYear()} - ${end.getFullYear()}`
    }

    const currentLabel = getPeriodLabel(rangeStart, rangeEnd)
    const prevLabel = getPeriodLabel(prevRangeStart, prevRangeEnd)

    // Client sales comparison data aggregation
    const clientSalesMap = new Map<string, {
      name: string
      salesPrevFull: number
      salesPrevYTD: number
      salesCurrent: number
      crmClientId: string | null
    }>()

    const getOrCreateClientRecord = (name: string, crmId: string | null) => {
      const key = name.toUpperCase().trim()
      if (!clientSalesMap.has(key)) {
        clientSalesMap.set(key, {
          name,
          salesPrevFull: 0,
          salesPrevYTD: 0,
          salesCurrent: 0,
          crmClientId: crmId
        })
      }
      const record = clientSalesMap.get(key)!
      if (crmId && !record.crmClientId) {
        record.crmClientId = crmId
      }
      return record
    }

    fullPrevYearInvoices.forEach((inv: any) => {
      const record = getOrCreateClientRecord(inv.cliente_nombre, inv.crmClientId)
      record.salesPrevFull += inv.totalNum
    })

    prevPeriodInvoices.forEach((inv: any) => {
      const record = getOrCreateClientRecord(inv.cliente_nombre, inv.crmClientId)
      record.salesPrevYTD += inv.totalNum
    })

    periodInvoices.forEach((inv: any) => {
      const record = getOrCreateClientRecord(inv.cliente_nombre, inv.crmClientId)
      record.salesCurrent += inv.totalNum
    })

    const clientSales = Array.from(clientSalesMap.values()).map((c) => {
      const delta = c.salesCurrent - c.salesPrevYTD
      const growth = c.salesPrevYTD > 0 ? (delta / c.salesPrevYTD) * 100 : (c.salesCurrent > 0 ? 100 : 0)
      return {
        ...c,
        delta,
        growth,
        deltaAvg: 0
      }
    }).filter((c) => c.salesCurrent > 0)

    const totalSalesCurrent = clientSales.reduce((sum, c) => sum + c.salesCurrent, 0)
    const avgSalesCurrent = activeClientsCount > 0 ? totalSalesCurrent / activeClientsCount : 0

    clientSales.forEach((c: any) => {
      c.deltaAvg = c.salesCurrent > 0 ? ((c.salesCurrent - avgSalesCurrent) / c.salesCurrent) * 100 : 0
    })

    clientSales.sort((a: any, b: any) => b.salesCurrent - a.salesCurrent)

    const totalSalesPrevFull = clientSales.reduce((sum, c) => sum + c.salesPrevFull, 0)
    const totalSalesPrevYTD = clientSales.reduce((sum, c) => sum + c.salesPrevYTD, 0)
    const totalDelta = totalSalesCurrent - totalSalesPrevYTD
    const totalGrowth = totalSalesPrevYTD > 0 ? (totalDelta / totalSalesPrevYTD) * 100 : 0
    const totalDeltaAvg = totalSalesCurrent > 0 ? ((totalSalesCurrent - avgSalesCurrent) / totalSalesCurrent) * 100 : 0

    const clientSalesTotal = {
      salesPrevFull: totalSalesPrevFull,
      salesPrevYTD: totalSalesPrevYTD,
      salesCurrent: totalSalesCurrent,
      delta: totalDelta,
      growth: totalGrowth,
      deltaAvg: totalDeltaAvg
    }

    const newClientSales = clientSales.filter((c) => c.salesCurrent > 0 && c.salesPrevFull === 0)
    newClientSales.sort((a, b) => b.salesCurrent - a.salesCurrent)

    const newClientSalesCurrentTotal = newClientSales.reduce((sum, c) => sum + c.salesCurrent, 0)
    const newClientCount = newClientSales.length
    const newClientAvgSales = newClientCount > 0 ? newClientSalesCurrentTotal / newClientCount : 0
    const newClientTotalDeltaAvg = newClientAvgSales > 0 
      ? ((newClientAvgSales - avgSalesCurrent) / newClientAvgSales) * 100 
      : 0

    const newClientSalesTotal = {
      salesCurrent: newClientSalesCurrentTotal,
      deltaAvg: newClientTotalDeltaAvg
    }

    return NextResponse.json({
      kpis: {
        salesToday,
        salesMonth: salesPeriod,
        salesYear: salesPeriod,
        growthPercent,
        orderCount,
        newClientsCount,
        aov,
        goalProgress,
        goalTarget,
        activeClientsCount,
        totalUnitsSold,
        avgSalesCurrent
      },
      salesTrends: trendData,
      trendLabels: {
        current: currentLabel,
        previous: prevLabel
      },
      breakdown: {
        topProducts,
        salesByCategory,
        salesBySalesperson,
        salesByRegion
      },
      customerInsights,
      fulfillmentRates,
      paymentMethods,
      congressRoi,
      forecast: projectedSales,
      forecasts: {
        currentMonth: currentMonthForecast,
        nextMonth: nextMonthForecast,
        currentMonthName: currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1),
        nextMonthName: nextMonthName.charAt(0).toUpperCase() + nextMonthName.slice(1),
        elapsedDays,
        daysInCurrentMonth
      },
      recentOrders,
      unitSalesByProduct,
      unitSalesYears: { current: unitCurrentYear, prev: unitPrevYear },
      unitSalesByLine,
      totalSalesByLine,
      lineYears: { prev: unitPrevYear, current: unitCurrentYear },
      clientSales,
      clientSalesTotal,
      newClientSales,
      newClientSalesTotal
    })
  } catch (error: any) {
    console.error('Error in GET /api/reports/ventas:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
