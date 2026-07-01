'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Edit, Trash2, Loader2, Search, LayoutGrid, List, X, Phone, Mail, FolderPlus, Tag, User } from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import { DirectorioContacto, DirectorioCategoria } from '@/types/database'
import { useI18n } from '@/contexts/I18nContext'

// Map category names to aesthetic badges
const getCategoryColor = (name: string) => {
  const norm = name.toLowerCase().trim()
  if (norm.includes('doctor')) {
    return {
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      gradient: 'from-blue-500 to-indigo-600',
      avatarBg: 'bg-blue-100 text-blue-700'
    }
  }
  if (norm.includes('cerdo')) {
    return {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      gradient: 'from-emerald-400 to-teal-600',
      avatarBg: 'bg-emerald-100 text-emerald-700'
    }
  }
  if (norm.includes('rayo')) {
    return {
      bg: 'bg-purple-50 text-purple-700 border-purple-200',
      gradient: 'from-purple-500 to-indigo-700',
      avatarBg: 'bg-purple-100 text-purple-700'
    }
  }
  // Generic / Default
  return {
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    gradient: 'from-amber-400 to-orange-500',
    avatarBg: 'bg-amber-100 text-amber-700'
  }
}

export default function DirectorioPage() {
  const { t } = useI18n()
  
  // Data State
  const [contacts, setContacts] = useState<DirectorioContacto[]>([])
  const [categories, setCategories] = useState<DirectorioCategoria[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Filtering & View State
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
  
  // Modals & Forms State
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  
  const [contactForm, setContactForm] = useState({
    name: '',
    category_id: '',
    phone: '',
    email: '',
    notes: ''
  })
  
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [contactError, setContactError] = useState('')

  // Edit Category State
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<DirectorioCategoria | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editCategoryError, setEditCategoryError] = useState('')

  // Fetch initial data
  const fetchData = async () => {
    try {
      setIsLoading(true)
      const [catsRes, contsRes] = await Promise.all([
        fetch('/api/directorio/categorias'),
        fetch('/api/directorio/contactos')
      ])
      
      if (catsRes.ok) {
        const catsData = await catsRes.json()
        setCategories(catsData.data || [])
      }
      if (contsRes.ok) {
        const contsData = await contsRes.json()
        setContacts(contsData.data || [])
      }
    } catch (error) {
      console.error('Error fetching directory data:', error)
    } finally {
      setIsLoading(false)
    }
  };

  useEffect(() => {
    fetchData()
  }, [])

  // Helper counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    contacts.forEach(c => {
      counts[c.category_id] = (counts[c.category_id] || 0) + 1
    })
    return counts
  }, [contacts])

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const matchCategory = selectedCategoryId === 'all' || c.category_id === selectedCategoryId
      
      const normQuery = searchQuery.toLowerCase().trim()
      const matchSearch = !normQuery || 
        c.name.toLowerCase().includes(normQuery) ||
        (c.phone && c.phone.toLowerCase().includes(normQuery)) ||
        (c.email && c.email.toLowerCase().includes(normQuery)) ||
        (c.notes && c.notes.toLowerCase().includes(normQuery)) ||
        (c.category?.name && c.category.name.toLowerCase().includes(normQuery))
        
      return matchCategory && matchSearch
    })
  }, [contacts, selectedCategoryId, searchQuery])

  // Contact actions
  const openNewContact = () => {
    setContactForm({
      name: '',
      category_id: categories[0]?.id || '',
      phone: '',
      email: '',
      notes: ''
    })
    setIsEditing(false)
    setSelectedContactId(null)
    setContactError('')
    setIsContactModalOpen(true)
  }

  const openEditContact = (contact: DirectorioContacto) => {
    setContactForm({
      name: contact.name,
      category_id: contact.category_id,
      phone: contact.phone || '',
      email: contact.email || '',
      notes: contact.notes || ''
    })
    setIsEditing(true)
    setSelectedContactId(contact.id)
    setContactError('')
    setIsContactModalOpen(true)
  }

  const handleDeleteContact = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este contacto?')) return
    try {
      const res = await fetch(`/api/directorio/contactos/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setContacts(prev => prev.filter(c => c.id !== id))
      } else {
        alert('Error al eliminar el contacto')
      }
    } catch (error) {
      console.error(error)
      alert('Error de conexión')
    }
  }

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contactForm.name.trim()) {
      setContactError('El nombre es requerido')
      return
    }
    if (!contactForm.category_id) {
      setContactError('La categoría es requerida')
      return
    }

    setIsSaving(true)
    setContactError('')
    try {
      const url = isEditing ? `/api/directorio/contactos/${selectedContactId}` : '/api/directorio/contactos'
      const method = isEditing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      })

      if (res.ok) {
        const saved = await res.json()
        if (isEditing) {
          setContacts(prev => prev.map(c => c.id === selectedContactId ? saved.data : c))
        } else {
          setContacts(prev => [saved.data, ...prev])
        }
        setIsContactModalOpen(false)
      } else {
        const errData = await res.json()
        setContactError(errData.error || 'Error al guardar el contacto')
      }
    } catch (error) {
      console.error(error)
      setContactError('Error al conectar con el servidor')
    } finally {
      setIsSaving(false)
    }
  }

  // Category actions
  const openNewCategory = () => {
    setNewCategoryName('')
    setCategoryError('')
    setIsCategoryModalOpen(true)
  }

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryName.trim()) {
      setCategoryError('El nombre es requerido')
      return
    }

    setIsSaving(true)
    setCategoryError('')
    try {
      const res = await fetch('/api/directorio/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() })
      })

      if (res.ok) {
        const saved = await res.json()
        setCategories(prev => [...prev, saved.data].sort((a, b) => a.name.localeCompare(b.name)))
        setIsCategoryModalOpen(false)
      } else {
        const errData = await res.json()
        setCategoryError(errData.error || 'Error al guardar la categoría')
      }
    } catch (error) {
      console.error(error)
      setCategoryError('Error al conectar con el servidor')
    } finally {
      setIsSaving(false)
    }
  }

  const openEditCategory = (cat: DirectorioCategoria) => {
    setSelectedCategory(cat)
    setEditCategoryName(cat.name)
    setEditCategoryError('')
    setIsEditCategoryModalOpen(true)
  }

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCategory) return
    if (!editCategoryName.trim()) {
      setEditCategoryError('El nombre es requerido')
      return
    }

    setIsSaving(true)
    setEditCategoryError('')
    try {
      const res = await fetch(`/api/directorio/categorias/${selectedCategory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editCategoryName.trim() })
      })

      if (res.ok) {
        const updatedName = editCategoryName.trim()
        setCategories(prev => 
          prev.map(c => c.id === selectedCategory.id ? { ...c, name: updatedName } : c)
              .sort((a, b) => a.name.localeCompare(b.name))
        )
        setContacts(prev => 
          prev.map(c => c.category_id === selectedCategory.id ? { ...c, category: { ...c.category!, name: updatedName } } : c)
        )
        setIsEditCategoryModalOpen(false)
      } else {
        const errData = await res.json()
        setEditCategoryError(errData.error || 'Error al actualizar la categoría')
      }
    } catch (error) {
      console.error(error)
      setEditCategoryError('Error al conectar con el servidor')
    } finally {
      setIsSaving(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(n => n)
      .slice(0, 2)
      .map(n => n[0].toUpperCase())
      .join('')
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Banner/Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0763a9] to-[#043d6c] p-6 lg:p-8 text-white shadow-lg">
          <div className="relative z-10">
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
              {t('directorio') || 'Directorio'}
            </h1>
            <p className="mt-2 text-sm lg:text-base text-blue-100 max-w-xl">
              Administra y organiza tus contactos en categorías personalizadas. Busca, llama, y envía correos rápidamente.
            </p>
          </div>
          
          {/* Subtle decor shape */}
          <div className="absolute right-0 top-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
          <div className="absolute right-12 bottom-0 w-32 h-32 rounded-full bg-indigo-500/20 blur-xl pointer-events-none" />
        </div>

        {/* Action Controls & Layout */}
        <div className="flex flex-col md:flex-row gap-6">
          
          {/* Left Sidebar - Categories Panel */}
          <div className="w-full md:w-64 shrink-0 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 text-sm tracking-wide uppercase flex items-center gap-1.5">
                  <Tag size={16} className="text-[#0763a9]" />
                  Categorías
                </h3>
                <button
                  onClick={openNewCategory}
                  className="p-1 hover:bg-gray-100 text-gray-500 hover:text-[#0763a9] rounded-lg transition-colors"
                  title="Nueva Categoría"
                >
                  <FolderPlus size={18} />
                </button>
              </div>

              <div className="space-y-1.5">
                {/* Todos Button */}
                <button
                  onClick={() => setSelectedCategoryId('all')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-between ${
                    selectedCategoryId === 'all'
                      ? 'bg-blue-50 text-[#0763a9]'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span>Todos los contactos</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                    selectedCategoryId === 'all'
                      ? 'bg-blue-100 text-[#0763a9]'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {contacts.length}
                  </span>
                </button>

                {/* Categories Loop */}
                {categories.map(cat => {
                  const isActive = selectedCategoryId === cat.id
                  const count = categoryCounts[cat.id] || 0
                  return (
                    <div
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center justify-between cursor-pointer group/cat ${
                        isActive
                          ? 'bg-blue-50 text-[#0763a9]'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate" title={cat.name}>{cat.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditCategory(cat)
                          }}
                          className="p-0.5 text-gray-400 hover:text-[#0763a9] hover:bg-gray-200/50 rounded opacity-0 group-hover/cat:opacity-100 transition-opacity shrink-0"
                          title="Editar nombre"
                        >
                          <Edit size={12} />
                        </button>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 ${
                        isActive
                          ? 'bg-blue-100 text-[#0763a9]'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {count}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Main Panel - Search, Controls, List */}
          <div className="flex-1 space-y-4">
            
            {/* Top Toolbar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
              
              {/* Search input */}
              <div className="relative w-full sm:w-80">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar contacto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0763a9]/20 focus:border-[#0763a9] transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-full"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Add & View Toggle Controls */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                
                {/* View togglers */}
                <div className="flex items-center bg-gray-100 p-0.5 rounded-lg">
                  <button
                    onClick={() => setViewMode('card')}
                    className={`p-1.5 rounded-md transition-all ${
                      viewMode === 'card' ? 'bg-white shadow-sm text-[#0763a9]' : 'text-gray-400 hover:text-gray-600'
                    }`}
                    title="Vista Cuadrícula"
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-md transition-all ${
                      viewMode === 'table' ? 'bg-white shadow-sm text-[#0763a9]' : 'text-gray-400 hover:text-gray-600'
                    }`}
                    title="Vista Tabla"
                  >
                    <List size={16} />
                  </button>
                </div>

                {/* Add button */}
                <button
                  onClick={openNewContact}
                  className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm"
                >
                  <Plus size={16} />
                  Nuevo Contacto
                </button>
              </div>
            </div>

            {/* List / Grid Display */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
                <Loader2 size={36} className="text-[#0763a9] animate-spin" />
                <span className="mt-3 text-sm text-gray-500">Cargando contactos...</span>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="inline-flex items-center justify-center p-3 rounded-full bg-blue-50 text-blue-500 mb-3">
                  <User size={30} />
                </div>
                <h4 className="font-bold text-gray-800 text-lg">No se encontraron contactos</h4>
                <p className="text-gray-500 text-sm mt-1 max-w-xs mx-auto">
                  Prueba cambiando el filtro de búsqueda, seleccionando otra categoría o crea un nuevo contacto.
                </p>
                <button
                  onClick={openNewContact}
                  className="mt-4 px-4 py-2 border border-[#0763a9] text-[#0763a9] hover:bg-blue-50 text-sm font-semibold rounded-lg transition-colors"
                >
                  Agregar Contacto
                </button>
              </div>
            ) : viewMode === 'card' ? (
              
              /* GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContacts.map(contact => {
                  const colors = getCategoryColor(contact.category?.name || '')
                  return (
                    <div
                      key={contact.id}
                      className="bg-white rounded-xl shadow-sm border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200 p-4 flex flex-col justify-between group relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        {/* Header card info */}
                        <div className="flex items-start gap-3">
                          
                          {/* Initials Avatar */}
                          <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-xs uppercase bg-gradient-to-br ${colors.gradient} text-white shadow-inner`}>
                            {getInitials(contact.name)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-gray-900 text-sm truncate group-hover:text-[#0763a9] transition-colors" title={contact.name}>
                              {contact.name}
                            </h4>
                            <span className={`inline-block border px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase mt-1 tracking-wide ${colors.bg}`}>
                              {contact.category?.name}
                            </span>
                          </div>
                        </div>

                        {/* Details content */}
                        <div className="space-y-1.5 text-xs text-gray-600 pt-1">
                          {contact.phone && (
                            <a
                              href={`tel:${contact.phone}`}
                              className="flex items-center gap-2 hover:text-[#0763a9] transition-colors inline-block"
                            >
                              <Phone size={13} className="text-gray-400" />
                              <span>{contact.phone}</span>
                            </a>
                          )}
                          {contact.email && (
                            <a
                              href={`mailto:${contact.email}`}
                              className="flex items-center gap-2 hover:text-[#0763a9] transition-colors truncate block"
                              title={contact.email}
                            >
                              <Mail size={13} className="text-gray-400" />
                              <span className="truncate">{contact.email}</span>
                            </a>
                          )}
                          {contact.notes && (
                            <p className="text-[11px] text-gray-400 italic line-clamp-2 pt-1 border-t border-gray-50 mt-1">
                              {contact.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Card Operations */}
                      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-50 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditContact(contact)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-all"
                          title="Editar"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-all"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              
              /* TABLE VIEW */
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-gray-600">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                        <th className="px-6 py-3">Nombre</th>
                        <th className="px-6 py-3">Categoría</th>
                        <th className="px-6 py-3">Teléfono</th>
                        <th className="px-6 py-3">Correo</th>
                        <th className="px-6 py-3">Notas</th>
                        <th className="px-6 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredContacts.map(contact => {
                        const colors = getCategoryColor(contact.category?.name || '')
                        return (
                          <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-semibold text-gray-900">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] uppercase bg-gradient-to-br ${colors.gradient} text-white shadow-inner`}>
                                  {getInitials(contact.name)}
                                </div>
                                <span>{contact.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-block border px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${colors.bg}`}>
                                {contact.category?.name}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-mono">
                              {contact.phone ? (
                                <a href={`tel:${contact.phone}`} className="hover:text-[#0763a9] transition-colors">
                                  {contact.phone}
                                </a>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs">
                              {contact.email ? (
                                <a href={`mailto:${contact.email}`} className="hover:text-[#0763a9] transition-colors">
                                  {contact.email}
                                </a>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs max-w-xs truncate" title={contact.notes || ''}>
                              {contact.notes || <span className="text-gray-400">-</span>}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => openEditContact(contact)}
                                  className="p-1 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded transition-colors"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteContact(contact.id)}
                                  className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Creation Modal */}
      <Modal
        open={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Crear Nueva Categoría"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Nombre de la categoría *
            </label>
            <input
              type="text"
              placeholder="Ej. Proveedores, Logística, etc."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0763a9]/20 focus:border-[#0763a9] transition-all"
              required
            />
            {categoryError && (
              <p className="text-xs text-red-500 mt-1 font-semibold">{categoryError}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary px-4 py-2 text-sm font-semibold rounded-lg shadow-sm flex items-center gap-1.5"
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              Guardar
            </button>
          </div>
        </form>
      </Modal>

      {/* Category Modification Modal */}
      <Modal
        open={isEditCategoryModalOpen}
        onClose={() => setIsEditCategoryModalOpen(false)}
        title="Editar Categoría"
      >
        <form onSubmit={handleUpdateCategory} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Nombre de la categoría *
            </label>
            <input
              type="text"
              placeholder="Ej. Proveedores, Logística, etc."
              value={editCategoryName}
              onChange={(e) => setEditCategoryName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0763a9]/20 focus:border-[#0763a9] transition-all"
              required
            />
            {editCategoryError && (
              <p className="text-xs text-red-500 mt-1 font-semibold">{editCategoryError}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditCategoryModalOpen(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary px-4 py-2 text-sm font-semibold rounded-lg shadow-sm flex items-center gap-1.5"
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              Guardar
            </button>
          </div>
        </form>
      </Modal>

      {/* Contact Creation / Modification Modal */}
      <Modal
        open={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        title={isEditing ? 'Editar Contacto' : 'Nuevo Contacto'}
      >
        <form onSubmit={handleSaveContact} className="space-y-4">
          {contactError && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-xs font-semibold">
              {contactError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Nombre Completo *
            </label>
            <input
              type="text"
              placeholder="Ej. Ing. Juan Pérez"
              value={contactForm.name}
              onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0763a9]/20 focus:border-[#0763a9] transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Categoría *
            </label>
            <select
              value={contactForm.category_id}
              onChange={(e) => setContactForm({ ...contactForm, category_id: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0763a9]/20 focus:border-[#0763a9] transition-all"
              required
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Teléfono / WhatsApp
              </label>
              <input
                type="tel"
                placeholder="Ej. +52 81 1234 5678"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0763a9]/20 focus:border-[#0763a9] transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                placeholder="Ej. juan.perez@ejemplo.com"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0763a9]/20 focus:border-[#0763a9] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Notas / Observaciones
            </label>
            <textarea
              placeholder="Detalles sobre el contacto..."
              value={contactForm.notes}
              onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0763a9]/20 focus:border-[#0763a9] transition-all"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsContactModalOpen(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary px-4 py-2 text-sm font-semibold rounded-lg shadow-sm flex items-center gap-1.5"
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              Guardar
            </button>
          </div>
        </form>
      </Modal>

    </AppShell>
  )
}
