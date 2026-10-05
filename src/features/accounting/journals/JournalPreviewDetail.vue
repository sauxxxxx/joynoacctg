<script setup lang="ts">
import { computed } from 'vue'
import type { JournalPreviewEntry } from './journalPreviewData'
import { formatJournalAmount, journalLineTotals } from './purchaseJournalData'
import { accountName } from '../setup/accountSetupData'

const props = defineProps<{ entry: JournalPreviewEntry | null; editable?: boolean }>()
const emit = defineEmits<{ edit: [entry: JournalPreviewEntry] }>()
const totals = computed(() => journalLineTotals(props.entry?.lines ?? []))
const balanced = computed(() => totals.value.debitCents === totals.value.creditCents)
</script>

<template>
  <section class="journal-detail" aria-label="Journal accounting lines">
    <template v-if="entry">
      <div class="journal-detail__heading">
        <span :title="entry.referenceNumber || entry.journalNumber">{{ entry.referenceNumber || `GJ #${entry.journalNumber}` }}<template v-if="entry.journalType"> · {{ entry.journalType }}</template></span>
        <span v-if="entry.lines.length" :class="{ 'journal-detail__balance--error': !balanced }">{{ balanced ? 'Balanced' : 'Out of balance' }}</span>
      </div>
      <div v-if="entry.lines.length" class="journal-detail__scroll">
        <table>
          <colgroup>
            <col class="journal-detail__col-account" /><col class="journal-detail__col-subsidiary" />
            <col class="journal-detail__col-debit" /><col class="journal-detail__col-credit" />
            <col class="journal-detail__col-remarks" />
          </colgroup>
          <thead><tr><th scope="col">Account</th><th scope="col">Subsidiary</th><th scope="col">Debit</th><th scope="col">Credit</th><th scope="col">Remarks</th></tr></thead>
          <tbody><tr v-for="(line, index) in entry.lines" :key="index">
            <td>{{ accountName(line.accountId) }}</td><td>{{ line.subsidiary || '' }}</td>
            <td class="journal-detail__amount">{{ formatJournalAmount(line.debitCents) }}</td>
            <td class="journal-detail__amount">{{ formatJournalAmount(line.creditCents) }}</td>
            <td>{{ line.remarks || '' }}</td>
          </tr></tbody>
        </table>
      </div>
      <p v-else class="journal-detail__empty">Accounting lines were not shown for this reference sample.</p>
      <div v-if="editable && entry.status === 'Draft'" class="journal-preview-detail__actions">
        <button class="journal-button journal-button--secondary" type="button" @click="emit('edit', entry)">Edit draft</button>
      </div>
    </template>
    <p v-else class="journal-detail__empty">Select a journal entry to view its accounting lines.</p>
  </section>
</template>
