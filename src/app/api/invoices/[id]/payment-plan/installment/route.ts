import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: facturaId } = await params
    const body = await request.json()
    const {
      installmentId,
      pagado,
      fecha_pago,
      notas,
      monto_recibido,
      comprobante_url,
      comprobante_nombre,
    } = body

    if (!facturaId) {
      return NextResponse.json({ error: 'ID de factura es requerido' }, { status: 400 })
    }

    if (!installmentId) {
      return NextResponse.json({ error: 'ID de parcialidad es requerido' }, { status: 400 })
    }

    // Verify installment exists and belongs to a plan linked to this invoice
    const installment = await prisma.parcialidades.findUnique({
      where: { id: installmentId },
      include: {
        planes_pago: true
      }
    })

    if (!installment || installment.planes_pago.factura_id !== facturaId) {
      return NextResponse.json({ error: 'Parcialidad no encontrada o no pertenece a esta factura' }, { status: 404 })
    }

    // Check if there are other unpaid installments
    const otherUnpaidCount = await prisma.parcialidades.count({
      where: {
        plan_pago_id: installment.plan_pago_id,
        pagado: false,
        id: { not: installmentId }
      }
    })

    if (otherUnpaidCount === 0 && pagado && typeof monto_recibido === 'number') {
      const diff = Number(installment.monto) - monto_recibido
      if (diff < -0.005) {
        return NextResponse.json({
          error: `El monto recibido ($${monto_recibido.toFixed(2)}) supera el saldo restante de la última parcialidad ($${Number(installment.monto).toFixed(2)})`
        }, { status: 400 })
      }
    }

    const updatedInstallment = await prisma.$transaction(async (tx: any) => {
      // 1. If we are marking as paid and a custom received amount is provided, adjust subsequent installments
      if (pagado && typeof monto_recibido === 'number') {
        const diff = Number(installment.monto) - monto_recibido
        
        // Update this installment's amount to what we actually received
        await tx.parcialidades.update({
          where: { id: installmentId },
          data: { monto: monto_recibido }
        })

        if (Math.abs(diff) > 0.001) {
          const remainingInstallments = await tx.parcialidades.findMany({
            where: {
              plan_pago_id: installment.plan_pago_id,
              pagado: false,
              numero: { gt: installment.numero }
            },
            orderBy: { numero: 'asc' }
          })

          if (remainingInstallments.length > 0) {
            const adjustment = diff / remainingInstallments.length
            let accumulatedAdjustment = 0

            for (let i = 0; i < remainingInstallments.length; i++) {
              const instToUpdate = remainingInstallments[i]
              let adj = Math.round(adjustment * 100) / 100

              if (i === remainingInstallments.length - 1) {
                adj = Math.round((diff - accumulatedAdjustment) * 100) / 100
              } else {
                accumulatedAdjustment += adj
              }

              const newMonto = Math.max(0, Number(instToUpdate.monto) + adj)
              await tx.parcialidades.update({
                where: { id: instToUpdate.id },
                data: { monto: newMonto }
              })
            }
          } else if (diff > 0.005) {
            // This is the last unpaid installment, and we received less than expected.
            // Create a new installment for the difference!
            const nextMonth = new Date(installment.fecha_vencimiento)
            const currentDay = nextMonth.getDate()
            nextMonth.setMonth(nextMonth.getMonth() + 1)
            if (nextMonth.getDate() !== currentDay) {
              nextMonth.setDate(0)
            }

            await tx.parcialidades.create({
              data: {
                plan_pago_id: installment.plan_pago_id,
                numero: installment.numero + 1,
                monto: diff,
                fecha_vencimiento: nextMonth,
                pagado: false
              }
            })

            // Update plan's number of installments count
            await tx.planes_pago.update({
              where: { id: installment.plan_pago_id },
              data: { numero_parcialidades: installment.planes_pago.numero_parcialidades + 1 }
            })
          }
        }
      }

      // 2. Update the status, payment date, notes, and optional payment proof
      const updateData: any = {
        pagado: pagado,
        fecha_pago: pagado ? (fecha_pago ? new Date(fecha_pago) : new Date()) : null,
        notas: notas !== undefined ? notas : null,
      }

      if (pagado) {
        if (comprobante_url !== undefined) {
          updateData.comprobante_url = comprobante_url || null
        }
        if (comprobante_nombre !== undefined) {
          updateData.comprobante_nombre = comprobante_nombre || null
        }
      } else {
        // Clearing payment also clears attached proof
        updateData.comprobante_url = null
        updateData.comprobante_nombre = null
      }

      const updated = await tx.parcialidades.update({
        where: { id: installmentId },
        data: updateData,
      })

      // 3. Recalculate and update the plan total_con_descuento
      const updatedInstallments = await tx.parcialidades.findMany({
        where: { plan_pago_id: installment.plan_pago_id }
      })
      const newPlanTotal = updatedInstallments.reduce((sum: number, p: any) => sum + Number(p.monto), 0)
      await tx.planes_pago.update({
        where: { id: installment.plan_pago_id },
        data: { total_con_descuento: newPlanTotal }
      })

      // 4. Fetch all installments for this plan to calculate invoice state
      const allInstallments = await tx.parcialidades.findMany({
        where: { plan_pago_id: installment.plan_pago_id }
      })

      const anyPaid = allInstallments.some((p: any) => p.pagado)
      const allPaid = allInstallments.every((p: any) => p.pagado)
      const newInvoiceState = allPaid ? 'pagada' : anyPaid ? 'parcial' : 'pendiente'

      // Calculate invoice payment date (if all paid, use latest payment date)
      let invoicePaymentDate: Date | null = null
      if (allPaid) {
        const dates = allInstallments.map((p: any) => p.fecha_pago).filter(Boolean) as Date[]
        if (dates.length > 0) {
          invoicePaymentDate = new Date(Math.max(...dates.map(d => d.getTime())))
        } else {
          invoicePaymentDate = new Date()
        }
      }

      // First paid installment (by number) drives delivery limit (5 weeks / 60%)
      const paidByNumber = allInstallments
        .filter((p: any) => p.pagado && p.fecha_pago)
        .sort((a: any, b: any) => Number(a.numero) - Number(b.numero))
      const firstPaid = paidByNumber[0] || null
      const totalPagado = allInstallments
        .filter((p: any) => p.pagado)
        .reduce((sum: number, p: any) => sum + Number(p.monto), 0)

      // 5. Update the invoice status + first payment fields
      await tx.facturas_cliente.update({
        where: { id: facturaId },
        data: {
          estado: newInvoiceState,
          fecha_pago: invoicePaymentDate || (firstPaid ? firstPaid.fecha_pago : null),
          primer_pago_fecha: firstPaid ? firstPaid.fecha_pago : null,
          primer_pago_monto: firstPaid ? firstPaid.monto : null,
          total_pagado: totalPagado > 0 ? totalPagado : null,
        }
      })

      return updated
    })

    return NextResponse.json(updatedInstallment)
  } catch (error: any) {
    console.error('Error updating installment:', error)
    return NextResponse.json({ error: error.message || 'Error al actualizar la parcialidad' }, { status: 500 })
  }
}
