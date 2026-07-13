'use client'

import { useState } from 'react'
import { Coins, Edit } from 'lucide-react'

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount)
}

type InstallmentForm = {
  numero: number
  monto: number
  fecha: string
  porcentaje: number
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function buildInstallments(total: number, numPayments: number): InstallmentForm[] {
  const n = Math.max(1, Math.floor(numPayments) || 1)
  const installments: InstallmentForm[] = []

  if (n === 1) {
    const d = new Date()
    installments.push({
      numero: 1,
      monto: round2(total),
      porcentaje: 100,
      fecha: d.toISOString().split('T')[0]
    })
    return installments
  }

  // First payment: 60%. Remaining 40% split equally among the rest.
  const firstMonto = round2(total * 0.6)
  const remaining = round2(total - firstMonto)
  const restCount = n - 1
  const restBase = round2(remaining / restCount)
  let assigned = firstMonto

  const d0 = new Date()
  installments.push({
    numero: 1,
    monto: firstMonto,
    porcentaje: total > 0 ? round2((firstMonto / total) * 100) : 0,
    fecha: d0.toISOString().split('T')[0]
  })

  for (let i = 2; i <= n; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() + (i - 1))
    const isLast = i === n
    const monto = isLast ? round2(total - assigned) : restBase
    if (!isLast) assigned = round2(assigned + monto)
    installments.push({
      numero: i,
      monto,
      porcentaje: total > 0 ? round2((monto / total) * 100) : 0,
      fecha: d.toISOString().split('T')[0]
    })
  }

  return installments
}

export default function CotizacionPaymentPlan({ quote, onUpdate }: { quote: any; onUpdate: () => void }) {
  const existingPlan = quote?.planes_pago?.[0]
  const [paymentPlan, setPaymentPlan] = useState(existingPlan || null)
  const [isEditingPlan, setIsEditingPlan] = useState(!existingPlan)

  const [formNumPayments, setFormNumPayments] = useState<number>(3)
  const [formInstallments, setFormInstallments] = useState<InstallmentForm[]>([])
  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const [activeInput, setActiveInput] = useState<{ numero: number; type: 'monto' | 'pct' } | null>(null)
  const [montoInputs, setMontoInputs] = useState<Record<number, string>>({})
  const [pctInputs, setPctInputs] = useState<Record<number, string>>({})

  const quoteTotal = Number(quote?.total) || 0

  const handleGeneratePlan = () => {
    if (formNumPayments < 1) {
      alert('Ingrese un número de pagos válido (mínimo 1).')
      return
    }
    const newInst = buildInstallments(quoteTotal, formNumPayments)
    setFormInstallments(newInst)
    const nextPct: Record<number, string> = {}
    const nextMonto: Record<number, string> = {}
    newInst.forEach(inst => {
      nextPct[inst.numero] = inst.porcentaje.toFixed(1)
      nextMonto[inst.numero] = inst.monto.toFixed(2)
    })
    setPctInputs(nextPct)
    setMontoInputs(nextMonto)
  }

  const updateMonto = (numero: number, rawVal: string) => {
    setMontoInputs(prev => ({ ...prev, [numero]: rawVal }))
    const val = parseFloat(rawVal) || 0
    setFormInstallments(prev =>
      prev.map(p =>
        p.numero === numero
          ? {
              ...p,
              monto: val,
              porcentaje: quoteTotal > 0 ? round2((val / quoteTotal) * 100) : 0
            }
          : p
      )
    )
    const pct = quoteTotal > 0 ? ((val / quoteTotal) * 100).toFixed(1) : '0.0'
    setPctInputs(prev => ({ ...prev, [numero]: pct }))
  }

  const updatePorcentaje = (numero: number, rawVal: string) => {
    setPctInputs(prev => ({ ...prev, [numero]: rawVal }))
    const pctVal = parseFloat(rawVal) || 0
    const newMonto = round2((pctVal / 100) * quoteTotal)
    setFormInstallments(prev =>
      prev.map(p =>
        p.numero === numero
          ? { ...p, monto: newMonto, porcentaje: pctVal }
          : p
      )
    )
    setMontoInputs(prev => ({ ...prev, [numero]: newMonto.toFixed(2) }))
  }

  const handleSavePlan = async () => {
    if (formInstallments.length === 0) return alert('Genere un plan primero.')
    setIsSavingPlan(true)
    try {
      const res = await fetch(`/api/cotizaciones/${quote.id}/plan_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcialidades: formInstallments.map(({ numero, monto, fecha }) => ({
            numero,
            monto,
            fecha
          }))
        })
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

  const sumMontos = formInstallments.reduce((acc, curr) => acc + Number(curr.monto || 0), 0)
  const sumPct = formInstallments.reduce((acc, curr) => acc + Number(curr.porcentaje || 0), 0)

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
            <div className="flex gap-4 items-end flex-wrap">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Número de pagos</label>
                <input
                  type="number"
                  min={1}
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
              <p className="text-xs text-gray-500 pb-2">
                Por defecto: primer pago <strong>60%</strong>, resto en partes iguales.
              </p>
            </div>

            {formInstallments.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm text-gray-600 border-b border-gray-100 pb-2">
                  <span>
                    Total cotización:{' '}
                    <strong className="text-gray-900">{formatCurrency(quoteTotal)}</strong>
                  </span>
                  <span>
                    Suma plan:{' '}
                    <strong className={Math.abs(sumMontos - quoteTotal) > 0.05 ? 'text-amber-600' : 'text-gray-900'}>
                      {formatCurrency(sumMontos)}
                    </strong>
                    {' '}
                    <span className="text-gray-400">({sumPct.toFixed(1)}%)</span>
                  </span>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                        <th className="p-2 text-left w-14">No.</th>
                        <th className="p-2 text-left w-28">Monto</th>
                        <th className="p-2 text-left w-24">%</th>
                        <th className="p-2 text-left">Fecha de Pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formInstallments.map((inst, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="p-2 font-medium text-gray-700">{inst.numero}</td>
                          <td className="p-2 w-28">
                            <div className="relative w-24">
                              <span className="absolute inset-y-0 left-2 flex items-center text-gray-400 text-xs pointer-events-none">
                                $
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="border rounded pl-5 pr-1 py-1 w-full text-sm no-spinner"
                                value={
                                  activeInput?.numero === inst.numero && activeInput?.type === 'monto'
                                    ? (montoInputs[inst.numero] ?? '')
                                    : inst.monto
                                }
                                onFocus={() => {
                                  setMontoInputs(prev => ({
                                    ...prev,
                                    [inst.numero]: inst.monto.toString()
                                  }))
                                  setActiveInput({ numero: inst.numero, type: 'monto' })
                                }}
                                onBlur={() => setActiveInput(null)}
                                onChange={e => updateMonto(inst.numero, e.target.value)}
                              />
                            </div>
                          </td>
                          <td className="p-2 w-24">
                            <div className="flex items-center gap-1 border rounded px-1.5 py-0.5 w-20 bg-gray-50">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                className="w-12 text-sm bg-transparent outline-none text-center no-spinner"
                                value={
                                  activeInput?.numero === inst.numero && activeInput?.type === 'pct'
                                    ? (pctInputs[inst.numero] ?? '')
                                    : (quoteTotal > 0
                                        ? ((inst.monto / quoteTotal) * 100).toFixed(1)
                                        : '0.0')
                                }
                                onFocus={() => {
                                  const currentPct =
                                    quoteTotal > 0
                                      ? ((inst.monto / quoteTotal) * 100).toFixed(1)
                                      : '0.0'
                                  setPctInputs(prev => ({ ...prev, [inst.numero]: currentPct }))
                                  setActiveInput({ numero: inst.numero, type: 'pct' })
                                }}
                                onBlur={() => setActiveInput(null)}
                                onChange={e => updatePorcentaje(inst.numero, e.target.value)}
                              />
                              <span className="text-xs text-gray-400 font-bold">%</span>
                            </div>
                          </td>
                          <td className="p-2">
                            <input
                              type="date"
                              className="border rounded px-2 py-1 w-full max-w-[11rem]"
                              value={inst.fecha}
                              onChange={e => {
                                const newInst = [...formInstallments]
                                newInst[i] = { ...newInst[i], fecha: e.target.value }
                                setFormInstallments(newInst)
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsEditingPlan(false)}
                    className="px-4 py-2 bg-gray-100 rounded text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSavePlan}
                    disabled={isSavingPlan}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                  >
                    {isSavingPlan ? 'Guardando...' : 'Guardar Plan'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : paymentPlan ? (
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-2 text-left">No.</th>
                  <th className="p-2 text-left">Monto</th>
                  <th className="p-2 text-left">%</th>
                  <th className="p-2 text-left">Vencimiento</th>
                  <th className="p-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {paymentPlan.parcialidades?.map((p: any) => {
                  const monto = Number(p.monto) || 0
                  const pct =
                    quoteTotal > 0 ? ((monto / quoteTotal) * 100).toFixed(1) : '—'
                  return (
                    <tr key={p.id} className="border-b">
                      <td className="p-2 font-medium">{p.numero}</td>
                      <td className="p-2">{formatCurrency(monto)}</td>
                      <td className="p-2 text-gray-600">{pct}%</td>
                      <td className="p-2">
                        {new Date(p.fecha_vencimiento).toLocaleDateString()}
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            p.pagado
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {p.pagado ? 'Pagado' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500 text-sm">
            No hay plan de pagos configurado.
          </div>
        )}
      </div>
    </div>
  )
}
