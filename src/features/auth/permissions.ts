import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { findAncestorIds, type NavigationItem } from '../../navigation'
import { roles, type PermissionAction, type PermissionModule, type Role } from '../company/companyStore'
import type { AuthUser } from './authTypes'

const rootModules: Record<string, PermissionModule> = {
  assets: 'Asset Management', sales: 'Sales', purchases: 'Purchases', accounting: 'Accounting', government: 'Government',
  banking: 'Banking', company: 'Company', documents: 'Documents',
}

export function moduleForPage(pageId: string): PermissionModule | null {
  if (pageId === 'dashboard') return null
  const root = findAncestorIds(pageId)[0] ?? pageId
  return rootModules[root] ?? null
}

export function roleForUser(user: AuthUser | null): Role | null {
  if (!user) return null
  return roles.value.find((role) => role.active && role.name === user.role) ?? null
}

export function hasPermission(user: AuthUser | null, module: PermissionModule, action: PermissionAction): boolean {
  if (!user?.active) return false
  // The server sends the membership's permissions at sign-in; preview users take them from Company › Roles.
  const permissions = user.permissions ?? roleForUser(user)?.permissions
  return Boolean(permissions?.[module]?.[action])
}

export function canAccessPage(user: AuthUser | null, pageId: string): boolean {
  const module = moduleForPage(pageId)
  return module === null ? Boolean(user?.active) : hasPermission(user, module, 'view')
}

export function filterNavigation(items: NavigationItem[], user: AuthUser | null): NavigationItem[] {
  return items.flatMap((item) => {
    if (item.children) {
      const children = filterNavigation(item.children, user)
      return children.length ? [{ ...item, children }] : []
    }
    return canAccessPage(user, item.id) ? [item] : []
  })
}

export function usePermissions(user: MaybeRefOrGetter<AuthUser | null>) {
  const currentRole = computed(() => roleForUser(toValue(user)))
  const can = (module: PermissionModule, action: PermissionAction) => hasPermission(toValue(user), module, action)
  const canViewPage = (pageId: string) => canAccessPage(toValue(user), pageId)
  return { currentRole, can, canViewPage }
}
