import { describe, expect, it } from 'vitest'
import { canAccessPage, hasPermission } from '../features/auth/permissions'
import { isSessionExpired } from '../features/auth/authSession'
import type { AuthUser } from '../features/auth/authTypes'

const admin: AuthUser = { id: '1', username: 'admin', email: '', name: 'Admin', role: 'Administrator', active: true }

describe('permissions and sessions', () => {
  it('blocks inactive users and permits active administrators', () => {
    expect(hasPermission(admin, 'Banking', 'delete')).toBe(true)
    expect(canAccessPage({ ...admin, active: false }, 'bank-accounts')).toBe(false)
  })
  it('treats the exact expiration instant as expired', () => {
    expect(isSessionExpired(1000, 1000)).toBe(true)
    expect(isSessionExpired(1001, 1000)).toBe(false)
  })
})
