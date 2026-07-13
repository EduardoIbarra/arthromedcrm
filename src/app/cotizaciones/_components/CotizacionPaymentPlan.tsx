'use client'

import { useState } from 'react'
import { Coins, Edit, Save, Plus, Trash2 } from 'lucide-react'

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount)
}
export default function CotizacionPaymentPlan({ quote, onUpdate }: { quote: any; onUpdate: () => void }) {
  const existingPlan = quote?.planes_pago?.[0]
  const [paymentPlan, setPaymentPlan] = useState(existingPlan || null)
  const [isEditingPlan, setIsEditingPlan] = useState(!existingPlan)
  
  const [formNumPayments, setFormNumPayments] = useState<number>(3)
  const [formInstallments, setFormInstallments] = useState<any[]>([])
  const [isSavingPlan, setIsSavingPlan] = useState(false)

  const handleGeneratePlan = () => {
    const total = Number(quote.total) || 0
    const amt = total / formNumPayments
    const newInst = Array.from({ length: formNumPayments }).map((_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() + i)
      return {
        numero: i + 1,
        monto: amt,
        fecha: d.toISOString().split('T')[0]
      }
    })
    setFormInstallments(newInst)
  }

  const handleSavePlan = async () => {
    if (formInstallments.length === 0) return alert('Genere un plan primero.')
    setIsSavingPlan(true)
    try {
      const res = await fetch(`/api/cotizaciones/${quote.id}/plan_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcialidades: formInstallments })
      })
      const data = await res.json()
      if (data.success) {
        setPaymentPlan(data.plan)
        setIsEditingPlan(false)
        onUpdate()
      } else {
        alert(data.error || 'Error')
      }
    } catch (e: any) {
      alert(e.message)
    } finally {
      setIsSavingPlan(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-6">
      <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
        <h4 className="text-sm font-extrabold uppercase text-gray-800 tracking-wider flex items-center gap-2">
          <Coins size={16} className="text-blue-600" />
          Plan de Pagos / Parcialidades
        </h4>
        {paymentPlan && !isEditingPlan && (
          <button onClick={() => setIsEditingPlan(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-bold">
            <Edit size={12} /> Modificar
          </button>
        )}
      </div>

      <div className="p-6">
        {isEditingPlan ? (
          <div className="space-y-6">
            <div className="flex gap-4 items-end">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Número de pagos</label>
                <input 
                  type="number" 
                  className="border rounded px-3 py-2 text-sm w-32" 
                  value={formNumPayments} 
                  onChange={e => setFormNumPayments(Number(e.target.value))} 
                />
              </div>
              <button 
                onClick={handleGeneratePlan}
                className="bg-gray-100 px-4 py-2 rounded text-sm font-medium hover:bg-gray-200"
              >
                Generar
              </button>
            </div>

            {formInstallments.length > 0 && (
              <div className="space-y-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 text-left">No.</th>
                      <th className="p-2 text-left">Monto</th>
                      <th className="p-2 text-left">Fecha de Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formInstallments.map((inst, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">{inst.numero}</td>
                        <td className="p-2">
                          <input 
                            type="number" 
                            className="border rounded px-2 py-1 w-full"
                            value={inst.monto}
                            onChange={e => {
                              const newInst = [...formInstallments]
                              newInst[i].monto = Number(e.target.value)
                              setFormInstallments(newInst)
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="date" 
                            className="border rounded px-2 py-1 w-full"
                            value={inst.fecha}
                            onChange={e => {
                              const newInst = [...formInstallments]
                              newInst[i].fecha = e.target.value
                              setFormInstallments(newInst)
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsEditingPlan(false)} className="px-4 py-2 bg-gray-100 rounded text-sm">Cancelar</button>
                  <button onClick={handleSavePlan} disabled={isSavingPlan} className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                    {isSavingPlan ? 'Guardando...' : 'Guardar Plan'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          paymentPlan ? (
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-2 text-left">No.</th>
                    <th className="p-2 text-left">Monto</th>
                    <th className="p-2 text-left">Vencimiento</th>
                    <th className="p-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentPlan.parcialidades?.map((p: any) => (
                    <tr key={p.id} className="border-b">
                      <td className="p-2 font-medium">{p.numero}</td>
                      <td className="p-2">{formatCurrency(p.monto)}</td>
                      <td className="p-2">{new Date(p.fecha_vencimiento).toLocaleDateString()}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.pagado ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {p.pagado ? 'Pagado' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 text-sm">
              No hay plan de pagos configurado.
            </div>
          )
        )}
      </div>
    </div>
  )
}
