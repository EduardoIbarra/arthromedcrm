import { NextRequest, NextResponse } from 'next/server'
import { generateText, tool, stepCountIs } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required and must be an array' }, { status: 400 })
    }

        const systemPrompt = `Eres un asistente de inteligencia artificial experto en el ERP de Arthromed (una empresa mexicana de equipo médico).
Tu objetivo es ayudar a los usuarios a consultar, analizar, proyectar y comparar los datos de ventas de la empresa con total flexibilidad.

Tienes acceso a herramientas para consultar las ventas mensuales y desgloses de productos a partir de las facturas de clientes (facturas_cliente y factura_productos).
Las ventas se registran mediante facturas, que contienen detalles de los clientes y los productos específicos vendidos (con cantidad, precio unitario e importe).

Reglas de razonamiento y uso de herramientas:
1. IMPORTANTE: Ejecuta las herramientas inmediatamente cuando la pregunta del usuario requiera consultar, comparar o analizar datos. Nunca pidas confirmación ni permisos al usuario para usar las herramientas, ejecútalas directamente en el primer paso.
2. Identifica cuál es la mejor herramienta para responder la consulta:
   - Para VENTAS TOTALES de un periodo, mes, año, tendencias, o comparaciones generales de totales, usa SIEMPRE la herramienta "getSalesSummaryByPeriod". Esta herramienta calcula la suma total directamente en el servidor y te da el valor consolidado de forma 100% exacta sin inducir a errores de cálculo.
   - Para DESGLOSES DE CLIENTES, RANKINGS de clientes, o detalles por cliente, usa "getSalesData" pasando el año ("anio") y/o mes ("mes") si el usuario los especificó.
   - Para CONSULTAS SOBRE PRODUCTOS (cuál se vende más, volúmenes de venta, precios, qué productos compra un cliente, productos vendidos en un periodo, etc.), usa SIEMPRE la herramienta "getProductSalesSummary".
   - Para CONSULTAS DETALLADAS O GRANULARES DE VENTAS DE UN PRODUCTO POR FACTURA (por ejemplo, cuántas unidades de un producto específico se vendieron este año o mes, en qué facturas, a qué clientes, a qué precios y cuáles son los montos de venta detallados), usa "getProductSalesByInvoice".
3. CONSULTAS DE FACTURAS ESPECÍFICAS: Si el usuario te pregunta por facturas específicas (ej. F-240, F-238, o simplemente 240, 238), usa SIEMPRE la herramienta "getSpecificInvoices" pasando los números de factura.
4. PROYECCIONES: Si el usuario te pide proyecciones de ventas (por ejemplo, para el resto del año 2026 o para periodos futuros), obtén el histórico de ventas utilizando "getSalesSummaryByPeriod" (sin filtrar o filtrando por año), analiza el promedio mensual o la tendencia de crecimiento, y calcula una proyección razonada explicándola paso a paso en tu respuesta.
5. Responde siempre en español de manera profesional, analítica, clara y extremadamente concisa. Evita rodeos, saludos redundantes o explicaciones largas.
6. Muestra siempre las cifras monetarias formateadas como pesos mexicanos (ej. $1,250,500.00 MXN).
7. Presenta las respuestas de forma muy estructurada. Usa formato Markdown (tablas, negritas, viñetas) para que los rankings, desgloses y comparaciones sean visualmente impecables y fáciles de leer.
8. Si te preguntan sobre cosas ajenas a las ventas o al ERP, responde amablemente que tu especialidad es el análisis de ventas y datos del ERP de Arthromed.
9. Sé muy directo y breve en tus introducciones y explicaciones de texto (máximo 1 o 2 párrafos cortos antes de cualquier tabla) para que la lectura por voz sea fluida y rápida. No repitas en prosa o en texto los números o datos exactos que ya se detallan en la tabla.
`

    const result = await generateText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages,
      tools: {
        getSalesData: tool({
          description: 'Obtiene las ventas mensuales detalladas de los clientes filtrando por año, mes o nombre del cliente.',
          inputSchema: z.object({
            anio: z.number().optional().describe('Año específico para filtrar (ej. 2026)'),
            mes: z.number().optional().describe('Mes específico para filtrar (1-12, ej. 1 para enero)'),
            clienteNombre: z.string().optional().describe('Nombre del cliente para filtrar (búsqueda parcial insensible a mayúsculas/minúsculas)'),
          }),
          execute: async ({ anio, mes, clienteNombre }: { anio?: number, mes?: number, clienteNombre?: string }) => {
            try {
              const where: any = {
                estado: { notIn: ['anulado', 'cancelada'] }
              }
              
              if (clienteNombre) {
                where.cliente_nombre = {
                  contains: clienteNombre,
                  mode: 'insensitive'
                }
              }

              if (anio) {
                if (mes) {
                  const startDate = new Date(anio, mes - 1, 1)
                  const endDate = new Date(anio, mes, 0, 23, 59, 59, 999)
                  where.fecha_expedicion = { gte: startDate, lte: endDate }
                } else {
                  const startDate = new Date(anio, 0, 1)
                  const endDate = new Date(anio, 11, 31, 23, 59, 59, 999)
                  where.fecha_expedicion = { gte: startDate, lte: endDate }
                }
              } else if (mes) {
                const currentYear = new Date().getFullYear()
                const startDate = new Date(currentYear, mes - 1, 1)
                const endDate = new Date(currentYear, mes, 0, 23, 59, 59, 999)
                where.fecha_expedicion = { gte: startDate, lte: endDate }
              }

              const rawData = await prisma.facturas_cliente.findMany({
                where,
                orderBy: {
                  fecha_expedicion: 'desc'
                }
              })

              return rawData.map((item: any) => ({
                id: item.id,
                cliente_id: item.cliente_id || '',
                cliente_nombre: item.cliente_nombre,
                anio: new Date(item.fecha_expedicion).getFullYear(),
                mes: new Date(item.fecha_expedicion).getMonth() + 1,
                monto: Number(item.total),
                created_at: item.created_at || item.fecha_expedicion
              }))
            } catch (err: any) {
              console.error('Error in getSalesData tool:', err)
              return { error: err.message }
            }
          }
        }),

        getSpecificInvoices: tool({
          description: 'Obtiene el detalle de una o varias facturas específicas, incluyendo sus productos y montos. Úsalo cuando el usuario pregunte por números de factura concretos (ej. F-240, 238).',
          inputSchema: z.object({
            numerosFactura: z.array(z.string()).describe('Lista de números de factura a consultar (ej. ["240", "238", "F-247"])'),
          }),
          execute: async ({ numerosFactura }: { numerosFactura: string[] }) => {
            try {
              // Limpiar los números para quitar prefijos como "F-", "f-", "factura " y dejar solo el valor que está en BD
              const cleanNumbers = numerosFactura.map(num => num.replace(/^(f-|factura\s*|#)/i, '').trim())

              const facturas = await prisma.facturas_cliente.findMany({
                where: {
                  numero_factura: {
                    in: cleanNumbers
                  }
                },
                include: {
                  factura_productos: {
                    select: {
                      producto_nombre: true,
                      cantidad_facturada: true,
                      precio_unitario: true,
                      importe: true
                    }
                  }
                }
              })

              return facturas.map((f: any) => ({
                numero_factura: f.numero_factura,
                cliente_nombre: f.cliente_nombre,
                fecha_expedicion: f.fecha_expedicion,
                estado: f.estado,
                subtotal: Number(f.subtotal || 0),
                iva: Number(f.iva || 0),
                total: Number(f.total || 0),
                productos: f.factura_productos.map((p: any) => ({
                  producto: p.producto_nombre,
                  cantidad: p.cantidad_facturada,
                  precio_unitario: Number(p.precio_unitario || 0),
                  importe: Number(p.importe || 0)
                }))
              }))
            } catch (err: any) {
              console.error('Error in getSpecificInvoices tool:', err)
              return { error: err.message }
            }
          }
        }),

        getSalesSummaryByPeriod: tool({
          description: 'Obtiene el resumen de ventas totales agregadas (sumadas) agrupadas por año y mes.',
          inputSchema: z.object({
            anio: z.number().optional().describe('Año para filtrar el resumen de ventas (ej. 2026). Si se omite, devuelve todo el histórico.'),
          }),
          execute: async ({ anio }: { anio?: number }) => {
            try {
              const where: any = {
                estado: { notIn: ['anulado', 'cancelada'] }
              }

              if (anio) {
                const startDate = new Date(anio, 0, 1)
                const endDate = new Date(anio, 11, 31, 23, 59, 59, 999)
                where.fecha_expedicion = { gte: startDate, lte: endDate }
              }

              const rawData = await prisma.facturas_cliente.findMany({
                where,
                select: {
                  fecha_expedicion: true,
                  total: true
                }
              })

              // Group and aggregate
              const summaryMap: Record<string, { year: number; month: number; total: number; count: number }> = {}
              rawData.forEach((item: any) => {
                const d = new Date(item.fecha_expedicion)
                const year = d.getFullYear()
                const month = d.getMonth() + 1
                const key = `${year}-${month}`
                if (!summaryMap[key]) {
                  summaryMap[key] = { year, month, total: 0, count: 0 }
                }
                summaryMap[key].total += Number(item.total)
                summaryMap[key].count += 1
              })

              return Object.values(summaryMap).sort((a, b) => b.year - a.year || b.month - a.month)
            } catch (err: any) {
              console.error('Error in getSalesSummaryByPeriod tool:', err)
              return { error: err.message }
            }
          }
        }),

        getUniqueClientsWithSales: tool({
          description: 'Obtiene un listado de los nombres únicos de todos los clientes que tienen registros de ventas en el ERP.',
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const result = await prisma.facturas_cliente.groupBy({
                where: { estado: { notIn: ['anulado', 'cancelada'] } },
                by: ['cliente_nombre'],
              })
              return result.map((r: any) => r.cliente_nombre)
            } catch (err: any) {
              console.error('Error in getUniqueClientsWithSales tool:', err)
              return { error: err.message }
            }
          }
        }),

        getProductSalesSummary: tool({
          description: 'Obtiene un resumen agregado de las ventas de productos (nombre, código, cantidad vendida, total facturado y precio promedio) agrupado por producto, filtrando opcionalmente por cliente, año, mes o nombre de producto.',
          inputSchema: z.object({
            productoNombre: z.string().optional().describe('Nombre o parte del nombre del producto (ej. tornillo)'),
            clienteNombre: z.string().optional().describe('Nombre del cliente para ver sus compras (ej. Bio Implants)'),
            anio: z.number().optional().describe('Año específico para filtrar'),
            mes: z.number().optional().describe('Mes específico (1-12) para filtrar'),
            sortBy: z.enum(['cantidad', 'monto']).optional().describe('Orden del resumen: cantidad (volumen de ventas) o monto (ingresos generados)'),
          }),
          execute: async ({ productoNombre, clienteNombre, anio, mes, sortBy = 'cantidad' }) => {
            try {
              const where: any = {}
              
              if (productoNombre) {
                const cleanSearch = productoNombre.replace(/\s+/g, '')
                const cleanWithDash = productoNombre.replace(/\s+/g, '-')
                where.OR = [
                  { producto_nombre: { contains: productoNombre, mode: 'insensitive' } },
                  { producto_nombre: { contains: cleanSearch, mode: 'insensitive' } },
                  { producto_nombre: { contains: cleanWithDash, mode: 'insensitive' } }
                ]
              }

              const invoiceWhere: any = {
                estado: { notIn: ['anulado', 'cancelada'] }
              }

              if (clienteNombre) {
                invoiceWhere.cliente_nombre = {
                  contains: clienteNombre,
                  mode: 'insensitive'
                }
              }

              if (anio) {
                if (mes) {
                  const startDate = new Date(anio, mes - 1, 1)
                  const endDate = new Date(anio, mes, 0, 23, 59, 59, 999)
                  invoiceWhere.fecha_expedicion = { gte: startDate, lte: endDate }
                } else {
                  const startDate = new Date(anio, 0, 1)
                  const endDate = new Date(anio, 11, 31, 23, 59, 59, 999)
                  invoiceWhere.fecha_expedicion = { gte: startDate, lte: endDate }
                }
              } else if (mes) {
                const currentYear = new Date().getFullYear()
                const startDate = new Date(currentYear, mes - 1, 1)
                const endDate = new Date(currentYear, mes, 0, 23, 59, 59, 999)
                invoiceWhere.fecha_expedicion = { gte: startDate, lte: endDate }
              }

              where.facturas_cliente = invoiceWhere

              const items = await prisma.factura_productos.findMany({
                where,
                include: {
                  facturas_cliente: {
                    select: {
                      cliente_nombre: true,
                      fecha_expedicion: true,
                      numero_factura: true
                    }
                  }
                }
              })

              const productMap: Record<string, {
                producto_nombre: string;
                producto_codigo: string | null;
                cantidad_total: number;
                monto_total: number;
                precios_unitarios: number[];
                clientes: Set<string>;
              }> = {}

              items.forEach((item: any) => {
                const key = item.producto_nombre.trim()
                if (!productMap[key]) {
                  productMap[key] = {
                    producto_nombre: item.producto_nombre,
                    producto_codigo: item.producto_codigo,
                    cantidad_total: 0,
                    monto_total: 0,
                    precios_unitarios: [],
                    clientes: new Set()
                  }
                }

                const qty = item.cantidad_facturada
                const totalVal = Number(item.importe || 0)
                const price = Number(item.precio_unitario || 0)

                productMap[key].cantidad_total += qty
                productMap[key].monto_total += totalVal
                if (price > 0) {
                  productMap[key].precios_unitarios.push(price)
                }
                if (item.facturas_cliente?.cliente_nombre) {
                  productMap[key].clientes.add(item.facturas_cliente.cliente_nombre)
                }
              })

              const summaryList = Object.values(productMap).map((p) => {
                const avgPrice = p.precios_unitarios.length > 0 
                  ? p.precios_unitarios.reduce((a, b) => a + b, 0) / p.precios_unitarios.length 
                  : 0

                return {
                  producto_nombre: p.producto_nombre,
                  producto_codigo: p.producto_codigo,
                  cantidad_total: p.cantidad_total,
                  monto_total: p.monto_total,
                  precio_promedio: avgPrice,
                  clientes_unicos: Array.from(p.clientes)
                }
              })

              if (sortBy === 'cantidad') {
                summaryList.sort((a, b) => b.cantidad_total - a.cantidad_total)
              } else {
                summaryList.sort((a, b) => b.monto_total - a.monto_total)
              }

              let transactions: any[] = []
              if (productoNombre && items.length > 0) {
                transactions = items.slice(0, 30).map((item: any) => ({
                  factura_numero: item.facturas_cliente?.numero_factura,
                  fecha: item.facturas_cliente?.fecha_expedicion,
                  cliente: item.facturas_cliente?.cliente_nombre,
                  cantidad: item.cantidad_facturada,
                  precio_unitario: Number(item.precio_unitario || 0),
                  importe: Number(item.importe || 0)
                }))
              }

              return {
                resumen: summaryList.slice(0, 50),
                transacciones_detalladas: transactions
              }
            } catch (err: any) {
              console.error('Error in getProductSalesSummary tool:', err)
              return { error: err.message }
            }
          }
        }),

        getProductSalesByInvoice: tool({
          description: 'Obtiene el desglose detallado de ventas factura por factura para un producto específico, permitiendo ver de forma granular las ventas registradas. Devuelve una lista de transacciones donde cada elemento representa la venta de ese producto en una factura, incluyendo número de factura, fecha, cliente, cantidad facturada, precio unitario e importe.',
          inputSchema: z.object({
            productoNombre: z.string().describe('Nombre del producto a buscar (ej. cannon 3)'),
            clienteNombre: z.string().optional().describe('Nombre del cliente para filtrar las ventas (ej. Bio Implants)'),
            anio: z.number().optional().describe('Año específico para filtrar (ej. 2026)'),
            mes: z.number().optional().describe('Mes específico (1-12) para filtrar (ej. 1 para enero)'),
          }),
          execute: async ({ productoNombre, clienteNombre, anio, mes }) => {
            try {
              const cleanSearch = productoNombre.replace(/\s+/g, '')
              const cleanWithDash = productoNombre.replace(/\s+/g, '-')
              const where: any = {
                OR: [
                  { producto_nombre: { contains: productoNombre, mode: 'insensitive' } },
                  { producto_nombre: { contains: cleanSearch, mode: 'insensitive' } },
                  { producto_nombre: { contains: cleanWithDash, mode: 'insensitive' } }
                ]
              }

              const invoiceWhere: any = {
                estado: { notIn: ['anulado', 'cancelada'] }
              }

              if (clienteNombre) {
                invoiceWhere.cliente_nombre = {
                  contains: clienteNombre,
                  mode: 'insensitive'
                }
              }

              if (anio) {
                if (mes) {
                  const startDate = new Date(anio, mes - 1, 1)
                  const endDate = new Date(anio, mes, 0, 23, 59, 59, 999)
                  invoiceWhere.fecha_expedicion = { gte: startDate, lte: endDate }
                } else {
                  const startDate = new Date(anio, 0, 1)
                  const endDate = new Date(anio, 11, 31, 23, 59, 59, 999)
                  invoiceWhere.fecha_expedicion = { gte: startDate, lte: endDate }
                }
              } else if (mes) {
                const currentYear = new Date().getFullYear()
                const startDate = new Date(currentYear, mes - 1, 1)
                const endDate = new Date(currentYear, mes, 0, 23, 59, 59, 999)
                invoiceWhere.fecha_expedicion = { gte: startDate, lte: endDate }
              }

              where.facturas_cliente = invoiceWhere

              const items = await prisma.factura_productos.findMany({
                where,
                include: {
                  facturas_cliente: {
                    select: {
                      cliente_nombre: true,
                      fecha_expedicion: true,
                      numero_factura: true
                    }
                  }
                }
              })

              // Sort in memory to avoid Prisma order by nested relations limitations
              items.sort((a: any, b: any) => {
                const dateA = a.facturas_cliente?.fecha_expedicion ? new Date(a.facturas_cliente.fecha_expedicion).getTime() : 0
                const dateB = b.facturas_cliente?.fecha_expedicion ? new Date(b.facturas_cliente.fecha_expedicion).getTime() : 0
                return dateB - dateA
              })

              return items.map((item: any) => ({
                factura_numero: item.facturas_cliente?.numero_factura,
                fecha: item.facturas_cliente?.fecha_expedicion,
                cliente: item.facturas_cliente?.cliente_nombre,
                producto: item.producto_nombre,
                cantidad: item.cantidad_facturada,
                precio_unitario: Number(item.precio_unitario || 0),
                importe: Number(item.importe || 0)
              }))
            } catch (err: any) {
              console.error('Error in getProductSalesByInvoice tool:', err)
              return { error: err.message }
            }
          }
        })
      },
      stopWhen: stepCountIs(5),
    })

    return NextResponse.json({
      text: result.text,
      finishReason: result.finishReason,
    })
  } catch (error: any) {
    console.error('Error in AI Chat Route:', error)
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 })
  }
}
