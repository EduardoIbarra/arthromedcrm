import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const plan = await prisma.planes_pago.findFirst({
      where: { factura_id: id },
      include: {
        parcialidades: {
          orderBy: {
            numero: 'asc'
          }
        }
      }
    })

    return NextResponse.json(plan || null)
  } catch (error: any) {
    console.error('Error fetching payment plan:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { interes_porcentaje = 0, interes_moratorio = 0, parcialidades } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    if (!Array.isArray(parcialidades) || parcialidades.length === 0) {
      return NextResponse.json({ error: 'Se requieren parcialidades' }, { status: 400 })
    }

    // Fetch invoice
    const factura = await prisma.facturas_cliente.findUnique({
      where: { id }
    })

    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    // Validate first payment is greater than the rest
    const firstPayment = parcialidades.find((p: any) => p.numero === 1)
    if (!firstPayment) {
      return NextResponse.json({ error: 'Debe incluir el primer pago (número 1)' }, { status: 400 })
    }
    const firstMonto = Number(firstPayment.monto)
    for (const p of parcialidades) {
      if (p.numero > 1 && Number(p.monto) >= firstMonto) {
        return NextResponse.json({ error: 'El primer pago debe ser estrictamente mayor que el resto' }, { status: 400 })
      }
    }

    // Validate total amount matches (Invoice Total + Interest)
    const originalTotal = Number(factura.total || 0)
    const expectedTotal = Math.round((originalTotal * (1 + interes_porcentaje / 100)) * 100) / 100
    const sumMontos = Math.round(parcialidades.reduce((sum, p: any) => sum + Number(p.monto), 0) * 100) / 100

    if (Math.abs(expectedTotal - sumMontos) > 0.05) {
      return NextResponse.json({ 
        error: `La suma de los pagos (${sumMontos}) no coincide con el total esperado (${expectedTotal})` 
      }, { status: 400 })
    }

    // Get current user session
    let usuarioId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        usuarioId = session.user.id
      }
    } catch (authError) {
      console.warn('Could not get session for payment plan creation:', authError)
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Delete existing plans associated with this invoice (cascades to parcialidades)
      await tx.planes_pago.deleteMany({
        where: { factura_id: id }
      })

      // 2. Create new planes_pago
      const createdPlan = await tx.planes_pago.create({
        data: {
          folio: `PP-${factura.numero_factura}`,
          cliente_id: factura.cliente_id,
          cliente_nombre: factura.cliente_nombre,
          usuario_id: usuarioId,
          fecha: new Date(),
          numero_parcialidades: parcialidades.length,
          total_sin_descuento: originalTotal,
          total_con_descuento: expectedTotal,
          interes_porcentaje: interes_porcentaje,
          interes_moratorio: interes_moratorio,
          factura_id: id,
          parcialidades: {
            create: parcialidades.map((p: any) => ({
              numero: p.numero,
              monto: Number(p.monto),
              fecha_vencimiento: new Date(p.fecha_vencimiento),
              pagado: p.pagado || false,
              fecha_pago: p.fecha_pago ? new Date(p.fecha_pago) : null,
              notas: p.notas || null
            }))
          }
        },
        include: {
          parcialidades: {
            orderBy: {
              numero: 'asc'
            }
          }
        }
      })

      // 3. Update invoice status to 'pendiente' or 'parcial' based on paid status of the new plan
      const anyPaid = parcialidades.some((p: any) => p.pagado)
      const allPaid = parcialidades.every((p: any) => p.pagado)
      const newInvoiceState = allPaid ? 'pagada' : anyPaid ? 'parcial' : 'pendiente'
      
      await tx.facturas_cliente.update({
        where: { id },
        data: { estado: newInvoiceState }
      })

      return createdPlan
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error creating payment plan:', error)
    return NextResponse.json({ error: error.message || 'Error al crear el plan de pago' }, { status: 500 })
  }
}
