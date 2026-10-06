import { onMounted, ref, type Ref } from 'vue'
import { getApiCredentials } from './api/session'
import { errorMessage } from './api/errors'
import type { Entity, EntityRepository } from './repository'

/** Shared persistence lifecycle for small, explicitly typed record registers. */
export function useRecordWorkspace<T extends Entity>(repository: EntityRepository<T>, rows: Ref<T[]>) {
  const loading = ref(true)
  const busy = ref(false)
  const error = ref('')
  let generation = 0
  async function load() {
    const current = ++generation
    const token = getApiCredentials()?.accessToken
    loading.value = true
    error.value = ''
    try {
      const records = await repository.listAll()
      if (current === generation && token === getApiCredentials()?.accessToken) rows.value = records
    } catch (cause) {
      if (current === generation) error.value = errorMessage(cause, 'Records could not be loaded.')
    } finally { if (current === generation) loading.value = false }
  }
  async function save(record: T) {
    if (busy.value || loading.value) return null
    busy.value = true; error.value = ''
    try { return await repository.save(record) }
    catch (cause) { error.value = errorMessage(cause, 'Your changes could not be saved.'); return null }
    finally { busy.value = false }
  }
  async function remove(record: T) {
    if (busy.value || loading.value) return false
    busy.value = true; error.value = ''
    try { await repository.remove(record.id, record.version); return true }
    catch (cause) { error.value = errorMessage(cause, 'The record could not be deleted.'); return false }
    finally { busy.value = false }
  }
  onMounted(load)
  return { loading, busy, error, load, save, remove }
}
