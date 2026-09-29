<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import { formatJournalAmount, formatJournalDate, type PurchaseJournalEntry } from './purchaseJournalData'

const props = defineProps<{ entry: PurchaseJournalEntry | null }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)

watch(() => props.entry, async (entry) => {
  await nextTick()
  if (entry && !dialog.value?.open) dialog.value?.showModal()
  if (!entry && dialog.value?.open) dialog.value.close()
}, { immediate: true })

function closeOnBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="journal-detail" aria-label="Purchase journal details" @cancel.prevent="emit('close')" @click="closeOnBackdrop">
      <div v-if="entry" class="journal-detail__panel">
        <header class="journal-detail__header">
          <div>
            <span class="journal-detail__eyebrow">Purchase Journal</span>
            <h2>{{ entry.journalNumber || entry.referenceNumber }}</h2>
          </div>
          <button class="icon-button" type="button" aria-label="Close details" @click="emit('close')"><X :size="19" aria-hidden="true" /></button>
        </header>
        <div class="journal-detail__body">
          <p class="journal-detail__note">Sample entry for the frontend preview.</p>
          <dl>
            <div><dt>Invoice / Receipt #</dt><dd>{{ entry.referenceNumber }}</dd></div>
            <div><dt>Date</dt><dd>{{ formatJournalDate(entry.date) }}</dd></div>
            <div><dt>Payee</dt><dd>{{ entry.payee }}</dd></div>
            <div><dt>Total amount</dt><dd>{{ formatJournalAmount(entry.amountCents) }}</dd></div>
            <div><dt>Status</dt><dd>{{ entry.status }}</dd></div>
            <div><dt>Remarks</dt><dd>{{ entry.remarks }}</dd></div>
            <div><dt>Created By</dt><dd>{{ entry.createdBy }}</dd></div>
          </dl>
        </div>
        <footer class="journal-detail__footer">
          <button class="journal-button journal-button--secondary" type="button" @click="emit('close')">Close</button>
        </footer>
      </div>
    </dialog>
  </Teleport>
</template>
