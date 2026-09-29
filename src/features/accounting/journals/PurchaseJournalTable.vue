<script setup lang="ts">
import { ArrowUpRight, SearchX } from '@lucide/vue'
import { computed } from 'vue'
import { formatJournalDate, formatPesos, type PurchaseJournalEntry } from './purchaseJournalData'

const props = defineProps<{
  entries: PurchaseJournalEntry[]
  selectedIds: string[]
  reviewMode: boolean
  totalCount: number
}>()

const emit = defineEmits<{
  toggle: [id: string]
  toggleAll: []
  open: [entry: PurchaseJournalEntry]
  reset: []
}>()

const allSelected = computed(() => props.entries.length > 0 && props.entries.every((entry) => props.selectedIds.includes(entry.id)))
const someSelected = computed(() => props.entries.some((entry) => props.selectedIds.includes(entry.id)))
</script>

<template>
  <div class="journal-results">
    <p class="journal-results__mobile-hint">Swipe the table to see payee and amount.</p>
    <div class="journal-results__scroll">
      <table class="journal-table">
        <thead>
          <tr>
            <th class="journal-table__check">
              <input
                type="checkbox"
                aria-label="Select all visible entries"
                :checked="allSelected"
                :indeterminate="someSelected && !allSelected"
                :disabled="!reviewMode || !entries.length"
                @change="emit('toggleAll')"
              />
            </th>
            <th scope="col">PJ #</th>
            <th scope="col">Invoice / Receipt #</th>
            <th scope="col">Date</th>
            <th scope="col">Payee</th>
            <th scope="col" class="journal-table__amount">Total amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.id" :class="{ 'journal-table__row--selected': selectedIds.includes(entry.id) }">
            <td class="journal-table__check">
              <input
                type="checkbox"
                :aria-label="`Select ${entry.journalNumber}`"
                :checked="selectedIds.includes(entry.id)"
                :disabled="!reviewMode"
                @change="emit('toggle', entry.id)"
              />
            </td>
            <td>
              <button class="journal-table__reference" type="button" :aria-label="`View ${entry.journalNumber}`" @click="emit('open', entry)">
                {{ entry.journalNumber }} <ArrowUpRight :size="13" aria-hidden="true" />
              </button>
            </td>
            <td>{{ entry.referenceNumber }}</td>
            <td class="journal-table__date">{{ formatJournalDate(entry.date) }}</td>
            <td>{{ entry.payee }}</td>
            <td class="journal-table__amount">{{ formatPesos(entry.amountCents) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!entries.length" class="journal-empty" role="status">
        <SearchX :size="25" :stroke-width="1.5" aria-hidden="true" />
        <strong>No journal entries found</strong>
        <p>Try another date range or search term.</p>
        <button type="button" @click="emit('reset')">Reset filters</button>
      </div>
    </div>
    <div class="journal-results__footer">
      <span>Showing {{ entries.length }} of {{ totalCount }} sample entries</span>
      <span v-if="reviewMode">{{ selectedIds.length }} selected</span>
    </div>
  </div>
</template>
