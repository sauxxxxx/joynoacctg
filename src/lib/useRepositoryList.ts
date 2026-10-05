import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import { errorMessage } from '../services/api/errors'
import type { Entity, EntityRepository, Filters, ListQuery } from '../services/repository'

export type ListStatus = 'loading' | 'ready' | 'error'

export interface RepositoryListOptions {
  pageSize?: number
  /** Delay before reloading after the query changes, so typing in search does not send a request per key. */
  debounceMs?: number
}

/**
 * A server-paged table. `query` returns everything except the page number; when it changes the
 * list returns to page 1. Out-of-order responses are discarded.
 */
export function useRepositoryList<T extends Entity, F extends Filters>(
  repository: EntityRepository<T, F>,
  query: () => Omit<ListQuery<F>, 'page' | 'pageSize'>,
  options: RepositoryListOptions = {},
) {
  const pageSize = options.pageSize ?? 25
  const items = shallowRef<T[]>([]) as Ref<T[]>
  const page = ref(1)
  const totalItems = ref(0)
  const totalPages = ref(1)
  const summary = ref<Record<string, number>>({})
  const status = ref<ListStatus>('loading')
  const error = ref('')
  let requestNumber = 0
  let timer: number | undefined

  async function load() {
    const current = ++requestNumber
    status.value = 'loading'
    error.value = ''
    try {
      const result = await repository.list({ ...query(), page: page.value, pageSize })
      if (current !== requestNumber) return
      items.value = result.items
      totalItems.value = result.totalItems
      totalPages.value = result.totalPages
      summary.value = result.summary ?? {}
      if (page.value > result.totalPages) page.value = result.totalPages
      status.value = 'ready'
    } catch (cause) {
      if (current !== requestNumber) return
      error.value = errorMessage(cause, 'The list could not be loaded.')
      status.value = 'error'
    }
  }

  function schedule(delay: number) {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => void load(), delay)
  }

  watch(query, () => {
    if (page.value !== 1) page.value = 1
    schedule(options.debounceMs ?? 250)
  }, { deep: true })
  watch(page, () => schedule(0))
  onBeforeUnmount(() => { window.clearTimeout(timer); requestNumber += 1 })
  void load()

  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages,
    summary,
    status,
    error,
    loading: computed(() => status.value === 'loading'),
    reload: load,
  }
}

/**
 * Every record matching a bounded query (a date range, one customer's open invoices), reloaded when
 * the query changes. Use for views that need the whole set, such as journals for a month or reports.
 */
export function useRepositoryQuery<T extends Entity, F extends Filters>(
  repository: EntityRepository<T, F>,
  query: () => Omit<ListQuery<F>, 'page' | 'pageSize'> | null,
  options: { debounceMs?: number } = {},
) {
  const items = shallowRef<T[]>([]) as Ref<T[]>
  const status = ref<ListStatus>('loading')
  const error = ref('')
  let requestNumber = 0
  let timer: number | undefined

  async function load() {
    const current = ++requestNumber
    const params = query()
    if (!params) { items.value = []; status.value = 'ready'; return }
    status.value = 'loading'
    error.value = ''
    try {
      const result = await repository.listAll(params)
      if (current !== requestNumber) return
      items.value = result
      status.value = 'ready'
    } catch (cause) {
      if (current !== requestNumber) return
      error.value = errorMessage(cause, 'The records could not be loaded.')
      status.value = 'error'
    }
  }

  watch(query, () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => void load(), options.debounceMs ?? 250)
  }, { deep: true })
  onBeforeUnmount(() => { window.clearTimeout(timer); requestNumber += 1 })
  void load()

  return { items, status, error, loading: computed(() => status.value === 'loading'), reload: load }
}
