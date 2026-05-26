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

Tienes acceso a herramientas para consultar las ventas mensuales por cliente de la base de datos (ventas_mensuales_cliente).
Las ventas se registran mensualmente por cliente, identificadas por el año (anio), mes (1-12) y el monto total en pesos mexicanos (MXN).

Reglas de razonamiento y uso de herramientas:
1. IMPORTANTE: Ejecuta las herramientas inmediatamente cuando la pregunta del usuario requiera consultar, comparar o analizar datos. Nunca pidas confirmación ni permisos al usuario para usar las herramientas, ejecútalas directamente en el primer paso.
2. Identifica cuál es la mejor herramienta para responder la consulta:
   - Para VENTAS TOTALES de un periodo, mes, año, tendencias, o comparaciones generales de totales, usa SIEMPRE la herramienta "getSalesSummaryByPeriod". Esta herramienta calcula la suma total directamente en el servidor y te da el valor consolidado de forma 100% exacta sin inducir a errores de cálculo.
   - Para DESGLOSES DE CLIENTES, RANKINGS de clientes, o detalles por cliente, usa "getSalesData" pasando el año ("anio") y/o mes ("mes") si el usuario los especificó. Si necesitas hacer rankings anuales o análisis más amplios, puedes omitir el parámetro "mes" para traer todo el año.
3. PROYECCIONES: Si el usuario te pide proyecciones de ventas (por ejemplo, para el resto del año 2026 o para periodos futuros), obtén el histórico de ventas utilizando "getSalesSummaryByPeriod" (sin filtrar o filtrando por año), analiza el promedio mensual o la tendencia de crecimiento, y calcula una proyección razonada explicándola paso a paso en tu respuesta.
4. Responde siempre en español de manera profesional, analítica, clara y concisa.
5. Muestra siempre las cifras monetarias formateadas como pesos mexicanos (ej. $1,250,500.00 MXN).
6. Presenta las respuestas de forma muy estructurada. Usa formato Markdown (tablas, negritas, viñetas) para que los rankings, desgloses y comparaciones sean visualmente impecables y fáciles de leer.
7. Si te preguntan sobre cosas ajenas a las ventas o al ERP, responde amablemente que tu especialidad es el análisis de ventas y datos del ERP de Arthromed.
`

    const result = await generateText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages,
      tools: {
        getSalesData: tool({
          description: 'Obtiene las ventas mensuales detalladas de los clientes filtrando por año, mes o nombre del cliente.',
          parameters: z.object({
            anio: z.number().optional().describe('Año específico para filtrar (ej. 2026)'),
            mes: z.number().optional().describe('Mes específico para filtrar (1-12, ej. 1 para enero)'),
            clienteNombre: z.string().optional().describe('Nombre del cliente para filtrar (búsqueda parcial insensible a mayúsculas/minúsculas)'),
          }),
          execute: async ({ anio, mes, clienteNombre }) => {
            try {
              const where: any = {}
              if (anio) {
                where.anio = anio
              }
              if (mes) {
                where.mes = mes
              }
              if (clienteNombre) {
                where.cliente_nombre = {
                  contains: clienteNombre,
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

              return rawData.map((item: any) => ({
                ...item,
                id: item.id.toString()
              }))
            } catch (err: any) {
              console.error('Error in getSalesData tool:', err)
              return { error: err.message }
            }
          }
        }),

        getSalesSummaryByPeriod: tool({
          description: 'Obtiene el resumen de ventas totales agregadas (sumadas) agrupadas por año y mes.',
          parameters: z.object({
            anio: z.number().optional().describe('Año para filtrar el resumen de ventas (ej. 2026). Si se omite, devuelve todo el histórico.'),
          }),
          execute: async ({ anio }) => {
            try {
              const where: any = {}
              if (anio) {
                where.anio = anio
              }

              const rawData = await prisma.ventas_mensuales_cliente.findMany({
                where,
                select: {
                  anio: true,
                  mes: true,
                  monto: true
                }
              })

              // Group and aggregate
              const summaryMap: Record<string, { year: number; month: number; total: number; count: number }> = {}
              rawData.forEach((item: any) => {
                const key = `${item.anio}-${item.mes}`
                if (!summaryMap[key]) {
                  summaryMap[key] = { year: item.anio, month: item.mes, total: 0, count: 0 }
                }
                summaryMap[key].total += item.monto
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
          parameters: z.object({}),
          execute: async () => {
            try {
              const result = await prisma.ventas_mensuales_cliente.groupBy({
                by: ['cliente_nombre'],
              })
              return result.map(r => r.cliente_nombre)
            } catch (err: any) {
              console.error('Error in getUniqueClientsWithSales tool:', err)
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
