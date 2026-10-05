import { ref } from 'vue'
import { errorMessage, fieldErrorsOf, type FieldErrors } from '../services/api/errors'

/**
 * State for one save/delete/post action: disables the button while it runs and keeps the
 * server's message and field errors so the form can show them instead of closing.
 */
export function useSubmit() {
  const pending = ref(false)
  const error = ref('')
  const fieldErrors = ref<FieldErrors>({})

  async function run(action: () => Promise<unknown>, fallback?: string): Promise<boolean> {
    if (pending.value) return false
    pending.value = true
    error.value = ''
    fieldErrors.value = {}
    try {
      await action()
      return true
    } catch (cause) {
      error.value = errorMessage(cause, fallback)
      fieldErrors.value = fieldErrorsOf(cause)
      return false
    } finally {
      pending.value = false
    }
  }

  function reset() {
    error.value = ''
    fieldErrors.value = {}
  }

  return { pending, error, fieldErrors, run, reset }
}
