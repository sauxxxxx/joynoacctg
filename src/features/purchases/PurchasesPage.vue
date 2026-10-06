<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CalendarDays, Download, LayoutGrid, ListFilter, Plus, Search } from '@lucide/vue'
import { exportPurchases } from './purchaseExports'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { paginate } from '../../lib/tableQuery'
import { confirmAction } from '../../services/dialogService'
import { purchaseRepository } from '../../services/previewRepositories'
import PurchasesEditor from './PurchasesEditor.vue'
import PurchasesTable from './PurchasesTable.vue'
import { purchaseConfigs, purchaseRecords, purchaseVendorName, type PurchaseKind, type PurchaseRecord } from './purchasePreviewData'
import { purchaseSetupRecords } from './setup/purchaseSetupData'
import './purchases.css'
import { useRecordWorkspace } from '../../services/useRecordWorkspace'
import { useDocumentReferences } from '../transactions/useDocumentReferences'
import { useAuth } from '../auth/authStore'
import { usePermissions } from '../auth/permissions'

const props = defineProps<{ kind: PurchaseKind }>()
const workspace = useRecordWorkspace(purchaseRepository, purchaseRecords)
const references = useDocumentReferences('purchases')
const { authUser } = useAuth()
const { can } = usePermissions(authUser)
const config = computed(() => purchaseConfigs[props.kind])
const activeTab = ref('Search')
const search = ref('')
const filtersOpen = ref(false)
const filterControl = ref<HTMLElement | null>(null)
const filterButton = ref<HTMLButtonElement | null>(null)
const compact = ref(false)
const editorOpen = ref(false)
const selectedRecord = ref<PurchaseRecord | null>(null)
const notice = ref('')
const filterError = ref('')
const currentPage = ref(1)
const pageSize = 25
const today = new Date()
const initialFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
const initialTo = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()).padStart(2, '0')}`
const fromDate = ref(initialFrom)
const toDate = ref(initialTo)
const vendor = ref('')
const payrollYear = ref(String(today.getFullYear()))
const applied = ref({ from: initialFrom, to: initialTo, vendor: '', year: String(today.getFullYear()) })
const isPayroll = computed(() => props.kind === 'payrolls')
const newRecordLabel = computed(() => ({
  'purchase-invoices': 'New invoice',
  payrolls: 'New payroll',
  'cash-voucher': 'New cash voucher',
  'check-voucher': 'New check voucher',
  'petty-cash-voucher': 'New petty cash voucher',
  'purchase-receipts': 'New receipt',
})[props.kind])
const vendorOptions = computed(() => [{ value: '', label: 'All vendors' }, ...purchaseSetupRecords.value.filter((item) => item.kind === 'vendors' && item.active).map((item) => ({ value: item.id, label: item.name }))])
const filtered = computed(() => activeTab.value !== 'Search' || Boolean(search.value.trim()) || applied.value.from !== initialFrom || applied.value.to !== initialTo || applied.value.vendor !== '' || applied.value.year !== String(today.getFullYear()))
const hasAppliedFilters = computed(() => isPayroll.value
  ? applied.value.year !== String(today.getFullYear())
  : applied.value.from !== initialFrom || applied.value.to !== initialTo || applied.value.vendor !== '')
const visibleRecords = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return purchaseRecords.value.filter((record) => record.kind === props.kind)
    .filter((record) => activeTab.value === 'Search' || (activeTab.value === 'Unpaid' ? record.status === 'Posted' && record.paidCents < record.totalCents : record.status === 'Draft'))
    .filter((record) => isPayroll.value ? record.year === applied.value.year : record.date >= applied.value.from && record.date <= applied.value.to && (!applied.value.vendor || record.vendorId === applied.value.vendor))
    .filter((record) => !query || [record.number, purchaseVendorName(record.vendorId), record.remarks, record.paymentMethod, record.status, record.period, record.payGroup].some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((a, b) => a.date.localeCompare(b.date))
})
const pagedRecords = computed(() => paginate(visibleRecords.value, currentPage.value, pageSize).items)
watch(visibleRecords, () => { currentPage.value = 1 })

function applyFilters() {
  if (!isPayroll.value && fromDate.value > toDate.value) { filterError.value = 'The end date must be on or after the start date.'; return }
  if (isPayroll.value && !/^\d{4}$/.test(payrollYear.value)) { filterError.value = 'Enter a four-digit year.'; return }
  filterError.value = ''
  applied.value = { from: fromDate.value, to: toDate.value, vendor: vendor.value, year: payrollYear.value }
  filtersOpen.value = false
  nextTick(() => filterButton.value?.focus())
}
function resetFilters() {
  activeTab.value = 'Search'; search.value = ''; fromDate.value = initialFrom; toDate.value = initialTo
  vendor.value = ''; payrollYear.value = String(today.getFullYear())
  applied.value = { from: initialFrom, to: initialTo, vendor: '', year: String(today.getFullYear()) }
  filterError.value = ''; filtersOpen.value = false
}
function onOutsidePointer(event: PointerEvent) {
  if (!filtersOpen.value || !(event.target instanceof Node) || filterControl.value?.contains(event.target)) return
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
function openEditor(record: PurchaseRecord | null = null) {
  if (workspace.loading.value || workspace.busy.value || references.loading.value || references.error.value || (!record && !can('Purchases', 'create'))) return
  selectedRecord.value = record; editorOpen.value = true; notice.value = ''
}
async function saveRecord(record: PurchaseRecord) {
  if (!can('Purchases', selectedRecord.value ? 'edit' : 'create') || !await workspace.save(record)) return
  editorOpen.value = false
  activeTab.value = 'Search'; search.value = ''
  if (!isPayroll.value) {
    if (record.date < applied.value.from) applied.value.from = record.date
    if (record.date > applied.value.to) applied.value.to = record.date
    fromDate.value = applied.value.from; toDate.value = applied.value.to
    vendor.value = ''; applied.value.vendor = ''
  } else { payrollYear.value = record.year; applied.value.year = record.year }
  notice.value = `${record.number} saved. Review and post it when ready.`
  await workspace.load()
}
async function deleteRecord(record: PurchaseRecord) {
  if (!can('Purchases', 'delete') || record.status !== 'Draft' || workspace.busy.value) return
  if (!await confirmAction({ title: 'Delete purchase draft?', message: `${record.number} will be permanently removed.`, confirmLabel: 'Delete draft', destructive: true })) return
  if (!await workspace.remove(record)) return
  editorOpen.value = false
  notice.value = `${record.number} draft deleted.`
  await workspace.load()
}
function postedRecord(message: string) { editorOpen.value = false; notice.value = message; void workspace.load() }
</script>

<template>
  <section class="purchases-page" :aria-label="config.title">
    <p v-if="workspace.loading.value || references.loading.value" role="status">Loading records…</p>
    <p v-if="workspace.error.value || references.error.value" class="purchases-notice" role="alert">{{ workspace.error.value || references.error.value }} <button type="button" @click="workspace.load(); references.load()">Retry</button></p>
    <header class="purchases-toolbar">
      <nav class="purchases-tabs" :aria-label="`${config.title} views`"><button v-for="item in config.tabs" :key="item" type="button" :class="{ 'purchases-tabs__active': activeTab === item }" :aria-current="activeTab === item ? 'page' : undefined" @click="activeTab = item">{{ item }}</button></nav>
      <div class="purchases-toolbar__actions">
        <label class="purchases-search"><Search :size="15" aria-hidden="true" /><input v-model="search" type="search" :aria-label="`Search ${config.title}`" placeholder="Type to filter" /></label>
        <div ref="filterControl" class="purchases-filter-control">
          <button ref="filterButton" type="button" class="purchases-icon-button" :aria-pressed="filtersOpen" :aria-expanded="filtersOpen" :aria-controls="`${kind}-filters`" aria-label="Open filters" @click="filtersOpen = !filtersOpen">
            <ListFilter v-if="isPayroll" :size="17" aria-hidden="true" /><CalendarDays v-else :size="17" aria-hidden="true" />
            <span v-if="hasAppliedFilters" class="purchases-filter-control__indicator" aria-hidden="true" />
          </button>
          <aside v-if="filtersOpen" :id="`${kind}-filters`" class="purchases-filters" aria-label="List filters">
            <div class="purchases-filters__heading"><component :is="isPayroll ? ListFilter : CalendarDays" :size="17" aria-hidden="true" /><div><strong>{{ isPayroll ? 'Payroll year' : 'Date range' }}</strong><span>Refine the records shown below.</span></div></div>
            <form @submit.prevent="applyFilters">
              <template v-if="isPayroll"><label>Year <span aria-hidden="true">*</span><input v-model="payrollYear" type="number" min="2000" max="2100" required /></label></template>
              <template v-else><AppDatePicker v-model="fromDate" label="From" required :invalid="Boolean(filterError)" /><AppDatePicker v-model="toDate" label="To" required :invalid="Boolean(filterError)" /><AppSelect v-model="vendor" :options="vendorOptions" label="Vendor" /></template>
              <p v-if="filterError" class="purchases-filter-error" role="alert">{{ filterError }}</p>
              <div class="purchases-filters__actions"><button type="button" class="purchases-button" @click="resetFilters">Reset</button><button type="submit" class="purchases-button purchases-button--primary">Apply</button></div>
            </form>
          </aside>
        </div>
        <button v-if="can('Purchases', 'create')" type="button" class="purchases-button purchases-button--primary" :disabled="workspace.loading.value || references.loading.value || Boolean(references.error.value)" @click="openEditor()"><Plus :size="16" aria-hidden="true" />{{ newRecordLabel }}</button>
        <button type="button" class="purchases-button" :disabled="workspace.loading.value || references.loading.value || Boolean(workspace.error.value || references.error.value) || !visibleRecords.length" @click="exportPurchases(kind, visibleRecords)"><Download :size="16" aria-hidden="true" />Export CSV</button>
        <button type="button" class="purchases-icon-button" :aria-pressed="compact" aria-label="Toggle compact rows" @click="compact = !compact"><LayoutGrid :size="18" /></button>
      </div>
    </header>
    <p v-if="notice" class="purchases-notice" role="status">{{ notice }}</p>
    <div class="purchases-workspace" :class="{ 'purchases-workspace--compact': compact }">
      <PurchasesTable :kind="kind" :records="pagedRecords" :filtered="filtered" :can-create="can('Purchases', 'create')" @open="openEditor" @reset="resetFilters" @add="openEditor()" />
      <AppPagination v-model:page="currentPage" :page-size="pageSize" :total="visibleRecords.length" :label="config.title.toLocaleLowerCase()" />
    </div>
    <PurchasesEditor :open="editorOpen" :kind="kind" :record="selectedRecord" :busy="workspace.busy.value" :server-error="workspace.error.value" :readonly="!can('Purchases', selectedRecord ? 'edit' : 'create')" :can-delete="can('Purchases', 'delete')" @close="editorOpen = false" @save="saveRecord" @delete="deleteRecord" @changed="postedRecord" />
  </section>
</template>
