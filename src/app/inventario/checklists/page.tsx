'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ClipboardList, 
  Search, 
  Plus, 
  RotateCcw, 
  CheckCircle2, 
  History, 
  Settings, 
  ChevronRight, 
  PlusCircle,
  Loader2, 
  X, 
  Check, 
  AlertCircle,
  Calendar,
  User,
  ArrowLeft,
  Trash2,
  FileText,
  FileSpreadsheet
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useUser } from '@/contexts/UserContext'
import { useI18n } from '@/contexts/I18nContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string
  material: string
  modelo?: string
  cantidad?: number
  observaciones?: string
  addedOnTheFly?: boolean
}

interface Checklist {
  id: string
  nombre: string
  descripcion: string
  items: ChecklistItem[]
}

interface PendingChecklist {
  id: string
  nombre: string
  areaId: string
  areaNombre: string
  date: string
  user: string
  items: ChecklistItem[]
  notes?: string
}

interface HistoryEntry {
  id: string
  checklistId: string
  checklistName: string
  date: string
  user: string
  checkedCount: number
  totalCount: number
  notes?: string
  items: {
    material: string
    modelo?: string
    cantidad?: number
    cantidadContada?: number
    checked: boolean
    observaciones?: string
  }[]
}

export default function ChecklistsPage() {
  const { profile } = useUser()
  const { t, locale } = useI18n()
  const router = useRouter()

  // Tab State
  const [activeTab, setActiveTab] = useState<'create' | 'pending' | 'history'>('pending')

  // Data Loading States
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [pendingLists, setPendingLists] = useState<PendingChecklist[]>([])
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([])
  
  const [loading, setLoading] = useState(true)
  const [loadingPending, setLoadingPending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Creation Tab State ────────────────────────────────────────────────────
  const [selectedChecklistId, setSelectedChecklistId] = useState<string>('')
  const [selectedInventoryItems, setSelectedInventoryItems] = useState<Record<string, boolean>>({})
  const [customExpectedQtys, setCustomExpectedQtys] = useState<Record<string, number>>({})
  const [createdCustomItems, setCreatedCustomItems] = useState<ChecklistItem[]>([])
  const [newChecklistTitle, setNewChecklistTitle] = useState('')
  const [newChecklistNotes, setNewChecklistNotes] = useState('')
  const [creatingChecklist, setCreatingChecklist] = useState(false)
  const [createSearchQuery, setCreateSearchQuery] = useState('')

  // ─── Pending Tab State ─────────────────────────────────────────────────────
  const [activePendingList, setActivePendingList] = useState<PendingChecklist | null>(null)
  const [verificationChecked, setVerificationChecked] = useState<Record<string, boolean>>({})
  const [verificationCounted, setVerificationCounted] = useState<Record<string, number>>({})
  const [verificationNotes, setVerificationNotes] = useState('')
  const [verifyingSearchQuery, setVerifyingSearchQuery] = useState('')
  const [verifyingFilter, setVerifyingFilter] = useState<'all' | 'checked' | 'unchecked'>('all')
  const [submittingVerification, setSubmittingVerification] = useState(false)

  // ─── History Tab State ─────────────────────────────────────────────────────
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<HistoryEntry | null>(null)
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([])
  const [historySearchQuery, setHistorySearchQuery] = useState('')

  // Modal item on the fly (for creation tab)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemModel, setNewItemModel] = useState('')
  const [newItemQty, setNewItemQty] = useState('1')
  const [newItemNotes, setNewItemNotes] = useState('')

  // Toast / Notifications
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [toastMessage, setToastMessage] = useState({ title: '', desc: '' })
  const [savedHistoryId, setSavedHistoryId] = useState<string | null>(null)

  // ─── API Fetchers ──────────────────────────────────────────────────────────

  const fetchChecklists = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/checklists')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al obtener checklists')
      
      const data = json.data as Checklist[]
      setChecklists(data)
      if (data.length > 0 && !selectedChecklistId) {
        setSelectedChecklistId(data[0].id)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [selectedChecklistId])

  const fetchPendingLists = useCallback(async () => {
    setLoadingPending(true)
    try {
      const res = await fetch('/api/checklists/pending')
      const json = await res.json()
      if (res.ok) {
        const data = json.data || []
        setPendingLists(data)
        // If there are pending lists, default tab to pending on first load, else create
        if (data.length === 0 && activeTab === 'pending') {
          setActiveTab('create')
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingPending(false)
    }
  }, [activeTab])

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/checklists/history')
      const json = await res.json()
      if (res.ok) {
        setHistoryList(json.data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    fetchChecklists()
    fetchPendingLists()
    fetchHistory()
  }, [])

  // Auto-select history entry if ?historyId is present in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const historyId = params.get('historyId')
      if (historyId && historyList.length > 0) {
        const entry = historyList.find(e => e.id === historyId)
        if (entry) {
          setActiveTab('history')
          setSelectedHistoryEntry(entry)
        }
      }
    }
  }, [historyList])

  // Helper translations for standard areas
  const getChecklistLabel = (id: string) => {
    switch (id) {
      case 'consumibles_taller': return t('consumibles')
      case 'muestras': return t('muestrasLabel')
      case 'inventario_desechables': return t('desechables')
      case 'herramienta': return t('herramientaLabel')
      case 'admin_fijos': return t('equiposMobiliario')
      case 'admin_stand': return t('catalogosStand')
      default: {
        const found = checklists.find(c => c.id === id)
        return found ? (found.nombre || id) : id
      }
    }
  }

  const activeChecklist = useMemo(() => {
    return checklists.find(c => c.id === selectedChecklistId) || null
  }, [checklists, selectedChecklistId])

  const activeItems = useMemo(() => {
    if (!activeChecklist) return []
    return [...activeChecklist.items, ...createdCustomItems]
  }, [activeChecklist, createdCustomItems])

  // Prefill Creation form when selected area template changes
  useEffect(() => {
    if (activeChecklist) {
      const initialSelected: Record<string, boolean> = {}
      const initialQtys: Record<string, number> = {}
      activeChecklist.items.forEach(item => {
        initialSelected[item.id] = true
        initialQtys[item.id] = item.cantidad || 1
      })
      setSelectedInventoryItems(initialSelected)
      setCustomExpectedQtys(initialQtys)
      setCreatedCustomItems([])

      const dateStr = new Date().toLocaleDateString(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'es-MX', { day: '2-digit', month: 'short' })
      setNewChecklistTitle(`Checklist ${getChecklistLabel(activeChecklist.id)} - ${dateStr}`)
      setNewChecklistNotes('')
    }
  }, [selectedChecklistId, checklists, locale])

  // Filter creation inventory list by search query
  const filteredCreateItems = useMemo(() => {
    const query = createSearchQuery.toLowerCase().trim()
    return activeItems.filter(item => 
      item.material.toLowerCase().includes(query) ||
      (item.modelo && item.modelo.toLowerCase().includes(query)) ||
      (item.observaciones && item.observaciones.toLowerCase().includes(query))
    )
  }, [activeItems, createSearchQuery])

  // Progress Calculations for verification run
  const verificationProgress = useMemo(() => {
    if (!activePendingList) return { checked: 0, total: 0, pct: 0 }
    const total = activePendingList.items.length
    if (total === 0) return { checked: 0, total: 0, pct: 0 }
    const checked = activePendingList.items.filter(item => !!verificationChecked[item.id]).length
    return {
      checked,
      total,
      pct: Math.round((checked / total) * 100)
    }
  }, [activePendingList, verificationChecked])

  // Filter items in active verification checklist
  const filteredVerifyItems = useMemo(() => {
    if (!activePendingList) return []
    const query = verifyingSearchQuery.toLowerCase().trim()

    return activePendingList.items.filter(item => {
      const matchesSearch = 
        item.material.toLowerCase().includes(query) ||
        (item.modelo && item.modelo.toLowerCase().includes(query)) ||
        (item.observaciones && item.observaciones.toLowerCase().includes(query))

      const isChecked = !!verificationChecked[item.id]

      if (verifyingFilter === 'checked') return matchesSearch && isChecked
      if (verifyingFilter === 'unchecked') return matchesSearch && !isChecked
      return matchesSearch
    })
  }, [activePendingList, verifyingSearchQuery, verificationChecked, verifyingFilter])

  // ─── Actions ───────────────────────────────────────────────────────────────

  // Creation actions
  const handleToggleSelectItem = (id: string) => {
    setSelectedInventoryItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  };

  const handleSelectAll = (select: boolean) => {
    const updated: Record<string, boolean> = {}
    activeItems.forEach(item => {
      updated[item.id] = select
    })
    setSelectedInventoryItems(updated)
  }

  const handleUpdateExpectedQty = (id: string, val: number) => {
    setCustomExpectedQtys(prev => ({
      ...prev,
      [id]: val >= 0 ? val : 0
    }))
  }

  const handleAddOnTheFlyItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim()) return

    const qty = parseInt(newItemQty, 10)
    const newId = `otf_${Date.now()}`
    
    const newOtfItem: ChecklistItem = {
      id: newId,
      material: newItemName.trim(),
      modelo: newItemModel.trim() || undefined,
      cantidad: isNaN(qty) ? undefined : qty,
      observaciones: newItemNotes.trim() || undefined,
      addedOnTheFly: true
    }

    setCreatedCustomItems(prev => [...prev, newOtfItem])
    setSelectedInventoryItems(prev => ({
      ...prev,
      [newId]: true
    }))
    setCustomExpectedQtys(prev => ({
      ...prev,
      [newId]: isNaN(qty) ? 1 : qty
    }))

    // Clear fields & close
    setShowAddModal(false)
    setNewItemName('')
    setNewItemModel('')
    setNewItemQty('1')
    setNewItemNotes('')
  }

  const handleCreateChecklistSubmit = async () => {
    if (!newChecklistTitle.trim()) {
      alert(t('checklistNameRequired'))
      return
    }

    const selectedIds = Object.keys(selectedInventoryItems).filter(id => selectedInventoryItems[id])
    if (selectedIds.length === 0) {
      alert(t('checklistAtLeastOne'))
      return
    }

    setCreatingChecklist(true)
    try {
      const itemsToInspect = activeItems
        .filter(item => selectedInventoryItems[item.id])
        .map(item => ({
          id: item.id,
          material: item.material,
          modelo: item.modelo,
          cantidad: customExpectedQtys[item.id] !== undefined ? customExpectedQtys[item.id] : (item.cantidad || 1),
          observaciones: item.observaciones,
          addedOnTheFly: item.addedOnTheFly
        }))

      const pendingEntry = {
        id: `pchk_${Date.now()}`,
        nombre: newChecklistTitle.trim(),
        areaId: selectedChecklistId,
        areaNombre: getChecklistLabel(selectedChecklistId),
        date: new Date().toISOString(),
        user: profile?.email || 'Usuario ERP',
        items: itemsToInspect,
        notes: newChecklistNotes.trim() || undefined
      }

      const res = await fetch('/api/checklists/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry: pendingEntry })
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Error al guardar la checklist pendiente')
      }

      setToastMessage({
        title: t('checklistCreatedSuccess'),
        desc: t('checklistCreatedSuccessDesc')
      })
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 4000)

      // Clear & refetch
      setSelectedInventoryItems({})
      setCustomExpectedQtys({})
      setCreatedCustomItems([])
      setNewChecklistTitle('')
      setNewChecklistNotes('')
      
      await fetchPendingLists()
      setActiveTab('pending')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setCreatingChecklist(false)
    }
  }

  // Pending Actions
  const handleStartVerification = (pList: PendingChecklist) => {
    setActivePendingList(pList)
    setVerificationNotes(pList.notes || '')
    
    // Initialize verification checks and counted quantities
    const initialChecks: Record<string, boolean> = {}
    const initialCounted: Record<string, number> = {}
    
    pList.items.forEach(item => {
      initialChecks[item.id] = false
      initialCounted[item.id] = item.cantidad || 0
    })

    setVerificationChecked(initialChecks)
    setVerificationCounted(initialCounted)
    setVerifyingSearchQuery('')
    setVerifyingFilter('all')
  }

  const handleToggleVerificationCheck = (itemId: string) => {
    setVerificationChecked(prev => {
      const updated = { ...prev, [itemId]: !prev[itemId] }
      return updated
    })
  }

  const handleUpdateVerificationQty = (itemId: string, val: number) => {
    setVerificationCounted(prev => {
      const updated = { ...prev, [itemId]: val >= 0 ? val : 0 }
      return updated
    })
    // Auto check item when quantity is counted/modified
    setVerificationChecked(prev => {
      if (!prev[itemId]) {
        return { ...prev, [itemId]: true }
      }
      return prev
    })
  }

  const handleDiscardPendingList = async (id: string) => {
    if (!confirm(t('confirmDeletePending'))) return

    try {
      const res = await fetch(`/api/checklists/pending?id=${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Error al descartar la checklist pendiente')
      
      fetchPendingLists()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleSaveVerificationSubmit = async () => {
    if (!activePendingList) return
    
    if (verificationProgress.checked === 0) {
      alert(t('alertAtLeastOneItem'))
      return
    }

    if (!confirm(`${t('confirmSubmitChecklist')} ("${activePendingList.nombre}")`)) return

    setSubmittingVerification(true)
    try {
      // 1. Prepare history entry
      const historyEntry = {
        id: `hlog_${Date.now()}`,
        checklistId: activePendingList.areaId,
        checklistName: activePendingList.nombre,
        date: new Date().toISOString(),
        user: profile?.email || 'Inspector ERP',
        checkedCount: verificationProgress.checked,
        totalCount: verificationProgress.total,
        notes: verificationNotes.trim(),
        items: activePendingList.items.map(item => {
          const expectedQty = item.cantidad || 0
          return {
            material: item.material,
            modelo: item.modelo,
            cantidad: expectedQty,
            cantidadContada: verificationCounted[item.id] !== undefined ? verificationCounted[item.id] : expectedQty,
            checked: !!verificationChecked[item.id],
            observaciones: item.observaciones
          }
        })
      }

      // 2. Submit to history
      const historyRes = await fetch('/api/checklists/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry: historyEntry })
      })

      if (!historyRes.ok) {
        const json = await historyRes.json()
        throw new Error(json.error || 'Error al guardar el historial')
      }

      // 3. Delete from pending list
      const deleteRes = await fetch(`/api/checklists/pending?id=${activePendingList.id}`, {
        method: 'DELETE'
      })

      if (!deleteRes.ok) {
        throw new Error('Error al remover de la lista de pendientes')
      }

      setSavedHistoryId(historyEntry.id)
      setToastMessage({
        title: t('inspectionSaved'),
        desc: t('inspectionSavedDesc')
      })
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 4000)

      // Reset states
      setActivePendingList(null)
      setVerificationChecked({})
      setVerificationCounted({})
      setVerificationNotes('')
      
      // Refetch both pending and history
      await fetchPendingLists()
      await fetchHistory()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSubmittingVerification(false)
    }
  }

  // History filtering
  const filteredHistory = useMemo(() => {
    const query = historySearchQuery.toLowerCase().trim()
    if (!query) return historyList
    return historyList.filter(entry => 
      entry.checklistName.toLowerCase().includes(query) ||
      entry.user.toLowerCase().includes(query) ||
      (entry.notes && entry.notes.toLowerCase().includes(query))
    )
  }, [historyList, historySearchQuery])

  // Progress Color Badge Helpers
  const getProgressColor = (pct: number) => {
    if (pct === 100) return 'bg-emerald-500'
    if (pct > 50) return 'bg-blue-500'
    return 'bg-amber-500'
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-4 md:space-y-6 pb-20">
        
        {/* Navigation & Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <Link 
            href="/inventario" 
            className="flex items-center gap-1 text-sm font-semibold text-[#0763a9] hover:underline"
          >
            <ArrowLeft size={16} /> {t('backToInventory')}
          </Link>
          
          <Link
            href="/inventario/checklists/manage"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-sm font-semibold text-white shadow transition-all self-start sm:self-auto"
          >
            <Settings size={16} /> {t('manageChecklists')}
          </Link>
        </div>

        {/* Title Card */}
        <div className="bg-white rounded-2xl p-5 md:p-6 border border-blue-50 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
              <ClipboardList size={26} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-950">{t('checklistsMainTitle')}</h1>
              <p className="text-xs md:text-sm text-gray-500 font-medium">{t('checklistsDesc')}</p>
            </div>
          </div>
        </div>

        {/* Premium Tab Bar Navigation */}
        <div className="bg-white p-1.5 rounded-2xl border border-gray-150 shadow-sm grid grid-cols-3 gap-1">
          <button
            onClick={() => { setActiveTab('create'); setActivePendingList(null); setSelectedHistoryEntry(null); }}
            className={`py-3 text-xs md:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'create' 
                ? 'bg-blue-600 text-white shadow shadow-blue-800/10' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <PlusCircle size={16} />
            {t('viewCreateTab')}
          </button>
          <button
            onClick={() => { setActiveTab('pending'); setSelectedHistoryEntry(null); }}
            className={`py-3 text-xs md:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 relative ${
              activeTab === 'pending' 
                ? 'bg-blue-600 text-white shadow shadow-blue-800/10' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <FileText size={16} />
            {t('viewPendingTab')}
            {pendingLists.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white">
                {pendingLists.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('history'); setActivePendingList(null); }}
            className={`py-3 text-xs md:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'history' 
                ? 'bg-blue-600 text-white shadow shadow-blue-800/10' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <History size={16} />
            {t('viewHistoryTab')}
          </button>
        </div>

        {/* ─── TAB 1: CREAR CHECKLIST ────────────────────────────────────────── */}
        {activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Template selector & Details form */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-2xl border border-gray-150 p-4 space-y-4 shadow-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">{t('inventariosPorArea')}</h3>
                
                <div className="space-y-1">
                  {checklists.map(c => {
                    const isSelected = selectedChecklistId === c.id
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedChecklistId(c.id)}
                        className={`w-full text-left p-3 rounded-xl text-xs md:text-sm font-semibold transition-all flex items-center justify-between ${
                          isSelected 
                            ? 'bg-blue-50 text-blue-800 border-l-4 border-blue-600 font-bold' 
                            : 'hover:bg-slate-50 text-gray-700 border-l-4 border-transparent'
                        }`}
                      >
                        <span className="truncate">{getChecklistLabel(c.id)}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                          {c.items.length}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Checklist Title & Notes panel */}
              {activeChecklist && (
                <div className="bg-white rounded-2xl border border-gray-150 p-5 space-y-4 shadow-sm">
                  <h3 className="font-bold text-gray-900 text-sm">{t('checklistSemanticsLabel')}</h3>
                  
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Título de la Checklist *</label>
                      <input
                        type="text"
                        value={newChecklistTitle}
                        onChange={(e) => setNewChecklistTitle(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:outline-none bg-gray-50/50"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Notas / Instrucciones</label>
                      <textarea
                        rows={3}
                        value={newChecklistNotes}
                        onChange={(e) => setNewChecklistNotes(e.target.value)}
                        placeholder="Ej. Favor de contar las piezas del tercer estante..."
                        className="w-full p-3.5 border border-gray-200 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:outline-none bg-gray-50/50"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t flex justify-between items-center text-xs text-gray-500 font-semibold">
                    <span>Artículos seleccionados:</span>
                    <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                      {Object.values(selectedInventoryItems).filter(Boolean).length} de {activeItems.length}
                    </span>
                  </div>

                  <button
                    onClick={handleCreateChecklistSubmit}
                    disabled={creatingChecklist || Object.values(selectedInventoryItems).filter(Boolean).length === 0}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-white rounded-xl shadow-sm text-sm flex items-center justify-center gap-1.5 transition-all"
                  >
                    {creatingChecklist ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('saving')}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        {t('sendToVerification')}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Inventory catalog table for subset selection */}
            <div className="lg:col-span-2 space-y-4">
              {activeChecklist ? (
                <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden flex flex-col">
                  
                  {/* Title & Search row */}
                  <div className="p-4 bg-slate-50 border-b border-gray-150 space-y-3.5">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div>
                        <h2 className="text-base font-bold text-gray-900">Catálogo: {getChecklistLabel(activeChecklist.id)}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">{t('selectItemsFromInventory')}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectAll(true)}
                          className="px-3 py-1.5 bg-white border border-gray-200 text-xs text-gray-700 font-bold hover:bg-gray-50 rounded-lg shadow-sm"
                        >
                          Seleccionar todos
                        </button>
                        <button
                          onClick={() => handleSelectAll(false)}
                          className="px-3 py-1.5 bg-white border border-gray-200 text-xs text-gray-700 font-bold hover:bg-gray-50 rounded-lg shadow-sm"
                        >
                          Deseleccionar todos
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder={t('searchPlaceholder')}
                        value={createSearchQuery}
                        onChange={(e) => setCreateSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                      />
                    </div>
                  </div>

                  {/* List of items */}
                  <div className="divide-y divide-gray-100 max-h-[50vh] overflow-y-auto bg-white">
                    {filteredCreateItems.length === 0 ? (
                      <div className="p-10 text-center text-gray-400 space-y-1">
                        <AlertCircle className="w-8 h-8 text-gray-200 mx-auto" />
                        <p className="text-sm font-medium">{t('noItemsFound')}</p>
                      </div>
                    ) : (
                      filteredCreateItems.map(item => {
                        const isSelected = !!selectedInventoryItems[item.id]
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleToggleSelectItem(item.id)}
                            className={`flex items-center gap-4 p-4 md:p-5 cursor-pointer transition-all ${
                              isSelected 
                                ? 'bg-blue-50/40 hover:bg-blue-50 border-l-4 border-blue-500' 
                                : 'hover:bg-gray-50/50 border-l-4 border-transparent'
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {isSelected ? (
                                <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white scale-105 transition-transform">
                                  <Check size={14} strokeWidth={3} />
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-lg border-2 border-gray-300 hover:border-gray-400 bg-white transition-colors" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className={`text-sm md:text-base font-bold truncate ${isSelected ? 'text-blue-950' : 'text-gray-900'}`}>
                                {item.material}
                              </p>
                              {item.modelo && (
                                <span className="inline-block font-mono text-[10px] text-gray-400 bg-gray-50 px-1 py-0.2 rounded border border-gray-100 mt-1 font-semibold">
                                  {t('model')}: {item.modelo}
                                </span>
                              )}
                            </div>

                            {/* Quantity settings for creators */}
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <span className="text-xs text-gray-400 font-bold mr-1">{t('qtyHeader')}:</span>
                              <input
                                type="number"
                                min="0"
                                value={customExpectedQtys[item.id] !== undefined ? customExpectedQtys[item.id] : (item.cantidad || 1)}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10)
                                  handleUpdateExpectedQty(item.id, isNaN(val) ? 0 : val)
                                }}
                                disabled={!isSelected}
                                className="w-14 text-center text-sm font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded py-0.5 focus:bg-white focus:outline-none disabled:opacity-40"
                              />
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Add Custom Item trigger */}
                  <div className="p-4 bg-gray-50 border-t border-gray-150 text-right">
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs inline-flex items-center gap-1.5 transition-all border border-blue-200"
                    >
                      <Plus size={14} />
                      Agregar Item al Vuelo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
                  <ClipboardList className="w-16 h-16 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-bold text-gray-500">Cargando inventarios por área...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: CHECKLISTS PENDIENTES ───────────────────────────────────── */}
        {activeTab === 'pending' && (
          <div className="space-y-6">
            {!activePendingList ? (
              // List View of Pending checklists
              <div className="bg-white rounded-2xl border border-gray-150 shadow-sm p-4 md:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">{t('pendingChecklists')}</h2>
                    <p className="text-xs text-gray-500">{t('pendingChecklistsDesc')}</p>
                  </div>
                </div>

                {loadingPending ? (
                  <div className="py-12 flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-[#0763a9] animate-spin" />
                    <span className="text-xs text-gray-400">Obteniendo checklists pendientes...</span>
                  </div>
                ) : pendingLists.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 border border-dashed rounded-2xl border-gray-200">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-bold">{t('noPendingChecklists')}</p>
                    <p className="text-xs mt-1">Crea una nueva checklist en la pestaña anterior para enviarla a revisión.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingLists.map(list => (
                      <div 
                        key={list.id}
                        className="border border-gray-150 rounded-2xl p-4 flex flex-col justify-between gap-4 hover:shadow-md hover:border-blue-100 hover:bg-slate-50/20 transition-all shadow-sm"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <h4 className="font-bold text-gray-950 text-sm truncate max-w-[80%]">{list.nombre}</h4>
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                              Pendiente
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 font-semibold">
                            <span className="bg-gray-100 px-2 py-0.5 rounded">{list.areaNombre}</span>
                            <span className="flex items-center gap-0.5">
                              <Calendar size={12} />
                              {new Date(list.date).toLocaleString(locale === 'es' ? 'es-MX' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <User size={12} />
                              {list.user.split('@')[0]}
                            </span>
                          </div>

                          {list.notes && (
                            <p className="text-xs text-gray-400 italic line-clamp-2 mt-2 bg-gray-50 p-2 rounded-lg">
                              &ldquo;{list.notes}&rdquo;
                            </p>
                          )}
                        </div>

                        <div className="border-t pt-3 flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-gray-500">
                            {list.items.length} {t('itemsCount')}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDiscardPendingList(list.id)}
                              className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-600 flex items-center justify-center transition-all hover:border hover:border-red-100"
                              title="Descartar"
                            >
                              <Trash2 size={15} />
                            </button>
                            <button
                              onClick={() => handleStartVerification(list)}
                              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow flex items-center gap-1"
                            >
                              <CheckCircle2 size={13} />
                              {t('verifyChecklistBtn')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Active Verification Screen
              <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden flex flex-col">
                
                {/* Verification Header */}
                <div className="p-4 md:p-6 bg-slate-50 border-b border-gray-150 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div className="space-y-1">
                      <button
                        onClick={() => setActivePendingList(null)}
                        className="text-xs font-bold text-[#0763a9] hover:underline flex items-center gap-1"
                      >
                        &larr; Volver a pendientes
                      </button>
                      <h2 className="text-lg font-bold text-gray-900">{activePendingList.nombre}</h2>
                      <p className="text-xs text-gray-500 font-semibold">
                        Área: {activePendingList.areaNombre} | Creado por: {activePendingList.user}
                      </p>
                    </div>

                    <div className="bg-white border border-gray-200 px-3.5 py-2 rounded-xl flex items-center justify-between sm:justify-start gap-4">
                      <span className="text-xs text-gray-500 font-bold">{t('progress')}</span>
                      <span className="text-sm font-bold text-gray-900">
                        {verificationProgress.checked} / {verificationProgress.total}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${getProgressColor(verificationProgress.pct)}`}
                        style={{ width: `${verificationProgress.pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] font-semibold text-gray-400">
                      <span>0%</span>
                      <span>{verificationProgress.pct}% {t('completedLabel')}</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-4 border-b border-gray-150 bg-white grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder={t('searchPlaceholder')}
                      value={verifyingSearchQuery}
                      onChange={(e) => setVerifyingSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    {verifyingSearchQuery && (
                      <button 
                        onClick={() => setVerifyingSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="flex border border-gray-200 rounded-xl overflow-hidden text-xs font-semibold">
                    <button
                      onClick={() => setVerifyingFilter('all')}
                      className={`flex-1 py-2 ${verifyingFilter === 'all' ? 'bg-slate-100 text-gray-800' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                      {t('all')}
                    </button>
                    <button
                      onClick={() => setVerifyingFilter('unchecked')}
                      className={`flex-1 py-2 border-x border-gray-100 ${verifyingFilter === 'unchecked' ? 'bg-slate-100 text-gray-800' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                      {t('missing')}
                    </button>
                    <button
                      onClick={() => setVerifyingFilter('checked')}
                      className={`flex-1 py-2 ${verifyingFilter === 'checked' ? 'bg-emerald-50 text-emerald-800' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                      {t('ready')}
                    </button>
                  </div>
                </div>

                {/* Verification Items List (Subset Only) */}
                <div className="divide-y divide-gray-100 max-h-[50vh] overflow-y-auto bg-white">
                  {filteredVerifyItems.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 space-y-1">
                      <AlertCircle className="w-8 h-8 text-gray-300 mx-auto" />
                      <p className="text-sm font-semibold">{t('noItemsFound')}</p>
                    </div>
                  ) : (
                    filteredVerifyItems.map(item => {
                      const isChecked = !!verificationChecked[item.id]
                      const expectedQty = item.cantidad || 0
                      const countedQty = verificationCounted[item.id] !== undefined ? verificationCounted[item.id] : expectedQty
                      const diff = countedQty - expectedQty

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleToggleVerificationCheck(item.id)}
                          className={`flex items-center gap-4 p-5 cursor-pointer select-none transition-all ${
                            isChecked 
                              ? 'bg-emerald-50/40 hover:bg-emerald-50 border-l-4 border-emerald-500' 
                              : 'hover:bg-gray-50/50 border-l-4 border-transparent'
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {isChecked ? (
                              <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white scale-110 transition-transform shadow shadow-emerald-500/20">
                                <Check size={18} strokeWidth={3} />
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-full border-2 border-gray-300 hover:border-gray-400 transition-colors bg-white" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className={`text-base font-bold truncate ${isChecked ? 'text-emerald-950 font-bold' : 'text-gray-950'}`}>
                              {item.material}
                            </p>
                            
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
                              {item.modelo && (
                                <span className="font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                  {t('model')}: {item.modelo}
                                </span>
                              )}
                              
                              <span className="text-gray-400 font-bold">
                                {t('expectedQtyHeader')}: {expectedQty}
                              </span>

                              {item.observaciones && (
                                <span className="text-gray-500 italic max-w-[250px] truncate">
                                  &ldquo;{item.observaciones}&rdquo;
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Counted Quantity panel */}
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleUpdateVerificationQty(item.id, countedQty - 1)}
                              className="w-8 h-8 rounded-lg bg-gray-150 hover:bg-gray-200 border border-gray-250 flex items-center justify-center font-bold text-gray-700 active:scale-95 transition-transform"
                            >
                              -
                            </button>
                            
                            <div className="flex flex-col items-center min-w-[50px]">
                              <input
                                type="number"
                                min="0"
                                value={countedQty}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10)
                                  handleUpdateVerificationQty(item.id, isNaN(val) ? 0 : val)
                                }}
                                className="w-12 text-center text-sm font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded py-0.5 focus:outline-none focus:border-blue-500 focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />

                              {diff !== 0 && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border mt-0.5 ${
                                  diff < 0 
                                    ? 'text-red-600 bg-red-50 border-red-100' 
                                    : 'text-emerald-600 bg-emerald-50 border-emerald-100'
                                }`}>
                                  {diff > 0 ? `+${diff}` : diff}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleUpdateVerificationQty(item.id, countedQty + 1)}
                              className="w-8 h-8 rounded-lg bg-gray-150 hover:bg-gray-200 border border-gray-250 flex items-center justify-center font-bold text-gray-700 active:scale-95 transition-transform"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* General Observations */}
                <div className="p-4 md:p-6 bg-slate-50/40 border-t border-gray-150 space-y-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {t('generalObservations')}
                  </label>
                  <textarea
                    placeholder={t('generalObservationsPlaceholder')}
                    rows={2}
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  />
                </div>

                {/* Bottom verification submit */}
                <div className="p-4 bg-gray-50 border-t border-gray-150 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setActivePendingList(null)}
                    className="px-4 py-2 border border-gray-300 text-xs font-bold text-gray-700 rounded-xl bg-white hover:bg-gray-50 shadow-sm"
                  >
                    {t('cancel')}
                  </button>

                  <button
                    onClick={handleSaveVerificationSubmit}
                    disabled={submittingVerification || verificationProgress.checked === 0}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingVerification ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('saving')}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        Guardar y Registrar Inspección
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: HISTORIAL ──────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-gray-150 shadow-sm p-4 md:p-6 space-y-4">
            
            {selectedHistoryEntry ? (
              // History Detailed view
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedHistoryEntry(null)}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  &larr; {t('backToHistoryList')}
                </button>
                
                <div className="bg-slate-50 rounded-2xl p-4 border border-gray-100 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">{selectedHistoryEntry.checklistName}</h4>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1.5">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} /> 
                          {new Date(selectedHistoryEntry.date).toLocaleString(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <User size={13} /> 
                          {selectedHistoryEntry.user.split('@')[0]}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        try {
                          const res = await fetch(`/api/checklists/history/${selectedHistoryEntry.id}/pdf`)
                          if (!res.ok) throw new Error('Error al generar PDF')
                          const blob = await res.blob()
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `Reporte_Checklist_${selectedHistoryEntry.id.replace('hlog_', '')}.pdf`
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                          URL.revokeObjectURL(url)
                        } catch (err: any) {
                          alert('Error al descargar el PDF: ' + err.message)
                        }
                      }}
                      className="bg-red-50 hover:bg-red-100 text-red-700 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1 border border-red-200 transition-all cursor-pointer shrink-0"
                    >
                      <FileSpreadsheet size={14} />
                      {t('downloadReport')}
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs font-semibold border-t pt-3">
                    <span className="text-gray-500">{t('finalResult')}</span>
                    <span className="bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-full font-bold">
                      {selectedHistoryEntry.checkedCount} {t('of')} {selectedHistoryEntry.totalCount} {t('readyLabel')}
                    </span>
                  </div>
                  
                  {selectedHistoryEntry.notes && (
                    <div className="bg-blue-50/60 border border-blue-100/50 p-3.5 rounded-xl text-xs text-blue-950 mt-2 font-medium">
                      <p className="font-bold text-blue-900 mb-0.5">{t('reportNotes')}</p>
                      <p className="whitespace-pre-wrap">{selectedHistoryEntry.notes}</p>
                    </div>
                  )}
                </div>

                <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('itemDetails')}</h5>
                <div className="divide-y border rounded-2xl overflow-hidden bg-white">
                  {selectedHistoryEntry.items.map((item, idx) => (
                    <div key={idx} className={`p-3 text-xs flex items-start gap-2 justify-between ${item.checked ? 'bg-emerald-50/20' : 'bg-red-50/10'}`}>
                      <div className="min-w-0">
                        <p className={`font-semibold ${item.checked ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                          {item.material}
                        </p>
                        {item.modelo && <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{t('model')}: {item.modelo}</p>}
                        {item.observaciones && <p className="text-[10px] text-gray-400 italic mt-0.5">{item.observaciones}</p>}
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.cantidadContada !== undefined && item.cantidad !== undefined ? (
                          <div className="text-right flex flex-col items-end mr-1">
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                              {t('qtyHeader')}: {item.cantidadContada} / {item.cantidad}
                            </span>
                            {item.cantidadContada !== item.cantidad && (
                              <span className={`text-[9px] font-bold px-1 rounded mt-0.5 ${
                                item.cantidadContada < item.cantidad ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                              }`}>
                                {item.cantidadContada - item.cantidad > 0 ? `+${item.cantidadContada - item.cantidad}` : item.cantidadContada - item.cantidad}
                              </span>
                            )}
                          </div>
                        ) : item.cantidad !== undefined ? (
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                            {t('qtyHeader')}: {item.cantidad}
                          </span>
                        ) : null}
                        {item.checked ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">{t('ready')}</span>
                        ) : (
                          <span className="bg-red-100 text-red-800 text-[10px] font-bold px-1.5 py-0.5 rounded">{t('missingItem')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // History Lists
              <div className="space-y-4">
                {/* Filters / Search */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Buscar por checklist, usuario..."
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Bulk Download options */}
                  {selectedHistoryIds.length > 0 && (
                    <div className="bg-blue-50 border border-blue-150 rounded-xl p-2 flex items-center justify-between gap-2 text-xs font-semibold animate-fade-in shadow-inner">
                      <span className="text-blue-900 pl-2">{selectedHistoryIds.length} seleccionados</span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={async () => {
                            try {
                              const idsStr = selectedHistoryIds.join(',')
                              const res = await fetch(`/api/checklists/history/bulk-pdf?ids=${idsStr}`)
                              if (!res.ok) throw new Error('Error al generar PDF masivo')
                              const blob = await res.blob()
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `Reporte_Checklists_Masivo.pdf`
                              document.body.appendChild(a)
                              a.click()
                              document.body.removeChild(a)
                              URL.revokeObjectURL(url)
                            } catch (err: any) {
                              alert('Error al descargar el PDF masivo: ' + err.message)
                            }
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded-lg text-[11px] shadow transition-all"
                        >
                          Descargar Lote
                        </button>
                        <button
                          onClick={() => setSelectedHistoryIds([])}
                          className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 font-bold px-2 py-1 rounded-lg transition-all"
                        >
                          Limpiar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Select All Checkbox */}
                {filteredHistory.length > 0 && !loadingHistory && (
                  <div className="flex items-center justify-between px-1">
                    <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedHistoryIds.length === filteredHistory.length && filteredHistory.length > 0}
                        onChange={() => {
                          if (selectedHistoryIds.length === filteredHistory.length) {
                            setSelectedHistoryIds([])
                          } else {
                            setSelectedHistoryIds(filteredHistory.map(h => h.id))
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      Seleccionar todos
                    </label>
                  </div>
                )}

                {loadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Loader2 className="w-8 h-8 text-[#0763a9] animate-spin" />
                    <span className="text-xs text-gray-400">{t('loadingRecords')}</span>
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 border border-dashed rounded-2xl">
                    <History className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm font-medium">{t('noHistoryLogs')}</p>
                    <p className="text-xs mt-1">{t('noHistoryLogsDesc')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredHistory.map(entry => {
                      const isSelected = selectedHistoryIds.includes(entry.id)
                      return (
                        <div
                          key={entry.id}
                          onClick={() => setSelectedHistoryEntry(entry)}
                          className={`bg-white hover:bg-slate-50 border rounded-2xl p-4 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-sm hover:shadow ${
                            isSelected ? 'border-blue-200 bg-blue-50/10' : 'border-gray-150'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedHistoryIds(prev => 
                                    prev.includes(entry.id) 
                                      ? prev.filter(id => id !== entry.id) 
                                      : [...prev, entry.id]
                                  )
                                }}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </div>

                            <div className="min-w-0 space-y-1">
                              <h4 className="font-bold text-gray-950 text-sm truncate">{entry.checklistName}</h4>
                              <p className="text-[11px] text-gray-500 flex items-center gap-1">
                                <Calendar size={11} /> 
                                {new Date(entry.date).toLocaleString(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <p className="text-[11px] text-gray-400 truncate">
                                {t('userLabel')} {entry.user}
                              </p>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0 flex items-center gap-2">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                try {
                                  const res = await fetch(`/api/checklists/history/${entry.id}/pdf`)
                                  if (!res.ok) throw new Error('Error al generar PDF')
                                  const blob = await res.blob()
                                  const url = URL.createObjectURL(blob)
                                  const a = document.createElement('a')
                                  a.href = url
                                  a.download = `Reporte_Checklist_${entry.id.replace('hlog_', '')}.pdf`
                                  document.body.appendChild(a)
                                  a.click()
                                  document.body.removeChild(a)
                                  URL.revokeObjectURL(url)
                                } catch (err: any) {
                                  alert('Error al descargar el PDF: ' + err.message)
                                }
                              }}
                              className="w-8 h-8 rounded-lg hover:bg-slate-100 text-gray-500 hover:text-red-600 flex items-center justify-center transition-all cursor-pointer mr-1"
                              title={t('downloadReport')}
                            >
                              <FileSpreadsheet size={16} />
                            </button>
                            <div>
                              <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100/50">
                                {entry.checkedCount} / {entry.totalCount}
                              </p>
                              <p className="text-[9px] text-gray-400 mt-1 uppercase font-bold tracking-wider">{t('readyLabel')}</p>
                            </div>
                            <ChevronRight size={16} className="text-gray-400" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Submit Success Toast */}
        {submitSuccess && (
          <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-4 rounded-2xl shadow-xl z-50 flex items-center gap-3.5 border border-slate-800 animate-slide-up">
            <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white flex-shrink-0">
              <Check size={16} strokeWidth={3} />
            </div>
            <div>
              <p className="text-sm font-bold">{toastMessage.title}</p>
              <p className="text-xs text-gray-400">{toastMessage.desc}</p>
            </div>
          </div>
        )}

        {/* PDF Download Prompt Modal after verification */}
        {savedHistoryId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mx-auto shadow-inner">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="font-bold text-gray-950 text-xl">{t('inspectionSaved')}</h3>
              <p className="text-sm text-gray-500 font-medium">
                La inspección ha sido registrada con éxito en el historial. ¿Deseas descargar el reporte detallado en formato PDF?
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/checklists/history/${savedHistoryId}/pdf`)
                      if (!res.ok) throw new Error('Error al generar PDF')
                      const blob = await res.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `Reporte_Checklist_${savedHistoryId.replace('hlog_', '')}.pdf`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                      setSavedHistoryId(null)
                    } catch (err: any) {
                      alert('Error al descargar el PDF: ' + err.message)
                    }
                  }}
                  className="w-full py-3 bg-[#0763a9] hover:bg-[#064e86] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow transition-all cursor-pointer text-sm"
                >
                  <FileSpreadsheet size={18} />
                  Descargar Reporte PDF
                </button>
                <button
                  onClick={() => setSavedHistoryId(null)}
                  className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all cursor-pointer font-bold"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD ITEM ON THE FLY (Creation tab) */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <PlusCircle className="text-blue-600" size={20} />
                  Agregar Elemento al Vuelo
                </h3>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-150 flex items-center justify-center text-gray-500"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddOnTheFlyItem} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('itemNameLabel')}</label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder={t('itemNamePlaceholder')}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('itemModelLabel')}</label>
                    <input
                      type="text"
                      value={newItemModel}
                      onChange={(e) => setNewItemModel(e.target.value)}
                      placeholder={t('itemModelPlaceholder')}
                      className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('itemQtyLabel')}</label>
                    <input
                      type="number"
                      min="1"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('itemNotesLabel')}</label>
                  <input
                    type="text"
                    value={newItemNotes}
                    onChange={(e) => setNewItemNotes(e.target.value)}
                    placeholder={t('itemNotesPlaceholder')}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="pt-3 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border rounded-xl text-sm text-gray-700 bg-white hover:bg-gray-50 font-semibold"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!newItemName.trim()}
                    className="px-5 py-2 rounded-xl text-sm text-white bg-blue-600 hover:bg-blue-700 font-bold shadow-sm"
                  >
                    {t('addItem')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  )
}
