'use client'
import React from 'react'
import { useUser } from '@/contexts/UserContext'
import { Section, PermissionAction } from '@/lib/permissions'

interface PermissionGuardProps {
  section: Section
  action: PermissionAction
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function PermissionGuard({ 
  section, 
  action, 
  children, 
  fallback = null 
}: PermissionGuardProps) {
  const { hasPermission, loading } = useUser()

  if (loading) return null

  if (hasPermission(section, action)) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
