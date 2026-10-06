import { ref } from 'vue'
import { apiConfig, dataMode } from '../../services/api/config'
import { onSessionExpired, setApiCredentials } from '../../services/api/session'
import { resetCollectionStores } from '../../services/collectionStore'
import { resetSettingsStores } from '../../services/settingsStore'
import { apiAuthService } from './apiAuthService'
import { mockAuthService } from './mockAuthService'
import { AuthenticationError, type AuthCredentials, type AuthSession, type AuthUser } from './authTypes'
import { isSessionExpired } from './authSession'

const SESSION_KEY = dataMode === 'api' ? `joyno.auth-session:${encodeURIComponent(apiConfig.baseUrl)}` : 'joyno.preview-auth-session'
const authService = dataMode === 'api' ? apiAuthService : mockAuthService

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
    if (!isAuthUser(session.user) || !session.user.active || typeof session.expiresAt !== 'number' || isSessionExpired(session.expiresAt)
      || typeof session.companyId !== 'string' || !session.companyId || typeof session.accessToken !== 'string'
      || (dataMode === 'api' && !session.accessToken)) {
      removeStoredSession()
      return null
    }
    return session as AuthSession
  } catch {
    removeStoredSession()
    return null
  }
}

let session: AuthSession | null = restoreSession()
const authUser = ref<AuthUser | null>(session?.user ?? null)
const authenticating = ref(false)
const authError = ref('')
let expiryTimer: number | undefined
let attempt = 0

function clearSession(message = '') {
  if (expiryTimer) window.clearTimeout(expiryTimer)
  expiryTimer = undefined
  session = null
  setApiCredentials(null)
  removeStoredSession()
  resetCollectionStores()
  resetSettingsStores()
  authUser.value = null
  authError.value = message
}

function activate(next: AuthSession) {
  session = next
  setApiCredentials({ accessToken: next.accessToken, companyId: next.companyId })
  authUser.value = next.user
  if (expiryTimer) window.clearTimeout(expiryTimer)
  expiryTimer = window.setTimeout(() => clearSession('Your session expired. Sign in again to continue.'), Math.max(0, next.expiresAt - Date.now()))
}

if (session) activate(session)
onSessionExpired((message) => { if (session) clearSession(message) })

async function signIn(credentials: AuthCredentials) {
  const current = ++attempt
  authenticating.value = true
  authError.value = ''
  try {
    const next = await authService.signIn(credentials)
    if (current !== attempt) {
      void authService.signOut(next).catch(() => undefined)
      return false
    }
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
    } catch {
      // Keep the session in memory when browser storage is unavailable.
    }
    activate(next)
    return true
  } catch (error) {
    if (current !== attempt) return false
    authError.value = error instanceof AuthenticationError ? error.message : 'Sign in could not be completed. Try again.'
    return false
  } finally {
    if (current === attempt) authenticating.value = false
  }
}

function signOut(message = '') {
  attempt += 1
  authenticating.value = false
  const current = session
  clearSession(message)
  // The server revokes the token; the local session is already gone, so a failure here is not shown.
  if (current) void authService.signOut(current).catch(() => undefined)
}

function clearAuthError() {
  authError.value = ''
}

/** Display name for audit attribution in preview mode. The API records the actor from the token. */
export function currentActorName(): string {
  return authUser.value?.name ?? 'Unknown user'
}

export function useAuth() {
  return { authUser, authenticating, authError, signIn, signOut, clearAuthError }
}
