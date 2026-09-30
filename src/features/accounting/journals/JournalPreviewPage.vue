<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CalendarDays, Plus, Search } from '@lucide/vue'
import { z } from 'zod'
import AppDatePicker from '../../../components/ui/AppDatePicker.vue'
import GeneralJournalEditor from './GeneralJournalEditor.vue'
import JournalPreviewDetail from './JournalPreviewDetail.vue'
import JournalPreviewTable from './JournalPreviewTable.vue'
import { journalPreviewConfigs, type JournalPreviewEntry, type JournalPreviewKind } from './journalPreviewData'
import { sampleJournalRange } from './purchaseJournalData'
import './purchaseJournal.css'
import './journalPreview.css'

const props = defineProps<{ kind: JournalPreviewKind }>()
const config = computed(() => journalPreviewConfigs[props.kind])
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
const drafts = ref<JournalPreviewEntry[]>([])
const editorOpen = ref(false)
const editingEntry = ref<JournalPreviewEntry | null>(null)
const nextGeneralJournalNumber = computed(() => {
  const numbers = [...config.value.entries, ...drafts.value]
    .map((entry) => Number(entry.journalNumber))
    .filter(Number.isFinite)
  return String(Math.max(0, ...numbers) + 1)
})

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid start date.'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid end date.'),
}).refine((range) => range.from <= range.to, { message: 'The end date must be on or after the start date.', path: ['to'] })

const entries = computed(() => {
  const query = searchTerm.value.trim().toLocaleLowerCase()
  return [...config.value.entries, ...drafts.value]
    .filter((entry) => entry.date >= appliedRange.value.from && entry.date <= appliedRange.value.to)
    .filter((entry) => !query || [entry.journalNumber, entry.referenceNumber, entry.party, entry.status, entry.remarks, entry.createdBy]
      .some((value) => value.toLocaleLowerCase().includes(query)))
})
const activeEntry = computed(() => entries.value.find((entry) => entry.id === selectedIds.value.at(-1)) ?? null)
const filtered = computed(() => Boolean(searchTerm.value.trim()) || appliedRange.value.from !== initialRange.from || appliedRange.value.to !== initialRange.to)

watch(entries, (visible) => {
  const ids = new Set(visible.map((entry) => entry.id))
  selectedIds.value = selectedIds.value.filter((id) => ids.has(id))
})
watch(reviewMode, (enabled) => { if (!enabled) selectedIds.value = [] })

function loadRange() {
  const result = rangeSchema.safeParse({ from: fromDate.value, to: toDate.value })
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

function resetFilters() {
  fromDate.value = initialRange.from
  toDate.value = initialRange.to
  appliedRange.value = { ...initialRange }
  dateError.value = ''
  searchTerm.value = ''
  selectedIds.value = []
  filtersOpen.value = false
}

function onOutsidePointer(event: PointerEvent) {
  if (!filtersOpen.value || !(event.target instanceof Node)) return
  if (filterControl.value?.contains(event.target)) return
  if (event.target instanceof Element && event.target.closest('.ui-date-picker__panel')) return
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

function toggleAll() {
  const ids = entries.value.map((entry) => entry.id)
  selectedIds.value = ids.length && ids.every((id) => selectedIds.value.includes(id)) ? [] : ids
}

function openEntry(entry: JournalPreviewEntry) {
  reviewMode.value = true
  selectedIds.value = [...selectedIds.value.filter((id) => id !== entry.id), entry.id]
}

function openEditor(entry: JournalPreviewEntry | null = null) {
  editingEntry.value = entry
  editorOpen.value = true
}

function saveDraft(entry: JournalPreviewEntry) {
  const index = drafts.value.findIndex((draft) => draft.id === entry.id)
  if (index >= 0) drafts.value.splice(index, 1, entry)
  else drafts.value.push(entry)
  if (entry.date < appliedRange.value.from) appliedRange.value.from = entry.date
  if (entry.date > appliedRange.value.to) appliedRange.value.to = entry.date
  fromDate.value = appliedRange.value.from
  toDate.value = appliedRange.value.to
  searchTerm.value = ''
  reviewMode.value = true
  selectedIds.value = [entry.id]
}
</script>

<template>
  <section class="journal-page" :aria-label="config.label">
    <div class="journal-page__toolbar">
      <div class="journal-page__toolbar-left">
        <h1 class="journal-page__title">{{ config.label }}</h1>
        <label class="journal-switch"><input v-model="reviewMode" type="checkbox" /><span class="journal-switch__track" aria-hidden="true" /><span>Review mode</span></label>
        <span class="journal-page__preview">{{ kind === 'general-journal' ? 'Temporary drafts · Nothing is posted' : kind === 'cash-disbursement-journal' ? '2 reference samples · Nothing is saved' : 'Preview only · No records connected' }}</span>
      </div>
      <div class="journal-page__toolbar-right">
        <label class="journal-search"><Search :size="16" aria-hidden="true" /><input v-model="searchTerm" type="search" placeholder="Search journal entries..." :aria-label="`Search ${config.label.toLocaleLowerCase()} entries`" /></label>
        <div ref="filterControl" class="journal-date-control">
          <button ref="filterButton" class="journal-button journal-button--secondary journal-date-control__toggle" type="button"
            :aria-expanded="filtersOpen" :aria-controls="`${kind}-date-filter`" :aria-label="`Date range: ${appliedRange.from} to ${appliedRange.to}`" title="Date range"
            @click="filtersOpen = !filtersOpen"><CalendarDays :size="17" aria-hidden="true" /></button>
          <div v-if="filtersOpen" :id="`${kind}-date-filter`" class="journal-date-filter" role="group" aria-label="Date range filters">
            <div class="journal-date-filter__heading"><CalendarDays :size="17" aria-hidden="true" /><h2>Date range</h2></div>
            <form @submit.prevent="loadRange">
              <AppDatePicker :id="`${kind}-from`" v-model="fromDate" label="From" required :invalid="Boolean(dateError)" />
              <AppDatePicker :id="`${kind}-to`" v-model="toDate" label="To" required :invalid="Boolean(dateError)" />
              <p v-if="dateError" class="journal-date-filter__error" role="alert">{{ dateError }}</p>
              <div class="journal-date-filter__actions">
                <button class="journal-button journal-button--secondary" type="button" @click="resetFilters">Reset</button>
                <button class="journal-button journal-button--primary" type="submit">Apply dates</button>
              </div>
            </form>
          </div>
        </div>
        <template v-if="kind === 'general-journal'">
          <button class="journal-button journal-button--secondary" type="button" disabled title="Posting requires a connected accounting backend.">Post</button>
          <button class="journal-button journal-button--secondary" type="button" disabled title="Voiding requires a connected accounting backend.">Void</button>
          <button class="journal-button journal-button--secondary journal-preview__add" type="button" aria-label="Add General Journal draft" @click="openEditor()"><Plus :size="18" /></button>
        </template>
        <button v-else class="journal-button journal-button--primary" type="button" disabled title="Journal transfers require a connected accounting backend.">{{ config.transferLabel }}</button>
      </div>
    </div>
    <div class="journal-workarea journal-preview" :class="{ 'journal-workarea--review': reviewMode, 'journal-preview--review': reviewMode, 'journal-preview--general': kind === 'general-journal' }">
      <JournalPreviewTable :kind="kind" :config="config" :entries="entries" :selected-ids="selectedIds" :review-mode="reviewMode" :filtered="filtered"
        @toggle="toggleSelection" @toggle-all="toggleAll" @open="openEntry" @reset="resetFilters" @add="openEditor()" />
      <JournalPreviewDetail v-if="reviewMode" :entry="activeEntry" :editable="kind === 'general-journal'" @edit="openEditor" />
    </div>
    <GeneralJournalEditor v-if="kind === 'general-journal'" :open="editorOpen" :entry="editingEntry" :next-journal-number="nextGeneralJournalNumber" @save="saveDraft" @close="editorOpen = false" />
  </section>
</template>
