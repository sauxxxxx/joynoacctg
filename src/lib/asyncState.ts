import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { errorMessage, isApiError } from '../services/api/errors'

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error' | 'unauthorized'

export interface AsyncResource<T> {
  data: Ref<T | null>
  error: Ref<string>
  status: Ref<AsyncStatus>
  loading: ComputedRef<boolean>
  run: () => Promise<void>
}

export interface AsyncResourceOptions<T> {
  load: () => Promise<T>
  isEmpty?: (value: T) => boolean
  errorMessage?: string
}

export function useAsyncResource<T>(options: AsyncResourceOptions<T>): AsyncResource<T> {
  const data = ref<T | null>(null) as Ref<T | null>
  const error = ref('')
  const status = ref<AsyncStatus>('idle')
  const loading = computed(() => status.value === 'loading')
  let generation = 0

  async function run() {
    const current = ++generation
    status.value = 'loading'
    error.value = ''
    try {
      const value = await options.load()
      if (current !== generation) return
      data.value = value
      status.value = options.isEmpty?.(value) ? 'empty' : 'success'
    } catch (cause) {
      if (current !== generation) return
      status.value = cause instanceof UnauthorizedError || (isApiError(cause) && cause.code === 'FORBIDDEN') ? 'unauthorized' : 'error'
      error.value = errorMessage(cause, options.errorMessage ?? 'The requested data could not be loaded.')
    }
  }

  return { data, error, status, loading, run }
}

export class UnauthorizedError extends Error {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}
