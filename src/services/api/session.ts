/**
 * Credentials attached to API requests. The auth store owns the session and keeps this in sync;
 * the HTTP client only reads it. Kept separate so the client does not import Vue or feature code.
 */
export interface ApiCredentials {
  accessToken: string
  companyId: string
}

let credentials: ApiCredentials | null = null
let expiredHandler: ((message: string) => void) | null = null
const resetHandlers = new Set<() => void>()
export function onSessionReset(handler: () => void) { resetHandlers.add(handler) }

export function setApiCredentials(next: ApiCredentials | null) {
  if (!next || (credentials && (credentials.companyId !== next.companyId || credentials.accessToken !== next.accessToken))) resetHandlers.forEach((handler) => handler())
  credentials = next
}

export function getApiCredentials(): ApiCredentials | null {
  return credentials
}

/** Called once by the auth store. The HTTP client invokes it when the server rejects the session. */
export function onSessionExpired(handler: (message: string) => void) {
  expiredHandler = handler
}

export function notifySessionExpired(message: string) {
  expiredHandler?.(message)
}
