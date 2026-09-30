<script setup lang="ts">
import { computed } from 'vue'
import { formatJournalAmount, journalLineTotals, type PurchaseJournalEntry } from './purchaseJournalData'

const props = defineProps<{ entry: PurchaseJournalEntry | null }>()
const totals = computed(() => journalLineTotals(props.entry?.lines ?? []))
const balanced = computed(() => totals.value.debitCents === totals.value.creditCents)
</script>

<template>
  <section class="journal-detail" aria-label="Purchase journal accounting lines">
    <template v-if="entry">
      <div class="journal-detail__heading">
        <span :title="entry.referenceNumber">{{ entry.referenceNumber }}</span>
        <span :class="{ 'journal-detail__balance--error': !balanced }">{{ balanced ? 'Balanced' : 'Out of balance' }}</span>
      </div>
      <div class="journal-detail__scroll">
        <table>
          <colgroup>
            <col class="journal-detail__col-account" /><col class="journal-detail__col-subsidiary" />
            <col class="journal-detail__col-debit" /><col class="journal-detail__col-credit" />
            <col class="journal-detail__col-remarks" />
          </colgroup>
          <thead><tr><th scope="col">Account</th><th scope="col">Subsidiary</th><th scope="col">Debit</th><th scope="col">Credit</th><th scope="col">Remarks</th></tr></thead>
          <tbody>
            <tr v-for="(line, index) in entry.lines" :key="index">
              <td>{{ line.accountName }}</td>
              <td>{{ line.subsidiary || '' }}</td>
              <td class="journal-detail__amount">{{ formatJournalAmount(line.debitCents) }}</td>
              <td class="journal-detail__amount">{{ formatJournalAmount(line.creditCents) }}</td>
              <td>{{ line.remarks || '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <p v-else class="journal-detail__empty">Select a journal entry to view its accounting lines.</p>
  </section>
</template>
