<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Plus, Trash2, X } from '@lucide/vue'
import AppDatePicker from '../../../components/ui/AppDatePicker.vue'
import AppSelect, { type SelectOption } from '../../../components/ui/AppSelect.vue'
import { toIsoDate } from '../../../components/ui/dateUtils'
import { useCollections } from '../../../services/collectionStore'
import { accountStore, accounts } from '../setup/accountSetupData'
import { amountInCents, validateJournalDraft, type JournalDraftInput } from './journalDraft'
import { formatJournalAmount } from './purchaseJournalData'
import type { JournalPreviewEntry } from './journalPreviewData'

const props = withDefaults(defineProps<{ open: boolean; entry: JournalPreviewEntry | null; nextJournalNumber: string; busy?: boolean; serverError?: string }>(), { busy: false, serverError: '' })
useCollections(accountStore)
const emit = defineEmits<{ close: []; save: [entry: JournalPreviewEntry] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const error = ref('')
const activeAccounts = computed(() => accounts.value.filter((account) => account.active))
const accountOptions = computed<SelectOption[]>(() => activeAccounts.value.map((account) => ({
  value: account.id,
  label: `${account.code} · ${account.name}`,
})))
const journalTypeOptions: SelectOption[] = [
  { value: 'Adjusting Entry', label: 'Adjusting Entry' },
  { value: 'Reversing Entry', label: 'Reversing Entry' },
  { value: 'Beginning Balance', label: 'Beginning Balance' },
  { value: 'Closing Entry', label: 'Closing Entry' },
]

function blankLine() {
  return { accountId: '', debit: '', credit: '', remarks: '' }
}

function blankDraft(): JournalDraftInput {
  return {
    journalNumber: props.nextJournalNumber, journalType: '', date: toIsoDate(new Date()), remarks: '',
    lines: [blankLine(), blankLine()],
  }
}

const draft = ref<JournalDraftInput>(blankDraft())
const totals = computed(() => draft.value.lines.reduce((result, line) => ({
  debitCents: result.debitCents + (amountInCents(line.debit) ?? 0),
  creditCents: result.creditCents + (amountInCents(line.credit) ?? 0),
}), { debitCents: 0, creditCents: 0 }))

watch(() => [props.open, props.entry, props.nextJournalNumber] as const, async () => {
  if (!props.open) {
    if (dialog.value?.open) dialog.value.close()
    return
  }
  draft.value = props.entry ? {
    journalNumber: props.entry.journalNumber,
    journalType: props.entry.journalType ?? '',
    date: props.entry.date,
    remarks: props.entry.remarks,
    lines: props.entry.lines.map((line) => ({
      accountId: line.accountId,
      debit: line.debitCents ? formatJournalAmount(line.debitCents).replaceAll(',', '') : '',
      credit: line.creditCents ? formatJournalAmount(line.creditCents).replaceAll(',', '') : '',
      remarks: line.remarks ?? '',
    })),
  } : blankDraft()
  error.value = ''
  await nextTick()
  if (!dialog.value?.open) dialog.value?.showModal()
}, { immediate: true })

function save() {
  if (props.busy) return
  const result = validateJournalDraft(draft.value, props.entry ?? undefined)
  if (!result.entry) {
    error.value = result.error ?? 'Check the journal entry.'
    return
  }
  emit('save', result.entry)
}

function onBackdropClick(event: MouseEvent) {
  if (!props.busy && event.target === dialog.value) emit('close')
}
</script>

<template>
  <dialog ref="dialog" class="journal-editor" aria-label="General Journal draft" @cancel.prevent="!busy && emit('close')" @click="onBackdropClick">
    <form class="journal-editor__form" @submit.prevent="save">
      <header class="journal-editor__header">
        <div><h2>{{ entry ? 'Edit General Journal draft' : 'New General Journal draft' }}</h2><p>Draft entries affect your financial statements only after posting.</p></div>
        <button class="icon-button" type="button" aria-label="Close draft editor" :disabled="busy" @click="emit('close')"><X :size="18" /></button>
      </header>
      <fieldset class="journal-editor__body" :disabled="busy">
        <div class="journal-editor__fields">
          <label>GJ #<input v-model="draft.journalNumber" type="text" readonly aria-readonly="true" /></label>
          <AppSelect id="general-journal-type" v-model="draft.journalType" label="General Journal type" required placeholder="Choose journal type" :options="journalTypeOptions" :invalid="Boolean(error && !draft.journalType)" />
          <AppDatePicker id="general-journal-entry-date" v-model="draft.date" label="Date" required :invalid="Boolean(error && !draft.date)" />
          <label class="journal-editor__remarks">Remarks<textarea v-model="draft.remarks" rows="2" maxlength="240" /></label>
        </div>
        <div class="journal-editor__lines-heading"><h3>Debit and credit lines</h3><span>Enter one side per line</span></div>
        <div class="journal-editor__lines">
          <div v-for="(line, index) in draft.lines" :key="index" class="journal-editor__line">
            <AppSelect :id="`general-journal-account-${index}`" v-model="line.accountId" label="Account" required placeholder="Choose account" :options="accountOptions" :invalid="Boolean(error && !line.accountId)" />
            <label>Debit<input v-model="line.debit" type="text" inputmode="decimal" placeholder="0.00" /></label>
            <label>Credit<input v-model="line.credit" type="text" inputmode="decimal" placeholder="0.00" /></label>
            <label>Remarks<input v-model="line.remarks" type="text" maxlength="160" placeholder="Optional line note" /></label>
            <button class="icon-button" type="button" :aria-label="`Remove line ${index + 1}`" :disabled="draft.lines.length <= 2" @click="draft.lines.splice(index, 1)"><Trash2 :size="16" /></button>
          </div>
        </div>
        <button class="journal-button journal-button--secondary" type="button" @click="draft.lines.push(blankLine())"><Plus :size="15" /> Add line</button>
        <div class="journal-editor__totals"><span>Totals</span><span>Debit {{ formatJournalAmount(totals.debitCents) }}</span><span>Credit {{ formatJournalAmount(totals.creditCents) }}</span></div>
        <p v-if="error" class="journal-date-filter__error" role="alert">{{ error }}</p>
      </fieldset>
      <p v-if="serverError" class="journal-editor__error" role="alert">{{ serverError }}</p>
      <footer class="journal-editor__footer"><button class="journal-button journal-button--secondary" type="button" :disabled="busy" @click="emit('close')">Cancel</button><button class="journal-button journal-button--primary" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save draft' }}</button></footer>
    </form>
  </dialog>
</template>

<style scoped>fieldset.journal-editor__body { margin: 0; border: 0; min-width: 0; }</style>
