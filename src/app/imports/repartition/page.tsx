'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { FileUp, Save, Brain, Info, CheckCircle2, Search, ArrowRight, Loader2, Sparkles, X, AlertCircle } from 'lucide-react'

interface Allocation {
  id: string
  folio: string
  customerName: string
  product: string
  requestedQty: number
  allocatedQty: number
  manualAdjustment?: boolean
}

export default function ImportRepartitionPage() {
  const { t, locale } = useI18n()
  const [csvContent, setCsvContent] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [invoiceResults, setInvoiceResults] = useState<any[]>([])
  const [isSearchingInvoices, setIsSearchingInvoices] = useState(false)
  const [selectedInvoices, setSelectedInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [remainingInventory, setRemainingInventory] = useState<Record<string, number>>({})
  const [initialInventory, setInitialInventory] = useState<Record<string, number>>({})
  const [aiReasoning, setAiReasoning] = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileName(file.name)
      const reader = new FileReader()
      reader.onload = (event) => {
        setCsvContent(event.target?.result as string)
      }
      reader.readAsText(file)
    }
  }

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (invoiceSearch.length < 2) {
         setInvoiceResults([])
         return
      }
      setIsSearchingInvoices(true)
      try {
        const isMultiple = invoiceSearch.includes(',');
        const size = isMultiple ? 100 : 5;
        const res = await fetch(`/api/invoices?search=${encodeURIComponent(invoiceSearch)}&pageSize=${size}`)
        const data = await res.json()
        const results = data.data || [];
        setInvoiceResults(results)
        
        if (isMultiple && results.length > 0) {
          const terms = invoiceSearch.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
          const cleanedTerms = terms.map(s => s.replace(/^F-/i, ''));
          
          const matches = results.filter((inv: any) => {
            const folUpper = String(inv.numero_factura).toUpperCase();
            return terms.includes(folUpper) || cleanedTerms.some(t => folUpper.includes(t));
          });
          
          if (matches.length > 0) {
            setSelectedInvoices(prev => {
              const newSelection = [...prev];
              matches.forEach((m: any) => {
                if (!newSelection.find(i => i.numero_factura === m.numero_factura)) {
                  newSelection.push(m);
                }
              });
              return newSelection;
            });
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsSearchingInvoices(false)
      }
    }, 300)
    return () => clearTimeout(delay)
  }, [invoiceSearch])

  const toggleInvoice = (invoice: any) => {
    if (selectedInvoices.find(i => i.numero_factura === invoice.numero_factura)) {
      setSelectedInvoices(prev => prev.filter(i => i.numero_factura !== invoice.numero_factura))
    } else {
      setSelectedInvoices(prev => [...prev, invoice])
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.name.endsWith('.csv')) {
      setFileName(file.name)
      const reader = new FileReader()
      reader.onload = (event) => {
        setCsvContent(event.target?.result as string)
      }
      reader.readAsText(file)
    }
  }

  const handleProcess = async () => {
    if (!csvContent) {
      setError(t('uploadCsvDesc'))
      return
    }
    
    // Parse folios from selected invoices
    const facturas = selectedInvoices.map(i => String(i.numero_factura))
    if (facturas.length === 0) {
      setError(t('invoicesToFulfill'))
      return
    }

    setLoading(true)
    setError('')
    setSuccessMsg('')
    setAllocations([])
    setRemainingInventory({})
    setInitialInventory({})
    setAiReasoning('')

    try {
      const res = await fetch('/api/imports/repartition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent, facturas, locale })
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Error processing repartition')
      
      setAllocations(data.allocations || [])
      setRemainingInventory(data.remainingInventory || {})
      setAiReasoning(data.aiReasoning || '')

      // Calculate initial inventory from allocations + remaining
      const initInv: Record<string, number> = { ...data.remainingInventory }
      data.allocations?.forEach((a: Allocation) => {
        initInv[a.product] = (initInv[a.product] || 0) + a.allocatedQty
      })
      setInitialInventory(initInv)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleQtyChange = (id: string, newQty: number) => {
    setAllocations(prev => {
      const copy = [...prev]
      const index = copy.findIndex(a => a.id === id)
      if (index === -1) return prev

      const oldAlloc = copy[index]
      const product = oldAlloc.product
      
      // Calculate max available to avoid overallocating
      const totalAllocatedOther = copy.filter(a => a.product === product && a.id !== id).reduce((acc, curr) => acc + curr.allocatedQty, 0)
      const totalAvailable = initialInventory[product] || 0
      const maxAllowed = totalAvailable - totalAllocatedOther
      
      let validQty = Math.max(0, Math.min(newQty, maxAllowed))
      
      // Cap at requested amount to prevent logic bugs
      validQty = Math.min(validQty, oldAlloc.requestedQty)

      copy[index] = { ...oldAlloc, allocatedQty: validQty, manualAdjustment: true }

      // Update remaining inventory
      const newTotalAllocated = totalAllocatedOther + validQty
      setRemainingInventory(prevInv => ({
        ...prevInv,
        [product]: totalAvailable - newTotalAllocated
      }))

      return copy
    })
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/imports/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations, remainingInventory, aiReasoning })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error saving allocations')
      
      setSuccessMsg(t('saveAllocationSuccess'))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Group allocations by product
  const groupedAllocations = allocations.reduce((acc, curr) => {
    if (!acc[curr.product]) acc[curr.product] = []
    acc[curr.product].push(curr)
    return acc
  }, {} as Record<string, Allocation[]>)

  // Group allocations by customer
  const groupedByCustomer = allocations.reduce((acc, curr) => {
    if (!acc[curr.customerName]) acc[curr.customerName] = []
    acc[curr.customerName].push(curr)
    return acc
  }, {} as Record<string, Allocation[]>)

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto min-h-screen space-y-8 bg-gray-50/50">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('repartition')}</h1>
          <p className="text-gray-500 mt-1">{t('tagline')}</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 flex items-start gap-3 shadow-sm">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Al completar la repartición, se notificará automáticamente al personal asignado (vía WhatsApp) para que confirmen la dirección de envío con sus clientes.</p>
        </div>
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-start gap-3">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </motion.div>
      )}

      {successMsg && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-100 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{successMsg}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('uploadCsvTitle')}</h2>
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-500 hover:bg-indigo-50/50 transition-colors cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <FileUp className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                {fileName || t('importBtn')}
              </p>
              <p className="text-xs text-gray-500">{t('uploadCsvDesc')}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('invoicesToFulfill')}</h2>
            
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar facturas por folio, cliente, RFC..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                className="erp-input pl-10 w-full"
              />
              {isSearchingInvoices && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
              )}
            </div>

            {invoiceResults.length > 0 && (
              <div className="mb-4 border border-gray-100 rounded-xl max-h-48 overflow-y-auto divide-y divide-gray-50 shadow-sm">
                {invoiceResults.map(inv => {
                  const isSelected = !!selectedInvoices.find(i => i.numero_factura === inv.numero_factura)
                  return (
                    <div 
                      key={inv.id} 
                      onClick={() => toggleInvoice(inv)}
                      className={`p-3 cursor-pointer transition-colors flex items-start gap-3 hover:bg-indigo-50/50 ${isSelected ? 'bg-indigo-50/30' : 'bg-white'}`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}`}>
                        {isSelected && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                          Folio: {inv.numero_factura}
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600">{new Date(inv.fecha_expedicion).toLocaleDateString()}</span>
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-1">{inv.cliente_nombre}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {selectedInvoices.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2 tracking-wider">Facturas seleccionadas ({selectedInvoices.length})</p>
                <div className="flex flex-wrap gap-2">
                  {selectedInvoices.map(inv => (
                    <span key={inv.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-sm font-medium border border-indigo-100">
                      {inv.numero_factura}
                      <button onClick={() => toggleInvoice(inv)} className="hover:bg-indigo-200 rounded-full p-0.5 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleProcess}
            disabled={loading || !csvContent || selectedInvoices.length === 0}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium shadow-md shadow-indigo-200 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            <span>Analizar y Repartir</span>
          </button>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="popLayout">
            {loading && (
              <motion.div
                key="loading-state"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 rounded-2xl bg-indigo-50/50 p-6"
              >
                <div className="relative mb-6">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center animate-pulse">
                    <Brain className="w-8 h-8 text-indigo-600 animate-bounce" />
                  </div>
                  <div className="absolute top-0 right-0 -mt-1 -mr-1">
                    <Sparkles className="w-6 h-6 text-violet-500 animate-ping" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-indigo-900 mb-2">La IA está analizando</h3>
                <p className="text-indigo-600 text-center max-w-sm">
                  Procesando el inventario disponible y cruzando datos con los clientes seleccionados...
                </p>
              </motion.div>
            )}

            {!loading && aiReasoning && (
              <motion.div 
                key="ai-reasoning"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-gradient-to-br from-violet-50 to-fuchsia-50 p-6 rounded-2xl border border-violet-100 shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Brain className="w-24 h-24 text-violet-600" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-violet-600" />
                    <h3 className="font-bold text-violet-900">{t('aiReasoning')}</h3>
                  </div>
                  <p className="text-violet-800 text-sm leading-relaxed whitespace-pre-wrap">
                    {aiReasoning}
                  </p>
                </div>
              </motion.div>
            )}

            {!loading && Object.keys(groupedAllocations).length > 0 && (
              <motion.div 
                key="allocations-dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">{t('allocationDashboard')}</h2>
                  <button
                    onClick={handleSave}
                    disabled={loading || successMsg !== ''}
                    className="py-2 px-4 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {t('saveAllocation')}
                  </button>
                </div>

                <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                  <div className="p-4 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <h3 className="text-lg font-bold text-gray-800">Por Producto</h3>
                  </div>
                  {Object.entries(groupedAllocations).map(([product, items]) => {
                    const totalReceived = initialInventory[product] || 0
                    const currentAllocated = items.reduce((acc, curr) => acc + curr.allocatedQty, 0)
                    const rem = remainingInventory[product] || 0

                    return (
                      <div key={product} className="p-6 hover:bg-gray-50/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                              {product.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                {product}
                                {items.reduce((acc, curr) => acc + (curr.requestedQty - curr.allocatedQty), 0) > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-xs font-medium border border-red-100">
                                    <AlertCircle className="w-3 h-3" /> Faltan {items.reduce((acc, curr) => acc + (curr.requestedQty - curr.allocatedQty), 0)}
                                  </span>
                                )}
                              </h4>
                              <p className="text-xs text-gray-500">{t('received')}: {totalReceived}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm">
                            <div className="text-center px-3 py-1 bg-green-50 text-green-700 rounded-md font-medium">
                              {t('allocated')}: {currentAllocated}
                            </div>
                            <div className={`text-center px-3 py-1 rounded-md font-medium ${rem > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                              {t('pendingAllocation')}: {rem}
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                              <tr>
                                <th className="px-4 py-2 rounded-l-lg">{t('orderFolio')}</th>
                                <th className="px-4 py-2">{t('customer')}</th>
                                <th className="px-4 py-2 text-center">{t('qtyPending')}</th>
                                <th className="px-4 py-2 text-center rounded-r-lg w-40">{t('qtyAllocated')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {items.map(alloc => (
                                <tr key={alloc.id} className="hover:bg-white transition-colors">
                                  <td className="px-4 py-3 font-medium text-gray-900">{alloc.folio}</td>
                                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={alloc.customerName}>
                                    <div className="flex items-center gap-2">
                                      <span>{alloc.customerName}</span>
                                      {alloc.requestedQty - alloc.allocatedQty > 0 && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 text-[10px] font-medium border border-red-100" title={`Faltan ${alloc.requestedQty - alloc.allocatedQty}`}>
                                          <AlertCircle className="w-3 h-3" /> Faltan {alloc.requestedQty - alloc.allocatedQty}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center font-medium text-gray-500">
                                    {alloc.requestedQty}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-2">
                                      <input 
                                        type="number"
                                        min="0"
                                        max={alloc.requestedQty}
                                        value={alloc.allocatedQty}
                                        onChange={(e) => handleQtyChange(alloc.id, parseInt(e.target.value || '0', 10))}
                                        className={`w-16 text-center border rounded-md py-1 px-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${alloc.manualAdjustment ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'border-gray-200'}`}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}

                  <div className="p-4 bg-gray-50 border-y border-gray-200 mt-4 sticky top-0 z-10">
                    <h3 className="text-lg font-bold text-gray-800">Por Cliente</h3>
                  </div>
                  {Object.entries(groupedByCustomer).map(([customerName, items]) => {
                    const customerMissing = items.reduce((acc, curr) => acc + (curr.requestedQty - curr.allocatedQty), 0);
                    const customerRequested = items.reduce((acc, curr) => acc + curr.requestedQty, 0);
                    const customerAllocated = items.reduce((acc, curr) => acc + curr.allocatedQty, 0);

                    return (
                      <div key={customerName} className="p-6 hover:bg-gray-50/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">
                              {customerName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                {customerName}
                                {customerMissing > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-xs font-medium border border-red-100">
                                    <AlertCircle className="w-3 h-3" /> Faltan {customerMissing}
                                  </span>
                                )}
                              </h4>
                              <p className="text-xs text-gray-500">Total Solicitado: {customerRequested} | Total Asignado: {customerAllocated}</p>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                              <tr>
                                <th className="px-4 py-2 rounded-l-lg">{t('orderFolio')}</th>
                                <th className="px-4 py-2">Producto</th>
                                <th className="px-4 py-2 text-center">{t('qtyPending')}</th>
                                <th className="px-4 py-2 text-center rounded-r-lg w-40">{t('qtyAllocated')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {items.map(alloc => {
                                const isMissing = alloc.requestedQty - alloc.allocatedQty > 0;
                                return (
                                  <tr key={`cust-${alloc.id}`} className="hover:bg-white transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-900">{alloc.folio}</td>
                                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={alloc.product}>
                                      <div className="flex items-center gap-2">
                                        <span>{alloc.product}</span>
                                        {isMissing && (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 text-[10px] font-medium border border-red-100" title={`Faltan ${alloc.requestedQty - alloc.allocatedQty}`}>
                                            <AlertCircle className="w-3 h-3" /> Faltan {alloc.requestedQty - alloc.allocatedQty}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center font-medium text-gray-500">
                                      {alloc.requestedQty}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-center gap-2">
                                        <input 
                                          type="number"
                                          min="0"
                                          max={alloc.requestedQty}
                                          value={alloc.allocatedQty}
                                          onChange={(e) => handleQtyChange(alloc.id, parseInt(e.target.value || '0', 10))}
                                          className={`w-16 text-center border rounded-md py-1 px-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${alloc.manualAdjustment ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'border-gray-200'}`}
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
            
            {!loading && Object.keys(groupedAllocations).length === 0 && !aiReasoning && (
              <motion.div 
                key="empty-state"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-full min-h-[400px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-white p-6"
              >
                <Search className="w-12 h-12 mb-3 text-gray-300" />
                <p className="font-medium text-gray-500">Sube un archivo y folios para comenzar</p>
                <p className="text-sm mt-1">La IA analizará la mejor distribución de tu inventario.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
    </AppShell>
  )
}

