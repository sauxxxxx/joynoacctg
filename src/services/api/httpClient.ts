import { apiConfig } from './config'
import { ApiError, apiErrorFromResponse } from './errors'
import { getApiCredentials, notifySessionExpired } from './session'

export type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue | QueryValue[]>

export interface RequestOptions {
  query?: QueryParams
  body?: unknown
  signal?: AbortSignal
  /** Prefix the path with `/companies/{companyId}`. Defaults to true; auth endpoints opt out. */
  tenant?: boolean
  /** Overrides the session token, e.g. to revoke a session that is already cleared locally. */
  accessToken?: string
}

function buildUrl(path: string, options: RequestOptions): string {
  const tenant = options.tenant ?? true
  let prefix = '/api/v1'
  if (tenant) {
    const companyId = getApiCredentials()?.companyId
    if (!companyId) throw new ApiError('UNAUTHENTICATED')
    prefix += `/companies/${encodeURIComponent(companyId)}`
  }
  const url = new URL(`${apiConfig.baseUrl}${prefix}${path}`, window.location.origin)
  for (const [key, raw] of Object.entries(options.query ?? {})) {
    for (const value of Array.isArray(raw) ? raw : [raw]) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.append(key, String(value))
    }
  }
  return url.toString()
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

export async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, options: RequestOptions = {}): Promise<T> {
  const requestId = crypto.randomUUID()
  const url = buildUrl(path, options)
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Request-Id': requestId }
  const token = options.accessToken ?? getApiCredentials()?.accessToken
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const timeout = new AbortController()
  const timer = window.setTimeout(() => timeout.abort(), apiConfig.timeoutMs)
  const abort = () => timeout.abort()
  options.signal?.addEventListener('abort', abort, { once: true })

  let response: Response
  try {
    response = await fetch(url, {
      method, headers, signal: timeout.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch (cause) {
    if (options.signal?.aborted) throw cause
    throw new ApiError('NETWORK_ERROR', undefined, { requestId })
  } finally {
    window.clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
  }

  const body = await readBody(response)
  if (!response.ok) {
    const error = apiErrorFromResponse(response.status, body, requestId)
    if (error.code === 'SESSION_EXPIRED' || error.code === 'UNAUTHENTICATED') notifySessionExpired(error.message)
    throw error
  }
  return body as T
}

export const http = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, { ...options, body }),
  delete: <T = void>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
}
