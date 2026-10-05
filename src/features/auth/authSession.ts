import type { AuthSession } from './authTypes'

export function isSessionExpired(expiresAt: number, now = Date.now()) {
  return !Number.isFinite(expiresAt) || expiresAt <= now
}

export function isRestorableSession(value: Partial<AuthSession>, now = Date.now()): value is AuthSession {
  return Boolean(value.user && typeof value.user.id === 'string' && value.user.active && !isSessionExpired(value.expiresAt ?? Number.NaN, now))
}
