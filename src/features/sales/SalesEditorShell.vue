<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { X } from '@lucide/vue'
import './sales-pages.css'

/** Full-page editor frame used by every Sales form: header, cards (default slot), sticky save bar, discard prompt. */
const props = defineProps<{ title: string; subtitle?: string; dirty: boolean; error?: string; saveLabel?: string }>()
const emit = defineEmits<{ save: []; close: [] }>()

const discardDialog = ref<HTMLDialogElement | null>(null)

function requestClose() {
  if (props.dirty) discardDialog.value?.showModal()
  else emit('close')
}

// Ctrl+S saves, matching how people expect a full-page form to behave.
function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    emit('save')
  }
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section class="sales-page sales-editor" :aria-labelledby="'sales-editor-title'">
    <header class="sales-editor__header">
      <div>
        <h2 id="sales-editor-title">{{ title }}</h2>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <button class="sales-editor__close" type="button" aria-label="Close" @click="requestClose"><X :size="20" aria-hidden="true" /></button>
    </header>
    <slot name="before" />
    <form class="sales-editor__form" novalidate @submit.prevent="emit('save')">
      <slot />
      <div class="sales-editor__actions">
        <slot name="extra-actions" />
        <p v-if="error" class="sales-editor__error" role="alert">{{ error }}</p>
        <button class="sales-button" type="button" @click="requestClose">Cancel</button>
        <button class="sales-button sales-button--primary" type="submit">{{ saveLabel ?? 'Save' }}</button>
      </div>
    </form>

    <dialog ref="discardDialog" class="sales-dialog sales-dialog--small" aria-labelledby="sales-editor-discard-title">
      <div class="sales-dialog__header"><h2 id="sales-editor-discard-title">Discard changes?</h2></div>
      <p class="sales-dialog__body">Do you really want to close without saving your changes?</p>
      <div class="sales-dialog__footer">
        <button class="sales-button" type="button" @click="discardDialog?.close()">Keep editing</button>
        <button class="sales-button sales-button--danger" type="button" @click="emit('close')">Discard</button>
      </div>
    </dialog>
  </section>
</template>
