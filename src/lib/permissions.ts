export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | '*'

export const SECTIONS = [
  'dashboard',
  'clients',
  'products',
  'hospitals',
  'congresos',
  'gastos',
  'settings',
  'users',
  'roles'
] as const

export const ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete']

export type Section = typeof SECTIONS[number] | '*'

export interface UserPermissions {
  [section: string]: PermissionAction[]
}

/**
 * Checks if a user has a specific permission for a section.
 * @param permissions The permissions object from the role or user profile
 * @param section The section to check (e.g., 'clients')
 * @param action The action to check (e.g., 'view')
 * @returns boolean
 */
export function hasPermission(
  permissions: UserPermissions | null | undefined,
  section: Section,
  action: PermissionAction
): boolean {
  if (!permissions) return false

  // Special "all" permission for superadmins
  if (permissions['*']?.includes('*') || permissions['all']?.includes('*')) {
    return true
  }

  // Check section specific permissions
  const sectionPermissions = permissions[section] || []
  
  if (sectionPermissions.includes('*')) return true
  if (sectionPermissions.includes(action)) return true

  return false
}

/**
 * Combines role permissions with user overrides.
 */
export function getCombinedPermissions(
  rolePermissions: UserPermissions | null | undefined,
  overrides: UserPermissions | null | undefined
): UserPermissions {
  const combined: UserPermissions = { ...(rolePermissions || {}) }

  if (overrides) {
    Object.entries(overrides).forEach(([section, actions]) => {
      combined[section] = Array.from(new Set([...(combined[section] || []), ...actions]))
    })
  }

  return combined
}
