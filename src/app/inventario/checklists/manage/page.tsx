'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ClipboardList, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  Loader2, 
  ArrowLeft, 
  X, 
  AlertCircle, 
  PlusCircle, 
  Check, 
  FolderPlus,
  BookOpen
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/contexts/I18nContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string
  material: string
  modelo?: string
  cantidad?: number
  observaciones?: string
  groupId?: string
}

interface ChecklistGroup {
  id: string
  nombre: string
}

interface Checklist {
  id: string
  nombre: string
  descripcion: string
  items: ChecklistItem[]
  groups?: ChecklistGroup[]
  coResponsableId?: string
}

interface StaffMember {
  id: string
  email: string
  first_name: string
  last_name: string
  position: string
}

export default function ChecklistManagePage() {
  const router = useRouter()
  const { t } = useI18n()

  // Data State
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Selection
  const [selectedId, setSelectedId] = useState<string>('')

  // New Checklist Form
  const [showNewChecklistModal, setShowNewChecklistModal] = useState(false)
  const [newChecklistName, setNewChecklistName] = useState('')
  const [newChecklistDesc, setNewChecklistDesc] = useState('')

  // Editing Checklist Details (Current Selection)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editItems, setEditItems] = useState<ChecklistItem[]>([])
  const [editGroups, setEditGroups] = useState<ChecklistGroup[]>([])
  const [editCoResponsableId, setEditCoResponsableId] = useState<string>('')

  // Staff list for Co-Responsable dropdown
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [newGroupName, setNewGroupName] = useState('')

  // Item Form Modal (Adding or Editing)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null) // null means adding
  const [itemMaterial, setItemMaterial] = useState('')
  const [itemModelo, setItemModelo] = useState('')
  const [itemCantidad, setItemCantidad] = useState('1')
  const [itemObservaciones, setItemObservaciones] = useState('')
  const [itemGroupId, setItemGroupId] = useState<string>('')

  // ─── Fetch Checklist Definitions ───────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/checklists')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Error al obtener checklists')
        
        const data = json.data as Checklist[]
        setChecklists(data)
        
        if (data.length > 0) {
          const first = data[0]
          setSelectedId(first.id)
          setEditName(first.nombre)
          setEditDesc(first.descripcion)
          setEditItems(first.items)
          setEditGroups(first.groups || [])
          setEditCoResponsableId(first.coResponsableId || '')
        }

        // Fetch staff profiles
        const staffRes = await fetch('/api/cirugias/usuarios')
        const staffJson = await staffRes.json()
        if (staffRes.ok) {
          setStaffList(staffJson.data || [])
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ─── Handle Checklist Switch ───────────────────────────────────────────────

  const handleSelectChecklist = (id: string) => {
    const checklist = checklists.find(c => c.id === id)
    if (!checklist) return
    
    setSelectedId(id)
    setEditName(checklist.nombre)
    setEditDesc(checklist.descripcion)
    setEditItems(checklist.items)
    setEditGroups(checklist.groups || [])
    setEditCoResponsableId(checklist.coResponsableId || '')
    setSaveSuccess(false)
  }

  // ─── Create New Checklist Template ─────────────────────────────────────────

  const handleCreateChecklist = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChecklistName.trim()) return

    const newId = `custom_cl_${Date.now()}`
    const newChecklist: Checklist = {
      id: newId,
      nombre: newChecklistName.trim(),
      descripcion: newChecklistDesc.trim(),
      items: [],
      groups: [],
      coResponsableId: undefined
    }

    const updated = [...checklists, newChecklist]
    setChecklists(updated)
    
    // Switch to new checklist
    setSelectedId(newId)
    setEditName(newChecklist.nombre)
    setEditDesc(newChecklist.descripcion)
    setEditItems([])
    setEditGroups([])
    setEditCoResponsableId('')

    // Close modal
    setShowNewChecklistModal(false)
    setNewChecklistName('')
    setNewChecklistDesc('')
  }

  // ─── Delete Checklist Template ─────────────────────────────────────────────

  const handleDeleteChecklist = () => {
    if (!selectedId) return
    const current = checklists.find(c => c.id === selectedId)
    if (!current) return

    if (!confirm(`${t('confirmDeleteChecklist')} ("${current.nombre}")`)) {
      return
    }

    const updated = checklists.filter(c => c.id !== selectedId)
    setChecklists(updated)

    if (updated.length > 0) {
      const next = updated[0]
      setSelectedId(next.id)
      setEditName(next.nombre)
      setEditDesc(next.descripcion)
      setEditItems(next.items)
      setEditGroups(next.groups || [])
      setEditCoResponsableId(next.coResponsableId || '')
    } else {
      setSelectedId('')
      setEditName('')
      setEditDesc('')
      setEditItems([])
      setEditGroups([])
      setEditCoResponsableId('')
    }
  }

  // ─── Group Operations ──────────────────────────────────────────────────────

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return
    const newGroup: ChecklistGroup = {
      id: `group_${Date.now()}`,
      nombre: newGroupName.trim()
    }
    setEditGroups(prev => [...prev, newGroup])
    setNewGroupName('')
  }

  const handleDeleteGroup = (groupId: string) => {
    if (!confirm('¿Deseas eliminar este grupo? Los artículos de este grupo pasarán a estar "Sin grupo".')) return
    setEditGroups(prev => prev.filter(g => g.id !== groupId))
    setEditItems(prev => prev.map(item => {
      if (item.groupId === groupId) {
        const { groupId: _, ...rest } = item
        return rest
      }
      return item
    }))
  }

  const handleRenameGroup = (groupId: string, newName: string) => {
    if (!newName.trim()) return
    setEditGroups(prev => prev.map(g => g.id === groupId ? { ...g, nombre: newName.trim() } : g))
  }

  // Group selector for items
  const groupedEditItems = useMemo(() => {
    const ungrouped = editItems.filter(item => !item.groupId || !editGroups.some(g => g.id === item.groupId))
    const groupedMap = editGroups.map(group => ({
      group,
      items: editItems.filter(item => item.groupId === group.id)
    }))
    return {
      ungrouped,
      grouped: groupedMap
    }
  }, [editItems, editGroups])

  // ─── Item Operations ───────────────────────────────────────────────────────

  const openAddItemModal = (preselectedGroupId?: string) => {
    setEditingItemId(null)
    setItemMaterial('')
    setItemModelo('')
    setItemCantidad('1')
    setItemObservaciones('')
    setItemGroupId(preselectedGroupId || '')
    setShowItemModal(true)
  }

  const openEditItemModal = (item: ChecklistItem) => {
    setEditingItemId(item.id)
    setItemMaterial(item.material)
    setItemModelo(item.modelo || '')
    setItemCantidad(item.cantidad !== undefined ? String(item.cantidad) : '1')
    setItemObservaciones(item.observaciones || '')
    setItemGroupId(item.groupId || '')
    setShowItemModal(true)
  }

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemMaterial.trim()) return

    const qty = parseInt(itemCantidad, 10)
    
    if (editingItemId === null) {
      // Adding new item
      const newItem: ChecklistItem = {
        id: `item_${Date.now()}`,
        material: itemMaterial.trim(),
        modelo: itemModelo.trim() || undefined,
        cantidad: isNaN(qty) ? undefined : qty,
        observaciones: itemObservaciones.trim() || undefined,
        groupId: itemGroupId || undefined
      }
      setEditItems(prev => [...prev, newItem])
    } else {
      // Editing existing item
      setEditItems(prev => prev.map(item => {
        if (item.id === editingItemId) {
          return {
            ...item,
            material: itemMaterial.trim(),
            modelo: itemModelo.trim() || undefined,
            cantidad: isNaN(qty) ? undefined : qty,
            observaciones: itemObservaciones.trim() || undefined,
            groupId: itemGroupId || undefined
          }
        }
        return item
      }))
    }

    setShowItemModal(false)
  }

  const handleDeleteItem = (itemId: string) => {
    if (!confirm(t('confirmRemoveItem'))) return
    setEditItems(prev => prev.filter(item => item.id !== itemId))
  }

  // ─── Save All Changes to Database ──────────────────────────────────────────

  const handleSaveAllChanges = async () => {
    if (!selectedId && checklists.length > 0) return

    setSaving(true)
    setError(null)
    setSaveSuccess(false)

    try {
      // Merge active edits into the checklists array
      const updatedChecklists = checklists.map(c => {
        if (c.id === selectedId) {
          return {
            ...c,
            nombre: editName.trim(),
            descripcion: editDesc.trim(),
            items: editItems,
            groups: editGroups,
            coResponsableId: editCoResponsableId || undefined
          }
        }
        return c
      })

      const res = await fetch('/api/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklists: updatedChecklists })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || t('saveTemplateError'))

      setChecklists(json.data)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ─── Main Render ───────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        
        {/* Top bar / Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link 
            href="/inventario/checklists" 
            className="flex items-center gap-1 text-sm font-semibold text-[#0763a9] hover:underline"
          >
            <ArrowLeft size={16} /> {t('backToChecklists')}
          </Link>
          
          <button
            onClick={() => setShowNewChecklistModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white rounded-xl shadow-sm transition-colors"
          >
            <FolderPlus size={16} /> {t('newChecklist')}
          </button>
        </div>

        {/* Heading */}
        <div className="bg-slate-800 text-white rounded-2xl p-6 border border-slate-700 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <ClipboardList size={26} className="text-blue-400" />
              {t('checklistManagementTitle')}
            </h1>
            <p className="text-xs md:text-sm text-slate-300 mt-1">
              {t('checklistManagementDesc')}
            </p>
          </div>
          
          {checklists.length > 0 && (
            <button
              onClick={handleSaveAllChanges}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-emerald-500 hover:bg-emerald-600 rounded-xl disabled:opacity-50 text-white shadow shadow-emerald-950/20 transition-all self-start md:self-auto"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> {t('saving')}
                </>
              ) : (
                <>
                  <Save size={16} /> {t('saveAllChanges')}
                </>
              )}
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-100 flex items-start gap-2.5 text-sm">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-bold">{t('saveTemplateError')}</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Save success toast */}
        {saveSuccess && (
          <div className="bg-emerald-50 text-emerald-900 p-4 rounded-xl border border-emerald-100 flex items-center gap-2.5 text-sm animate-fade-in">
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white flex-shrink-0">
              <Check size={14} strokeWidth={3} />
            </div>
            <p className="font-bold">{t('saveSuccessMsg')}</p>
          </div>
        )}

        {checklists.length === 0 && !loading ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <h3 className="font-bold text-gray-700 text-lg">{t('noChecklistsCreated')}</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              {t('noChecklistsCreatedDesc')}
            </p>
          </div>
        ) : (
          /* Main Layout Split Screen */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Sidebar list of templates */}
            <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">{t('availableChecklists')}</h3>
              
              <div className="space-y-1">
                {checklists.map(c => {
                  const isSelected = selectedId === c.id
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelectChecklist(c.id)}
                      className={`w-full text-left p-3 rounded-xl text-xs md:text-sm font-semibold transition-all flex items-center justify-between ${
                        isSelected 
                          ? 'bg-blue-50 text-blue-800 border-l-4 border-blue-600 font-bold' 
                          : 'hover:bg-slate-50 text-gray-700 border-l-4 border-transparent'
                      }`}
                    >
                      <span className="truncate">{c.nombre}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold ml-1 flex-shrink-0">
                        {c.items.length} {t('itemsCount')}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Template Editor panel */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6 space-y-6">
              
              {/* Template Metadata form */}
              <div className="space-y-4 pb-4 border-b">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('checklistNameLabel')}</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={t('checklistNamePlaceholder')}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t('checklistDescLabel')}</label>
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder={t('checklistDescPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Co-Responsable</label>
                    <select
                      value={editCoResponsableId}
                      onChange={(e) => setEditCoResponsableId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">{t('none') || 'Ninguno'}</option>
                      {staffList.map(member => (
                        <option key={member.id} value={member.id}>
                          {member.first_name} {member.last_name} ({member.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Crear Grupo</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Nombre del nuevo grupo"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={handleAddGroup}
                        className="px-4 py-2 bg-slate-800 text-white font-bold rounded-xl text-sm hover:bg-slate-900 shadow-sm"
                      >
                        {t('add' as any) || 'Agregar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Section Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{t('templateItemsTitle')}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t('templateItemsDesc')}</p>
                </div>
                
                <button
                  onClick={() => openAddItemModal()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-lg border border-blue-200 shadow-sm"
                >
                  <Plus size={14} /> {t('addItem')}
                </button>
              </div>

              {/* Items Table / List */}
              <div className="border border-gray-150 rounded-2xl overflow-hidden shadow-inner">
                <div className="bg-slate-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider p-3 grid grid-cols-12 gap-2 border-b">
                  <span className="col-span-5 md:col-span-6">{t('itemNameHeader')}</span>
                  <span className="col-span-3 md:col-span-2">{t('modelHeader')}</span>
                  <span className="col-span-2 text-center">{t('qtyHeader')}</span>
                  <span className="col-span-2 text-right pr-2">{t('actionsHeader')}</span>
                </div>

                <div className="divide-y divide-gray-100 max-h-[50vh] overflow-y-auto bg-white">
                  {editItems.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 space-y-1">
                      <AlertCircle className="w-8 h-8 text-gray-200 mx-auto" />
                      <p className="text-sm font-medium">{t('checklistEmpty')}</p>
                      <p className="text-xs">{t('checklistEmptyDesc')}</p>
                    </div>
                  ) : (
                    <>
                      {/* Ungrouped Items */}
                      {groupedEditItems.ungrouped.length > 0 && (
                        <div>
                          <div className="bg-slate-100/70 px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            {t('ungroupedItems' as any) || 'Artículos Sin Grupo'}
                          </div>
                          <div className="divide-y divide-gray-100">
                            {groupedEditItems.ungrouped.map((item: ChecklistItem, idx: number) => (
                              <div key={item.id || idx} className="p-3 text-xs md:text-sm grid grid-cols-12 gap-2 items-center hover:bg-slate-50/50">
                                <div className="col-span-5 md:col-span-6 min-w-0">
                                  <p className="font-semibold text-gray-900 truncate">{item.material}</p>
                                  {item.observaciones && (
                                    <p className="text-[10px] text-gray-400 italic truncate">{item.observaciones}</p>
                                  )}
                                </div>
                                <span className="col-span-3 md:col-span-2 font-mono text-xs text-gray-500 truncate">
                                  {item.modelo || '—'}
                                </span>
                                <span className="col-span-2 text-center font-bold text-gray-700 bg-gray-50 border rounded px-1.5 py-0.5 max-w-[50px] mx-auto text-xs">
                                  {item.cantidad !== undefined ? item.cantidad : '—'}
                                </span>
                                <div className="col-span-2 flex items-center justify-end gap-1 pr-1">
                                  <button
                                    onClick={() => openEditItemModal(item)}
                                    className="w-7 h-7 rounded-lg hover:bg-blue-50 text-blue-600 flex items-center justify-center border border-transparent hover:border-blue-100"
                                    title={t('edit')}
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-600 flex items-center justify-center border border-transparent hover:border-red-100"
                                    title={t('delete')}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Grouped Items */}
                      {groupedEditItems.grouped.map(({ group, items }: { group: ChecklistGroup; items: ChecklistItem[] }) => (
                        <div key={group.id} className="border-t border-gray-100 first:border-t-0">
                          <div className="bg-slate-50 px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-700">
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-3 bg-blue-500 rounded-full"></span>
                              {group.nombre} ({items.length})
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openAddItemModal(group.id)}
                                className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-md transition-colors shadow-sm"
                                title={`Agregar artículo al grupo ${group.nombre}`}
                              >
                                <Plus size={10} />
                                Agregar artículo
                              </button>
                              <span className="text-gray-300">|</span>
                              <button
                                onClick={() => {
                                  const name = prompt(t('renameGroupPrompt' as any) || 'Nuevo nombre para el grupo:', group.nombre)
                                  if (name) handleRenameGroup(group.id, name)
                                }}
                                className="text-blue-600 hover:text-blue-800 text-[10px]"
                              >
                                {t('rename' as any) || 'Renombrar'}
                              </button>
                              <span className="text-gray-300">|</span>
                              <button
                                onClick={() => handleDeleteGroup(group.id)}
                                className="text-red-600 hover:text-red-800 text-[10px]"
                              >
                                {t('delete') || 'Eliminar'}
                              </button>
                            </div>
                          </div>
                          {items.length === 0 ? (
                            <div className="p-4 text-center space-y-2">
                              <p className="text-gray-400 text-xs italic">{t('emptyGroup' as any) || 'Este grupo no contiene artículos'}</p>
                              <button
                                onClick={() => openAddItemModal(group.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition-colors"
                              >
                                <Plus size={12} />
                                Agregar primer artículo
                              </button>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {items.map((item: ChecklistItem, idx: number) => (
                                <div key={item.id || idx} className="p-3 text-xs md:text-sm grid grid-cols-12 gap-2 items-center hover:bg-slate-50/50">
                                  <div className="col-span-5 md:col-span-6 min-w-0">
                                    <p className="font-semibold text-gray-900 truncate">{item.material}</p>
                                    {item.observaciones && (
                                      <p className="text-[10px] text-gray-400 italic truncate">{item.observaciones}</p>
                                    )}
                                  </div>
                                  <span className="col-span-3 md:col-span-2 font-mono text-xs text-gray-500 truncate">
                                    {item.modelo || '—'}
                                  </span>
                                  <span className="col-span-2 text-center font-bold text-gray-700 bg-gray-50 border rounded px-1.5 py-0.5 max-w-[50px] mx-auto text-xs">
                                    {item.cantidad !== undefined ? item.cantidad : '—'}
                                  </span>
                                  <div className="col-span-2 flex items-center justify-end gap-1 pr-1">
                                    <button
                                      onClick={() => openEditItemModal(item)}
                                      className="w-7 h-7 rounded-lg hover:bg-blue-50 text-blue-600 flex items-center justify-center border border-transparent hover:border-blue-100"
                                      title={t('edit')}
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-600 flex items-center justify-center border border-transparent hover:border-red-100"
                                      title={t('delete')}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Danger Zone: Delete Checklist */}
              <div className="pt-4 border-t border-gray-100 flex justify-between items-center bg-red-50/40 p-4 rounded-xl border border-red-100/50">
                <div>
                  <h4 className="text-xs md:text-sm font-bold text-red-950">{t('dangerZone')}</h4>
                  <p className="text-[11px] text-red-700">{t('deleteChecklistDesc')}</p>
                </div>
                <button
                  onClick={handleDeleteChecklist}
                  className="flex items-center gap-1 px-4 py-2 border border-red-200 bg-white hover:bg-red-50 text-xs font-bold text-red-600 rounded-lg shadow-sm"
                >
                  <Trash2 size={14} /> {t('deleteChecklistBtn')}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ─── MODAL: NEW CHECKLIST CREATOR ────────────────────────────────────── */}
        {showNewChecklistModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <PlusCircle className="text-blue-600" size={20} />
                  {t('createNewTemplate')}
                </h3>
                <button 
                  onClick={() => setShowNewChecklistModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateChecklist} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('checklistNameLabel')} *</label>
                  <input
                    type="text"
                    required
                    value={newChecklistName}
                    onChange={(e) => setNewChecklistName(e.target.value)}
                    placeholder={t('checklistNamePlaceholder')}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('checklistDescLabel')}</label>
                  <input
                    type="text"
                    value={newChecklistDesc}
                    onChange={(e) => setNewChecklistDesc(e.target.value)}
                    placeholder={t('checklistDescPlaceholder')}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="pt-3 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowNewChecklistModal(false)}
                    className="px-4 py-2 border rounded-xl text-sm text-gray-700 bg-white hover:bg-gray-50 font-semibold"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!newChecklistName.trim()}
                    className="px-5 py-2 rounded-xl text-sm text-white bg-blue-600 hover:bg-blue-700 font-bold disabled:opacity-50 shadow-sm"
                  >
                    {t('createListBtn')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL: ADD/EDIT ITEM DIALOG ─────────────────────────────────────── */}
        {showItemModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <PlusCircle className="text-blue-600" size={20} />
                  {editingItemId ? t('editItemTitle') : t('addItem')}
                </h3>
                <button 
                  onClick={() => setShowItemModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveItem} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('itemNameLabel')} *</label>
                  <input
                    type="text"
                    required
                    value={itemMaterial}
                    onChange={(e) => setItemMaterial(e.target.value)}
                    placeholder={t('itemMaterialPlaceholder')}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('modelHeader')}</label>
                    <input
                      type="text"
                      value={itemModelo}
                      onChange={(e) => setItemModelo(e.target.value)}
                      placeholder={t('itemModelPlaceholder')}
                      className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('recommendedQtyLabel')}</label>
                    <input
                      type="number"
                      min="1"
                      value={itemCantidad}
                      onChange={(e) => setItemCantidad(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('itemNotesLabel')}</label>
                  <input
                    type="text"
                    value={itemObservaciones}
                    onChange={(e) => setItemObservaciones(e.target.value)}
                    placeholder={t('itemNotesPlaceholder')}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Grupo</label>
                  <select
                    value={itemGroupId}
                    onChange={(e) => setItemGroupId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Ninguno</option>
                    {editGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-3 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowItemModal(false)}
                    className="px-4 py-2 border rounded-xl text-sm text-gray-700 bg-white hover:bg-gray-50 font-semibold"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!itemMaterial.trim()}
                    className="px-5 py-2 rounded-xl text-sm text-white bg-blue-600 hover:bg-blue-700 font-bold disabled:opacity-50 shadow-sm"
                  >
                    {editingItemId ? t('saveChangesBtn') : t('addItem')}
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
