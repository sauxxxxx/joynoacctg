import { ref, type Ref } from 'vue'
import type { EntityResponseDto } from '../contracts/dto'
import { dataMode } from './api/config'
import { ApiError, errorMessage } from './api/errors'
import { http } from './api/httpClient'
import { cloneRecord } from './repository'
import type { CollectionStatus } from './collectionStore'

/** A single settings document per company, e.g. the profile or tax rules. */
export interface SettingsRepository<T extends object> {
  readonly resource: string
  load(): Promise<{ value: T; version: number }>
  save(value: T, expectedVersion: number): Promise<{ value: T; version: number }>
}

type Versioned<T> = { value: T; version: number }
type SettingsDto<T> = T & { version: number }

function createMemorySettings<T extends object>(resource: string, seed: T): SettingsRepository<T> {
  let current: Versioned<T> = { value: cloneRecord(seed), version: 1 }
  return {
    resource,
    async load() { return cloneRecord(current) },
    async save(value, expectedVersion) {
      if (expectedVersion !== current.version) throw new ApiError('CONFLICT', undefined, { status: 409 })
      current = { value: cloneRecord(value), version: current.version + 1 }
      return cloneRecord(current)
    },
  }
}

function createHttpSettings<T extends object>(resource: string): SettingsRepository<T> {
  const unwrap = ({ version, ...value }: SettingsDto<T>): Versioned<T> => ({ value: value as unknown as T, version })
  return {
    resource,
    async load() { return unwrap((await http.get<EntityResponseDto<SettingsDto<T>>>(resource)).data) },
    async save(value, expectedVersion) { return unwrap((await http.put<EntityResponseDto<SettingsDto<T>>>(resource, { ...value, expectedVersion })).data) },
  }
}

export interface SettingsStore<T extends object> {
  readonly repository: SettingsRepository<T>
  /** The last saved value. Pages edit a copy and call `save`. */
  readonly value: Readonly<Ref<T>>
  readonly status: Readonly<Ref<CollectionStatus>>
  readonly error: Readonly<Ref<string>>
  ensureLoaded(): Promise<void>
  reload(): Promise<void>
  save(next: T): Promise<T>
  reset(): void
}

const registry = new Set<{ reset(): void }>()

export function resetSettingsStores() {
  registry.forEach((store) => store.reset())
}

/** `resource` is relative to the company prefix, e.g. `/settings/tax`. `fallback` is shown until loaded. */
export function createSettingsStore<T extends object>(resource: string, fallback: T, seed: T = fallback): SettingsStore<T> {
  const repository = dataMode === 'api' ? createHttpSettings<T>(resource) : createMemorySettings(resource, seed)
  const value = ref(cloneRecord(fallback)) as Ref<T>
  const status = ref<CollectionStatus>('idle')
  const error = ref('')
  let version = 0
  let pending: Promise<void> | null = null

  function load(force: boolean): Promise<void> {
    if (pending) return pending
    if (!force && status.value === 'ready') return Promise.resolve()
    status.value = 'loading'
    error.value = ''
    pending = repository.load()
      .then((result) => { value.value = result.value; version = result.version; status.value = 'ready' })
      .catch((cause: unknown) => { error.value = errorMessage(cause, 'Settings could not be loaded.'); status.value = 'error' })
      .finally(() => { pending = null })
    return pending
  }

  const store: SettingsStore<T> = {
    repository,
    value,
    status,
    error,
    ensureLoaded: () => load(false),
    reload: () => load(true),
    async save(next) {
      await load(false)
      const result = await repository.save(next, version)
      value.value = result.value
      version = result.version
      return result.value
    },
    reset() {
      pending = null
      value.value = cloneRecord(fallback)
      version = 0
      status.value = 'idle'
      error.value = ''
    },
  }
  registry.add(store)
  return store
}
