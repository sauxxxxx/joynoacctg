<script setup lang="ts">
import { computed, ref } from 'vue'
import DateRangeFilter from '../workspace/DateRangeFilter.vue'
import { customers } from './customers/customerPreviewStore'
import { reportDate, tableAmount } from './salesFormat'
import { salesDocuments } from './salesPreviewStore'
import { postedReceiptsTotal } from './salesRules'
import './sales-pages.css'

type ReportId = 'receivable-schedule' | 'receivable-aging'
type AgingBucket = 'current' | 'oneToThirty' | 'thirtyOneToSixty' | 'sixtyOneToNinety' | 'overNinety'
type AgingRow = { customerId: string; name: string; balance: number } & Record<AgingBucket, number>

const props = defineProps<{ pageId: ReportId }>()
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
const utcDay = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000

const balances = computed(() => {
  const reportDate = asOf.value
  if (!reportDate) return []
  return salesDocuments.value
    .filter((item) => item.kind === 'sales-invoices' && item.status === 'Unpaid' && item.date <= reportDate && item.dueDate)
    .map((invoice) => ({
      invoice,
      // Only receipts dated on or before the report date reduce the balance.
      balance: Math.round(Math.max(0, invoice.amount - postedReceiptsTotal(salesDocuments.value, invoice.id, reportDate)) * 100) / 100,
    }))
    .filter((item) => item.balance > 0)
})

const scheduleRows = computed(() => {
  const start = new Date(`${asOf.value}T00:00:00`)
  const targetMonth = start.getMonth() + (monthsError.value ? 3 : Number(months.value))
  const lastDay = new Date(start.getFullYear(), targetMonth + 1, 0).getDate()
  const horizon = new Date(start.getFullYear(), targetMonth, Math.min(start.getDate(), lastDay))
  const endDate = localDate(horizon)
  return balances.value
    .filter(({ invoice }) => (!customerFilter.value || invoice.customerId === customerFilter.value) && invoice.dueDate <= endDate)
    .map(({ invoice, balance }) => ({
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      name: customers.value.find((customer) => customer.id === invoice.customerId)?.name ?? 'Unknown customer',
      dueDate: invoice.dueDate,
      balance,
    }))
})

// One row per customer, as in the legacy AR Aging report. Each invoice balance falls in one bucket by days past due.
const agingRows = computed<AgingRow[]>(() => {
  const rows = new Map<string, AgingRow>()
  for (const { invoice, balance } of balances.value) {
    const row = rows.get(invoice.customerId) ?? {
      customerId: invoice.customerId,
      name: customers.value.find((customer) => customer.id === invoice.customerId)?.name ?? 'Unknown customer',
      balance: 0, current: 0, oneToThirty: 0, thirtyOneToSixty: 0, sixtyOneToNinety: 0, overNinety: 0,
    }
    const overdueDays = utcDay(asOf.value) - utcDay(invoice.dueDate)
    const bucket: AgingBucket = overdueDays <= 0 ? 'current' : overdueDays <= 30 ? 'oneToThirty' : overdueDays <= 60 ? 'thirtyOneToSixty' : overdueDays <= 90 ? 'sixtyOneToNinety' : 'overNinety'
    row.balance += balance
    row[bucket] += balance
    rows.set(invoice.customerId, row)
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name))
})
const agingColumns: { key: 'balance' | AgingBucket; label: string }[] = [
  { key: 'balance', label: 'Balance' }, { key: 'current', label: 'Current' }, { key: 'oneToThirty', label: '1-30 Days' },
  { key: 'thirtyOneToSixty', label: '31-60 Days' }, { key: 'sixtyOneToNinety', label: '61-90 Days' }, { key: 'overNinety', label: '91+ Days' },
]

const totals = computed(() => agingRows.value.reduce((sum, row) => ({
  balance: sum.balance + row.balance,
  current: sum.current + row.current,
  oneToThirty: sum.oneToThirty + row.oneToThirty,
  thirtyOneToSixty: sum.thirtyOneToSixty + row.thirtyOneToSixty,
  sixtyOneToNinety: sum.sixtyOneToNinety + row.sixtyOneToNinety,
  overNinety: sum.overNinety + row.overNinety,
}), { balance: 0, current: 0, oneToThirty: 0, thirtyOneToSixty: 0, sixtyOneToNinety: 0, overNinety: 0 }))
</script>

<template>
  <section class="sales-page" :aria-label="title">
    <div class="sales-panel sales-report">
      <div class="sales-panel__toolbar">
        <div><h2>{{ title }}</h2><p>{{ isAging ? 'See how long invoice balances have been outstanding.' : 'See receivables due in the selected period.' }}</p></div>
        <div class="sales-panel__actions">
          <template v-if="!isAging">
            <label class="sales-inline-field">Month(s) <input v-model.number="months" type="number" min="1" max="36" step="1" required :aria-invalid="Boolean(monthsError)" /></label>
            <select v-model="customerFilter" class="sales-status-filter" aria-label="Filter by customer"><option value="">All customers</option><option v-for="customer in customers" :key="customer.id" :value="customer.id">{{ customer.name }}</option></select>
          </template>
          <DateRangeFilter v-model="asOfRange" :default-value="defaultAsOf" mode="as-of" />
        </div>
      </div>
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
              <tr v-for="row in scheduleRows" :key="row.invoiceId"><td>{{ row.name }}</td><td>{{ row.invoiceNumber }}</td><td>{{ reportDate(row.dueDate) }}</td><td class="sales-table__number">{{ tableAmount(row.balance) }}</td></tr>
            </tbody>
            <tfoot><tr><th scope="row">Total</th><td /><td /><td class="sales-table__number">{{ tableAmount(scheduleRows.reduce((sum, row) => sum + row.balance, 0)) }}</td></tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>
