<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Plus, Trash2, X } from '@lucide/vue'
import AppDatePicker from '../../../components/ui/AppDatePicker.vue'
import { toIsoDate } from '../../../components/ui/dateUtils'
import { amountInCents, validateJournalDraft, type JournalDraftInput } from './journalDraft'
import { formatJournalAmount } from './purchaseJournalData'
import type { JournalPreviewEntry } from './journalPreviewData'

const props = defineProps<{ open: boolean; entry: JournalPreviewEntry | null }>()
const emit = defineEmits<{ close: []; save: [entry: JournalPreviewEntry] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const error = ref('')

function blankDraft(): JournalDraftInput {
  return {
    date: toIsoDate(new Date()), referenceNumber: '', remarks: '',
    lines: [{ accountName: '', debit: '', credit: '' }, { accountName: '', debit: '', credit: '' }],
  }
}

const draft = ref<JournalDraftInput>(blankDraft())
const totals = computed(() => draft.value.lines.reduce((result, line) => ({
  debitCents: result.debitCents + (amountInCents(line.debit) ?? 0),
  creditCents: result.creditCents + (amountInCents(line.credit) ?? 0),
}), { debitCents: 0, creditCents: 0 }))

watch(() => [props.open, props.entry] as const, async () => {
  if (!props.open) {
    if (dialog.value?.open) dialog.value.close()
    return
  }
  draft.value = props.entry ? {
    date: props.entry.date, referenceNumber: props.entry.referenceNumber, remarks: props.entry.remarks,
    lines: props.entry.lines.map((line) => ({
      accountName: line.accountName,
      debit: line.debitCents ? formatJournalAmount(line.debitCents).replaceAll(',', '') : '',
      credit: line.creditCents ? formatJournalAmount(line.creditCents).replaceAll(',', '') : '',
    })),
  } : blankDraft()
  error.value = ''
  await nextTick()
  if (!dialog.value?.open) dialog.value?.showModal()
}, { immediate: true })

function save() {
  const result = validateJournalDraft(draft.value, props.entry ?? undefined)
  if (!result.entry) {
    error.value = result.error ?? 'Check the journal entry.'
    return
  }
  emit('save', result.entry)
  emit('close')
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('close')
}
</script>

<template>
  <dialog ref="dialog" class="journal-editor" aria-label="General Journal draft" @cancel.prevent="emit('close')" @click="onBackdropClick">
    <form class="journal-editor__form" @submit.prevent="save">
      <header class="journal-editor__header">
        <div><h2>{{ entry ? 'Edit draft' : 'New General Journal draft' }}</h2><p>Temporary preview · Drafts disappear when you leave this page. Nothing is posted.</p></div>
        <button class="icon-button" type="button" aria-label="Close draft editor" @click="emit('close')"><X :size="18" /></button>
      </header>
      <div class="journal-editor__body">
        <div class="journal-editor__fields">
          <AppDatePicker id="general-journal-entry-date" v-model="draft.date" label="Date" required :invalid="Boolean(error)" />
          <label>Reference #<input v-model="draft.referenceNumber" type="text" maxlength="80" required /></label>
          <label>Description<input v-model="draft.remarks" type="text" maxlength="240" /></label>
        </div>
        <div class="journal-editor__lines-heading"><h3>Debit and credit lines</h3><span>Enter one side per line</span></div>
        <div class="journal-editor__lines">
          <div v-for="(line, index) in draft.lines" :key="index" class="journal-editor__line">
            <label>Account<input v-model="line.accountName" type="text" placeholder="Account name" required /></label>
            <label>Debit<input v-model="line.debit" type="text" inputmode="decimal" placeholder="0.00" /></label>
            <label>Credit<input v-model="line.credit" type="text" inputmode="decimal" placeholder="0.00" /></label>
            <button class="icon-button" type="button" :aria-label="`Remove line ${index + 1}`" :disabled="draft.lines.length <= 2" @click="draft.lines.splice(index, 1)"><Trash2 :size="16" /></button>
          </div>
        </div>
        <button class="journal-button journal-button--secondary" type="button" @click="draft.lines.push({ accountName: '', debit: '', credit: '' })"><Plus :size="15" /> Add line</button>
        <div class="journal-editor__totals"><span>Totals</span><span>Debit {{ formatJournalAmount(totals.debitCents) }}</span><span>Credit {{ formatJournalAmount(totals.creditCents) }}</span></div>
        <p v-if="error" class="journal-date-filter__error" role="alert">{{ error }}</p>
      </div>
      <footer class="journal-editor__footer">
        <button class="journal-button journal-button--secondary" type="button" @click="emit('close')">Cancel</button>
        <button class="journal-button journal-button--primary" type="submit">Save draft</button>
      </footer>
    </form>
  </dialog>
</template>
