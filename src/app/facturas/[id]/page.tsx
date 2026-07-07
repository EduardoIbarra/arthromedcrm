'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, CheckCircle, Info, Edit, Check, X, AlertCircle, Coins, Plus, PackageOpen, Truck } from 'lucide-react'
import AppShell from '@/components/AppShell'

interface FacturaProducto {
  id: string
  producto_nombre: string
  producto_codigo: string | null
  cantidad_facturada: number
  cantidad_entregada: number
  cantidad_pendiente: number
  precio_unitario: number
  importe: number
}

interface RemisionProducto {
  id: string
  producto_nombre: string
  cantidad: number
}

interface Remision {
  id: string
  numero_remision: string
  fecha_remision: string
  estado: string
  observaciones?: string | null
  remision_productos: RemisionProducto[]
}

interface Parcialidad {
  id: string
  plan_pago_id: string
  numero: number
  monto: number
  fecha_vencimiento: string
  pagado: boolean
  fecha_pago: string | null
  notas: string | null
}

interface PlanPago {
  id: string
  folio: string
  cliente_id: string | null
  cliente_nombre: string | null
  fecha: string
  numero_parcialidades: number
  total_sin_descuento: number
  total_con_descuento: number
  interes_porcentaje: number
  interes_moratorio: number
  parcialidades: Parcialidad[]
}

interface Factura {
  id: string
  numero_factura: string
  cliente_nombre: string
  cliente_rfc: string | null
  fecha_expedicion: string
  fecha_vencimiento: string
  estado: string
  estado_surtido: string
  subtotal: number
  iva: number
  total: number
  observaciones: string | null
  alegra_id: string | null
  factura_productos: FacturaProducto[]
  remisiones?: Remision[]
  planes_pago?: PlanPago[]
  fecha_pago: string | null
  metodo_pago: string | null
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pendiente: { label: 'Pendiente',  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100'  },
  pagada:    { label: 'Pagada',     bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  pagado:    { label: 'Pagado',     bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  parcial:   { label: 'Parcial',   bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100'   },
  completa:  { label: 'Completa',  bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-100'  },
  cancelada: { label: 'Cancelada', bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-100'   },
  anulado:   { label: 'Anulado',   bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-100'   },
  borrador:  { label: 'Borrador',  bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-100'  }
}

const ESTADO_SURTIDO_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  no_surtida: { label: 'No Surtida', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100' },
  parcial: { label: 'Parcial', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
  completa: { label: 'Completa', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  surtida: { label: 'Completa', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' }
}

export default function FacturaDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [invoice, setInvoice] = useState<Factura | null>(null)
  const [loading, setLoading] = useState(true)

  // Fulfillment State
  const [editFulfillmentMode, setEditFulfillmentMode] = useState(false)
  const [fulfillmentStatus, setFulfillmentStatus] = useState('')
  const [fulfillmentItems, setFulfillmentItems] = useState<Record<string, number>>({})
  const [isSavingFulfillment, setIsSavingFulfillment] = useState(false)
  const [isSavingEntregada, setIsSavingEntregada] = useState(false)

  // Payment Plan State
  const [paymentPlan, setPaymentPlan] = useState<PlanPago | null>(null)
  const [isEditingPlan, setIsEditingPlan] = useState(false)
  const [formNumPayments, setFormNumPayments] = useState<number | string>(3)
  const [isCustomPayments, setIsCustomPayments] = useState(false)
  const [formInterest, setFormInterest] = useState(0)
  const [formMoratorio, setFormMoratorio] = useState(0)
  const [formInstallments, setFormInstallments] = useState<{ numero: number; monto: number; fecha_vencimiento: string }[]>([])
  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const [pctInputs, setPctInputs] = useState<Record<number, string>>({})
  const [montoInputs, setMontoInputs] = useState<Record<number, string>>({})
  const [activeInput, setActiveInput] = useState<{ numero: number; type: 'monto' | 'pct' } | null>(null)

  // Installment Payment State
  const [payingInstallment, setPayingInstallment] = useState<Parcialidad | null>(null)
  const [payDate, setPayDate] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [payReceivedAmount, setPayReceivedAmount] = useState<number | string>('')
  const [isSavingPayment, setIsSavingPayment] = useState(false)

  // Direct Invoice Payment State
  const [payingInvoice, setPayingInvoice] = useState(false)
  const [invoicePayDate, setInvoicePayDate] = useState('')
  const [invoicePayMethod, setInvoicePayMethod] = useState('Efectivo')
  const [isSavingInvoicePayment, setIsSavingInvoicePayment] = useState(false)

  // Remision Modal State
  const [showRemisionModal, setShowRemisionModal] = useState(false)
  const [editingRemision, setEditingRemision] = useState<Remision | null>(null)
  const [remisionNumero, setRemisionNumero] = useState('')
  const [remisionObservaciones, setRemisionObservaciones] = useState('')
  const [remisionItems, setRemisionItems] = useState<Record<string, number>>({})
  const [isSavingRemision, setIsSavingRemision] = useState(false)

  const handleConfirmInvoicePayment = async () => {
    try {
      setIsSavingInvoicePayment(true)
      const res = await fetch(`/api/invoices/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_pago: invoicePayDate,
          metodo_pago: invoicePayMethod
        })
      })
      if (!res.ok) throw new Error('Error al registrar pago de factura')
      setPayingInvoice(false)
      await fetchInvoice()
    } catch (error) {
      console.error(error)
      alert('Error al registrar pago de factura')
    } finally {
      setIsSavingInvoicePayment(false)
    }
  }

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/invoices/${id}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setInvoice(data)
      setFulfillmentStatus(data.estado_surtido || 'no_surtida')
      
      const activePlan = data.planes_pago?.[0] || null
      setPaymentPlan(activePlan)
      
      const initialItems: Record<string, number> = {}
      data.factura_productos?.forEach((p: FacturaProducto) => {
        initialItems[p.id] = p.cantidad_entregada || 0
      })
      setFulfillmentItems(initialItems)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchInvoice()
  }, [id])

  const handleSaveFulfillment = async () => {
    if (!invoice) return
    try {
      setIsSavingFulfillment(true)
      
      const itemsPayload = invoice.factura_productos.map(p => ({
        id: p.id,
        cantidad_entregada: fulfillmentStatus === 'completa' ? p.cantidad_facturada : 
                            fulfillmentStatus === 'no_surtida' ? 0 : 
                            (fulfillmentItems[p.id] || 0)
      }))

      const res = await fetch(`/api/invoices/${invoice.id}/fulfillment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado_surtido: fulfillmentStatus,
          items: itemsPayload
        })
      })

      if (!res.ok) throw new Error('Error al guardar surtido')
      
      setEditFulfillmentMode(false)
      
      setInvoice({
        ...invoice,
        estado_surtido: fulfillmentStatus,
        factura_productos: invoice.factura_productos.map(p => ({
          ...p,
          cantidad_entregada: itemsPayload.find(i => i.id === p.id)?.cantidad_entregada || 0
        }))
      })

    } catch (error) {
      console.error(error)
      alert('Error al guardar surtido')
    } finally {
      setIsSavingFulfillment(false)
    }
  }


  // Direct Entregada inline save
  const handleSaveEntregada = async (updatedItems: Record<string, number>) => {
    if (!invoice) return
    try {
      setIsSavingEntregada(true)
      const itemsPayload = invoice.factura_productos.map(p => ({
        id: p.id,
        cantidad_entregada: updatedItems[p.id] ?? p.cantidad_entregada ?? 0
      }))
      const res = await fetch(`/api/invoices/${invoice.id}/fulfillment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsPayload })
      })
      if (!res.ok) throw new Error('Error al guardar')
      await fetchInvoice()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSavingEntregada(false)
    }
  }

  // Remision Handlers
  const openCreateRemision = () => {
    setEditingRemision(null)
    setRemisionNumero('')
    setRemisionObservaciones('')
    const initItems: Record<string, number> = {}
    invoice?.factura_productos.forEach(fp => { initItems[fp.id] = 0 })
    setRemisionItems(initItems)
    setShowRemisionModal(true)
  }

  const openEditRemision = (remision: Remision) => {
    setEditingRemision(remision)
    setRemisionNumero(remision.numero_remision)
    setRemisionObservaciones(remision.observaciones || '')
    // Map existing delivered per factura_producto via producto_nombre matching
    const initItems: Record<string, number> = {}
    invoice?.factura_productos.forEach(fp => {
      const existing = remision.remision_productos.find(rp => rp.producto_nombre === fp.producto_nombre)
      initItems[fp.id] = existing?.cantidad || 0
    })
    setRemisionItems(initItems)
    setShowRemisionModal(true)
  }

  const handleSaveRemision = async () => {
    if (!invoice) return
    try {
      setIsSavingRemision(true)
      const itemsPayload = invoice.factura_productos.map(fp => ({
        factura_producto_id: fp.id,
        producto_nombre: fp.producto_nombre,
        cantidad: remisionItems[fp.id] || 0
      }))

      const body = editingRemision
        ? { action: 'edit', remision_id: editingRemision.id, observaciones: remisionObservaciones, items: itemsPayload }
        : { action: 'create', observaciones: remisionObservaciones, items: itemsPayload }

      const res = await fetch(`/api/invoices/${invoice.id}/remisiones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar remisión')
      }

      setShowRemisionModal(false)
      await fetchInvoice()
    } catch (error: any) {
      console.error(error)
      alert(error.message || 'Error al guardar remisión')
    } finally {
      setIsSavingRemision(false)
    }
  }

  // Payment Plan Handlers
  const getNextMonthDate = (monthsToAdd: number) => {
    const d = new Date()
    const currentDay = d.getDate()
    d.setMonth(d.getMonth() + monthsToAdd)
    if (d.getDate() !== currentDay) {
      d.setDate(0)
    }
    return d.toISOString().split('T')[0]
  }

  const handleStartEditPlan = () => {
    setIsEditingPlan(true)
    if (paymentPlan) {
      const n = paymentPlan.numero_parcialidades
      const standardOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24]
      if (standardOptions.includes(n)) {
        setFormNumPayments(n)
        setIsCustomPayments(false)
      } else {
        setFormNumPayments(n)
        setIsCustomPayments(true)
      }
      setFormInterest(Number(paymentPlan.interes_porcentaje))
      setFormMoratorio(Number(paymentPlan.interes_moratorio))
      setFormInstallments(
        paymentPlan.parcialidades.map(p => ({
          numero: p.numero,
          monto: Number(p.monto),
          fecha_vencimiento: new Date(p.fecha_vencimiento).toISOString().split('T')[0]
        }))
      )
      
      const initialPct: Record<number, string> = {}
      const totalWithInterest = Number(invoice?.total || 0) * (1 + Number(paymentPlan.interes_porcentaje) / 100)
      paymentPlan.parcialidades.forEach(p => {
        initialPct[p.numero] = totalWithInterest > 0 ? ((Number(p.monto) / totalWithInterest) * 100).toFixed(1) : '0.0'
      })
      setPctInputs(initialPct)
    } else {
      setFormNumPayments(3)
      setIsCustomPayments(false)
      setFormInterest(0)
      setFormMoratorio(0)
      setFormInstallments([])
      setPctInputs({})
    }
  }

  const generateProposal = () => {
    if (!invoice) return
    const num = typeof formNumPayments === 'string' ? parseInt(formNumPayments) || 0 : formNumPayments
    if (num <= 0) {
      alert('Por favor ingrese un número de pagos válido mayor a 0')
      return
    }
    const interest = formInterest
    const totalWithInterest = Number(invoice.total) * (1 + interest / 100)
    
    const installments = []
    if (num === 1) {
      installments.push({
        numero: 1,
        monto: parseFloat(totalWithInterest.toFixed(2)),
        fecha_vencimiento: getNextMonthDate(1)
      })
    } else {
      // First payment is total/N + 10% of total
      const firstMonto = parseFloat((totalWithInterest / num + totalWithInterest * 0.10).toFixed(2))
      // Rest is distributed equally
      const restMontoBase = (totalWithInterest - firstMonto) / (num - 1)
      let sum = firstMonto
      
      installments.push({
        numero: 1,
        monto: firstMonto,
        fecha_vencimiento: getNextMonthDate(1)
      })
      
      for (let i = 2; i <= num; i++) {
        let monto = parseFloat(restMontoBase.toFixed(2))
        if (i === num) {
          monto = parseFloat((totalWithInterest - sum).toFixed(2))
        } else {
          sum += monto
        }
        installments.push({
          numero: i,
          monto: monto,
          fecha_vencimiento: getNextMonthDate(i)
        })
      }
    }
    setFormInstallments(installments)
    const proposalPct: Record<number, string> = {}
    installments.forEach(inst => {
      proposalPct[inst.numero] = totalWithInterest > 0 ? ((inst.monto / totalWithInterest) * 100).toFixed(1) : '0.0'
    })
    setPctInputs(proposalPct)
  }

  const handleSavePlan = async () => {
    const { valid, message } = validateForm()
    if (!valid) {
      alert(message)
      return
    }

    try {
      setIsSavingPlan(true)
      const res = await fetch(`/api/invoices/${id}/payment-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interes_porcentaje: formInterest,
          interes_moratorio: formMoratorio,
          parcialidades: formInstallments
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Error al guardar el plan de pago')
      }

      setIsEditingPlan(false)
      await fetchInvoice()
    } catch (error: any) {
      console.error(error)
      alert(error.message || 'Error al guardar el plan de pago')
    } finally {
      setIsSavingPlan(false)
    }
  }

  const handleUpdateInstallmentStatus = async (inst: Parcialidad, setPaid: boolean) => {
    if (!setPaid) {
      // Direct revert to unpaid
      if (!confirm('¿Está seguro de revertir el pago de esta parcialidad?')) return
      try {
        setLoading(true)
        const res = await fetch(`/api/invoices/${id}/payment-plan/installment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            installmentId: inst.id,
            pagado: false,
            fecha_pago: null,
            notas: null
          })
        })
        if (!res.ok) throw new Error('Error al actualizar estado')
        await fetchInvoice()
      } catch (error) {
        console.error(error)
        alert('Error al actualizar estado')
      } finally {
        setLoading(false)
      }
    } else {
      // Start payment process
      setPayingInstallment(inst)
      setPayDate(new Date().toISOString().split('T')[0])
      setPayNotes('')
      setPayReceivedAmount(Number(inst.monto))
    }
  }

  const handleConfirmInstallmentPayment = async () => {
    if (!payingInstallment) return
    const recAmt = typeof payReceivedAmount === 'string' ? parseFloat(payReceivedAmount) : payReceivedAmount
    if (isNaN(recAmt) || recAmt < 0) {
      alert('Por favor ingrese un monto recibido válido')
      return
    }

    // Check if this is the final remaining unpaid installment
    const otherUnpaid = paymentPlan?.parcialidades?.filter(
      (p: any) => !p.pagado && p.id !== payingInstallment.id
    ) || []
    const isLastUnpaid = otherUnpaid.length === 0

    if (isLastUnpaid && recAmt > Number(payingInstallment.monto) + 0.005) {
      alert(`El monto recibido (${formatCurrency(recAmt)}) es mayor al saldo pendiente de esta última parcialidad (${formatCurrency(payingInstallment.monto)}). Se ajustará automáticamente para no exceder el total.`);
      setPayReceivedAmount(Number(payingInstallment.monto));
      return;
    }

    try {
      setIsSavingPayment(true)
      const res = await fetch(`/api/invoices/${id}/payment-plan/installment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installmentId: payingInstallment.id,
          pagado: true,
          fecha_pago: payDate,
          notas: payNotes || null,
          monto_recibido: recAmt
        })
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Error al guardar pago')
      }
      setPayingInstallment(null)
      await fetchInvoice()
    } catch (error: any) {
      console.error(error)
      alert(error.message || 'Error al guardar pago')
    } finally {
      setIsSavingPayment(false)
    }
  }

  const validateForm = () => {
    if (formInstallments.length === 0) return { valid: false, message: 'Genere una propuesta primero' }
    
    const totalWithInterest = Number(invoice?.total || 0) * (1 + formInterest / 100)
    const sum = formInstallments.reduce((acc, curr) => acc + Number(curr.monto || 0), 0)
    
    if (Math.abs(sum - totalWithInterest) > 0.05) {
      return { 
        valid: false, 
        message: `La suma de los pagos (${formatCurrency(sum)}) no coincide con el total esperado (${formatCurrency(totalWithInterest)})` 
      }
    }
    
    const firstPayment = formInstallments.find(p => p.numero === 1)
    if (!firstPayment) return { valid: false, message: 'No se encontró el primer pago' }
    
    const firstMonto = Number(firstPayment.monto || 0)
    for (const inst of formInstallments) {
      if (inst.numero > 1 && Number(inst.monto || 0) >= firstMonto) {
        return { 
          valid: false, 
          message: `El primer pago (${formatCurrency(firstMonto)}) debe ser estrictamente mayor que el resto (Pago #${inst.numero}: ${formatCurrency(Number(inst.monto))})` 
        }
      }
    }
    
    return { valid: true, message: '' }
  }

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '$0.00'
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const d = new Date(dateString)
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC'
    }).format(d)
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0763a9]"></div>
        </div>
      </AppShell>
    )
  }

  if (!invoice) {
    return (
      <AppShell>
        <div className="p-8 text-center text-gray-500">Factura no encontrada</div>
      </AppShell>
    )
  }

  const validation = validateForm()

  return (
    <>
    <AppShell>
      <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6 animate-fade-in">
        
        {/* Header and Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/facturas')}
              className="p-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              aria-label="Volver a Facturas"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Factura {invoice.numero_factura}
              </h1>
              <p className="text-sm text-gray-500 font-medium mt-0.5">
                Detalle de factura y plan de pagos
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#e8f1f9] shadow-sm overflow-hidden">
          {/* Header Grid */}
          <div className="grid grid-cols-2 gap-6 bg-gray-50/50 p-6 border-b border-[#e8f1f9]">
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Cliente</p>
              <p className="text-lg font-extrabold text-gray-900">{invoice.cliente_nombre}</p>
              {invoice.cliente_rfc && (
                <p className="text-sm text-gray-500 font-mono mt-1 bg-white inline-block px-2 py-0.5 rounded border border-gray-200 shadow-xs">
                  RFC: {invoice.cliente_rfc}
                </p>
              )}
            </div>
            
            <div className="text-right flex flex-col items-end gap-3">
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Estado Pago</p>
                <div className="flex items-center gap-2">
                  {!['pagada', 'pagado'].includes(invoice.estado) && !paymentPlan && (
                    <button
                      onClick={() => {
                        setPayingInvoice(true)
                        setInvoicePayDate(new Date().toISOString().split('T')[0])
                        setInvoicePayMethod('Efectivo')
                      }}
                      className="text-xs text-[#0763a9] hover:text-[#0a86e3] underline-offset-2 hover:underline font-bold transition-colors cursor-pointer"
                    >
                      (Registrar Pago)
                    </button>
                  )}
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold border ${
                    STATUS_MAP[invoice.estado]?.bg || 'bg-gray-50'
                  } ${STATUS_MAP[invoice.estado]?.text || 'text-gray-700'} ${STATUS_MAP[invoice.estado]?.border || 'border-gray-150'}`}>
                    {STATUS_MAP[invoice.estado]?.label || invoice.estado}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-end gap-2">
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Estado Surtido</p>
                  {!editFulfillmentMode && (
                    <button 
                      onClick={() => setEditFulfillmentMode(true)}
                      className="text-xs text-[#0763a9] hover:text-[#0a86e3] underline-offset-2 hover:underline flex items-center gap-1 font-bold transition-colors"
                    >
                      (Editar)
                    </button>
                  )}
                </div>
                
                {editFulfillmentMode ? (
                  <div className="mt-1 flex justify-end">
                    <select
                      value={fulfillmentStatus}
                      onChange={(e) => setFulfillmentStatus(e.target.value)}
                      className="erp-input w-40 !py-1 text-sm font-semibold shadow-xs"
                    >
                      <option value="no_surtida">No Surtida</option>
                      <option value="parcial">Parcial</option>
                      <option value="completa">Completa</option>
                    </select>
                  </div>
                ) : (
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold border mt-1 ${
                    ESTADO_SURTIDO_MAP[invoice.estado_surtido]?.bg || 'bg-gray-50'
                  } ${ESTADO_SURTIDO_MAP[invoice.estado_surtido]?.text || 'text-gray-700'} ${ESTADO_SURTIDO_MAP[invoice.estado_surtido]?.border || 'border-gray-150'}`}>
                    {ESTADO_SURTIDO_MAP[invoice.estado_surtido]?.label || 'No Surtida'}
                  </span>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100/60">
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Fecha Expedición</p>
              <p className="text-sm text-gray-800 font-semibold flex items-center gap-1.5">
                <Calendar size={14} className="text-[#0763a9]" />
                {formatDate(invoice.fecha_expedicion)}
              </p>
            </div>
            
            <div className="pt-4 border-t border-gray-100/60 text-right">
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Fecha Vencimiento</p>
              <p className="text-sm text-gray-800 font-semibold flex items-center justify-end gap-1.5">
                <Calendar size={14} className="text-amber-600" />
                {formatDate(invoice.fecha_vencimiento)}
              </p>
            </div>

            {(['pagada', 'pagado'].includes(invoice.estado)) && invoice.fecha_pago && (
              <div className="col-span-2 pt-4 pb-2 border-t border-gray-100 flex justify-between items-center bg-emerald-50/40 px-4 py-3 rounded-xl border border-emerald-100/50">
                <span className="text-sm text-emerald-800 font-bold uppercase tracking-wider">Fecha de Pago</span>
                <span className="text-sm text-emerald-950 font-extrabold flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-emerald-150 shadow-sm">
                  <CheckCircle size={16} className="text-emerald-600" />
                  {formatDate(invoice.fecha_pago)}
                </span>
              </div>
            )}

            {invoice.metodo_pago && (
              <div className="col-span-2 py-2 flex justify-between items-center bg-blue-50/40 px-4 py-3 rounded-xl border border-blue-100/50">
                <span className="text-sm text-blue-800 font-bold uppercase tracking-wider">Método de Pago</span>
                <span className="text-sm text-blue-950 font-bold bg-white px-3 py-1 rounded-lg border border-blue-150 shadow-sm">
                  {invoice.metodo_pago}
                </span>
              </div>
            )}
          </div>

          {payingInvoice && (
            <div className="bg-emerald-50/50 border-b border-[#e8f1f9] p-6 space-y-4 animate-fade-in">
              <h5 className="font-extrabold text-sm uppercase text-gray-800 flex items-center gap-1.5">
                <CheckCircle size={16} className="text-emerald-600" />
                Registrar Pago Completo de Factura
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Fecha de Pago</label>
                  <input
                    type="date"
                    value={invoicePayDate}
                    onChange={(e) => setInvoicePayDate(e.target.value)}
                    className="erp-input w-full bg-white text-sm font-semibold shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Método de Pago</label>
                  <select
                    value={invoicePayMethod}
                    onChange={(e) => setInvoicePayMethod(e.target.value)}
                    className="erp-input w-full bg-white text-sm font-semibold shadow-xs"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia electrónica de fondos">Transferencia electrónica de fondos</option>
                    <option value="Tarjetas de crédito">Tarjetas de crédito</option>
                    <option value="Cheque nominativo">Cheque nominativo</option>
                    <option value="Por definir">Por definir</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingInvoice(false)}
                  className="btn-secondary !py-1.5 !px-4 text-xs font-semibold cursor-pointer"
                  disabled={isSavingInvoicePayment}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmInvoicePayment}
                  className="btn-primary !py-1.5 !px-5 text-xs font-bold shadow-xs cursor-pointer"
                  disabled={isSavingInvoicePayment}
                >
                  {isSavingInvoicePayment ? 'Procesando...' : 'Confirmar Pago'}
                </button>
              </div>
            </div>
          )}

          {/* Items List */}
          <div className="p-6">
            <h4 className="text-sm font-extrabold uppercase text-gray-800 tracking-wider mb-4 flex items-center gap-2">
              <span className="bg-[#0763a9] w-2 h-2 rounded-full"></span>
              Detalle de Conceptos
            </h4>
            
            <div className="border border-[#e8f1f9] rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-[#e8f1f9] font-bold text-gray-600">
                    <th className="p-4">Concepto / Producto</th>
                    <th className="p-4">Código</th>
                    <th className="p-4 text-center border-l border-gray-100">Facturada</th>
                    <th className="p-4 text-center bg-blue-50/30">
                      <span className="flex items-center justify-center gap-1.5">
                        Entregada
                        {isSavingEntregada
                          ? <span className="inline-block w-3 h-3 border-2 border-[#0763a9]/30 border-t-[#0763a9] rounded-full animate-spin" />
                          : <span className="text-[10px] text-[#0763a9] font-normal normal-case">(editable)</span>
                        }
                      </span>
                    </th>
                    <th className="p-4 text-right border-l border-gray-100">Precio Unit.</th>
                    <th className="p-4 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8f1f9] text-gray-800">
                  {invoice.factura_productos && invoice.factura_productos.length > 0 ? (
                    invoice.factura_productos.map((prod) => (
                      <tr key={prod.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 font-semibold text-gray-900">{prod.producto_nombre}</td>
                        <td className="p-4 text-gray-500 font-mono text-xs">{prod.producto_codigo || '-'}</td>
                        <td className="p-4 text-center border-l border-gray-100 font-semibold">{prod.cantidad_facturada}</td>
                        <td className="p-4 text-center font-bold bg-blue-50/10">
                          <input
                            type="number"
                            min={0}
                            max={prod.cantidad_facturada}
                            className="w-16 border border-gray-200 rounded-lg px-1 py-1 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-[#0763a9]/30 focus:border-[#0763a9] transition disabled:bg-gray-50 disabled:text-gray-400"
                            value={fulfillmentItems[prod.id] ?? prod.cantidad_entregada ?? 0}
                            disabled={isSavingEntregada}
                            onChange={e => {
                              const val = Math.max(0, Math.min(prod.cantidad_facturada, parseInt(e.target.value) || 0))
                              setFulfillmentItems(prev => ({ ...prev, [prod.id]: val }))
                            }}
                            onBlur={e => {
                              const val = Math.max(0, Math.min(prod.cantidad_facturada, parseInt(e.target.value) || 0))
                              const updated = { ...fulfillmentItems, [prod.id]: val }
                              setFulfillmentItems(updated)
                              handleSaveEntregada(updated)
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                            }}
                          />
                        </td>
                        <td className="p-4 text-right font-mono text-gray-600 border-l border-gray-100">{formatCurrency(prod.precio_unitario)}</td>
                        <td className="p-4 text-right font-bold text-gray-900 font-mono">{formatCurrency(prod.importe)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-400 italic">No hay productos en esta factura</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Actions (Surtido) */}
            {editFulfillmentMode && (
              <div className="mt-6 flex justify-end gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
                <button
                  onClick={() => {
                    setEditFulfillmentMode(false)
                    setFulfillmentStatus(invoice.estado_surtido || 'no_surtida')
                  }}
                  className="btn-secondary !py-2 !px-5 text-sm font-semibold"
                  disabled={isSavingFulfillment}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveFulfillment}
                  className="btn-primary !py-2 !px-6 text-sm font-bold shadow-md hover:shadow-lg transition-all"
                  disabled={isSavingFulfillment}
                >
                  {isSavingFulfillment ? 'Guardando...' : 'Guardar Cambios de Surtido'}
                </button>
              </div>
            )}
          </div>

          {/* Summary Totals */}
          <div className="p-6 bg-gray-50/50 border-t border-[#e8f1f9] flex justify-between items-start">
            
            {/* Left Side: Observations */}
            <div className="w-1/2">
              {invoice.observaciones ? (
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <h4 className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1.5 mb-2">
                    <Info size={14} className="text-[#0763a9]" />
                    Observaciones
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed italic">{invoice.observaciones}</p>
                </div>
              ) : (
                <div />
              )}
            </div>

            {/* Right Side: Totals */}
            <div className="w-72 bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex justify-between text-gray-500 text-sm">
                <span className="font-medium">Subtotal:</span>
                <span className="font-mono">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-sm">
                <span className="font-medium">IVA (16%):</span>
                <span className="font-mono">{formatCurrency(invoice.iva)}</span>
              </div>
              <div className="flex justify-between text-gray-950 font-extrabold text-lg border-t border-gray-100 pt-3 mt-1">
                <span>Total:</span>
                <span className="font-mono text-[#0763a9] tracking-tight">{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Plan Section */}
        <div className="bg-white rounded-2xl border border-[#e8f1f9] shadow-sm overflow-hidden mt-6">
          <div className="p-6 bg-gray-50/50 border-b border-[#e8f1f9] flex justify-between items-center">
            <h4 className="text-sm font-extrabold uppercase text-gray-800 tracking-wider flex items-center gap-2">
              <Coins size={16} className="text-[#0763a9]" />
              Plan de Pagos / Parcialidades
            </h4>
            {paymentPlan && !isEditingPlan && (
              <button
                onClick={handleStartEditPlan}
                className="text-xs text-[#0763a9] hover:text-[#0a86e3] underline-offset-2 hover:underline flex items-center gap-1 font-bold transition-colors cursor-pointer"
              >
                <Edit size={12} /> Modificar Plan
              </button>
            )}
          </div>

          {isEditingPlan ? (
            /* Create / Modify Form */
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-inner">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Número de Pagos</label>
                  {isCustomPayments ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={formNumPayments}
                        onChange={(e) => setFormNumPayments(parseInt(e.target.value) || '')}
                        className="erp-input w-full shadow-xs bg-white text-sm font-semibold"
                        placeholder="Ej. 5"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomPayments(false)
                          setFormNumPayments(3)
                        }}
                        className="text-xs text-[#0763a9] hover:underline font-semibold cursor-pointer shrink-0"
                      >
                        Lista
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formNumPayments}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === 'custom') {
                          setIsCustomPayments(true)
                          setFormNumPayments('')
                        } else {
                          setFormNumPayments(parseInt(val) || 1)
                        }
                      }}
                      className="erp-input w-full shadow-xs bg-white text-sm"
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((n) => (
                        <option key={n} value={n}>{n} {n === 1 ? 'pago' : 'pagos'}</option>
                      ))}
                      <option value="custom">Otro (Personalizado)...</option>
                    </select>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Interés ordinario (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formInterest}
                    onChange={(e) => {
                      const newInterest = parseFloat(e.target.value) || 0
                      setFormInterest(newInterest)
                      if (invoice) {
                        const newTotalWithInterest = Number(invoice.total) * (1 + newInterest / 100)
                        setPctInputs(prev => {
                          const updated = { ...prev }
                          formInstallments.forEach(inst => {
                            updated[inst.numero] = newTotalWithInterest > 0 ? ((inst.monto / newTotalWithInterest) * 100).toFixed(1) : '0.0'
                          })
                          return updated
                        })
                      }
                    }}
                    className="erp-input w-full shadow-xs bg-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Interés Moratorio (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formMoratorio}
                    onChange={(e) => setFormMoratorio(parseFloat(e.target.value) || 0)}
                    className="erp-input w-full shadow-xs bg-white text-sm"
                  />
                </div>

                <div className="md:col-span-3 flex justify-start gap-3">
                  <button
                    type="button"
                    onClick={generateProposal}
                    className="btn-secondary !py-2 !px-5 text-sm font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Coins size={14} /> Generar Propuesta de Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (paymentPlan) {
                        setFormNumPayments(paymentPlan.numero_parcialidades)
                        const standardOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24]
                        setIsCustomPayments(!standardOptions.includes(paymentPlan.numero_parcialidades))
                        setFormInterest(Number(paymentPlan.interes_porcentaje))
                        setFormMoratorio(Number(paymentPlan.interes_moratorio))
                        setFormInstallments(
                          paymentPlan.parcialidades.map(p => ({
                            numero: p.numero,
                            monto: Number(p.monto),
                            fecha_vencimiento: new Date(p.fecha_vencimiento).toISOString().split('T')[0]
                          }))
                        )
                        const initialPct: Record<number, string> = {}
                        const totalWithInterest = Number(invoice?.total || 0) * (1 + Number(paymentPlan.interes_porcentaje) / 100)
                        paymentPlan.parcialidades.forEach(p => {
                          initialPct[p.numero] = totalWithInterest > 0 ? ((Number(p.monto) / totalWithInterest) * 100).toFixed(1) : '0.0'
                        })
                        setPctInputs(initialPct)
                      } else {
                        setFormNumPayments(3)
                        setIsCustomPayments(false)
                        setFormInterest(0)
                        setFormMoratorio(0)
                        setFormInstallments([])
                        setPctInputs({})
                      }
                    }}
                    className="btn-secondary border-red-200 text-red-600 hover:bg-red-50 !py-2 !px-5 text-sm font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <X size={14} /> Restablecer
                  </button>
                </div>
              </div>

              {formInstallments.length > 0 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span className="text-sm text-gray-600 font-medium">
                      Total Factura: <strong className="text-gray-900 font-bold">{formatCurrency(invoice.total)}</strong>
                    </span>
                    <span className="text-sm text-gray-600 font-medium">
                      Con Interés ({formInterest}%): <strong className="text-[#0763a9] font-bold">{formatCurrency(invoice.total * (1 + formInterest / 100))}</strong>
                    </span>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                          <th className="p-3 text-center w-20">Pago #</th>
                          <th className="p-3">Monto del Pago (MXN)</th>
                          <th className="p-3">Fecha de Vencimiento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {formInstallments.map((inst, index) => {
                          const totalWithInterest = Number(invoice.total || 0) * (1 + formInterest / 100)
                          return (
                            <tr key={index} className="hover:bg-gray-50/50">
                              <td className="p-3 text-center font-bold text-gray-700">#{inst.numero}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-3">
                                  <div className="relative rounded-md shadow-xs w-36">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                      <span className="text-gray-400 sm:text-sm">$</span>
                                    </div>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      value={
                                        activeInput?.numero === inst.numero && activeInput?.type === 'monto'
                                          ? (montoInputs[inst.numero] ?? '')
                                          : inst.monto
                                      }
                                      onFocus={() => {
                                        setMontoInputs(prev => ({ ...prev, [inst.numero]: inst.monto.toString() }))
                                        setActiveInput({ numero: inst.numero, type: 'monto' })
                                      }}
                                      onBlur={() => setActiveInput(null)}
                                      onChange={(e) => {
                                        const rawVal = e.target.value
                                        setMontoInputs(prev => ({ ...prev, [inst.numero]: rawVal }))
                                        const val = parseFloat(rawVal) || 0
                                        setFormInstallments(prev => prev.map(p => p.numero === inst.numero ? { ...p, monto: val } : p))
                                        const pct = totalWithInterest > 0 ? ((val / totalWithInterest) * 100).toFixed(1) : '0.0'
                                        setPctInputs(prev => ({ ...prev, [inst.numero]: pct }))
                                      }}
                                      className="erp-input !pl-7 !py-1 text-sm font-semibold w-full bg-white shadow-inner no-spinner"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-lg shadow-inner">
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      max="100"
                                      value={
                                        activeInput?.numero === inst.numero && activeInput?.type === 'pct'
                                          ? (pctInputs[inst.numero] ?? '')
                                          : (totalWithInterest > 0 ? ((inst.monto / totalWithInterest) * 100).toFixed(1) : '0.0')
                                      }
                                      onFocus={() => {
                                        const currentPct = totalWithInterest > 0 ? ((inst.monto / totalWithInterest) * 100).toFixed(1) : '0.0'
                                        setPctInputs(prev => ({ ...prev, [inst.numero]: currentPct }))
                                        setActiveInput({ numero: inst.numero, type: 'pct' })
                                      }}
                                      onBlur={() => setActiveInput(null)}
                                      onChange={(e) => {
                                        const rawVal = e.target.value
                                        setPctInputs(prev => ({ ...prev, [inst.numero]: rawVal }))
                                        const pctVal = parseFloat(rawVal) || 0
                                        const newMonto = parseFloat(((pctVal / 100) * totalWithInterest).toFixed(2))
                                        setFormInstallments(prev => prev.map(p => p.numero === inst.numero ? { ...p, monto: newMonto } : p))
                                      }}
                                      className="w-12 text-xs font-bold text-gray-700 bg-transparent outline-none text-center no-spinner"
                                      placeholder="%"
                                    />
                                    <span className="text-xs text-gray-400 font-bold">%</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3">
                                <input
                                  type="date"
                                  value={inst.fecha_vencimiento}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setFormInstallments(prev => prev.map(p => p.numero === inst.numero ? { ...p, fecha_vencimiento: val } : p))
                                  }}
                                  className="erp-input !py-1 text-sm font-semibold max-w-[200px] bg-white shadow-inner"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Dynamic validation messages */}
                  {!validation.valid && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-850 flex items-start gap-3 shadow-xs animate-pulse">
                      <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                      <div className="text-sm font-medium leading-relaxed">{validation.message}</div>
                    </div>
                  )}

                  {validation.valid && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-850 flex items-start gap-3 shadow-xs">
                      <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                      <div className="text-sm font-medium leading-relaxed">
                        El plan cumple con las validaciones: El primer pago es el mayor y la suma coincide con el total esperado.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Form buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditingPlan(false)}
                  className="btn-secondary !py-2 !px-5 text-sm font-semibold cursor-pointer"
                  disabled={isSavingPlan}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSavePlan}
                  className="btn-primary !py-2 !px-6 text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                  disabled={isSavingPlan || !validation.valid}
                >
                  {isSavingPlan ? 'Guardando...' : 'Guardar Plan de Pago'}
                </button>
              </div>
            </div>
          ) : paymentPlan ? (
            /* View Mode */
            <div className="p-6 space-y-6">
              {/* Plan Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-gray-50/50 p-5 rounded-xl border border-gray-100 shadow-xs">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Folio del Plan</p>
                  <p className="text-base font-extrabold text-gray-900">{paymentPlan.folio}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Interés ordinario</p>
                  <p className="text-base font-semibold text-gray-800">{paymentPlan.interes_porcentaje}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Interés Moratorio</p>
                  <p className="text-base font-semibold text-gray-800">{paymentPlan.interes_moratorio}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Total con Interés</p>
                  <p className="text-base font-extrabold text-[#0763a9] font-mono">{formatCurrency(paymentPlan.total_con_descuento)}</p>
                </div>
              </div>

              {/* Installment status overlay when registering a payment */}
              {payingInstallment && (
                <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-5 shadow-xs space-y-4 animate-fade-in">
                  <h5 className="font-extrabold text-sm uppercase text-gray-800 flex items-center gap-1.5">
                    <Coins size={16} className="text-amber-600" />
                    Registrar Pago de Parcialidad #{payingInstallment.numero}
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Monto Recibido (MXN)</label>
                      <div className="relative rounded-md shadow-xs">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-400 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payReceivedAmount}
                          onChange={(e) => setPayReceivedAmount(e.target.value)}
                          className="erp-input !pl-7 w-full bg-white text-sm font-semibold"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Esperado: {formatCurrency(payingInstallment.monto)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Fecha de Pago</label>
                      <input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="erp-input w-full bg-white text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">Notas / Referencia</label>
                      <input
                        type="text"
                        value={payNotes}
                        onChange={(e) => setPayNotes(e.target.value)}
                        placeholder="Ej. Transferencia SPEI, cheque, etc."
                        className="erp-input w-full bg-white text-sm"
                      />
                    </div>
                  </div>

                  {payingInstallment && Math.abs(Number(payReceivedAmount || 0) - Number(payingInstallment.monto)) > 0.005 && (
                    <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5 font-semibold leading-relaxed animate-pulse">
                      ⚠️ El monto recibido es diferente al esperado. Al guardar, la diferencia se distribuirá y ajustará automáticamente en las parcialidades restantes.
                    </div>
                  )}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setPayingInstallment(null)}
                      className="btn-secondary !py-1.5 !px-4 text-xs font-semibold cursor-pointer"
                      disabled={isSavingPayment}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmInstallmentPayment}
                      className="btn-primary !py-1.5 !px-5 text-xs font-bold shadow-xs cursor-pointer"
                      disabled={isSavingPayment}
                    >
                      {isSavingPayment ? 'Procesando...' : 'Confirmar Pago'}
                    </button>
                  </div>
                </div>
              )}

              {/* Installments Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                      <th className="p-4 text-center w-20">Pago</th>
                      <th className="p-4">Vencimiento</th>
                      <th className="p-4 text-right">Monto</th>
                      <th className="p-4 text-center">Estado</th>
                      <th className="p-4">Detalles de Pago</th>
                      <th className="p-4 text-center w-40">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-800">
                    {paymentPlan.parcialidades.map((inst) => (
                      <tr key={inst.id} className="hover:bg-gray-50/50">
                        <td className="p-4 text-center font-bold">#{inst.numero}</td>
                        <td className="p-4 font-semibold text-gray-700">{formatDate(inst.fecha_vencimiento)}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-extrabold font-mono text-gray-900">{formatCurrency(inst.monto)}</span>
                            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 shrink-0">
                              {paymentPlan.total_con_descuento > 0 ? ((Number(inst.monto) / Number(paymentPlan.total_con_descuento)) * 100).toFixed(1) : '0.0'}%
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            inst.pagado 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                              : 'bg-amber-50 text-amber-700 border-amber-150'
                          }`}>
                            {inst.pagado ? 'Pagado' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="p-4 text-xs">
                          {inst.pagado ? (
                            <div className="space-y-0.5">
                              <p className="text-gray-500">Pagado el: <strong className="font-semibold text-gray-700">{formatDate(inst.fecha_pago)}</strong></p>
                              {inst.notas && <p className="text-gray-400 italic">"{inst.notas}"</p>}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Sin registros</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {inst.pagado ? (
                            <button
                              onClick={() => handleUpdateInstallmentStatus(inst, false)}
                              className="text-xs text-rose-600 hover:text-rose-800 font-bold border border-rose-200 rounded px-2.5 py-1 bg-white hover:bg-rose-50 transition-colors shadow-xs cursor-pointer"
                            >
                              Revertir Pago
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateInstallmentStatus(inst, true)}
                              className="text-xs text-[#0763a9] hover:text-[#0a86e3] font-bold border border-blue-200 rounded px-2.5 py-1 bg-white hover:bg-blue-50 transition-colors shadow-xs cursor-pointer"
                              disabled={!!payingInstallment}
                            >
                              Registrar Pago
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Call to Action Mode */
            <div className="p-10 text-center space-y-4 bg-gray-50/20">
              <div className="inline-flex p-4 rounded-full bg-blue-50 text-[#0763a9] border border-blue-100">
                <Coins size={32} />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h5 className="font-bold text-gray-800 text-lg">Sin Plan de Pagos</h5>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Esta factura aún no cuenta con un plan de pagos diferidos (parcialidades). Puede crear uno ahora para dividir el saldo.
                </p>
              </div>
              <div>
                <button
                  onClick={handleStartEditPlan}
                  className="btn-primary !py-2.5 !px-6 text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  Configurar Plan de Pagos
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Remisiones Asociadas */}
        {invoice.remisiones !== undefined && (
          <div className="bg-white rounded-2xl border border-[#e8f1f9] shadow-sm overflow-hidden mt-6">
            <div className="p-6 bg-gray-50/50 border-b border-[#e8f1f9] flex items-center justify-between">
              <h4 className="text-sm font-extrabold uppercase text-gray-800 tracking-wider flex items-center gap-2">
                <span className="bg-[#0763a9] w-2 h-2 rounded-full"></span>
                Remisiones Asociadas
              </h4>
              <button
                onClick={openCreateRemision}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0763a9] hover:bg-[#0a86e3] text-white text-xs font-bold transition-colors shadow-sm"
              >
                <Plus size={13} />
                Generar Remisión
              </button>
            </div>
            <div className="p-6 space-y-6">
              {invoice.remisiones.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <PackageOpen size={36} className="mb-2 opacity-40" />
                  <p className="text-sm font-medium">Sin remisiones aún</p>
                  <p className="text-xs mt-1">Genera la primera remisión con el botón de arriba</p>
                </div>
              )}
              {invoice.remisiones.map((remision) => (
                <div key={remision.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Truck size={15} className="text-[#0763a9]" />
                      <div>
                        <span className="text-xs text-gray-400 uppercase font-bold tracking-wider mr-2">Remisión:</span>
                        <span className="font-extrabold text-gray-900">{remision.numero_remision}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 font-semibold flex items-center gap-1">
                        <Calendar size={12} className="text-gray-400" />
                        {formatDate(remision.fecha_remision)}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                        {remision.estado}
                      </span>
                      <button
                        onClick={() => openEditRemision(remision)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[#0763a9] text-[#0763a9] hover:bg-[#0763a9]/5 text-xs font-bold transition-colors"
                      >
                        <Edit size={11} />
                        Editar
                      </button>
                    </div>
                  </div>
                  {remision.observaciones && (
                    <div className="bg-white px-4 py-3 border-b border-gray-100">
                      <h4 className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1.5 mb-1">
                        <Info size={14} className="text-[#0763a9]" />
                        Observaciones
                      </h4>
                      <p className="text-sm text-gray-700 italic">{remision.observaciones}</p>
                    </div>
                  )}
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="p-3 font-semibold">Producto</th>
                        <th className="p-3 font-semibold text-right">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-800">
                      {remision.remision_productos && remision.remision_productos.length > 0 ? (
                        remision.remision_productos.map((rp) => (
                          <tr key={rp.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-3 font-medium text-gray-900">{rp.producto_nombre}</td>
                            <td className="p-3 text-right font-semibold">{rp.cantidad}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="p-4 text-center text-gray-400 italic text-xs">No hay productos</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </AppShell>

    {/* Remision Modal */}
    {showRemisionModal && invoice && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0763a9]/10 flex items-center justify-center">
                <Truck size={18} className="text-[#0763a9]" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-gray-900">
                  {editingRemision ? 'Editar Remisión' : 'Generar Remisión'}
                </h2>
                <p className="text-xs text-gray-400">
                  {editingRemision ? `Remisión ${editingRemision.numero_remision}` : invoice.numero_factura}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowRemisionModal(false)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Auto-generated number hint */}
            {!editingRemision && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
                <span className="text-blue-500 text-xs">ℹ</span>
                <p className="text-xs text-blue-700 font-medium">El número de remisión se generará automáticamente (ej: REM-0001)</p>
              </div>
            )}

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 tracking-wider mb-1.5">
                Observaciones
              </label>
              <textarea
                value={remisionObservaciones}
                onChange={e => setRemisionObservaciones(e.target.value)}
                placeholder="Notas adicionales (opcional)..."
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0763a9]/30 focus:border-[#0763a9] transition resize-none"
              />
            </div>

            {/* Products Table */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 tracking-wider mb-2">
                Piezas entregadas en esta remisión
              </label>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left text-xs font-bold uppercase text-gray-500 tracking-wider">Producto</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold uppercase text-gray-500 tracking-wider w-28">Facturado</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold uppercase text-gray-500 tracking-wider w-28">Ya entregado</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold uppercase text-gray-500 tracking-wider w-28">Esta remisión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoice.factura_productos.map((fp) => (
                      <tr key={fp.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 text-sm">{fp.producto_nombre}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{fp.cantidad_facturada}</td>
                        <td className="px-4 py-3 text-center text-gray-500">
                          {editingRemision
                            ? (fp.cantidad_entregada ?? 0) - (editingRemision.remision_productos.find(rp => rp.producto_nombre === fp.producto_nombre)?.cantidad || 0)
                            : (fp.cantidad_entregada ?? 0)
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={fp.cantidad_facturada}
                            value={remisionItems[fp.id] ?? 0}
                            onChange={e => setRemisionItems(prev => ({ ...prev, [fp.id]: Math.max(0, Number(e.target.value)) }))}
                            className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-[#0763a9]/30 focus:border-[#0763a9] transition"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2 italic">
                El estado de surtido de la factura se recalculará automáticamente: 
                <strong> No Surtida</strong>, <strong>Parcial</strong> o <strong>Completa</strong>.
              </p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <button
              onClick={() => setShowRemisionModal(false)}
              disabled={isSavingRemision}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveRemision}
              disabled={isSavingRemision}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#0763a9] hover:bg-[#0a86e3] text-white text-sm font-bold transition-colors shadow-sm disabled:opacity-60"
            >
              {isSavingRemision ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check size={15} />
              )}
              {editingRemision ? 'Guardar Cambios' : 'Generar Remisión'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
