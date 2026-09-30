<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CalendarDays, Search } from '@lucide/vue'
import { z } from 'zod'
import AppDatePicker from '../../../components/ui/AppDatePicker.vue'
import PurchaseJournalDetail from './PurchaseJournalDetail.vue'
import PurchaseJournalTable from './PurchaseJournalTable.vue'
import { sampleJournalRange, samplePurchaseJournalEntries, type PurchaseJournalEntry } from './purchaseJournalData'
import './purchaseJournal.css'

const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid start date.'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid end date.'),
}).refine((range) => range.from <= range.to, { message: 'The end date must be on or after the start date.', path: ['to'] })

const initialRange = sampleJournalRange()
const fromDate = ref(initialRange.from)
const toDate = ref(initialRange.to)
const appliedRange = ref({ ...initialRange })
const dateError = ref('')
const searchTerm = ref('')
const reviewMode = ref(false)
const filtersOpen = ref(false)
const filterControl = ref<HTMLElement | null>(null)
const filterButton = ref<HTMLButtonElement | null>(null)
const selectedIds = ref<string[]>([])
const activeEntry = computed<PurchaseJournalEntry | null>(() => {
  const id = selectedIds.value.at(-1)
  return entries.value.find((entry) => entry.id === id) ?? null
})

const entries = computed(() => {
  const query = searchTerm.value.trim().toLocaleLowerCase()
  return samplePurchaseJournalEntries.filter((entry) => {
    const inRange = entry.date >= appliedRange.value.from && entry.date <= appliedRange.value.to
    const matches = !query || [entry.journalNumber, entry.referenceNumber, entry.payee, entry.status, entry.remarks, entry.createdBy]
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
  nextTick(() => filterButton.value?.focus())
}

function restoreDefaultRange() {
  const range = sampleJournalRange()
  fromDate.value = range.from
  toDate.value = range.to
  appliedRange.value = range
  dateError.value = ''
  selectedIds.value = []
}

function resetFilters() {
  restoreDefaultRange()
  searchTerm.value = ''
  filtersOpen.value = false
}

function resetDateRange() {
  restoreDefaultRange()
  filtersOpen.value = false
  nextTick(() => filterButton.value?.focus())
}

function onOutsidePointer(event: PointerEvent) {
  const target = event.target
  if (!filtersOpen.value || !(target instanceof Node)) return
  if (filterControl.value?.contains(target)) return
  if (target instanceof Element && target.closest('.ui-date-picker__panel')) return
  filtersOpen.value = false
}

function onFilterKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !filtersOpen.value) return
  filtersOpen.value = false
  filterButton.value?.focus()
}

onMounted(() => {
  document.addEventListener('pointerdown', onOutsidePointer)
  document.addEventListener('keydown', onFilterKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsidePointer)
  document.removeEventListener('keydown', onFilterKeydown)
})

function toggleSelection(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((selectedId) => selectedId !== id)
    : [...selectedIds.value, id]
}

function openEntry(entry: PurchaseJournalEntry) {
  reviewMode.value = true
  selectedIds.value = [...selectedIds.value.filter((id) => id !== entry.id), entry.id]
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
        <h1 class="journal-page__title">Purchase Journal</h1>
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
        <div ref="filterControl" class="journal-date-control">
          <button ref="filterButton" class="journal-button journal-button--secondary journal-date-control__toggle" type="button"
            :aria-expanded="filtersOpen" aria-controls="journal-date-filter"
            :aria-label="`Date range: ${appliedRange.from} to ${appliedRange.to}`" title="Date range"
            @click="filtersOpen = !filtersOpen">
            <CalendarDays :size="17" aria-hidden="true" />
            <span class="journal-date-control__indicator" aria-hidden="true" />
          </button>
          <div v-if="filtersOpen" id="journal-date-filter" class="journal-date-filter" role="group" aria-label="Date range filters">
            <div class="journal-date-filter__heading"><CalendarDays :size="17" aria-hidden="true" /><h2>Date range</h2></div>
            <form @submit.prevent="loadRange">
              <AppDatePicker id="journal-from" v-model="fromDate" label="From" required :invalid="Boolean(dateError)" />
              <AppDatePicker id="journal-to" v-model="toDate" label="To" required :invalid="Boolean(dateError)" />
              <p v-if="dateError" class="journal-date-filter__error" role="alert">{{ dateError }}</p>
              <div class="journal-date-filter__actions">
                <button class="journal-button journal-button--secondary" type="button" @click="resetDateRange">Reset</button>
                <button class="journal-button journal-button--primary" type="submit">Apply dates</button>
              </div>
            </form>
          </div>
        </div>
        <button class="journal-button journal-button--primary" type="button" disabled title="Journal transfers are not available in this frontend preview.">Move to CDJ</button>
      </div>
    </div>

    <div class="journal-workarea" :class="{ 'journal-workarea--review': reviewMode }">
      <PurchaseJournalTable
        :entries="entries"
        :selected-ids="selectedIds"
        :review-mode="reviewMode"
        @toggle="toggleSelection"
        @toggle-all="toggleAll"
        @open="openEntry"
        @reset="resetFilters"
      />
      <PurchaseJournalDetail v-if="reviewMode" :entry="activeEntry" />
    </div>
  </section>
</template>
