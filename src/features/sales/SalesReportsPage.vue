<script setup lang="ts">
import AppDataState from '../../components/ui/AppDataState.vue'
import { computed, ref } from 'vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { getAgingBucket } from '../../lib/aging'
import DateRangeFilter from '../workspace/DateRangeFilter.vue'
import { customers } from './customers/customerPreviewStore'
import { reportDate, tableAmount } from './salesFormat'
import { salesDocuments, setupRecords } from './salesPreviewStore'
import { postedReceiptsTotalCents, receivableInstallments } from './salesRules'
import './sales-pages.css'
import { salesDocumentRepository } from '../../services/previewRepositories'
import { useRecordWorkspace } from '../../services/useRecordWorkspace'
import { useDocumentReferences } from '../transactions/useDocumentReferences'
import { downloadCsv, toCsv } from './salesCsv'

type ReportId = 'receivable-schedule' | 'receivable-aging'
type AgingBucket = 'current' | 'oneToThirty' | 'thirtyOneToSixty' | 'sixtyOneToNinety' | 'overNinety'
type AgingRow = { customerId: string; name: string; balanceCents: number } & Record<AgingBucket, number>

const props = defineProps<{ pageId: ReportId }>()
const workspace = useRecordWorkspace(salesDocumentRepository, salesDocuments)
const references = useDocumentReferences('sales-documents')
const isAging = computed(() => props.pageId === 'receivable-aging')
const title = computed(() => isAging.value ? 'Receivable Aging' : 'Receivable Schedule')
const pad = (value: number) => String(value).padStart(2, '0')
const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const defaultAsOf = { from: '', to: localDate(new Date()) }
const asOfRange = ref({ ...defaultAsOf })
const asOf = computed(() => asOfRange.value.to)
const months = ref(3)
const customerFilter = ref('')
const monthsError = computed(() => !isAging.value && (!Number.isInteger(Number(months.value)) || months.value < 1 || months.value > 36) ? 'Enter 1 to 36 months.' : '')
const customerOptions = computed(() => [
  { value: '', label: 'All customers' },
  ...customers.value.map((customer) => ({ value: customer.id, label: customer.name })),
])

// One entry per unpaid installment. Only receipts dated on or before the report date reduce the balances.
const balances = computed(() => {
  const reportDate = asOf.value
  if (!reportDate) return []
  return salesDocuments.value
    .filter((item) => item.kind === 'sales-invoices' && item.journalEntryId && item.status !== 'Cancelled' && item.date <= reportDate)
    .flatMap((invoice) => {
      const term = setupRecords.value.find((record) => record.id === invoice.paymentTermId)
      const collectedCents = postedReceiptsTotalCents(salesDocuments.value, invoice.id, reportDate)
      return receivableInstallments(invoice.amountCents, invoice.date, term, collectedCents, invoice.dueDate)
        .filter((installment) => installment.balanceCents > 0)
        .map((installment) => ({ invoice, installment, dueDate: installment.dueDate, balanceCents: installment.balanceCents }))
    })
})

const scheduleRows = computed(() => {
  const start = new Date(`${asOf.value}T00:00:00`)
  const targetMonth = start.getMonth() + (monthsError.value ? 3 : Number(months.value))
  const lastDay = new Date(start.getFullYear(), targetMonth + 1, 0).getDate()
  const horizon = new Date(start.getFullYear(), targetMonth, Math.min(start.getDate(), lastDay))
  const endDate = localDate(horizon)
  return balances.value
    .filter(({ invoice, dueDate }) => (!customerFilter.value || invoice.customerId === customerFilter.value) && dueDate <= endDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.invoice.number.localeCompare(b.invoice.number))
    .map(({ invoice, installment, dueDate, balanceCents }) => ({
      rowKey: `${invoice.id}:${installment.number}`,
      invoiceNumber: installment.count > 1 ? `${invoice.number} (${installment.number}/${installment.count})` : invoice.number,
      name: customers.value.find((customer) => customer.id === invoice.customerId)?.name ?? 'Unknown customer',
      dueDate,
      balanceCents,
    }))
})

// One row per customer, as in the legacy AR Aging report. Each invoice balance falls in one bucket by days past due.
const agingRows = computed<AgingRow[]>(() => {
  const rows = new Map<string, AgingRow>()
  for (const { invoice, dueDate, balanceCents } of balances.value) {
    const row = rows.get(invoice.customerId) ?? {
      customerId: invoice.customerId,
      name: customers.value.find((customer) => customer.id === invoice.customerId)?.name ?? 'Unknown customer',
      balanceCents: 0, current: 0, oneToThirty: 0, thirtyOneToSixty: 0, sixtyOneToNinety: 0, overNinety: 0,
    }
    const bucket: AgingBucket = ({
      current: 'current',
      '1-30': 'oneToThirty',
      '31-60': 'thirtyOneToSixty',
      '61-90': 'sixtyOneToNinety',
      '90+': 'overNinety',
    } as const)[getAgingBucket(dueDate, new Date(`${asOf.value}T00:00:00`))]
    row.balanceCents += balanceCents
    row[bucket] += balanceCents
    rows.set(invoice.customerId, row)
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name))
})
const agingColumns: { key: 'balanceCents' | AgingBucket; label: string }[] = [
  { key: 'balanceCents', label: 'Balance' }, { key: 'current', label: 'Current' }, { key: 'oneToThirty', label: '1-30 Days' },
  { key: 'thirtyOneToSixty', label: '31-60 Days' }, { key: 'sixtyOneToNinety', label: '61-90 Days' }, { key: 'overNinety', label: '91+ Days' },
]

const totals = computed(() => agingRows.value.reduce((sum, row) => ({
  balanceCents: sum.balanceCents + row.balanceCents,
  current: sum.current + row.current,
  oneToThirty: sum.oneToThirty + row.oneToThirty,
  thirtyOneToSixty: sum.thirtyOneToSixty + row.thirtyOneToSixty,
  sixtyOneToNinety: sum.sixtyOneToNinety + row.sixtyOneToNinety,
  overNinety: sum.overNinety + row.overNinety,
}), { balanceCents: 0, current: 0, oneToThirty: 0, thirtyOneToSixty: 0, sixtyOneToNinety: 0, overNinety: 0 }))
function exportCsv() {
  const headers = isAging.value ? ['Customer', ...agingColumns.map((column) => `${column.label} (PHP)`)] : ['Customer', 'Invoice', 'Due date', 'Balance (PHP)']
  const rows = isAging.value ? agingRows.value.map((row) => [row.name, ...agingColumns.map((column) => row[column.key] / 100)]) : scheduleRows.value.map((row) => [row.name, row.invoiceNumber, row.dueDate, row.balanceCents / 100])
  downloadCsv(`${props.pageId}-${asOf.value}.csv`, toCsv(headers, rows))
}
</script>

<template>
  <section class="sales-page" :aria-label="title">
    <div class="sales-panel sales-report">
      <div class="sales-panel__toolbar">
        <div><h2>{{ title }}</h2><p>{{ isAging ? 'See how long invoice balances have been outstanding.' : 'See receivables due in the selected period.' }}</p></div>
        <div class="sales-panel__actions">
          <template v-if="!isAging">
            <label class="sales-inline-field">Month(s) <input v-model.number="months" type="number" min="1" max="36" step="1" required :aria-invalid="Boolean(monthsError)" /></label>
            <AppSelect v-model="customerFilter" :options="customerOptions" aria-label="Filter by customer" compact />
          </template>
          <DateRangeFilter v-model="asOfRange" :default-value="defaultAsOf" mode="as-of" />
          <button type="button" class="sales-button" :disabled="workspace.loading.value || references.loading.value || Boolean(workspace.error.value || references.error.value || monthsError)" @click="exportCsv">Export CSV</button>
        </div>
      </div>
    <AppDataState :loading="workspace.loading.value || references.loading.value" :error="workspace.error.value || references.error.value" :empty="!monthsError && (isAging ? !agingRows.length : !scheduleRows.length)" variant="report" :label="title" empty-title="No receivables in this period" empty-message="Only posted, outstanding invoices appear here. Try another period or review your sales records." @retry="workspace.load(); references.load()">
      <div class="sales-report__results">
        <div class="sales-report__heading sales-report__heading--center"><h3>{{ isAging ? 'AR Aging' : 'Receivables' }}</h3><span>As of {{ reportDate(asOf) }}</span></div>
        <p v-if="monthsError" class="sales-form__error" role="alert">{{ monthsError }}</p>
        <div v-else-if="isAging" class="sales-table-wrap">
          <table class="sales-table sales-report__table sales-report__table--grid">
            <thead><tr><th scope="col">Customer</th><th v-for="column in agingColumns" :key="column.key" scope="col" class="sales-table__number">{{ column.label }}</th></tr></thead>
            <tbody>
              <tr v-for="row in agingRows" :key="row.customerId"><td>{{ row.name }}</td><td v-for="column in agingColumns" :key="column.key" class="sales-table__number">{{ tableAmount(row[column.key]) }}</td></tr>
            </tbody>
            <tfoot><tr><th scope="row">Total</th><td v-for="column in agingColumns" :key="column.key" class="sales-table__number">{{ tableAmount(totals[column.key]) }}</td></tr></tfoot>
          </table>
        </div>
        <div v-else class="sales-table-wrap">
          <table class="sales-table sales-report__table sales-report__table--grid">
            <thead><tr><th scope="col">Customer</th><th scope="col">Invoice #</th><th scope="col">Due date</th><th scope="col" class="sales-table__number">Balance Due</th></tr></thead>
            <tbody>
              <tr v-for="row in scheduleRows" :key="row.rowKey"><td>{{ row.name }}</td><td>{{ row.invoiceNumber }}</td><td>{{ reportDate(row.dueDate) }}</td><td class="sales-table__number">{{ tableAmount(row.balanceCents) }}</td></tr>
            </tbody>
            <tfoot><tr><th scope="row">Total</th><td /><td /><td class="sales-table__number">{{ tableAmount(scheduleRows.reduce((sum, row) => sum + row.balanceCents, 0)) }}</td></tr></tfoot>
          </table>
        </div>
      </div>
    </AppDataState>
    </div>
  </section>
</template>
