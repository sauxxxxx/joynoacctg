<script setup lang="ts">
import { computed } from 'vue'
import type { JournalPreviewConfig, JournalPreviewEntry, JournalPreviewKind } from './journalPreviewData'
import { formatJournalAmount, formatJournalDate } from './purchaseJournalData'

const props = defineProps<{
  kind: JournalPreviewKind
  config: JournalPreviewConfig
  entries: JournalPreviewEntry[]
  selectedIds: string[]
  reviewMode: boolean
  filtered: boolean
  canCreate?: boolean
}>()
const emit = defineEmits<{
  toggle: [id: string]
  toggleAll: []
  open: [entry: JournalPreviewEntry]
  reset: []
  add: []
}>()
const allSelected = computed(() => props.entries.length > 0 && props.entries.every((entry) => props.selectedIds.includes(entry.id)))
const someSelected = computed(() => props.entries.some((entry) => props.selectedIds.includes(entry.id)))
const totalCents = computed(() => props.entries.reduce((sum, entry) => sum + entry.amountCents, 0))
</script>

<template>
  <div class="journal-results journal-preview-results" :class="{ 'journal-preview-results--general': kind === 'general-journal' }">
    <div class="journal-results__scroll">
      <table class="journal-table journal-preview-table">
        <colgroup>
          <col class="journal-preview-table__check" /><col class="journal-preview-table__number" />
          <col class="journal-preview-table__reference" /><col class="journal-preview-table__date" />
          <col v-if="config.partyLabel" class="journal-preview-table__party" />
          <col class="journal-preview-table__amount" /><col class="journal-preview-table__status" />
          <col class="journal-preview-table__remarks" /><col class="journal-preview-table__created" />
        </colgroup>
        <thead><tr>
          <th class="journal-table__check"><input type="checkbox" aria-label="Select all visible entries" :checked="allSelected" :indeterminate="someSelected && !allSelected" :disabled="!reviewMode || !entries.length" @change="emit('toggleAll')" /></th>
          <th scope="col">{{ config.numberLabel }}</th>
          <th scope="col">Invoice / Receipt #</th>
          <th scope="col">Date</th>
          <th v-if="config.partyLabel" scope="col">{{ config.partyLabel }}</th>
          <th scope="col" class="journal-table__amount">Total Amount</th>
          <th scope="col">Status</th>
          <th scope="col">Remarks</th>
          <th scope="col">Created By</th>
        </tr></thead>
        <tbody><tr v-for="entry in entries" :key="entry.id" :class="{ 'journal-table__row--selected': selectedIds.includes(entry.id) }">
          <td class="journal-table__check"><input type="checkbox" :aria-label="`Select ${entry.referenceNumber || entry.journalNumber}`" :checked="selectedIds.includes(entry.id)" :disabled="!reviewMode" @change="emit('toggle', entry.id)" /></td>
          <td>{{ entry.journalNumber }}</td>
          <td><button class="journal-table__reference" type="button" :aria-label="`View ${entry.referenceNumber || entry.journalNumber}`" @click="emit('open', entry)">{{ entry.referenceNumber || '—' }}</button></td>
          <td class="journal-table__date">{{ formatJournalDate(entry.date) }}</td>
          <td v-if="config.partyLabel"><span class="journal-table__truncate" :title="entry.party">{{ entry.party }}</span></td>
          <td class="journal-table__amount">{{ formatJournalAmount(entry.amountCents) }}</td>
          <td><span :class="entry.status === 'Posted' ? 'journal-table__status' : 'journal-preview-table__draft'">{{ entry.status }}</span></td>
          <td><span class="journal-table__truncate" :title="entry.remarks">{{ entry.remarks }}</span></td>
          <td>{{ entry.createdBy }}</td>
        </tr></tbody>
      </table>
      <div v-if="!entries.length" class="journal-preview-empty" role="status">
        <strong>{{ filtered ? 'No matching journal entries' : 'No rows to show' }}</strong>
        <p v-if="kind === 'general-journal' && !filtered">No General Journal drafts on this page yet.</p>
        <p v-else-if="!filtered">No journal entries in this period.</p>
        <p v-else>Try another search term or date range.</p>
        <button v-if="filtered" class="journal-button journal-button--secondary" type="button" @click="emit('reset')">Reset filters</button>
        <button v-else-if="kind === 'general-journal' && canCreate" class="journal-button journal-button--secondary" type="button" @click="emit('add')">Add draft</button>
      </div>
      <div class="journal-preview-footer" role="status">
        <span><span class="journal-results__sr-only">Entries: </span>{{ entries.length }}</span>
        <span class="journal-preview-footer__total"><span class="journal-results__sr-only">Total amount: </span>{{ formatJournalAmount(totalCents) }}</span>
        <span v-if="reviewMode" class="journal-preview-footer__selected">{{ selectedIds.length }} selected</span>
      </div>
    </div>
  </div>
</template>
