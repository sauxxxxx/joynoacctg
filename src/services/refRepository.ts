import type { Ref } from 'vue'
import { dataMode } from './api/config'
import { createHttpRepository, createMemoryBackend, createMemoryRepository, type Entity, type EntityRepository, type Filters, type MemoryRepositoryOptions } from './repository'

/** Keeps legacy reactive preview collections in sync while they migrate to collection stores. */
export function createRefRepository<T extends Entity, F extends Filters = Filters>(
  resource: string,
  source: Ref<T[]>,
  options: MemoryRepositoryOptions<T, F> = {},
): EntityRepository<T, F> {
  const api = createHttpRepository<T, F>(resource)
  const current = () => dataMode === 'api' ? api : createMemoryRepository(resource, source.value, options)

  return {
    resource,
    list(query) { return current().list(query) },
    listAll(query) { return current().listAll(query) },
    get(id) { return current().get(id) },
    async save(record) {
      const isNew = !source.value.some((item) => item.id === record.id)
      const saved = dataMode === 'preview' && isNew && record.id
        ? createMemoryBackend(resource, source.value, options).write(record)
        : await current().save(dataMode === 'api' && isNew ? { ...record, id: '' } : record)
      const index = source.value.findIndex((item) => item.id === saved.id)
      source.value = index < 0
        ? [...source.value, saved]
        : source.value.map((item, position) => position === index ? saved : item)
      return saved
    },
    async remove(id, expectedVersion) {
      await current().remove(id, expectedVersion)
      source.value = source.value.filter((item) => item.id !== id)
    },
  }
}
