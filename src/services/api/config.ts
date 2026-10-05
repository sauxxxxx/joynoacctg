/**
 * Where data comes from. With `VITE_API_BASE_URL` set, every repository talks to the API described
 * in docs/BACKEND_SPEC.md. Without it, the app runs on in-memory preview data that resets on reload.
 */
const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

export const apiConfig = {
  baseUrl,
  /** Milliseconds before a request is abandoned and reported as a network error. */
  timeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS) || 30_000,
} as const

export type DataMode = 'preview' | 'api'

export const dataMode: DataMode = baseUrl ? 'api' : 'preview'

export const isPreviewMode = dataMode === 'preview'
