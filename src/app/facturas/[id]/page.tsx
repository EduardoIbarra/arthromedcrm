'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, CheckCircle, Info } from 'lucide-react'
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
  remision_productos: RemisionProducto[]
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
  completa: { label: 'Completa', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' }
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

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/invoices/${id}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setInvoice(data)
      setFulfillmentStatus(data.estado_surtido || 'no_surtida')
      
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

  return (
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
                Detalle de factura y surtido
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
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold border ${
                  STATUS_MAP[invoice.estado]?.bg || 'bg-gray-50'
                } ${STATUS_MAP[invoice.estado]?.text || 'text-gray-700'} ${STATUS_MAP[invoice.estado]?.border || 'border-gray-150'}`}>
                  {STATUS_MAP[invoice.estado]?.label || invoice.estado}
                </span>
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
                    <th className="p-4 text-center bg-blue-50/30">Entregada</th>
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
                          {editFulfillmentMode && fulfillmentStatus === 'parcial' ? (
                            <input
                              type="number"
                              min="0"
                              max={prod.cantidad_facturada}
                              className="erp-input w-20 text-center !py-1.5 !px-2 text-sm mx-auto shadow-inner bg-white"
                              value={fulfillmentItems[prod.id] ?? 0}
                              onChange={(e) => setFulfillmentItems(prev => ({ ...prev, [prod.id]: parseInt(e.target.value) || 0 }))}
                            />
                          ) : (
                            <span className={prod.cantidad_entregada >= prod.cantidad_facturada ? 'text-emerald-600' : prod.cantidad_entregada > 0 ? 'text-amber-600' : 'text-rose-600'}>
                              {prod.cantidad_entregada || 0}
                            </span>
                          )}
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

        {/* Remisiones Asociadas */}
        {invoice.remisiones && invoice.remisiones.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#e8f1f9] shadow-sm overflow-hidden mt-6">
            <div className="p-6 bg-gray-50/50 border-b border-[#e8f1f9]">
              <h4 className="text-sm font-extrabold uppercase text-gray-800 tracking-wider flex items-center gap-2">
                <span className="bg-[#0763a9] w-2 h-2 rounded-full"></span>
                Remisiones Asociadas
              </h4>
            </div>
            <div className="p-6 space-y-6">
              {invoice.remisiones.map((remision) => (
                <div key={remision.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <div>
                      <span className="text-xs text-gray-400 uppercase font-bold tracking-wider mr-2">Remisión:</span>
                      <span className="font-extrabold text-gray-900">{remision.numero_remision}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-500 font-semibold flex items-center gap-1">
                        <Calendar size={12} className="text-gray-400" />
                        {formatDate(remision.fecha_remision)}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                        {remision.estado}
                      </span>
                    </div>
                  </div>
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
  )
}
