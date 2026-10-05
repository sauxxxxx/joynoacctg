import { readonly, ref } from 'vue'

export type DialogOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type DialogRequest = DialogOptions & {
  mode: 'confirm' | 'alert'
  resolve: (accepted: boolean) => void
}

const activeDialog = ref<DialogRequest | null>(null)

function open(options: DialogOptions, mode: DialogRequest['mode']) {
  if (activeDialog.value) activeDialog.value.resolve(false)
  return new Promise<boolean>((resolve) => {
    activeDialog.value = { ...options, mode, resolve }
  })
}

export function confirmAction(options: DialogOptions) {
  return open(options, 'confirm')
}

export function showAlert(options: Omit<DialogOptions, 'cancelLabel'>) {
  return open(options, 'alert')
}

export function resolveDialog(accepted: boolean) {
  const request = activeDialog.value
  if (!request) return
  activeDialog.value = null
  request.resolve(accepted)
}

export function useDialogState() {
  return { activeDialog: readonly(activeDialog), resolveDialog }
}
