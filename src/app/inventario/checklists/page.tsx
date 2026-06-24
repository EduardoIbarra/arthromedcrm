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
  ArrowLeft
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

  // State
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [selectedChecklistId, setSelectedChecklistId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'checked' | 'unchecked'>('all')

  // Checked state stored as: { [checklistId]: { [itemId]: boolean } }
  const [checkedStates, setCheckedStates] = useState<Record<string, Record<string, boolean>>>({})
  
  // Custom items added on the fly: { [checklistId]: ChecklistItem[] }
  const [customItems, setCustomItems] = useState<Record<string, ChecklistItem[]>>({})

  // Counted quantities: { [checklistId]: { [itemId]: number } }
  const [countedQuantities, setCountedQuantities] = useState<Record<string, Record<string, number>>>({})
  
  // Checklist-level general notes: { [checklistId]: string }
  const [checklistNotes, setChecklistNotes] = useState<Record<string, string>>({})

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemModel, setNewItemModel] = useState('')
  const [newItemQty, setNewItemQty] = useState('1')
  const [newItemNotes, setNewItemNotes] = useState('')
  const [makePermanent, setMakePermanent] = useState(false)
  const [addingItem, setAddingItem] = useState(false)

  // History states
  const [showHistory, setShowHistory] = useState(false)
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<HistoryEntry | null>(null)
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([])

  // Submit states
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [savedHistoryId, setSavedHistoryId] = useState<string | null>(null)

  // ─── Fetch Checklist Definitions ───────────────────────────────────────────

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

  useEffect(() => {
    fetchChecklists()
  }, [fetchChecklists])

  // Load checklist history from query parameter on mount if ?historyId is present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const historyId = params.get('historyId')
      if (historyId) {
        setShowHistory(true)
        fetchHistory()
      }
    }
  }, [])

  // Auto-select the history entry matching the ?historyId query parameter once list is fetched
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const historyId = params.get('historyId')
      if (historyId && historyList.length > 0) {
        const entry = historyList.find(e => e.id === historyId)
        if (entry) {
          setSelectedHistoryEntry(entry)
        }
      }
    }
  }, [historyList])

  // ─── Load Local Storage States ──────────────────────────────────────────────

  useEffect(() => {
    if (checklists.length === 0) return

    const loadedStates: Record<string, Record<string, boolean>> = {}
    const loadedCustom: Record<string, ChecklistItem[]> = {}
    const loadedQuantities: Record<string, Record<string, number>> = {}
    const loadedNotes: Record<string, string> = {}

    checklists.forEach(c => {
      // Load checked states
      const stateKey = `checklist_checked_state_${c.id}`
      const savedState = localStorage.getItem(stateKey)
      if (savedState) {
        try {
          loadedStates[c.id] = JSON.parse(savedState)
        } catch (_) {}
      }

      // Load custom items
      const customKey = `checklist_custom_items_${c.id}`
      const savedCustom = localStorage.getItem(customKey)
      if (savedCustom) {
        try {
          loadedCustom[c.id] = JSON.parse(savedCustom)
        } catch (_) {}
      }

      // Load counted quantities
      const qtyKey = `checklist_counted_quantities_${c.id}`
      const savedQtys = localStorage.getItem(qtyKey)
      if (savedQtys) {
        try {
          loadedQuantities[c.id] = JSON.parse(savedQtys)
        } catch (_) {}
      }

      // Load checklist general notes
      const notesKey = `checklist_notes_${c.id}`
      const savedNote = localStorage.getItem(notesKey)
      if (savedNote) {
        loadedNotes[c.id] = savedNote
      }
    })

    setCheckedStates(loadedStates)
    setCustomItems(loadedCustom)
    setCountedQuantities(loadedQuantities)
    setChecklistNotes(loadedNotes)
  }, [checklists])

  // ─── Save Local Storage States ──────────────────────────────────────────────

  const saveCheckedStateLocally = (checklistId: string, itemStates: Record<string, boolean>) => {
    localStorage.setItem(`checklist_checked_state_${checklistId}`, JSON.stringify(itemStates))
  }

  const saveCustomItemsLocally = (checklistId: string, items: ChecklistItem[]) => {
    localStorage.setItem(`checklist_custom_items_${checklistId}`, JSON.stringify(items))
  }

  const saveCountedQuantitiesLocally = (checklistId: string, quantities: Record<string, number>) => {
    localStorage.setItem(`checklist_counted_quantities_${checklistId}`, JSON.stringify(quantities))
  }

  const handleUpdateNotes = (notes: string) => {
    if (!selectedChecklistId) return
    setChecklistNotes(prev => ({
      ...prev,
      [selectedChecklistId]: notes
    }))
    localStorage.setItem(`checklist_notes_${selectedChecklistId}`, notes)
  }

  const getCountedQty = (itemId: string, defaultQty: number) => {
    const checklistId = selectedChecklistId
    const checklistQtys = countedQuantities[checklistId] || {}
    if (checklistQtys[itemId] !== undefined) {
      return checklistQtys[itemId]
    }
    return defaultQty
  }

  const handleUpdateQty = (itemId: string, newQty: number) => {
    if (!selectedChecklistId) return
    const checklistId = selectedChecklistId
    const checklistQtys = countedQuantities[checklistId] || {}
    const updated = {
      ...checklistQtys,
      [itemId]: newQty >= 0 ? newQty : 0
    }
    setCountedQuantities(prev => ({
      ...prev,
      [checklistId]: updated
    }))
    saveCountedQuantitiesLocally(checklistId, updated)
    
    // Auto check item when quantity is modified!
    const currentChecked = checkedStates[selectedChecklistId] || {}
    if (!currentChecked[itemId]) {
      const updatedChecked = { ...currentChecked, [itemId]: true }
      setCheckedStates(prev => ({
        ...prev,
        [selectedChecklistId]: updatedChecked
      }))
      saveCheckedStateLocally(selectedChecklistId, updatedChecked)
    }
  }

  const handleIncrementQty = (itemId: string, defaultQty: number) => {
    const current = getCountedQty(itemId, defaultQty)
    handleUpdateQty(itemId, current + 1)
  }

  const handleDecrementQty = (itemId: string, defaultQty: number) => {
    const current = getCountedQty(itemId, defaultQty)
    if (current > 0) {
      handleUpdateQty(itemId, current - 1)
    }
  }

  const getQtyDiffBadge = (itemId: string, defaultQty: number) => {
    const currentQty = getCountedQty(itemId, defaultQty)
    const diff = currentQty - defaultQty
    if (diff === 0) return null
    if (diff < 0) {
      return (
        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded border border-red-100 mt-0.5">
          {diff}
        </span>
      )
    }
    return (
      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100 mt-0.5">
        +{diff}
      </span>
    )
  }

  // ─── Fetch History Logs ────────────────────────────────────────────────────

  const fetchHistory = async () => {
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
  }

  useEffect(() => {
    if (showHistory) {
      fetchHistory()
    }
  }, [showHistory])

  // ─── Computed Current Checklist ──────────────────────────────────────────

  const activeChecklist = useMemo(() => {
    return checklists.find(c => c.id === selectedChecklistId) || null
  }, [checklists, selectedChecklistId])

  const activeItems = useMemo(() => {
    if (!activeChecklist) return []
    const baseItems = activeChecklist.items
    const extraItems = customItems[activeChecklist.id] || []
    return [...baseItems, ...extraItems]
  }, [activeChecklist, customItems])

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    const checklistId = selectedChecklistId
    const currentChecked = checkedStates[checklistId] || {}

    return activeItems.filter(item => {
      const matchesSearch = 
        item.material.toLowerCase().includes(query) ||
        (item.modelo && item.modelo.toLowerCase().includes(query)) ||
        (item.observaciones && item.observaciones.toLowerCase().includes(query))

      const isChecked = !!currentChecked[item.id]

      if (filterMode === 'checked') return matchesSearch && isChecked
      if (filterMode === 'unchecked') return matchesSearch && !isChecked
      return matchesSearch
    })
  }, [activeItems, searchQuery, selectedChecklistId, checkedStates, filterMode])

  // Progress Calculations
  const progressStats = useMemo(() => {
    const total = activeItems.length
    if (total === 0) return { checked: 0, total: 0, pct: 0 }
    
    const checklistId = selectedChecklistId
    const currentChecked = checkedStates[checklistId] || {}
    const checked = activeItems.filter(item => !!currentChecked[item.id]).length
    
    return {
      checked,
      total,
      pct: Math.round((checked / total) * 100)
    }
  }, [activeItems, selectedChecklistId, checkedStates])

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleToggleCheck = (itemId: string) => {
    if (!selectedChecklistId) return
    
    const currentChecked = checkedStates[selectedChecklistId] || {}
    const updated = {
      ...currentChecked,
      [itemId]: !currentChecked[itemId]
    }

    setCheckedStates(prev => ({
      ...prev,
      [selectedChecklistId]: updated
    }))
    
    saveCheckedStateLocally(selectedChecklistId, updated)
  }

  const handleResetChecklist = () => {
    if (!selectedChecklistId || !confirm(t('confirmUncheckAll'))) return
    
    setCheckedStates(prev => ({
      ...prev,
      [selectedChecklistId]: {}
    }))
    saveCheckedStateLocally(selectedChecklistId, {})
  }

  const handleAddOnTheFlyItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChecklistId || !newItemName.trim()) return

    setAddingItem(true)
    const newId = `otf_${Date.now()}`
    const qty = parseInt(newItemQty, 10)
    
    const newOtfItem: ChecklistItem = {
      id: newId,
      material: newItemName.trim(),
      modelo: newItemModel.trim() || undefined,
      cantidad: isNaN(qty) ? undefined : qty,
      observaciones: newItemNotes.trim() || undefined,
      addedOnTheFly: true
    }

    try {
      if (makePermanent) {
        // Call backend API to append to the template permanently
        const updatedChecklists = checklists.map(c => {
          if (c.id === selectedChecklistId) {
            return {
              ...c,
              items: [...c.items, { ...newOtfItem, addedOnTheFly: undefined }] // Remove the temporary flag
            }
          }
          return c
        })

        const res = await fetch('/api/checklists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checklists: updatedChecklists })
        })

        if (!res.ok) {
          const json = await res.json()
          throw new Error(json.error || t('saveTemplateError'))
        }

        // Update local state with fetched templates
        const jsonResponse = await res.json()
        setChecklists(jsonResponse.data)
      } else {
        // Save only locally in this run
        const currentCustom = customItems[selectedChecklistId] || []
        const updatedCustom = [...currentCustom, newOtfItem]

        setCustomItems(prev => ({
          ...prev,
          [selectedChecklistId]: updatedCustom
        }))

        saveCustomItemsLocally(selectedChecklistId, updatedCustom)
      }

      // Mark the newly added item as checked automatically
      const currentChecked = checkedStates[selectedChecklistId] || {}
      const updatedChecked = { ...currentChecked, [newId]: true }
      setCheckedStates(prev => ({
        ...prev,
        [selectedChecklistId]: updatedChecked
      }))
      saveCheckedStateLocally(selectedChecklistId, updatedChecked)

      // Close modal & reset fields
      setShowAddModal(false)
      setNewItemName('')
      setNewItemModel('')
      setNewItemQty('1')
      setNewItemNotes('')
      setMakePermanent(false)
    } catch (err: any) {
      alert(`${t('error')}: ${err.message}`)
    } finally {
      setAddingItem(false)
    }
  }

  const handleSubmitChecklist = async () => {
    if (!activeChecklist) return
    if (progressStats.checked === 0) {
      alert(t('alertAtLeastOneItem'))
      return
    }

    if (!confirm(`${t('confirmSubmitChecklist')} ("${activeChecklist.nombre}")`)) return

    setSubmitting(true)
    try {
      const currentChecked = checkedStates[selectedChecklistId] || {}
      
      const historyEntry = {
        id: `hlog_${Date.now()}`,
        checklistId: selectedChecklistId,
        checklistName: activeChecklist.nombre,
        date: new Date().toISOString(),
        user: profile?.email || 'Usuario ERP',
        checkedCount: progressStats.checked,
        totalCount: progressStats.total,
        notes: checklistNotes[selectedChecklistId] || '',
        items: activeItems.map(item => {
          const defaultQty = item.cantidad || 0
          return {
            material: item.material,
            modelo: item.modelo,
            cantidad: defaultQty,
            cantidadContada: getCountedQty(item.id, defaultQty),
            checked: !!currentChecked[item.id],
            observaciones: item.observaciones
          }
        })
      }

      const res = await fetch('/api/checklists/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry: historyEntry })
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || t('error'))
      }

      setSavedHistoryId(historyEntry.id)
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 3000)
      fetchHistory()
      
      // Optionally reset the checklist state
      setCheckedStates(prev => ({
        ...prev,
        [selectedChecklistId]: {}
      }))
      saveCheckedStateLocally(selectedChecklistId, {})
      
      // Also clear custom items for this run
      setCustomItems(prev => ({
        ...prev,
        [selectedChecklistId]: []
      }))
      localStorage.removeItem(`checklist_custom_items_${selectedChecklistId}`)

      // Clear custom quantities and notes for this checklist
      setCountedQuantities(prev => ({
        ...prev,
        [selectedChecklistId]: {}
      }))
      localStorage.removeItem(`checklist_counted_quantities_${selectedChecklistId}`)

      setChecklistNotes(prev => ({
        ...prev,
        [selectedChecklistId]: ''
      }))
      localStorage.removeItem(`checklist_notes_${selectedChecklistId}`)

    } catch (err: any) {
      alert(`${t('error')}: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render Helper Badges ──────────────────────────────────────────────────

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

  const getProgressColor = (pct: number) => {
    if (pct === 100) return 'bg-emerald-500'
    if (pct > 50) return 'bg-blue-500'
    return 'bg-amber-500'
  }

  // ─── Main Render ───────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 pb-20">
        
        {/* Navigation Bar / Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link 
            href="/inventario" 
            className="flex items-center gap-1 text-sm font-medium text-[#0763a9] hover:underline"
          >
            <ArrowLeft size={16} /> {t('backToInventory')}
          </Link>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              <History size={16} /> {t('checklistHistory')}
            </button>
            <Link
              href="/inventario/checklists/manage"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-transparent bg-slate-800 text-sm text-white hover:bg-slate-900 shadow-sm"
            >
              <Settings size={16} /> {t('manageChecklists')}
            </Link>
          </div>
        </div>

        {/* Title */}
        <div className="bg-white rounded-2xl p-5 md:p-6 border border-blue-100 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <ClipboardList size={26} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">{t('checklists')}</h1>
                <p className="text-xs md:text-sm text-gray-500">{t('checklistsDesc')}</p>
              </div>
            </div>
          </div>

          {/* Quick Tabs Selection */}
          {loading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="w-6 h-6 text-[#0763a9] animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {checklists.map(c => {
                const isSelected = selectedChecklistId === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedChecklistId(c.id)
                      setSearchQuery('')
                    }}
                    className={`py-2 px-3 text-xs md:text-sm font-semibold rounded-xl text-center border transition-all ${
                      isSelected 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20' 
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    {getChecklistLabel(c.id)}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Current Active Checklist and Progress */}
        {activeChecklist && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            
            {/* Header Checklist Info & Progress bar */}
            <div className="p-4 md:p-6 bg-slate-50 border-b border-gray-100 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{activeChecklist.nombre}</h2>
                  <p className="text-xs text-gray-500">{activeChecklist.descripcion}</p>
                </div>
                <div className="bg-white border px-3 py-1.5 rounded-xl flex items-center justify-between sm:justify-start gap-4">
                  <span className="text-xs text-gray-500 font-medium">{t('progress')}</span>
                  <span className="text-sm font-bold text-gray-900">
                    {progressStats.checked} / {progressStats.total}
                  </span>
                </div>
              </div>

              {/* Progress bar container */}
              <div className="space-y-1">
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                     className={`h-full rounded-full transition-all duration-500 ${getProgressColor(progressStats.pct)}`}
                     style={{ width: `${progressStats.pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-semibold text-gray-400">
                  <span>0%</span>
                  <span>{progressStats.pct}% {t('completedLabel')}</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-4 border-b border-gray-100 bg-white grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Search */}
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filter mode */}
              <div className="flex border border-gray-200 rounded-xl overflow-hidden text-xs">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`flex-1 py-2 font-medium ${filterMode === 'all' ? 'bg-slate-100 text-gray-800' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  {t('all')}
                </button>
                <button
                  onClick={() => setFilterMode('unchecked')}
                  className={`flex-1 py-2 font-medium border-x border-gray-100 ${filterMode === 'unchecked' ? 'bg-slate-100 text-gray-800' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  {t('missing')}
                </button>
                <button
                  onClick={() => setFilterMode('checked')}
                  className={`flex-1 py-2 font-medium ${filterMode === 'checked' ? 'bg-emerald-50 text-emerald-800' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  {t('ready')}
                </button>
              </div>
            </div>

            {/* List of items */}
            <div className="divide-y divide-gray-100 max-h-[50vh] md:max-h-[60vh] overflow-y-auto bg-white">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-gray-400 space-y-1">
                  <AlertCircle className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="text-sm font-medium">{t('noItemsFound')}</p>
                  <p className="text-xs">{t('changeFiltersOrSearch')}</p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isChecked = !!(checkedStates[selectedChecklistId] || {})[item.id]
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleCheck(item.id)}
                      className={`flex items-center gap-4 p-5 md:p-6 cursor-pointer select-none transition-all ${
                        isChecked 
                          ? 'bg-emerald-50/60 hover:bg-emerald-50 border-l-4 border-emerald-500' 
                          : 'hover:bg-gray-50/80 border-l-4 border-transparent'
                      }`}
                    >
                      {/* Checkbox circle/icon */}
                      <div className="flex-shrink-0">
                        {isChecked ? (
                          <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white scale-110 transition-transform">
                            <Check size={18} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full border-2 border-gray-300 hover:border-gray-400 transition-colors bg-white" />
                        )}
                      </div>

                      {/* Content details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center gap-3">
                          <p className={`text-base md:text-lg font-bold truncate ${isChecked ? 'text-emerald-950 font-bold' : 'text-gray-900'}`}>
                            {item.material}
                          </p>
                          {item.cantidad !== undefined && (
                            <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              {/* Decrement Quantity */}
                              <button
                                type="button"
                                onClick={() => handleDecrementQty(item.id, item.cantidad || 0)}
                                className="w-8 h-8 rounded-lg bg-gray-150 hover:bg-gray-200 border border-gray-250 flex items-center justify-center font-bold text-gray-700 active:scale-90 transition-transform"
                                title={t('subtractOne')}
                              >
                                -
                              </button>
                              
                              {/* Quantity and Diff display */}
                              <div className="flex flex-col items-center min-w-[50px]">
                                <input
                                  type="number"
                                  min="0"
                                  value={getCountedQty(item.id, item.cantidad || 0)}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10)
                                    handleUpdateQty(item.id, isNaN(val) ? 0 : val)
                                  }}
                                  className="w-12 text-center text-sm font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded py-0.5 leading-none focus:outline-none focus:border-blue-500 focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                {getQtyDiffBadge(item.id, item.cantidad || 0)}
                              </div>

                              {/* Increment Quantity */}
                              <button
                                type="button"
                                onClick={() => handleIncrementQty(item.id, item.cantidad || 0)}
                                className="w-8 h-8 rounded-lg bg-gray-150 hover:bg-gray-200 border border-gray-250 flex items-center justify-center font-bold text-gray-700 active:scale-90 transition-transform"
                                title={t('addOne')}
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Sub headers if any */}
                        {(item.modelo || item.observaciones || item.addedOnTheFly) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs md:text-sm">
                            {item.modelo && (
                              <span className="font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                {t('model')}: {item.modelo}
                              </span>
                            )}
                            {item.observaciones && (
                              <span className="text-gray-500 italic truncate max-w-[300px]">
                                {item.observaciones}
                              </span>
                            )}
                            {item.addedOnTheFly && (
                              <span className="text-[11px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                                {t('addedOnTheFly')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Checklist Level Comments / Notes */}
            <div className="p-4 md:p-6 bg-slate-50/40 border-t border-gray-100 space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                {t('generalObservations')}
              </label>
              <textarea
                placeholder={t('generalObservationsPlaceholder')}
                rows={2}
                value={checklistNotes[selectedChecklistId] || ''}
                onChange={(e) => handleUpdateNotes(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              />
            </div>

            {/* Bottom Actions for checklist */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetChecklist}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 shadow-sm"
                >
                  <RotateCcw size={14} /> {t('uncheckAll')}
                </button>
                
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 shadow-sm"
                >
                  <Plus size={14} /> {t('addItem')}
                </button>
              </div>

              <button
                onClick={handleSubmitChecklist}
                disabled={submitting || progressStats.checked === 0}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> {t('saving')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> {t('saveInspection')}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Submit Success Notification Toast */}
        {submitSuccess && (
          <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl z-50 flex items-center gap-3 animate-fade-in border border-slate-800">
            <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white">
              <Check size={16} strokeWidth={3} />
            </div>
            <div>
              <p className="text-sm font-bold">{t('inspectionSaved')}</p>
              <p className="text-xs text-gray-400">{t('inspectionSavedDesc')}</p>
            </div>
          </div>
        )}

        {/* PDF Download Offering Modal */}
        {savedHistoryId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 text-center animate-scale-up space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="font-bold text-gray-900 text-xl">{t('inspectionSaved')}</h3>
              <p className="text-sm text-gray-500">
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
                  className="w-full py-3 bg-[#0763a9] hover:bg-[#064e86] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow transition-all cursor-pointer"
                >
                  <ClipboardList size={18} />
                  Descargar Reporte PDF
                </button>
                <button
                  onClick={() => setSavedHistoryId(null)}
                  className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all cursor-pointer font-medium"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: ADD ITEM ON THE FLY ──────────────────────────────────────── */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <PlusCircle className="text-blue-600" size={20} />
                  {t('addItemToList')}
                </h3>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
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

                <div className="pt-2">
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={makePermanent}
                      onChange={(e) => setMakePermanent(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <div className="text-xs text-gray-700">
                      <p className="font-bold text-gray-900">{t('savePermanently')}</p>
                      <p className="text-gray-500">{t('savePermanentlyDesc')}</p>
                    </div>
                  </label>
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
                    disabled={addingItem || !newItemName.trim()}
                    className="px-5 py-2 rounded-xl text-sm text-white bg-blue-600 hover:bg-blue-700 font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                  >
                    {addingItem && <Loader2 size={14} className="animate-spin" />}
                    {t('addItem')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL/DRAWER: HISTORIAL DE INSPECCIONES ─────────────────────────── */}
        {showHistory && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end">
            <div className="bg-white w-full max-w-lg h-full overflow-hidden shadow-2xl flex flex-col animate-slide-left">
              
              {/* History Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <History className="text-blue-600" size={20} />
                  <h3 className="font-bold text-gray-900 text-lg">{t('checklistHistory')}</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowHistory(false)
                    setSelectedHistoryEntry(null)
                  }}
                  className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500"
                >
                  <X size={18} />
                </button>
              </div>

              {/* History Content Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* Detailed Entry view (Back option) */}
                {selectedHistoryEntry ? (
                  <div className="space-y-4">
                    <button
                      onClick={() => setSelectedHistoryEntry(null)}
                      className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      &larr; {t('backToHistoryList')}
                    </button>
                    
                    <div className="bg-slate-50 rounded-2xl p-4 border border-gray-100 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900 text-base">{selectedHistoryEntry.checklistName}</h4>
                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1.5">
                            <span className="flex items-center gap-1">
                              <Calendar size={13} /> {new Date(selectedHistoryEntry.date).toLocaleString(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="flex items-center gap-1">
                              <User size={13} /> {selectedHistoryEntry.user.split('@')[0]}
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
                          className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border border-red-200 transition-all cursor-pointer shrink-0"
                        >
                          <ClipboardList size={13} />
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
                        <div className="bg-blue-50/60 border border-blue-100/50 p-3 rounded-xl text-xs text-blue-950 mt-2 font-medium">
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
                  /* History List View */
                  <div className="space-y-3">
                    {/* Bulk Action Bar */}
                    {selectedHistoryIds.length > 0 && (
                      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 flex items-center justify-between gap-2 mb-1 animate-fade-in shadow-sm">
                        <span className="text-xs font-bold text-blue-900">
                          {selectedHistoryIds.length} seleccionados
                        </span>
                        <div className="flex items-center gap-2">
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
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow"
                          >
                            <ClipboardList size={13} />
                            Descargar
                          </button>
                          <button
                            onClick={() => setSelectedHistoryIds([])}
                            className="text-gray-500 hover:text-gray-700 text-xs font-bold px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-all cursor-pointer"
                          >
                            Limpiar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Select All Checkbox */}
                    {historyList.length > 0 && !loadingHistory && (
                      <div className="flex items-center justify-between px-1">
                        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={selectedHistoryIds.length === historyList.length && historyList.length > 0}
                            onChange={() => {
                              if (selectedHistoryIds.length === historyList.length) {
                                setSelectedHistoryIds([])
                              } else {
                                setSelectedHistoryIds(historyList.map(h => h.id))
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
                    ) : historyList.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">
                        <ClipboardList className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                        <p className="text-sm font-medium">{t('noHistoryLogs')}</p>
                        <p className="text-xs mt-1">{t('noHistoryLogsDesc')}</p>
                      </div>
                    ) : (
                      historyList.map(entry => {
                        const isSelected = selectedHistoryIds.includes(entry.id)
                        return (
                          <div
                            key={entry.id}
                            onClick={() => setSelectedHistoryEntry(entry)}
                            className={`bg-white hover:bg-slate-50 border rounded-2xl p-4 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-sm hover:shadow ${
                              isSelected ? 'border-blue-200 bg-blue-50/10' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Selection Checkbox */}
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
                                <h4 className="font-bold text-gray-900 text-sm truncate">{entry.checklistName}</h4>
                                <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
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
                                <ClipboardList size={16} />
                              </button>
                              <div>
                                <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                  {entry.checkedCount} / {entry.totalCount}
                                </p>
                                <p className="text-[9px] text-gray-400 mt-1 uppercase font-semibold">{t('readyLabel')}</p>
                              </div>
                              <ChevronRight size={16} className="text-gray-400" />
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  )
}
