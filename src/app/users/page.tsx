'use client'
import { useEffect, useState } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { UserProfile, Role } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Shield, ShieldCheck, User, Trash2,
  Search, X, Loader2, AlertCircle, Settings2,
  CheckSquare, Square, MessageCircle, Edit2, Check
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import Modal from '@/components/Modal'
import { SECTIONS, ACTIONS } from '@/lib/permissions'
import Link from 'next/link'

const CARD = { background: '#ffffff', border: '1px solid #d4e0ec' }

export default function UsersPage() {
  const { t } = useI18n()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingOverrides, setEditingOverrides] = useState<UserProfile | null>(null)
  const [editingWhatsapp, setEditingWhatsapp] = useState<string | null>(null)
  const [whatsappInput, setWhatsappInput] = useState('')
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null)
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', position: '' })

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()

      const [usersRes, rolesRes] = await Promise.all([
        supabase.from('user_profiles').select('*, roles(*)').order('created_at', { ascending: false }),
        supabase.from('roles').select('*').order('name', { ascending: true })
      ])

      if (usersRes.error) throw usersRes.error
      if (rolesRes.error) throw rolesRes.error

      setUsers(usersRes.data || [])
      setRoles(rolesRes.data || [])

      if (authUser) {
        setCurrentUser(usersRes.data?.find((u: UserProfile) => u.id === authUser.id) || null)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateRole = async (userId: string, roleId: string) => {
    try {
      const selectedRole = roles.find(r => r.id === roleId)
      const { error } = await supabase
        .from('user_profiles')
        .update({
          role_id: roleId,
          // We keep the old 'role' string for legacy support if needed, 
          // or we can map it based on the role name.
          role: selectedRole?.name.toLowerCase().includes('admin') ? 'admin' : 'user'
        })
        .eq('id', userId)

      if (error) throw error
      setUsers(users.map((u: UserProfile) => u.id === userId ? { ...u, role_id: roleId, roles: selectedRole } : u))
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleUpdateOverrides = async () => {
    if (!editingOverrides) return
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ permission_overrides: editingOverrides.permission_overrides })
        .eq('id', editingOverrides.id)

      if (error) throw error
      setUsers(users.map((u: UserProfile) => u.id === editingOverrides.id ? editingOverrides : u))
      setEditingOverrides(null)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const toggleOverride = (section: string, action: string) => {
    if (!editingOverrides) return
    const currentOverrides = { ...(editingOverrides.permission_overrides || {}) }
    const sectionOverrides = [...(currentOverrides[section] || [])]

    if (sectionOverrides.includes(action)) {
      currentOverrides[section] = sectionOverrides.filter(a => a !== action)
    } else {
      currentOverrides[section] = [...sectionOverrides, action]
    }

    setEditingOverrides({ ...editingOverrides, permission_overrides: currentOverrides })
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm(t('confirm'))) return
    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId)

      if (error) throw error
      setUsers(users.filter((u: UserProfile) => u.id !== userId))
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleUpdateWhatsapp = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ whatsapp: whatsappInput })
        .eq('id', userId)

      if (error) throw error
      setUsers(users.map((u: UserProfile) => u.id === userId ? { ...u, whatsapp: whatsappInput } : u))
      setEditingWhatsapp(null)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleUpdateProfile = async () => {
    if (!editingProfile) return
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          first_name: profileForm.first_name || null,
          last_name: profileForm.last_name || null,
          position: profileForm.position || null
        })
        .eq('id', editingProfile.id)

      if (error) throw error
      setUsers(users.map((u: UserProfile) => u.id === editingProfile.id ? { 
        ...u, 
        first_name: profileForm.first_name || null, 
        last_name: profileForm.last_name || null, 
        position: profileForm.position || null 
      } : u))
      setEditingProfile(null)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const filteredUsers = users.filter((u: UserProfile) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const isSuperAdmin = currentUser?.role === 'superadmin'

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#37383a' }}>{t('manageUsers')}</h1>
            <p className="text-sm" style={{ color: '#5a5b5d' }}>{users.length} {t('usersRegistered')}</p>
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
            {isSuperAdmin && (
              <Link href="/users/roles" className="btn-ghost whitespace-nowrap">
                <Shield size={18} />
                {t('manageRoles')}
              </Link>
            )}
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
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <Users size={48} className="mb-4 opacity-20" />
              <p>{t('noResults')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('user')}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">WhatsApp</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('role')}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('registered')}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-[#0763a9] font-bold text-sm">
                            {user.first_name ? user.first_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {user.first_name || user.last_name 
                                ? `${user.first_name || ''} ${user.last_name || ''}`.trim() 
                                : user.email}
                            </p>
                            {(user.first_name || user.last_name) && (
                              <p className="text-[10px] text-gray-400 font-mono">{user.email}</p>
                            )}
                            {user.position && (
                              <p className="text-[10px] font-medium text-blue-600 mt-0.5">{user.position}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {editingWhatsapp === user.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={whatsappInput}
                              onChange={(e) => setWhatsappInput(e.target.value)}
                              placeholder="+52..."
                              className="text-xs border rounded-lg px-2 py-1 bg-white hover:border-blue-300 transition-colors outline-none max-w-[150px]"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateWhatsapp(user.id)
                                if (e.key === 'Escape') setEditingWhatsapp(null)
                              }}
                            />
                            <button onClick={() => handleUpdateWhatsapp(user.id)} className="p-1 rounded bg-green-50 text-green-600 hover:bg-green-100"><Check size={14}/></button>
                            <button onClick={() => setEditingWhatsapp(null)} className="p-1 rounded bg-gray-50 text-gray-600 hover:bg-gray-100"><X size={14}/></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/wa">
                            {user.whatsapp ? (
                              <span className="text-sm font-medium font-mono text-gray-700">{user.whatsapp}</span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">No configurado</span>
                            )}
                            {(isSuperAdmin || user.id === currentUser?.id) && (
                              <button 
                                onClick={() => {
                                  setWhatsappInput(user.whatsapp || '')
                                  setEditingWhatsapp(user.id)
                                }} 
                                className="p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover/wa:opacity-100 transition-all"
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isSuperAdmin && user.id !== currentUser?.id ? (
                          <select
                            value={user.role_id || ''}
                            onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                            className="text-xs border rounded-lg px-2 py-1 bg-white hover:border-blue-300 transition-colors outline-none max-w-[150px]"
                          >
                            <option value="">{t('noRole')}</option>
                            {roles.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-blue-50 border-blue-200 text-blue-700 w-fit">
                            <Shield size={14} />
                            {user.roles?.name || user.role || t('user')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(user.created_at), { addSuffix: true, locale: es })}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 group/actions">
                          {(isSuperAdmin || user.id === currentUser?.id) && (
                            <button
                              onClick={() => {
                                setEditingProfile(user)
                                setProfileForm({
                                  first_name: user.first_name || '',
                                  last_name: user.last_name || '',
                                  position: user.position || ''
                                })
                              }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all opacity-0 group-hover:opacity-100"
                              title={t('edit')}
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          {isSuperAdmin && user.id !== currentUser?.id && (
                            <>
                              <button
                                onClick={() => setEditingOverrides(user)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-all opacity-0 group-hover:opacity-100"
                                title="Permisos Especiales"
                              >
                                <Settings2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                title={t('delete')}
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                          {user.id === currentUser?.id && (
                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter bg-blue-50 px-1.5 py-0.5 rounded ml-2">{t('you')}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Permission Overrides Modal */}
        {editingOverrides && (
          <Modal
            open={!!editingOverrides}
            onClose={() => setEditingOverrides(null)}
            title={`${t('specialPermissions')}: ${editingOverrides.email}`}
          >
            <div className="space-y-6">
              <p className="text-sm text-gray-500">
                {t('overridesDesc')} ({editingOverrides.roles?.name || t('none')}).
              </p>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600">{t('section')}</th>
                      {['view', 'create', 'edit', 'delete'].map(action => (
                        <th key={action} className="px-4 py-2 text-center font-semibold text-gray-600 capitalize">{t(action as any)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {SECTIONS.map(section => (
                      <tr key={section}>
                        <td className="px-4 py-3 font-medium text-gray-700 capitalize">{t(section as any)}</td>
                        {['view', 'create', 'edit', 'delete'].map(action => {
                          const isChecked = (editingOverrides.permission_overrides?.[section] || []).includes(action)
                          return (
                            <td key={action} className="px-4 py-3 text-center">
                              <button
                                onClick={() => toggleOverride(section, action)}
                                className={`p-1.5 rounded-lg transition-colors ${isChecked ? 'text-amber-600 bg-amber-50' : 'text-gray-300 hover:bg-gray-100'}`}
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

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button onClick={() => setEditingOverrides(null)} className="btn-ghost">{t('cancel')}</button>
                <button onClick={handleUpdateOverrides} className="btn-primary">{t('saveChanges')}</button>
              </div>
            </div>
          </Modal>
        )}
        
        {/* Profile Edit Modal */}
        {editingProfile && (
          <Modal
            open={!!editingProfile}
            onClose={() => setEditingProfile(null)}
            title={t('editProfile') || 'Editar Perfil'}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('firstName') || 'Nombre(s)'}</label>
                <input
                  type="text"
                  value={profileForm.first_name}
                  onChange={e => setProfileForm({ ...profileForm, first_name: e.target.value })}
                  className="erp-input w-full"
                  placeholder="Ej. Juan"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('lastName') || 'Apellidos'}</label>
                <input
                  type="text"
                  value={profileForm.last_name}
                  onChange={e => setProfileForm({ ...profileForm, last_name: e.target.value })}
                  className="erp-input w-full"
                  placeholder="Ej. Pérez"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('position') || 'Puesto en la Empresa'}</label>
                <input
                  type="text"
                  value={profileForm.position}
                  onChange={e => setProfileForm({ ...profileForm, position: e.target.value })}
                  className="erp-input w-full"
                  placeholder="Ej. Gerente de Ventas"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <button onClick={() => setEditingProfile(null)} className="btn-ghost">{t('cancel')}</button>
                <button onClick={handleUpdateProfile} className="btn-primary">{t('saveChanges')}</button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppShell>
  )
}