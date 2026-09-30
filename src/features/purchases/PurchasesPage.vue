<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronLeft, ChevronRight, LayoutGrid, ListFilter, Plus, Search } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import PurchasesEditor from './PurchasesEditor.vue'
import PurchasesTable from './PurchasesTable.vue'
import { purchaseConfigs, purchaseRecords, type PurchaseKind, type PurchaseRecord } from './purchasePreviewData'
import './purchases.css'

const props = defineProps<{ kind: PurchaseKind }>()
const config = computed(() => purchaseConfigs[props.kind])
const activeTab = ref('Search')
const search = ref('')
const filtersOpen = ref(false)
const compact = ref(false)
const editorOpen = ref(false)
const selectedRecord = ref<PurchaseRecord | null>(null)
const notice = ref('')
const filterError = ref('')
const today = new Date()
const initialFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
const initialTo = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()).padStart(2, '0')}`
const fromDate = ref(initialFrom)
const toDate = ref(initialTo)
const vendor = ref('')
const payrollYear = ref(String(today.getFullYear()))
const applied = ref({ from: initialFrom, to: initialTo, vendor: '', year: String(today.getFullYear()) })
const isPayroll = computed(() => props.kind === 'payrolls')
const vendorOptions = computed(() => [{ value: '', label: 'All vendors' }, ...[...new Set(purchaseRecords.value.filter((item) => item.kind === props.kind).map((item) => item.vendor).filter(Boolean))].sort().map((name) => ({ value: name, label: name }))])
const filtered = computed(() => activeTab.value !== 'Search' || Boolean(search.value.trim()) || applied.value.from !== initialFrom || applied.value.to !== initialTo || applied.value.vendor !== '' || applied.value.year !== String(today.getFullYear()))
const visibleRecords = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return purchaseRecords.value.filter((record) => record.kind === props.kind)
    .filter((record) => activeTab.value === 'Search' || (activeTab.value === 'Unpaid' ? record.paidCents < record.totalCents : record.status === 'Draft'))
    .filter((record) => isPayroll.value ? record.year === applied.value.year : record.date >= applied.value.from && record.date <= applied.value.to && (!applied.value.vendor || record.vendor === applied.value.vendor))
    .filter((record) => !query || [record.number, record.vendor, record.remarks, record.paymentMethod, record.status, record.period, record.payGroup].some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((a, b) => a.date.localeCompare(b.date))
})

function applyFilters() {
  if (!isPayroll.value && fromDate.value > toDate.value) { filterError.value = 'The end date must be on or after the start date.'; return }
  if (isPayroll.value && !/^\d{4}$/.test(payrollYear.value)) { filterError.value = 'Enter a four-digit year.'; return }
  filterError.value = ''
  applied.value = { from: fromDate.value, to: toDate.value, vendor: vendor.value, year: payrollYear.value }
  filtersOpen.value = false
}
function resetFilters() {
  activeTab.value = 'Search'; search.value = ''; fromDate.value = initialFrom; toDate.value = initialTo
  vendor.value = ''; payrollYear.value = String(today.getFullYear())
  applied.value = { from: initialFrom, to: initialTo, vendor: '', year: String(today.getFullYear()) }
  filterError.value = ''; filtersOpen.value = false
}
function openEditor(record: PurchaseRecord | null = null) { selectedRecord.value = record; editorOpen.value = true; notice.value = '' }
function saveRecord(record: PurchaseRecord) {
  const index = purchaseRecords.value.findIndex((item) => item.id === record.id)
  if (index >= 0) purchaseRecords.value.splice(index, 1, record)
  else purchaseRecords.value.push(record)
  activeTab.value = 'Search'; search.value = ''
  if (!isPayroll.value) {
    if (record.date < applied.value.from) applied.value.from = record.date
    if (record.date > applied.value.to) applied.value.to = record.date
    fromDate.value = applied.value.from; toDate.value = applied.value.to
    vendor.value = ''; applied.value.vendor = ''
  } else { payrollYear.value = record.year; applied.value.year = record.year }
  notice.value = `${record.number} saved as a temporary draft. Nothing was posted.`
}
function deleteRecord(record: PurchaseRecord) {
  if (!window.confirm(`Delete draft ${record.number}?`)) return
  purchaseRecords.value = purchaseRecords.value.filter((item) => item.id !== record.id)
  editorOpen.value = false
  notice.value = `${record.number} draft deleted.`
}
</script>

<template>
  <section class="purchases-page" :aria-label="config.title">
    <nav class="purchases-tabs" :aria-label="`${config.title} views`"><button v-for="item in config.tabs" :key="item" type="button" :class="{ 'purchases-tabs__active': activeTab === item }" :aria-current="activeTab === item ? 'page' : undefined" @click="activeTab = item">{{ item }}</button></nav>
    <header class="purchases-toolbar"><div class="purchases-toolbar__title"><button type="button" class="purchases-toolbar__collapse" :aria-label="filtersOpen ? 'Hide filters' : 'Show filters'" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen"><ChevronLeft v-if="filtersOpen" :size="17" /><ChevronRight v-else :size="17" /></button><div><h1>{{ config.title }}</h1><span>{{ config.sampleCount ? `${config.sampleCount} reference samples · ` : '' }}Drafts are temporary</span></div></div>
      <div class="purchases-toolbar__actions"><label class="purchases-search"><Search :size="15" aria-hidden="true" /><input v-model="search" type="search" :aria-label="`Search ${config.title}`" placeholder="Type to filter" /></label><button type="button" class="purchases-icon-button" :aria-pressed="filtersOpen" aria-label="Toggle filters" @click="filtersOpen = !filtersOpen"><ListFilter :size="17" /></button><button type="button" class="purchases-icon-button" :aria-label="`Add ${config.title} draft`" @click="openEditor()"><Plus :size="19" /></button><button type="button" class="purchases-icon-button" :aria-pressed="compact" aria-label="Toggle compact rows" @click="compact = !compact"><LayoutGrid :size="18" /></button></div>
    </header>
    <p v-if="notice" class="purchases-notice" role="status">{{ notice }}</p>
    <div class="purchases-workspace" :class="{ 'purchases-workspace--filters': filtersOpen, 'purchases-workspace--compact': compact }">
      <aside v-if="filtersOpen" class="purchases-filters" aria-label="List filters"><form @submit.prevent="applyFilters">
        <template v-if="isPayroll"><label>Year <span aria-hidden="true">*</span><input v-model="payrollYear" type="number" min="2000" max="2100" required /></label></template>
        <template v-else><AppDatePicker v-model="fromDate" label="From" required :invalid="Boolean(filterError)" /><AppDatePicker v-model="toDate" label="To" required :invalid="Boolean(filterError)" /><AppSelect v-model="vendor" :options="vendorOptions" label="Vendor" /></template>
        <p v-if="filterError" class="purchases-filter-error" role="alert">{{ filterError }}</p><button type="submit" class="purchases-button purchases-button--primary">Load</button><button type="button" class="purchases-button" @click="resetFilters">Reset</button>
      </form></aside>
      <PurchasesTable :kind="kind" :records="visibleRecords" :filtered="filtered" @open="openEditor" @reset="resetFilters" @add="openEditor()" />
    </div>
    <PurchasesEditor :open="editorOpen" :kind="kind" :record="selectedRecord" @close="editorOpen = false" @save="saveRecord" @delete="deleteRecord" />
  </section>
</template>
