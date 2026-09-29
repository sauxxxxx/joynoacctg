<script setup lang="ts">
import { computed, ref } from 'vue'
import { customers } from './customers/customerPreviewStore'
import { salesDocuments } from './salesPreviewStore'
import './sales-pages.css'

type ReportId = 'receivable-schedule' | 'receivable-aging'
type AgingBucket = 'current' | 'oneToThirty' | 'thirtyOneToSixty' | 'sixtyOneToNinety' | 'overNinety'
type AgingRow = { invoiceId: string; invoiceNumber: string; name: string; balance: number } & Record<AgingBucket, number>

const props = defineProps<{ pageId: ReportId }>()
const isAging = computed(() => props.pageId === 'receivable-aging')
const title = computed(() => isAging.value ? 'Receivable Aging' : 'Receivable Schedule')
const pad = (value: number) => String(value).padStart(2, '0')
const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const asOf = ref(localDate(new Date()))
const months = ref(3)
const customerFilter = ref('')
const previewed = ref(false)
const error = ref('')
const currency = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
const utcDay = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000

const balances = computed(() => {
  const reportDate = asOf.value
  if (!reportDate) return []
  const postedReceipts = salesDocuments.value.filter((item) => item.kind === 'sales-receipts' && item.status === 'Posted' && item.date <= reportDate && item.invoiceId)
  return salesDocuments.value
    .filter((item) => item.kind === 'sales-invoices' && item.status === 'Unpaid' && item.date <= reportDate && item.dueDate)
    .map((invoice) => ({
      invoice,
      balance: Math.max(0, invoice.amount - postedReceipts.filter((receipt) => receipt.invoiceId === invoice.id).reduce((sum, receipt) => sum + receipt.amount, 0)),
    }))
    .filter((item) => item.balance > 0)
})

const scheduleRows = computed(() => {
  const start = new Date(`${asOf.value}T00:00:00`)
  const targetMonth = start.getMonth() + Number(months.value)
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

const agingRows = computed<AgingRow[]>(() => balances.value.map(({ invoice, balance }) => {
  const row: AgingRow = {
    invoiceId: invoice.id, invoiceNumber: invoice.number,
    name: customers.value.find((customer) => customer.id === invoice.customerId)?.name ?? 'Unknown customer',
    balance, current: 0, oneToThirty: 0, thirtyOneToSixty: 0, sixtyOneToNinety: 0, overNinety: 0,
  }
  const overdueDays = utcDay(asOf.value) - utcDay(invoice.dueDate)
  const bucket: AgingBucket = overdueDays <= 0 ? 'current' : overdueDays <= 30 ? 'oneToThirty' : overdueDays <= 60 ? 'thirtyOneToSixty' : overdueDays <= 90 ? 'sixtyOneToNinety' : 'overNinety'
  row[bucket] = balance
  return row
}))

const totals = computed(() => agingRows.value.reduce((sum, row) => ({
  balance: sum.balance + row.balance,
  current: sum.current + row.current,
  oneToThirty: sum.oneToThirty + row.oneToThirty,
  thirtyOneToSixty: sum.thirtyOneToSixty + row.thirtyOneToSixty,
  sixtyOneToNinety: sum.sixtyOneToNinety + row.sixtyOneToNinety,
  overNinety: sum.overNinety + row.overNinety,
}), { balance: 0, current: 0, oneToThirty: 0, thirtyOneToSixty: 0, sixtyOneToNinety: 0, overNinety: 0 }))

function preview() {
  if (!asOf.value) { error.value = 'Choose an as-of date.'; return }
  if (!isAging.value && (!Number.isInteger(Number(months.value)) || months.value < 1 || months.value > 36)) {
    error.value = 'Enter 1 to 36 months.'
    return
  }
  error.value = ''
  previewed.value = true
}
</script>

<template>
  <section class="sales-page" :aria-label="title">
    <p class="sales-preview-note">Frontend preview · This report uses unpaid invoices and posted receipts entered in this tab. Accounting integration will provide final balances.</p>
    <div class="sales-panel sales-report">
      <div class="sales-panel__toolbar"><div><h2>{{ title }}</h2><p>{{ isAging ? 'See how long invoice balances have been outstanding.' : 'See receivables due in the selected period.' }}</p></div></div>
      <div class="sales-workspace">
        <form class="sales-workspace__filters" @submit.prevent="preview">
          <label>As of <input v-model="asOf" type="date" required /></label>
          <template v-if="!isAging">
            <label>Month(s) <input v-model.number="months" type="number" min="1" max="36" step="1" required /></label>
            <label>Customer <select v-model="customerFilter"><option value="">All customers</option><option v-for="customer in customers" :key="customer.id" :value="customer.id">{{ customer.name }}</option></select></label>
          </template>
          <button class="sales-button sales-button--primary" type="submit">Preview</button>
          <p v-if="error" class="sales-form__error" role="alert">{{ error }}</p>
        </form>
        <div class="sales-workspace__results sales-report__results">
          <div class="sales-report__heading"><h3>{{ isAging ? 'AR Aging' : 'Receivables' }}</h3><span v-if="previewed">As of {{ asOf }}</span></div>
          <div v-if="!previewed" class="sales-empty"><strong>Choose your filters</strong><span>Select Preview to generate the report.</span></div>
          <template v-else-if="isAging">
            <div class="sales-table-wrap"><table class="sales-table sales-report__table"><thead><tr><th>Customer</th><th>Invoice #</th><th class="sales-table__number">Balance</th><th class="sales-table__number">Current</th><th class="sales-table__number">1–30 Days</th><th class="sales-table__number">31–60 Days</th><th class="sales-table__number">61–90 Days</th><th class="sales-table__number">91+ Days</th></tr></thead>
              <tbody><tr v-for="row in agingRows" :key="row.invoiceId"><td>{{ row.name }}</td><td>{{ row.invoiceNumber }}</td><td class="sales-table__number">{{ currency(row.balance) }}</td><td class="sales-table__number">{{ currency(row.current) }}</td><td class="sales-table__number">{{ currency(row.oneToThirty) }}</td><td class="sales-table__number">{{ currency(row.thirtyOneToSixty) }}</td><td class="sales-table__number">{{ currency(row.sixtyOneToNinety) }}</td><td class="sales-table__number">{{ currency(row.overNinety) }}</td></tr></tbody>
              <tfoot><tr><th>Total</th><th></th><th class="sales-table__number">{{ currency(totals.balance) }}</th><th class="sales-table__number">{{ currency(totals.current) }}</th><th class="sales-table__number">{{ currency(totals.oneToThirty) }}</th><th class="sales-table__number">{{ currency(totals.thirtyOneToSixty) }}</th><th class="sales-table__number">{{ currency(totals.sixtyOneToNinety) }}</th><th class="sales-table__number">{{ currency(totals.overNinety) }}</th></tr></tfoot>
            </table></div>
          </template>
          <template v-else><div class="sales-table-wrap"><table class="sales-table sales-report__table"><thead><tr><th>Customer</th><th>Invoice #</th><th>Due date</th><th class="sales-table__number">Balance Due</th></tr></thead><tbody><tr v-for="row in scheduleRows" :key="row.invoiceId"><td>{{ row.name }}</td><td>{{ row.invoiceNumber }}</td><td>{{ row.dueDate }}</td><td class="sales-table__number">{{ currency(row.balance) }}</td></tr></tbody><tfoot><tr><th>Total</th><th></th><th></th><th class="sales-table__number">{{ currency(scheduleRows.reduce((sum, row) => sum + row.balance, 0)) }}</th></tr></tfoot></table></div></template>
        </div>
      </div>
    </div>
  </section>
</template>
