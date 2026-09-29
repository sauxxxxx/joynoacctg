<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CalendarDays, Filter, Search } from '@lucide/vue'
import { z } from 'zod'
import PurchaseJournalDetail from './PurchaseJournalDetail.vue'
import PurchaseJournalTable from './PurchaseJournalTable.vue'
import { currentMonthRange, samplePurchaseJournalEntries, type PurchaseJournalEntry } from './purchaseJournalData'
import './purchaseJournal.css'

const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid start date.'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid end date.'),
}).refine((range) => range.from <= range.to, { message: 'The end date must be on or after the start date.', path: ['to'] })

const initialRange = currentMonthRange()
const fromDate = ref(initialRange.from)
const toDate = ref(initialRange.to)
const appliedRange = ref({ ...initialRange })
const dateError = ref('')
const searchTerm = ref('')
const reviewMode = ref(false)
const filtersOpen = ref(false)
const selectedIds = ref<string[]>([])
const activeEntry = ref<PurchaseJournalEntry | null>(null)

const entries = computed(() => {
  const query = searchTerm.value.trim().toLocaleLowerCase()
  return samplePurchaseJournalEntries.filter((entry) => {
    const inRange = entry.date >= appliedRange.value.from && entry.date <= appliedRange.value.to
    const matches = !query || [entry.journalNumber, entry.referenceNumber, entry.payee]
      .some((value) => value.toLocaleLowerCase().includes(query))
    return inRange && matches
  })
})

watch(entries, (visible) => {
  const visibleIds = new Set(visible.map((entry) => entry.id))
  selectedIds.value = selectedIds.value.filter((id) => visibleIds.has(id))
})

watch(reviewMode, (enabled) => {
  if (!enabled) selectedIds.value = []
})

function loadRange() {
  const result = dateRangeSchema.safeParse({ from: fromDate.value, to: toDate.value })
  if (!result.success) {
    dateError.value = result.error.issues[0]?.message ?? 'Check the date range.'
    return
  }
  dateError.value = ''
  appliedRange.value = result.data
  selectedIds.value = []
  filtersOpen.value = false
}

function resetFilters() {
  const range = currentMonthRange()
  fromDate.value = range.from
  toDate.value = range.to
  appliedRange.value = range
  searchTerm.value = ''
  dateError.value = ''
  selectedIds.value = []
}

function toggleSelection(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((selectedId) => selectedId !== id)
    : [...selectedIds.value, id]
}

function toggleAll() {
  const visibleIds = entries.value.map((entry) => entry.id)
  const allSelected = visibleIds.every((id) => selectedIds.value.includes(id))
  selectedIds.value = allSelected ? [] : visibleIds
}
</script>

<template>
  <section class="journal-page" aria-label="Purchase Journal">
    <div class="journal-page__toolbar">
      <div class="journal-page__toolbar-left">
        <label class="journal-switch">
          <input v-model="reviewMode" type="checkbox" />
          <span class="journal-switch__track" aria-hidden="true" />
          <span>Review mode</span>
        </label>
        <span class="journal-page__preview">Preview only · Nothing is saved</span>
      </div>
      <div class="journal-page__toolbar-right">
        <label class="journal-search">
          <Search :size="16" aria-hidden="true" />
          <input v-model="searchTerm" type="search" placeholder="Search journal entries..." aria-label="Search purchase journal entries" />
        </label>
        <button class="journal-button journal-button--secondary journal-page__filter-toggle" type="button" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">
          <Filter :size="16" aria-hidden="true" /> Filters
        </button>
        <button class="journal-button journal-button--primary" type="button" disabled title="Journal transfers are not available in this frontend preview.">Move to CDJ</button>
      </div>
    </div>

    <div class="journal-workarea">
      <aside class="journal-filters" :class="{ 'journal-filters--open': filtersOpen }" aria-label="Date filters">
        <div class="journal-filters__heading"><CalendarDays :size="17" aria-hidden="true" /><h2>Date range</h2></div>
        <form @submit.prevent="loadRange">
          <label for="journal-from">From <span aria-hidden="true">*</span></label>
          <input id="journal-from" v-model="fromDate" type="date" required :aria-invalid="Boolean(dateError)" />
          <label for="journal-to">To <span aria-hidden="true">*</span></label>
          <input id="journal-to" v-model="toDate" type="date" required :aria-invalid="Boolean(dateError)" />
          <p v-if="dateError" class="journal-filters__error" role="alert">{{ dateError }}</p>
          <button class="journal-button journal-button--primary journal-filters__load" type="submit">Load</button>
        </form>
        <p class="journal-filters__hint">The table updates when you load a date range.</p>
      </aside>

      <PurchaseJournalTable
        :entries="entries"
        :selected-ids="selectedIds"
        :review-mode="reviewMode"
        :total-count="samplePurchaseJournalEntries.length"
        @toggle="toggleSelection"
        @toggle-all="toggleAll"
        @open="activeEntry = $event"
        @reset="resetFilters"
      />
    </div>
    <PurchaseJournalDetail :entry="activeEntry" @close="activeEntry = null" />
  </section>
</template>
