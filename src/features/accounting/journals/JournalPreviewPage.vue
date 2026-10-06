<script setup lang="ts">
import AppDataState from '../../../components/ui/AppDataState.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CalendarDays, Plus, Search } from '@lucide/vue'
import { z } from 'zod'
import AppDatePicker from '../../../components/ui/AppDatePicker.vue'
import GeneralJournalEditor from './GeneralJournalEditor.vue'
import JournalPreviewDetail from './JournalPreviewDetail.vue'
import JournalPreviewTable from './JournalPreviewTable.vue'
import { journalPreviewConfigs, type JournalPreviewEntry, type JournalPreviewKind } from './journalPreviewData'
import { journalCollection } from './journalCollection'
import { http } from '../../../services/api/httpClient'
import { useCollections } from '../../../services/collectionStore'
import { errorMessage } from '../../../services/api/errors'
import { confirmAction } from '../../../services/dialogService'
import { useAuth } from '../../auth/authStore'
import { hasPermission } from '../../auth/permissions'
import { sampleJournalRange } from './purchaseJournalData'
import './purchaseJournal.css'
import './journalPreview.css'

const props = defineProps<{ kind: JournalPreviewKind }>()
const { loading, error: loadError, retry } = useCollections(journalCollection)
const { authUser } = useAuth()
const busy = ref(false)
const saveError = ref('')
const operationError = ref('')
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
const editorOpen = ref(false)
const editingEntry = ref<JournalPreviewEntry | null>(null)
const notice = ref('')
const nextGeneralJournalNumber = computed(() => {
  const numbers = journalCollection.items.value.filter((entry) => entry.kind === props.kind)
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
  return journalCollection.items.value.filter((entry) => entry.kind === props.kind)
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
  if (busy.value || !hasPermission(authUser.value, 'Accounting', entry ? 'edit' : 'create')) return
  editingEntry.value = entry
  editorOpen.value = true
}

async function saveDraft(entry: JournalPreviewEntry) {
  if (busy.value || !hasPermission(authUser.value, 'Accounting', editingEntry.value ? 'edit' : 'create')) return
  busy.value = true
  saveError.value = ''
  try {
    const saved = await journalCollection.save({ ...entry, id: editingEntry.value?.id ?? '', version: editingEntry.value?.version })
    editorOpen.value = false
    entry = saved
  } catch (cause) { saveError.value = errorMessage(cause, 'The journal could not be saved.'); return }
  finally { busy.value = false }
  if (entry.date < appliedRange.value.from) appliedRange.value.from = entry.date
  if (entry.date > appliedRange.value.to) appliedRange.value.to = entry.date
  fromDate.value = appliedRange.value.from
  toDate.value = appliedRange.value.to
  searchTerm.value = ''
  reviewMode.value = true
  selectedIds.value = [entry.id]
}

async function applyTransition(action: 'post' | 'void') {
  if (!selectedIds.value.length || busy.value) return
  if (!hasPermission(authUser.value, 'Accounting', 'edit')) return
  if (action === 'void' && !await confirmAction({ title: 'Void selected journal entries?', message: 'These posted entries will no longer affect reports. Their original lines and audit history will be retained.', confirmLabel: 'Void entries', destructive: true })) return
  busy.value = true
  operationError.value = ''
  try {
    const selected = entries.value.filter((entry) => selectedIds.value.includes(entry.id))
    await http.post('/journal-entries/transition', { action, entries: selected.map((entry) => ({ id: entry.id, expectedVersion: entry.version })) })
    await journalCollection.reload()
    notice.value = `Journal entry ${action === 'post' ? 'posted' : 'voided'}.`
    selectedIds.value = []
  } catch (error) {
    operationError.value = errorMessage(error, 'The journal status could not be changed.')
  } finally { busy.value = false }
}

const canPost = computed(() => !busy.value && hasPermission(authUser.value, 'Accounting', 'edit') && selectedIds.value.length > 0 && selectedIds.value.every((id) => entries.value.find((entry) => entry.id === id)?.status === 'Draft'))
const canVoid = computed(() => !busy.value && hasPermission(authUser.value, 'Accounting', 'edit') && selectedIds.value.length > 0 && selectedIds.value.every((id) => entries.value.find((entry) => entry.id === id)?.status === 'Posted'))
async function removeDraft(entry: JournalPreviewEntry) {
  if (busy.value || entry.status !== 'Draft' || !hasPermission(authUser.value, 'Accounting', 'delete')) return
  if (!await confirmAction({ title: 'Delete journal draft?', message: `Journal draft #${entry.journalNumber} will be removed.`, confirmLabel: 'Delete draft', destructive: true })) return
  busy.value = true; operationError.value = ''
  try { await journalCollection.remove(entry.id, entry.version); selectedIds.value = []; notice.value = 'Journal draft deleted.' }
  catch (cause) { operationError.value = errorMessage(cause, 'The draft could not be deleted.') }
  finally { busy.value = false }
}
function transferSelected() {
  notice.value = 'Use the source document to record a payment or collection.'
}
</script>

<template>
  <section class="journal-page" :aria-label="config.label">
    <div class="journal-page__toolbar">
      <div class="journal-page__toolbar-left">
        <h1 class="journal-page__title">{{ config.label }}</h1>
        <label class="journal-switch"><input v-model="reviewMode" type="checkbox" /><span class="journal-switch__track" aria-hidden="true" /><span>Review mode</span></label>
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
          <button class="journal-button journal-button--secondary" type="button" :disabled="!canPost" @click="applyTransition('post')">Post</button>
          <button class="journal-button journal-button--secondary" type="button" :disabled="!canVoid" @click="applyTransition('void')">Void</button>
          <button v-if="hasPermission(authUser, 'Accounting', 'create')" class="journal-button journal-button--secondary journal-preview__add" type="button" aria-label="Add General Journal draft" :disabled="loading || busy || Boolean(loadError)" @click="openEditor()"><Plus :size="18" /></button>
        </template>
        <button v-else class="journal-button journal-button--primary" type="button" :disabled="!selectedIds.length" @click="transferSelected">{{ config.transferLabel }}</button>
      </div>
    </div>
    <p v-if="notice" class="journal-date-filter__notice" role="status">{{ notice }}</p>
    <p v-if="operationError" class="journal-date-filter__error" role="alert">{{ operationError }}</p>
    <AppDataState :loading="loading" :error="loadError" label="Journal entries" :empty="!entries.length" :empty-title="filtered ? 'No matching journal entries' : 'No journal entries in this period'" empty-message="Try another search or date range, or review and post your source documents." :action-label="filtered ? 'Reset filters' : kind === 'general-journal' && hasPermission(authUser, 'Accounting', 'create') ? 'Add draft' : undefined" @action="filtered ? resetFilters() : openEditor()" @retry="retry">
    <div class="journal-workarea journal-preview" :class="{ 'journal-workarea--review': reviewMode, 'journal-preview--review': reviewMode, 'journal-preview--general': kind === 'general-journal' }">
      <JournalPreviewTable :kind="kind" :config="config" :entries="entries" :selected-ids="selectedIds" :review-mode="reviewMode" :filtered="filtered" :can-create="hasPermission(authUser, 'Accounting', 'create') && !busy"
        @toggle="toggleSelection" @toggle-all="toggleAll" @open="openEntry" @reset="resetFilters" @add="openEditor()" />
      <JournalPreviewDetail v-if="reviewMode" :entry="activeEntry" :editable="kind === 'general-journal' && hasPermission(authUser, 'Accounting', 'edit') && !busy" :can-delete="hasPermission(authUser, 'Accounting', 'delete') && !busy" @edit="openEditor" @delete="removeDraft" />
    </div>
    </AppDataState>
    <GeneralJournalEditor v-if="kind === 'general-journal'" :open="editorOpen" :entry="editingEntry" :next-journal-number="nextGeneralJournalNumber" :busy="busy" :server-error="saveError" @save="saveDraft" @close="editorOpen = false" />
  </section>
</template>
