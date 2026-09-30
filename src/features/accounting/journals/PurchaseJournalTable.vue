<script setup lang="ts">
import { ArrowUpRight, SearchX } from '@lucide/vue'
import { computed } from 'vue'
import { formatJournalAmount, formatJournalDate, type PurchaseJournalEntry } from './purchaseJournalData'

const props = defineProps<{
  entries: PurchaseJournalEntry[]
  selectedIds: string[]
  reviewMode: boolean
}>()

const emit = defineEmits<{
  toggle: [id: string]
  toggleAll: []
  open: [entry: PurchaseJournalEntry]
  reset: []
}>()

const allSelected = computed(() => props.entries.length > 0 && props.entries.every((entry) => props.selectedIds.includes(entry.id)))
const someSelected = computed(() => props.entries.some((entry) => props.selectedIds.includes(entry.id)))
const totalAmountCents = computed(() => props.entries.reduce((total, entry) => total + entry.amountCents, 0))
</script>

<template>
  <div class="journal-results">
    <p class="journal-results__mobile-hint">Swipe the table to see payee and amount.</p>
    <div class="journal-results__scroll">
      <table class="journal-table">
        <colgroup>
          <col class="journal-table__col-check" /><col class="journal-table__col-number" />
          <col class="journal-table__col-reference" /><col class="journal-table__col-date" />
          <col class="journal-table__col-payee" /><col class="journal-table__col-amount" />
          <col class="journal-table__col-status" /><col class="journal-table__col-remarks" />
          <col class="journal-table__col-created" />
        </colgroup>
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
            <th scope="col" class="journal-table__amount">Total Amount</th>
            <th scope="col">Status</th>
            <th scope="col">Remarks</th>
            <th scope="col">Created By</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.id" :class="{ 'journal-table__row--selected': selectedIds.includes(entry.id) }">
            <td class="journal-table__check">
              <input
                type="checkbox"
                :aria-label="`Select ${entry.referenceNumber}`"
                :checked="selectedIds.includes(entry.id)"
                :disabled="!reviewMode"
                @click.stop
                @change="emit('toggle', entry.id)"
              />
            </td>
            <td class="journal-table__journal-number">{{ entry.journalNumber }}</td>
            <td>
              <button class="journal-table__reference" type="button" :aria-label="`View ${entry.referenceNumber}`" @click="emit('open', entry)">
                {{ entry.referenceNumber }} <ArrowUpRight :size="13" aria-hidden="true" />
              </button>
            </td>
            <td class="journal-table__date">{{ formatJournalDate(entry.date) }}</td>
            <td><span class="journal-table__truncate" :title="entry.payee">{{ entry.payee }}</span></td>
            <td class="journal-table__amount">{{ formatJournalAmount(entry.amountCents) }}</td>
            <td><span class="journal-table__status">{{ entry.status }}</span></td>
            <td><span class="journal-table__truncate" :title="entry.remarks">{{ entry.remarks }}</span></td>
            <td>{{ entry.createdBy }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!entries.length" class="journal-empty" role="status">
        <SearchX :size="25" :stroke-width="1.5" aria-hidden="true" />
        <strong>No journal entries found</strong>
        <p>Try another date range or search term.</p>
        <button type="button" @click="emit('reset')">Reset filters</button>
      </div>
      <div class="journal-results__footer" role="status">
        <span class="journal-results__count"><span class="journal-results__sr-only">Entries: </span>{{ entries.length }}</span>
        <span class="journal-results__total"><span class="journal-results__sr-only">Total amount: </span>{{ formatJournalAmount(totalAmountCents) }}</span>
        <span v-if="reviewMode" class="journal-results__selection">{{ selectedIds.length }} selected</span>
      </div>
    </div>
  </div>
</template>
