import { computed, ref, watch, type Ref } from 'vue'
import { recordAudit } from './companyStore'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

/**
 * Edit a copy of a settings object and write it back on Save.
 * `validate` returns an error message, or '' when the draft can be saved.
 */
export function useSettingsDraft<T extends object>(store: Ref<T>, subject: string, validate: (draft: T) => string = () => '') {
  const draft = ref(clone(store.value)) as Ref<T>
  const error = ref('')
  const notice = ref('')
  const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(store.value))

  watch(draft, () => { error.value = '' }, { deep: true })

  function save() {
    error.value = validate(draft.value)
    if (error.value) return false
    store.value = clone(draft.value)
    notice.value = `${subject} saved.`
    recordAudit('Company', 'Updated', subject)
    return true
  }

  function discard() {
    draft.value = clone(store.value)
    error.value = ''
  }

  return { draft, error, notice, dirty, save, discard }
}
