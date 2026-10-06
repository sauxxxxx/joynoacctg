import { computed, ref, shallowRef, type ComputedRef, type Ref } from 'vue'
import { errorMessage } from './api/errors'
import type { Entity, EntityRepository, Filters, ListQuery } from './repository'

export type CollectionStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * A cached, read-mostly collection for reference data (accounts, customers, vendors, setup records).
 * Forms and tables read `items` for dropdowns and name lookups; every write goes through the
 * repository and then updates the cache with the server's copy.
 */
export interface CollectionStore<T extends Entity> {
  readonly repository: EntityRepository<T, Filters>
  readonly items: ComputedRef<T[]>
  readonly status: Readonly<Ref<CollectionStatus>>
  readonly error: Readonly<Ref<string>>
  ensureLoaded(): Promise<void>
  reload(): Promise<void>
  save(record: T): Promise<T>
  remove(id: string, expectedVersion?: number): Promise<void>
  reset(): void
}

const registry = new Set<{ reset(): void }>()

/** Clears every cache, e.g. on sign-out or when switching company. */
export function resetCollectionStores() {
  registry.forEach((store) => store.reset())
}

export function createCollectionStore<T extends Entity>(repository: EntityRepository<T, Filters>, query: Omit<ListQuery, 'page' | 'pageSize'> = {}): CollectionStore<T> {
  const rows = shallowRef<T[]>([])
  const status = ref<CollectionStatus>('idle')
  const error = ref('')
  let pending: Promise<void> | null = null
  let generation = 0

  function load(force: boolean): Promise<void> {
    if (pending) return pending
    if (!force && status.value === 'ready') return Promise.resolve()
    const current = generation
    status.value = 'loading'
    error.value = ''
    pending = repository.listAll(query)
      .then((items) => {
        if (current !== generation) return
        rows.value = items
        status.value = 'ready'
      })
      .catch((cause: unknown) => {
        if (current !== generation) return
        error.value = errorMessage(cause, 'Reference data could not be loaded.')
        status.value = 'error'
      })
      .finally(() => { if (current === generation) pending = null })
    return pending
  }

  const store: CollectionStore<T> = {
    repository,
    items: computed(() => rows.value),
    status,
    error,
    ensureLoaded: () => load(false),
    reload: () => load(true),
    async save(record) {
      const current = generation
      const saved = await repository.save(record)
      if (current !== generation) return saved
      const exists = rows.value.some((item) => item.id === saved.id)
      rows.value = exists ? rows.value.map((item) => item.id === saved.id ? saved : item) : [...rows.value, saved]
      return saved
    },
    async remove(id, expectedVersion) {
      const current = generation
      await repository.remove(id, expectedVersion ?? rows.value.find((item) => item.id === id)?.version)
      if (current !== generation) return
      rows.value = rows.value.filter((item) => item.id !== id)
    },
    reset() {
      generation += 1
      pending = null
      rows.value = []
      status.value = 'idle'
      error.value = ''
    },
  }
  registry.add(store)
  return store
}

/**
 * Loads the given stores for a component and reports their combined state.
 * Call from `setup`; the stores stay cached for other pages.
 */
export function useCollections(...stores: Pick<CollectionStore<Entity>, 'ensureLoaded' | 'reload' | 'status' | 'error'>[]) {
  stores.forEach((store) => void store.ensureLoaded())
  return {
    loading: computed(() => stores.some((store) => store.status.value === 'loading' || store.status.value === 'idle')),
    error: computed(() => stores.find((store) => store.error.value)?.error.value ?? ''),
    retry: () => Promise.all(stores.map((store) => store.status.value === 'error' ? store.reload() : store.ensureLoaded())),
  }
}
