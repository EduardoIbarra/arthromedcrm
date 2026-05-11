'use client'
import { useEffect, useState } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { UserProfile } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { 
  Users, Shield, ShieldCheck, User, Trash2, 
  Search, X, Loader2, AlertCircle
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const CARD = { background: '#ffffff', border: '1px solid #d4e0ec' }

export default function UsersPage() {
  const { t } = useI18n()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    setError(null)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])

      if (authUser) {
        setCurrentUser(data?.find(u => u.id === authUser.id) || null)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole as any } : u))
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm(t('confirm'))) return
    try {
      // Note: This only deletes the profile. Deleting the actual auth user 
      // usually requires administrative privileges or a service role.
      // For this implementation, we'll assume the user has the necessary setup or 
      // we'll at least remove their profile so they can't access the ERP.
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId)

      if (error) throw error
      setUsers(users.filter(u => u.id !== userId))
    } catch (err: any) {
      alert(err.message)
    }
  }

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'superadmin': return <ShieldCheck size={16} className="text-amber-600" />
      case 'admin': return <Shield size={16} className="text-blue-600" />
      default: return <User size={16} className="text-gray-500" />
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'superadmin': return t('superadmin')
      case 'admin': return t('admin')
      default: return t('user')
    }
  }

  const isSuperAdmin = currentUser?.role === 'superadmin'

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#37383a' }}>{t('manageUsers')}</h1>
            <p className="text-sm" style={{ color: '#5a5b5d' }}>{users.length} usuarios registrados</p>
          </div>
          
          <div className="relative w-full sm:w-72">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('search')}
              className="erp-input pl-10 pr-10"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={16} />
              </button>
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
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Registrado</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-[#0763a9] font-bold text-sm">
                            {user.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{user.email}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{user.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border
                            ${user.role === 'superadmin' ? 'bg-amber-50 border-amber-200 text-amber-700' : 
                              user.role === 'admin' ? 'bg-blue-50 border-blue-200 text-blue-700' : 
                              'bg-gray-50 border-gray-200 text-gray-600'}`}
                          >
                            {getRoleIcon(user.role)}
                            {getRoleLabel(user.role)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(user.created_at), { addSuffix: true, locale: es })}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isSuperAdmin && user.id !== currentUser?.id && (
                            <>
                              <select
                                value={user.role}
                                onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                                className="text-xs border rounded-lg px-2 py-1 bg-white hover:border-blue-300 transition-colors outline-none"
                              >
                                <option value="user">{t('user')}</option>
                                <option value="admin">{t('admin')}</option>
                                <option value="superadmin">{t('superadmin')}</option>
                              </select>
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
                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter bg-blue-50 px-1.5 py-0.5 rounded">Tú</span>
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
      </div>
    </AppShell>
  )
}
