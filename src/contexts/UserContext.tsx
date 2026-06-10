'use client'
import React, { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserProfile, Role } from '@/types/database'
import { hasPermission, getCombinedPermissions, Section, PermissionAction, UserPermissions } from '@/lib/permissions'

interface UserContextType {
  profile: UserProfile | null
  loading: boolean
  hasPermission: (section: Section, action: PermissionAction) => boolean
  refreshProfile: () => Promise<void>
}

const UserContext = createContext<UserContextType>({
  profile: null,
  loading: true,
  hasPermission: () => false,
  refreshProfile: async () => {},
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const refreshProfile = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*, roles(*)')
          .eq('id', user.id)
          .single()
        
        if (!error && data) {
          setProfile({ ...data, email: data.email ?? user.email ?? '' })
        }
      } else {
        setProfile(null)
      }
    } catch (err) {
      console.error('Error fetching user profile:', err)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshProfile()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refreshProfile()
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkPermission = (section: Section, action: PermissionAction): boolean => {
    if (!profile) return false
    
    // Superadmin bypass
    if (profile.role === 'superadmin') return true
    const adminEmails = [
      'eduardo.delacruz@arthromed.com.mx',
      'eduardo@arthromed.com.mx',
      'admin@arthromed.com.mx'
    ]
    if (adminEmails.includes(profile.email)) return true

    const combined = getCombinedPermissions(
      profile.roles?.permissions as UserPermissions,
      profile.permission_overrides as UserPermissions
    )

    return hasPermission(combined, section, action)
  }

  return (
    <UserContext.Provider value={{ 
      profile, 
      loading, 
      hasPermission: checkPermission,
      refreshProfile 
    }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
