import { ref } from 'vue'
import { mockAuthService } from './mockAuthService'
import { AuthenticationError, type AuthCredentials, type AuthSession, type AuthUser } from './authTypes'

const SESSION_KEY = 'joyno.preview-auth-session'
const SESSION_DURATION = 8 * 60 * 60 * 1000

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false
  const user = value as Partial<AuthUser>
  return typeof user.id === 'string' && typeof user.username === 'string' && typeof user.name === 'string'
    && typeof user.email === 'string' && typeof user.role === 'string' && typeof user.active === 'boolean'
}

function removeStoredSession() {
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // The in-memory session is still cleared when browser storage is unavailable.
  }
}

function restoreSession(): AuthSession | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY)
    if (!stored) return null
    const session = JSON.parse(stored) as Partial<AuthSession>
    if (!isAuthUser(session.user) || typeof session.expiresAt !== 'number' || session.expiresAt <= Date.now()) {
      removeStoredSession()
      return null
    }
    return session as AuthSession
  } catch {
    removeStoredSession()
    return null
  }
}

const restoredSession = restoreSession()
const authUser = ref<AuthUser | null>(restoredSession?.user ?? null)
const authenticating = ref(false)
const authError = ref('')
let expiryTimer: number | undefined

function scheduleExpiry(expiresAt: number) {
  if (expiryTimer) window.clearTimeout(expiryTimer)
  expiryTimer = window.setTimeout(() => {
    removeStoredSession()
    authUser.value = null
    authError.value = 'Your preview session expired. Sign in again to continue.'
  }, Math.max(0, expiresAt - Date.now()))
}

if (restoredSession) scheduleExpiry(restoredSession.expiresAt)

async function signIn(credentials: AuthCredentials) {
  authenticating.value = true
  authError.value = ''
  try {
    const user = await mockAuthService.signIn(credentials)
    const session: AuthSession = { user, expiresAt: Date.now() + SESSION_DURATION }
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {
      // Keep the preview session in memory when browser storage is unavailable.
    }
    authUser.value = user
    scheduleExpiry(session.expiresAt)
    return true
  } catch (error) {
    authError.value = error instanceof AuthenticationError ? error.message : 'Sign in could not be completed. Try again.'
    return false
  } finally {
    authenticating.value = false
  }
}

function signOut() {
  if (expiryTimer) window.clearTimeout(expiryTimer)
  expiryTimer = undefined
  removeStoredSession()
  authUser.value = null
  authError.value = ''
}

function clearAuthError() {
  authError.value = ''
}

export function useAuth() {
  return { authUser, authenticating, authError, signIn, signOut, clearAuthError }
}
