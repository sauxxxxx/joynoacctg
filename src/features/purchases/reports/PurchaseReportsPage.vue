<script setup lang="ts">
import AppDataState from '../../../components/ui/AppDataState.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { CalendarDays, ListFilter } from '@lucide/vue'
import AppDatePicker from '../../../components/ui/AppDatePicker.vue'
import AppSelect from '../../../components/ui/AppSelect.vue'
import { formatMoney } from '../../../lib/money'
import { purchaseSetupRecords } from '../setup/purchaseSetupData'
import { buildPayableRows, type PurchaseReportKind } from './purchaseReportData'
import './purchaseReports.css'
import { purchaseRecords, purchaseVendorName } from '../purchasePreviewData'
import { purchaseRepository } from '../../../services/previewRepositories'
import { useRecordWorkspace } from '../../../services/useRecordWorkspace'
import { useDocumentReferences } from '../../transactions/useDocumentReferences'
import { downloadCsv, toCsv } from '../../sales/salesCsv'

const props = defineProps<{ pageId: PurchaseReportKind }>()
const workspace = useRecordWorkspace(purchaseRepository, purchaseRecords)
const references = useDocumentReferences('purchases')
const today = new Date()
const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const titles: Record<PurchaseReportKind, string> = {
  'payable-schedule': 'Payable Schedule',
  'payable-aging': 'Payable Aging',
  'revolving-fund-logs': 'Revolving Fund Logs',
}
const title = computed(() => titles[props.pageId])
const isSchedule = computed(() => props.pageId === 'payable-schedule')
const isAging = computed(() => props.pageId === 'payable-aging')
const filtersOpen = ref(false)
const filterControl = ref<HTMLElement | null>(null)
const filterButton = ref<HTMLButtonElement | null>(null)
const months = ref(3)
const vendor = ref('')
const asOf = ref(todayIso)
const fromDate = ref(`${todayIso.slice(0, 7)}-01`)
const toDate = ref(todayIso)
const custodian = ref('')
const error = ref('')
const applied = ref({ months: 3, vendor: '', asOf: todayIso, from: fromDate.value, to: todayIso, custodian: '' })
const payableReportRows = computed(() => buildPayableRows(purchaseRecords.value, applied.value.asOf, purchaseVendorName))
const fundRows = computed(() => purchaseRecords.value.filter((record) => record.status === 'Posted' && record.custodianId && record.fundMovement && record.date >= applied.value.from && record.date <= applied.value.to && (!applied.value.custodian || record.custodianId === applied.value.custodian)).sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number)))
const custodianName = (id: string) => purchaseSetupRecords.value.find((record) => record.id === id)?.name || 'Unknown custodian'
const fundNetMovement = computed(() => fundRows.value.reduce((sum, record) => sum + (record.fundMovement === 'Replenishment' ? record.totalCents : -record.totalCents), 0))
const vendorOptions = computed(() => [{ value: '', label: 'All vendors' }, ...Array.from(new Set(payableReportRows.value.map((row) => row.vendor))).map((name) => ({ value: name, label: name }))])
const custodianOptions = computed(() => [{ value: '', label: 'All custodians' }, ...purchaseSetupRecords.value.filter((item) => item.kind === 'revolving-fund-customers').map((item) => ({ value: item.id, label: item.name }))])
const scheduleRows = computed(() => {
  const start = new Date(`${applied.value.asOf}T00:00:00`)
  const end = new Date(start.getFullYear(), start.getMonth() + applied.value.months + 1, 0)
  const horizon = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  return payableReportRows.value.filter((row) => (!applied.value.vendor || row.vendor === applied.value.vendor) && row.dueDate <= horizon)
})
const totalBalance = computed(() => scheduleRows.value.reduce((sum, row) => sum + row.balanceCents, 0))
const agingTotals = computed(() => payableReportRows.value.reduce((totals, row) => ({
  balanceCents: totals.balanceCents + row.balanceCents,
  currentCents: totals.currentCents + row.currentCents,
  oneToThirtyCents: totals.oneToThirtyCents + row.oneToThirtyCents,
  thirtyOneToSixtyCents: totals.thirtyOneToSixtyCents + row.thirtyOneToSixtyCents,
  sixtyOneToNinetyCents: totals.sixtyOneToNinetyCents + row.sixtyOneToNinetyCents,
  overNinetyCents: totals.overNinetyCents + row.overNinetyCents,
}), { balanceCents: 0, currentCents: 0, oneToThirtyCents: 0, thirtyOneToSixtyCents: 0, sixtyOneToNinetyCents: 0, overNinetyCents: 0 }))
const reportDate = (value: string) => {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${month}/${day}/${year}` : value
}

function applyFilters() {
  if (isSchedule.value && (!Number.isInteger(Number(months.value)) || Number(months.value) < 1 || Number(months.value) > 36)) { error.value = 'Enter 1 to 36 months.'; return }
  if (!isSchedule.value && !isAging.value && fromDate.value > toDate.value) { error.value = 'The end date must be on or after the start date.'; return }
  error.value = ''
  applied.value = { months: Number(months.value), vendor: vendor.value, asOf: asOf.value, from: fromDate.value, to: toDate.value, custodian: custodian.value }
  filtersOpen.value = false
  nextTick(() => filterButton.value?.focus())
}
function resetFilters() {
  months.value = 3; vendor.value = ''; asOf.value = todayIso; fromDate.value = `${todayIso.slice(0, 7)}-01`; toDate.value = todayIso; custodian.value = ''; error.value = ''
  applied.value = { months: 3, vendor: '', asOf: asOf.value, from: fromDate.value, to: toDate.value, custodian: '' }
  filtersOpen.value = false
}
function onOutsidePointer(event: PointerEvent) {
  if (!filtersOpen.value || !(event.target instanceof Node) || filterControl.value?.contains(event.target)) return
  if (event.target instanceof Element && event.target.closest('.ui-date-picker__panel')) return
  filtersOpen.value = false
}
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !filtersOpen.value) return
  filtersOpen.value = false
  filterButton.value?.focus()
}
onMounted(() => { document.addEventListener('pointerdown', onOutsidePointer); document.addEventListener('keydown', onKeydown) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', onOutsidePointer); document.removeEventListener('keydown', onKeydown) })
function exportCsv() {
  if (!isSchedule.value && !isAging.value) {
    downloadCsv(`revolving-fund-${applied.value.from}-${applied.value.to}.csv`, toCsv(['Date', 'Voucher', 'Custodian', 'Movement', 'Amount PHP', 'Remarks'], fundRows.value.map((record) => [record.date, record.number, custodianName(record.custodianId!), record.fundMovement || '', record.totalCents / 100, record.remarks])))
    return
  }
  const keys = ['balanceCents', 'currentCents', 'oneToThirtyCents', 'thirtyOneToSixtyCents', 'sixtyOneToNinetyCents', 'overNinetyCents'] as const
  const headers = isSchedule.value ? ['Vendor', 'Due date', 'Balance (PHP)'] : ['Vendor', 'Balance (PHP)', 'Current (PHP)', '1–30 (PHP)', '31–60 (PHP)', '61–90 (PHP)', '91+ (PHP)']
  const rows = isSchedule.value ? scheduleRows.value.map((row) => [row.vendor, row.dueDate, row.balanceCents / 100]) : payableReportRows.value.map((row) => [row.vendor, ...keys.map((key) => row[key] / 100)])
  downloadCsv(`${props.pageId}-${applied.value.asOf}.csv`, toCsv(headers, rows))
}
</script>

<template>
  <section class="purchase-report-page" :aria-label="title">
    <header class="purchase-report-toolbar">
      <h2>{{ title }}</h2>
      <button type="button" class="purchase-report-button" :disabled="workspace.loading.value || references.loading.value || Boolean(workspace.error.value || references.error.value)" @click="exportCsv">Export CSV</button>
      <div ref="filterControl" class="purchase-report-filter-control">
        <button ref="filterButton" type="button" class="purchase-report-icon" :aria-expanded="filtersOpen" :aria-controls="`${pageId}-filters`" aria-label="Open report filters" @click="filtersOpen = !filtersOpen"><ListFilter v-if="isSchedule" :size="17" /><CalendarDays v-else :size="17" /></button>
        <aside v-if="filtersOpen" :id="`${pageId}-filters`" class="purchase-report-filters" aria-label="Report filters">
          <div class="purchase-report-filters__heading"><component :is="isSchedule ? ListFilter : CalendarDays" :size="17" /><div><strong>Report filters</strong><span>Adjust the report period.</span></div></div>
          <form @submit.prevent="applyFilters">
            <template v-if="isSchedule"><AppDatePicker v-model="asOf" label="As of" required /><label>Month(s) <span>*</span><input v-model.number="months" type="number" min="1" max="36" /></label><AppSelect v-model="vendor" :options="vendorOptions" label="Vendor" /></template>
            <AppDatePicker v-else-if="isAging" v-model="asOf" label="As of" required />
            <template v-else><AppDatePicker v-model="fromDate" label="From" required :invalid="Boolean(error)" /><AppDatePicker v-model="toDate" label="To" required :invalid="Boolean(error)" /><AppSelect v-model="custodian" :options="custodianOptions" label="Custodian" /></template>
            <p v-if="error" class="purchase-report-error" role="alert">{{ error }}</p>
            <div class="purchase-report-filters__actions"><button type="button" class="purchase-report-button" @click="resetFilters">Reset</button><button type="submit" class="purchase-report-button purchase-report-button--primary">Apply</button></div>
          </form>
        </aside>
      </div>
    </header>
    <AppDataState :loading="workspace.loading.value || references.loading.value" :error="workspace.error.value || references.error.value" :empty="isSchedule ? !scheduleRows.length : isAging ? !payableReportRows.length : !fundRows.length" variant="report" :label="title" :empty-title="isSchedule || isAging ? 'No payables in this period' : 'No fund movements in this period'" empty-message="Only posted records appear here. Adjust the period or review the source records." @retry="workspace.load(); references.load()">
    <div class="purchase-report-panel">
      <div v-if="isSchedule" class="purchase-report-content">
        <div class="purchase-report-heading"><h3>Payables</h3><span>Next {{ applied.months }} month{{ applied.months === 1 ? '' : 's' }}</span></div>
        <table class="purchase-report-table"><thead><tr><th>Vendor</th><th>Due date</th><th class="purchase-report-table__number">Balance</th></tr></thead><tbody><tr v-for="row in scheduleRows" :key="row.id"><td>{{ row.vendor }}</td><td>{{ reportDate(row.dueDate) }}</td><td class="purchase-report-table__number">{{ formatMoney(row.balanceCents) }}</td></tr></tbody><tfoot><tr><th colspan="2">Total</th><td class="purchase-report-table__number">{{ formatMoney(totalBalance) }}</td></tr></tfoot></table>
      </div>
      <div v-else-if="isAging" class="purchase-report-content">
        <div class="purchase-report-heading purchase-report-heading--center"><h3>AP Aging</h3><span>As of {{ reportDate(applied.asOf) }}</span></div>
        <div class="purchase-report-table-scroll"><table class="purchase-report-table purchase-report-table--aging"><thead><tr><th>Supplier</th><th class="purchase-report-table__number">Balance</th><th class="purchase-report-table__number">Current</th><th class="purchase-report-table__number">1–30 Days</th><th class="purchase-report-table__number">31–60 Days</th><th class="purchase-report-table__number">61–90 Days</th><th class="purchase-report-table__number">91+ Days</th></tr></thead><tbody><tr v-for="row in payableReportRows" :key="row.id"><td>{{ row.vendor }}</td><td class="purchase-report-table__number">{{ formatMoney(row.balanceCents) }}</td><td class="purchase-report-table__number">{{ formatMoney(row.currentCents) }}</td><td class="purchase-report-table__number">{{ formatMoney(row.oneToThirtyCents) }}</td><td class="purchase-report-table__number">{{ formatMoney(row.thirtyOneToSixtyCents) }}</td><td class="purchase-report-table__number">{{ formatMoney(row.sixtyOneToNinetyCents) }}</td><td class="purchase-report-table__number">{{ formatMoney(row.overNinetyCents) }}</td></tr></tbody><tfoot><tr><th>Total</th><td v-for="key in (['balanceCents', 'currentCents', 'oneToThirtyCents', 'thirtyOneToSixtyCents', 'sixtyOneToNinetyCents', 'overNinetyCents'] as const)" :key="key" class="purchase-report-table__number">{{ formatMoney(agingTotals[key]) }}</td></tr></tfoot></table></div>
      </div>
      <div v-else-if="fundRows.length" class="purchase-report-content"><div class="purchase-report-heading"><h3>Posted fund movements</h3><span>Net movement in this period: {{ formatMoney(fundNetMovement) }}. This is not an opening or closing balance.</span></div><table class="purchase-report-table"><thead><tr><th>Date</th><th>Voucher</th><th>Custodian</th><th>Movement</th><th class="purchase-report-table__number">Amount</th><th>Remarks</th></tr></thead><tbody><tr v-for="record in fundRows" :key="record.id"><td>{{ reportDate(record.date) }}</td><td>{{ record.number }}</td><td>{{ custodianName(record.custodianId!) }}</td><td>{{ record.fundMovement }}</td><td class="purchase-report-table__number">{{ formatMoney(record.totalCents) }}</td><td>{{ record.remarks }}</td></tr></tbody></table></div>
    </div>
    </AppDataState>
  </section>
</template>
