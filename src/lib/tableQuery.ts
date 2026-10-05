export type SortDirection = 'asc' | 'desc'

export interface TableQuery<TSort extends string = string, TFilters extends Record<string, unknown> = Record<string, unknown>> {
  page: number
  pageSize: number
  search: string
  filters: TFilters
  sortBy: TSort
  sortDirection: SortDirection
}

export interface PageResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  /** Aggregates over every filtered record, not just this page. */
  summary?: Record<string, number>
}

export function paginate<T>(items: T[], page: number, pageSize: number): PageResult<T> {
  const safeSize = Math.max(1, Math.min(100, Math.trunc(pageSize) || 20))
  const totalPages = Math.max(1, Math.ceil(items.length / safeSize))
  const safePage = Math.max(1, Math.min(totalPages, Math.trunc(page) || 1))
  const start = (safePage - 1) * safeSize
  return { items: items.slice(start, start + safeSize), page: safePage, pageSize: safeSize, totalItems: items.length, totalPages }
}

export function compareValues(left: string | number, right: string | number, direction: SortDirection): number {
  const result = typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
  return direction === 'asc' ? result : -result
}
