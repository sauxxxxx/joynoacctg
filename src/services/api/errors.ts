import type { ApiErrorDto } from '../../contracts/dto'

/** Error codes from the BACKEND_SPEC error contract, plus client-side network failures. */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_STATE_TRANSITION'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'

export type FieldErrors = Record<string, string[]>

const defaultMessages: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: 'Check the highlighted fields.',
  UNAUTHENTICATED: 'Sign in to continue.',
  SESSION_EXPIRED: 'Your session expired. Sign in again to continue.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The record no longer exists. It may have been deleted.',
  CONFLICT: 'Someone else changed this record. Reload it and try again.',
  INVALID_STATE_TRANSITION: 'The record is no longer in a state that allows this action. Reload and try again.',
  RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
  INTERNAL_ERROR: 'The server could not complete the request. Try again later.',
  NETWORK_ERROR: 'The server could not be reached. Check your connection and try again.',
}

const statusCodes: Record<number, ApiErrorCode> = {
  401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 422: 'VALIDATION_ERROR', 429: 'RATE_LIMITED',
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly fieldErrors: FieldErrors
  readonly requestId: string

  constructor(code: ApiErrorCode, message = defaultMessages[code], options: { status?: number; fieldErrors?: FieldErrors; requestId?: string } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = options.status ?? 0
    this.fieldErrors = options.fieldErrors ?? {}
    this.requestId = options.requestId ?? ''
  }

  /** First message for a field path such as `lines.0.accountId`. */
  fieldError(path: string): string {
    return this.fieldErrors[path]?.[0] ?? ''
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

const knownCodes = new Set(Object.keys(defaultMessages))

/** Builds an ApiError from a non-2xx response body shaped like `{ error: ApiErrorDto }`. */
export function apiErrorFromResponse(status: number, body: unknown, requestId: string): ApiError {
  const dto = (body && typeof body === 'object' && 'error' in body ? (body as { error: Partial<ApiErrorDto> }).error : null) ?? null
  const code = dto?.code && knownCodes.has(dto.code) ? dto.code as ApiErrorCode : statusCodes[status] ?? 'INTERNAL_ERROR'
  return new ApiError(code, dto?.message || defaultMessages[code], { status, fieldErrors: dto?.fieldErrors, requestId: dto?.requestId || requestId })
}

/** A message that is safe to show to the person using the app. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (isApiError(error)) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function fieldErrorsOf(error: unknown): FieldErrors {
  return isApiError(error) ? error.fieldErrors : {}
}
