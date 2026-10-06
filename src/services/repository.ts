import type { ListResponseDto, EntityResponseDto } from '../contracts/dto'
import { compareValues, paginate, type PageResult, type SortDirection } from '../lib/tableQuery'
import { usesApiResource } from './api/config'
import { ApiError } from './api/errors'
import { http, type QueryParams } from './api/httpClient'

/** Every stored record has a server-assigned ID and, once saved, an optimistic-concurrency version. */
export interface Entity {
  id: string
  version?: number
}

export type Filters = Record<string, string | number | boolean | undefined>

export interface ListQuery<F extends Filters = Filters> {
  page?: number
  pageSize?: number
  search?: string
  filters?: F
  sortBy?: string
  sortDirection?: SortDirection
}

export interface EntityRepository<T extends Entity, F extends Filters = Filters> {
  /** API path relative to the company prefix, e.g. `/bank-accounts`. */
  readonly resource: string
  list(query?: ListQuery<F>): Promise<PageResult<T>>
  /** Every matching record, fetched page by page. For lookups and reports, not for tables. */
  listAll(query?: Omit<ListQuery<F>, 'page' | 'pageSize'>): Promise<T[]>
  get(id: string): Promise<T | null>
  /** Creates the record when `id` is empty; otherwise updates it, sending `version` as `expectedVersion`. */
  save(record: T): Promise<T>
  remove(id: string, expectedVersion?: number): Promise<void>
}

/** Server-side rules the preview adapter enforces so pages see the same failures the API returns. */
export interface MemoryRepositoryOptions<T extends Entity, F extends Filters> {
  searchText?: (record: T) => string
  /** Applies `filters`. Must mirror the API's filter semantics for the same keys. */
  matches?: (record: T, filters: F) => boolean
  sortValue?: (record: T, key: string) => string | number
  defaultSort?: { by: string; direction: SortDirection }
  summarize?: (records: T[]) => Record<string, number>
  /** Throw an ApiError (usually VALIDATION_ERROR, CONFLICT or INVALID_STATE_TRANSITION) to reject a save. */
  validate?: (record: T, others: T[], existing: T | undefined) => void
  /** Sets server-owned fields (numbers, totals, status) before a save is stored. */
  prepare?: (record: T, others: T[], existing: T | undefined) => T
  /** Adds read-only computed fields to every record the server returns, e.g. balances. */
  decorate?: (record: T, all: T[]) => T
  /** Throw an ApiError (usually CONFLICT) when the record is still referenced. */
  beforeRemove?: (record: T) => void | Promise<void>
  latencyMs?: number
}

export type RepositoryOptions<T extends Entity, F extends Filters> = MemoryRepositoryOptions<T, F>

const MAX_PAGE_SIZE = 100

/** Mimics the JSON round trip so callers never share object references with the store. */
export function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeQuery<F extends Filters>(query: ListQuery<F> = {}) {
  return {
    page: Math.max(1, Math.trunc(query.page ?? 1)),
    pageSize: Math.max(1, Math.min(MAX_PAGE_SIZE, Math.trunc(query.pageSize ?? 25))),
    search: (query.search ?? '').trim(),
    filters: (query.filters ?? {}) as F,
    sortBy: query.sortBy ?? '',
    sortDirection: query.sortDirection ?? 'asc' as SortDirection,
  }
}

export function validationError(message: string, field?: string): ApiError {
  return new ApiError('VALIDATION_ERROR', message, { status: 422, fieldErrors: field ? { [field]: [message] } : {} })
}

export function conflictError(message: string): ApiError {
  return new ApiError('CONFLICT', message, { status: 409 })
}

/**
 * The preview stand-in for a server resource. `repository` is what pages use; the other members are
 * "server internals" for preview operations (posting, status changes) that bypass client rules.
 */
export interface MemoryBackend<T extends Entity, F extends Filters> {
  repository: EntityRepository<T, F>
  /** Current stored rows, decorated. */
  all(): T[]
  /** Writes a record without client validation, as a server-side operation would. Assigns id and version. */
  write(record: T): T
}

export function createMemoryBackend<T extends Entity, F extends Filters = Filters>(resource: string, seed: T[], options: MemoryRepositoryOptions<T, F> = {}): MemoryBackend<T, F> {
  let rows: T[] = seed.map((record) => ({ ...cloneRecord(record), version: record.version ?? 1 }))
  const delay = () => options.latencyMs ? new Promise((resolve) => window.setTimeout(resolve, options.latencyMs)) : Promise.resolve()
  const valueOf = (record: T, key: string) => options.sortValue?.(record, key) ?? (record as unknown as Record<string, string | number>)[key] ?? ''
  const decorated = () => options.decorate ? rows.map((record) => options.decorate!(record, rows)) : rows

  function filtered(query: ReturnType<typeof normalizeQuery<F>>) {
    const term = query.search.toLocaleLowerCase()
    let result = decorated().filter((record) => (!options.matches || options.matches(record, query.filters))
      && (!term || !options.searchText || options.searchText(record).toLocaleLowerCase().includes(term)))
    const sortBy = query.sortBy || options.defaultSort?.by
    if (sortBy) {
      const direction = query.sortBy ? query.sortDirection : options.defaultSort?.direction ?? 'asc'
      result = [...result].sort((a, b) => compareValues(valueOf(a, sortBy), valueOf(b, sortBy), direction) || a.id.localeCompare(b.id))
    }
    return result
  }

  function output(record: T): T {
    return cloneRecord(options.decorate ? options.decorate(record, rows) : record)
  }

  function write(input: T): T {
    const record = cloneRecord(input)
    const index = record.id ? rows.findIndex((item) => item.id === record.id) : -1
    if (index >= 0) {
      const saved = { ...record, version: (rows[index]!.version ?? 1) + 1 }
      rows = rows.map((item, position) => position === index ? saved : item)
      return output(saved)
    }
    const created = { ...record, id: record.id || crypto.randomUUID(), version: 1 }
    rows = [...rows, created]
    return output(created)
  }

  const repository: EntityRepository<T, F> = {
    resource,
    async list(query) {
      await delay()
      const normalized = normalizeQuery(query)
      const result = filtered(normalized)
      const page = paginate(result, normalized.page, normalized.pageSize)
      return { ...page, items: page.items.map(cloneRecord), summary: options.summarize?.(result) }
    },
    async listAll(query) {
      await delay()
      return filtered(normalizeQuery(query)).map(cloneRecord)
    },
    async get(id) {
      await delay()
      const found = rows.find((record) => record.id === id)
      return found ? output(found) : null
    },
    async save(input) {
      await delay()
      let record = cloneRecord(input)
      const index = record.id ? rows.findIndex((item) => item.id === record.id) : -1
      if (record.id && index < 0) throw new ApiError('NOT_FOUND', undefined, { status: 404 })
      const existing = index >= 0 ? rows[index] : undefined
      if (existing && record.version !== undefined && existing.version !== record.version) throw new ApiError('CONFLICT', undefined, { status: 409 })
      const others = rows.filter((item) => item.id !== record.id)
      options.validate?.(record, others, existing)
      if (options.prepare) record = options.prepare(record, others, existing)
      return write(existing ? record : { ...record, id: '' })
    },
    async remove(id, expectedVersion) {
      await delay()
      const existing = rows.find((record) => record.id === id)
      if (!existing) throw new ApiError('NOT_FOUND', undefined, { status: 404 })
      if (expectedVersion !== undefined && existing.version !== expectedVersion) throw new ApiError('CONFLICT', undefined, { status: 409 })
      await options.beforeRemove?.(existing)
      rows = rows.filter((record) => record.id !== id)
    },
  }
  return { repository, all: () => decorated().map(cloneRecord), write }
}

export function createMemoryRepository<T extends Entity, F extends Filters = Filters>(resource: string, seed: T[], options: MemoryRepositoryOptions<T, F> = {}): EntityRepository<T, F> {
  return createMemoryBackend(resource, seed, options).repository
}

function toQueryParams<F extends Filters>(query: ListQuery<F>, page: number, pageSize: number): QueryParams {
  return {
    page, pageSize,
    search: query.search?.trim() || undefined,
    sortBy: query.sortBy || undefined,
    sortDirection: query.sortBy ? query.sortDirection : undefined,
    ...(query.filters ?? {}),
  }
}

export function createHttpRepository<T extends Entity, F extends Filters = Filters>(resource: string): EntityRepository<T, F> {
  const itemPath = (id: string) => `${resource}/${encodeURIComponent(id)}`
  async function fetchPage(query: ListQuery<F>, page: number, pageSize: number): Promise<PageResult<T>> {
    const response = await http.get<ListResponseDto<T>>(resource, { query: toQueryParams(query, page, pageSize) })
    return { items: response.data, page: response.page, pageSize: response.pageSize, totalItems: response.total, totalPages: response.totalPages, summary: response.summary }
  }
  return {
    resource,
    list(query = {}) {
      const normalized = normalizeQuery(query)
      return fetchPage(query, normalized.page, normalized.pageSize)
    },
    async listAll(query = {}) {
      const all: T[] = []
      for (let page = 1; ; page += 1) {
        const result = await fetchPage(query, page, MAX_PAGE_SIZE)
        all.push(...result.items)
        if (page >= result.totalPages) return all
      }
    },
    async get(id) {
      try {
        return (await http.get<EntityResponseDto<T>>(itemPath(id))).data
      } catch (error) {
        if (error instanceof ApiError && error.code === 'NOT_FOUND') return null
        throw error
      }
    },
    async save(record) {
      const { id, version, ...body } = record
      const response = id
        ? await http.patch<EntityResponseDto<T>>(itemPath(id), { ...body, expectedVersion: version })
        : await http.post<EntityResponseDto<T>>(resource, body)
      return response.data
    },
    async remove(id, expectedVersion) {
      await http.delete(itemPath(id), { query: { expectedVersion } })
    },
  }
}

/**
 * Only supported resources use the API in connected mode; other resources remain preview-only.
 * Modules whose preview operations need server internals use `createMemoryBackend` and `selectRepository`.
 */
export function createRepository<T extends Entity, F extends Filters = Filters>(resource: string, seed: T[], options: RepositoryOptions<T, F> = {}): EntityRepository<T, F> {
  return usesApiResource(resource) ? createHttpRepository<T, F>(resource) : createMemoryRepository<T, F>(resource, seed, options)
}

/** The API adapter in API mode, otherwise the given preview backend's repository. */
export function selectRepository<T extends Entity, F extends Filters>(resource: string, backend: MemoryBackend<T, F>): EntityRepository<T, F> {
  return usesApiResource(resource) ? createHttpRepository<T, F>(resource) : backend.repository
}

export function stateError(message: string): ApiError {
  return new ApiError('INVALID_STATE_TRANSITION', message, { status: 409 })
}
