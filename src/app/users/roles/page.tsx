'use client'
import { useEffect, useState } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { Role } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { 
  Shield, ShieldCheck, Plus, Trash2, Edit2, 
  Search, X, Loader2, AlertCircle, Save, CheckSquare, Square
} from 'lucide-react'
import { SECTIONS, PermissionAction } from '@/lib/permissions'
import Modal from '@/components/Modal'

const CARD = { background: '#ffffff', border: '1px solid #d4e0ec' }
const ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete']

export default function RolesPage() {
  const { t } = useI18n()
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingRole, setEditingRole] = useState<Partial<Role> | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    fetchRoles()
  }, [])

  async function fetchRoles() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/roles')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to fetch roles')
      setRoles(json.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRole = async () => {
    if (!editingRole?.name) return
    setIsSaving(true)
    try {
      if (editingRole.id) {
        const res = await fetch(`/api/roles/${editingRole.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editingRole.name,
            description: editingRole.description,
            permissions: editingRole.permissions
          })
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to update role')
      } else {
        const res = await fetch('/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editingRole.name,
            description: editingRole.description,
            permissions: editingRole.permissions || {}
          })
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to create role')
      }
      setEditingRole(null)
      fetchRoles()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteRole = async (id: string) => {
    if (!confirm(t('confirm'))) return
    try {
      const res = await fetch(`/api/roles/${id}`, {
        method: 'DELETE'
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete role')
      setRoles(roles.filter(r => r.id !== id))
    } catch (err: any) {
      alert(err.message)
    }
  }

  const togglePermission = (section: string, action: PermissionAction) => {
    if (!editingRole) return
    const currentPerms = { ...(editingRole.permissions || {}) }
    const sectionPerms = [...(currentPerms[section] || [])]
    
    if (sectionPerms.includes(action)) {
      currentPerms[section] = sectionPerms.filter(a => a !== action)
    } else {
      currentPerms[section] = [...sectionPerms, action]
    }
    
    setEditingRole({ ...editingRole, permissions: currentPerms })
  }

  const filteredRoles = roles.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#37383a' }}>{t('manageRoles') || 'Gestionar Roles'}</h1>
            <p className="text-sm" style={{ color: '#5a5b5d' }}>{roles.length} {t('rolesConfigured')}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('search')}
                className="erp-input pl-10"
              />
            </div>
            <button 
              onClick={() => setEditingRole({ name: '', description: '', permissions: {} })}
              className="btn-primary whitespace-nowrap"
            >
              <Plus size={18} />
              {t('newRole')}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-700">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden bg-white shadow-sm" style={CARD}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="w-8 h-8 text-[#0763a9] animate-spin" />
              <p className="text-sm text-gray-500">{t('loading')}</p>
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <Shield size={48} className="mb-4 opacity-20" />
              <p>{t('noResults')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('roleName')}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('roleDescription')}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('permissions')}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredRoles.map((role) => (
                    <tr key={role.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-semibold text-gray-800">
                          <Shield size={16} className="text-[#0763a9]" />
                          {role.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-500 truncate max-w-xs">{role.description || '—'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-gray-400">
                          {Object.keys(role.permissions || {}).length} {t('sectionsConfigured')}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingRole(role)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteRole(role.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Role Modal */}
        {editingRole && (
          <Modal 
            open={!!editingRole} 
            onClose={() => setEditingRole(null)}
            title={editingRole.id ? t('editRole') : t('newRole')}
          >
            <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">{t('roleName')}</label>
                    <input
                      type="text"
                      value={editingRole.name}
                      onChange={e => setEditingRole({ ...editingRole, name: e.target.value })}
                      className="erp-input w-full"
                      placeholder="Ej: Supervisor de Ventas"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">{t('roleDescription')}</label>
                    <textarea
                      value={editingRole.description || ''}
                      onChange={e => setEditingRole({ ...editingRole, description: e.target.value })}
                      className="erp-input w-full h-20 py-2"
                      placeholder="Descripción de las responsabilidades..."
                    />
                  </div>
                </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-[#0763a9]" />
                  {t('configurePermissions')}
                </label>
                
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">{t('section' as any) || 'Sección'}</th>
                        {ACTIONS.map(action => (
                          <th key={action} className="px-4 py-2 text-center font-semibold text-gray-600 capitalize">
                            {t(action as any)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {SECTIONS.map(section => (
                        <tr key={section} className="hover:bg-blue-50/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-700 capitalize">
                            {t(section as any)}
                          </td>
                          {ACTIONS.map(action => {
                            const isChecked = (editingRole.permissions?.[section] || []).includes(action)
                            return (
                              <td key={action} className="px-4 py-3 text-center">
                                <button
                                  onClick={() => togglePermission(section, action)}
                                  className={`p-1.5 rounded-lg transition-colors ${isChecked ? 'text-blue-600 bg-blue-50' : 'text-gray-300 hover:bg-gray-100'}`}
                                >
                                  {isChecked ? <CheckSquare size={20} /> : <Square size={20} />}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={() => setEditingRole(null)}
                    className="btn-ghost"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleSaveRole}
                    disabled={isSaving || !editingRole.name}
                    className="btn-primary min-w-[120px]"
                  >
                    {isSaving ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <Save size={18} />
                        {t('saveRole')}
                      </>
                    )}
                  </button>
                </div>
            </div>
          </Modal>
        )}
      </div>
    </AppShell>
  )
}
