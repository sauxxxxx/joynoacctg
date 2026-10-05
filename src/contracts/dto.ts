/**
 * Wire envelopes shared by every API endpoint (see docs/BACKEND_SPEC.md › Error contract and
 * Pagination). Resource bodies are the record types exported beside each feature's repository.
 */
export interface MoneyInput { amount: string }
export interface DateInput { date: string }

export interface EntityResponseDto<T> { data: T; requestId: string }
export interface ListResponseDto<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  /** Optional aggregates over the whole filtered set, such as `{ amountCents: 123 }`. */
  summary?: Record<string, number>
  requestId: string
}
export interface ApiErrorDto { code: string; message: string; fieldErrors?: Record<string, string[]>; requestId: string }
export interface ApiErrorResponseDto { error: ApiErrorDto }

export interface SignInRequestDto { username: string; password: string }
export interface SignInResponseDto {
  accessToken: string
  /** UTC ISO 8601. */
  expiresAt: string
  user: { id: string; username: string; email: string; name: string; active: boolean }
  /** Active company memberships; the first is selected when no preference exists. */
  memberships: { companyId: string; companyName: string; role: string; permissions: Record<string, Record<'view' | 'create' | 'edit' | 'delete', boolean>> }[]
}

export interface JournalPostRequestDto { expectedVersion: number }
export interface JournalPostResponseDto { journalEntryId: string; status: 'posted' | 'voided'; postedAt: string; auditEventId: string }
export interface CreateJournalsRequestDto { sourceIds: string[] }
export interface CreateJournalsResponseDto { journalEntryIds: string[]; created: number; existing: number }
