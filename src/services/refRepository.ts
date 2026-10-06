import type { Ref } from 'vue'
import { usesApiResource } from './api/config'
import { getApiCredentials, onSessionReset } from './api/session'
import { createHttpRepository, createMemoryBackend, createMemoryRepository, type Entity, type EntityRepository, type Filters, type MemoryRepositoryOptions } from './repository'
const registered = new WeakSet<object>()

/** Keeps legacy reactive preview collections in sync while they migrate to collection stores. */
export function createRefRepository<T extends Entity, F extends Filters = Filters>(
  resource: string,
  source: Ref<T[]>,
  options: MemoryRepositoryOptions<T, F> = {},
): EntityRepository<T, F> {
  const api = createHttpRepository<T, F>(resource)
  const connected = usesApiResource(resource)
  if (connected && !registered.has(source)) {
    registered.add(source)
    source.value = []
    onSessionReset(() => { source.value = [] })
  }
  const current = () => connected ? api : createMemoryRepository(resource, source.value, options)

  return {
    resource,
    list(query) { return current().list(query) },
    listAll(query) { return current().listAll(query) },
    get(id) { return current().get(id) },
    async save(record) {
      const token = getApiCredentials()?.accessToken
      const version = record.version ?? source.value.find((item) => item.id === record.id)?.version
      const isNew = !source.value.some((item) => item.id === record.id)
      const saved = !connected && isNew && record.id
        ? createMemoryBackend(resource, source.value, options).write(record)
        : await current().save(connected && isNew ? { ...record, id: '' } : { ...record, version })
      const index = source.value.findIndex((item) => item.id === saved.id)
      if (connected && token !== getApiCredentials()?.accessToken) return saved
      source.value = index < 0
        ? [...source.value, saved]
        : source.value.map((item, position) => position === index ? saved : item)
      return saved
    },
    async remove(id, expectedVersion) {
      const token = getApiCredentials()?.accessToken
      await current().remove(id, expectedVersion ?? source.value.find((item) => item.id === id)?.version)
      if (!connected || token === getApiCredentials()?.accessToken) source.value = source.value.filter((item) => item.id !== id)
    },
  }
}
