import { computed, ref, watch, type Ref } from 'vue'
import { recordAudit } from './companyStore'
import { saveCompanySettings } from './companyPersistence'
import { errorMessage } from '../../services/api/errors'
import { isPreviewMode } from '../../services/api/config'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

/**
 * Edit a copy of a settings object and write it back on Save.
 * `validate` returns an error message, or '' when the draft can be saved.
 */
export function useSettingsDraft<T extends object>(store: Ref<T>, subject: string, validate: (draft: T) => string = () => '') {
  const draft = ref(clone(store.value)) as Ref<T>
  const error = ref('')
  const notice = ref('')
  const saving = ref(false)
  const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(store.value))

  watch(draft, () => { error.value = '' }, { deep: true })

  async function save() {
    if (saving.value) return false
    error.value = validate(draft.value)
    if (error.value) return false
    saving.value = true
    try {
      if (isPreviewMode) store.value = clone(draft.value)
      else await saveCompanySettings(store, clone(draft.value))
      notice.value = `${subject} saved.`
      recordAudit('Company', 'Updated', subject)
      return true
    } catch (cause) { error.value = errorMessage(cause, 'Your changes could not be saved.'); return false }
    finally { saving.value = false }
  }

  function discard() {
    if (saving.value) return
    draft.value = clone(store.value)
    error.value = ''
  }

  return { draft, error, notice, dirty, saving, save, discard }
}
