import { describe, expect, it, vi } from 'vitest'
import { createCollectionStore } from '../services/collectionStore'
import { createMemoryRepository } from '../services/repository'

const record = { id: 'a', name: 'Cash', version: 2 }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('collection cache isolation', () => {
  it('uses the loaded version for a delete', async () => {
    const repository = createMemoryRepository('/test', [record])
    const remove = vi.spyOn(repository, 'remove').mockResolvedValue()
    const store = createCollectionStore(repository)
    await store.ensureLoaded()
    await store.remove('a')
    expect(remove).toHaveBeenCalledWith('a', 2)
    expect(store.items.value).toEqual([])
  })
  it('does not restore a previous session cache after a pending save finishes', async () => {
    const repository = createMemoryRepository('/test', [record])
    const next = deferred<typeof record>()
    vi.spyOn(repository, 'save').mockReturnValue(next.promise)
    const store = createCollectionStore(repository)
    const saving = store.save(record)
    store.reset()
    next.resolve(record)
    await saving
    expect(store.items.value).toEqual([])
  })
  it('does not clear a new session loading promise when an old load finishes', async () => {
    const repository = createMemoryRepository('/test', [record])
    const old = deferred<typeof record[]>()
    const next = deferred<typeof record[]>()
    const listing = vi.spyOn(repository, 'listAll').mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
    const store = createCollectionStore(repository)
    const first = store.ensureLoaded()
    store.reset()
    const second = store.ensureLoaded()
    old.resolve([record])
    await first
    expect(store.items.value).toEqual([])
    const third = store.ensureLoaded()
    expect(listing).toHaveBeenCalledTimes(2)
    next.resolve([{ ...record, name: 'New company' }])
    await Promise.all([second, third])
    expect(store.items.value[0]?.name).toBe('New company')
  })
})
