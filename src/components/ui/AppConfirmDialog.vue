<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { AlertTriangle, Info } from '@lucide/vue'
import { useDialogState } from '../../services/dialogService'

const { activeDialog, resolveDialog } = useDialogState()
const confirmButton = ref<HTMLButtonElement | null>(null)
const modal = ref<HTMLDialogElement | null>(null)
let returnFocus: HTMLElement | null = null

watch(activeDialog, async (request) => {
  if (request) {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    if (activeDialog.value === request && !modal.value?.open) modal.value?.showModal()
    confirmButton.value?.focus()
  } else {
    await nextTick()
    returnFocus?.focus()
    returnFocus = null
  }
}, { immediate: true })

function close(accepted: boolean) { resolveDialog(accepted) }
</script>

<template>
  <Teleport to="body">
    <dialog v-if="activeDialog" ref="modal" class="confirm-dialog__backdrop" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message" @cancel.prevent="close(false)" @mousedown.self="close(false)">
      <section class="confirm-dialog">
        <div class="confirm-dialog__icon" :class="{ 'confirm-dialog__icon--danger': activeDialog.destructive }" aria-hidden="true">
          <AlertTriangle v-if="activeDialog.destructive" :size="20" />
          <Info v-else :size="20" />
        </div>
        <div class="confirm-dialog__copy">
          <h2 id="confirm-dialog-title">{{ activeDialog.title }}</h2>
          <p id="confirm-dialog-message">{{ activeDialog.message }}</p>
        </div>
        <footer>
          <button v-if="activeDialog.mode === 'confirm'" type="button" class="confirm-dialog__button" @click="close(false)">{{ activeDialog.cancelLabel || 'Cancel' }}</button>
          <button ref="confirmButton" type="button" class="confirm-dialog__button confirm-dialog__button--primary" :class="{ 'confirm-dialog__button--danger': activeDialog.destructive }" @click="close(true)">{{ activeDialog.confirmLabel || (activeDialog.mode === 'alert' ? 'OK' : 'Confirm') }}</button>
        </footer>
      </section>
    </dialog>
  </Teleport>
</template>

<style scoped>
.confirm-dialog__backdrop { position: fixed; inset: 0; width: 100vw; max-width: none; height: 100dvh; max-height: none; margin: 0; border: 0; padding: 24px; background: transparent; }
.confirm-dialog__backdrop[open] { display: grid; place-items: center; }
.confirm-dialog__backdrop::backdrop { background: rgb(15 23 42 / 42%); backdrop-filter: blur(2px); }
.confirm-dialog { width: min(440px, 100%); display: grid; grid-template-columns: 42px 1fr; gap: 16px; padding: 24px; border: 1px solid var(--border, #d9dee7); border-radius: 14px; background: var(--surface, #fff); color: var(--text, #172033); box-shadow: 0 24px 70px rgb(15 23 42 / 24%); }
.confirm-dialog__icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 10px; color: #3157b7; background: #edf3ff; }
.confirm-dialog__icon--danger { color: #b42318; background: #fff0ee; }
.confirm-dialog__copy h2 { margin: 1px 0 7px; font-size: 18px; line-height: 1.3; }
.confirm-dialog__copy p { margin: 0; color: #5d6677; font-size: 14px; line-height: 1.55; }
.confirm-dialog footer { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
.confirm-dialog__button { min-height: 38px; padding: 0 16px; border: 1px solid #cfd6e2; border-radius: 8px; background: #fff; color: #263044; font: inherit; font-weight: 650; cursor: pointer; }
.confirm-dialog__button--primary { border-color: #3157b7; background: #3157b7; color: #fff; }
.confirm-dialog__button--danger { border-color: #b42318; background: #b42318; }
.confirm-dialog__button:focus-visible { outline: 3px solid rgb(49 87 183 / 25%); outline-offset: 2px; }
</style>
