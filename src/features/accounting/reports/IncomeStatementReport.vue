<script setup lang="ts">
import { computed, ref } from 'vue'
import AppSelect from '../../../components/ui/AppSelect.vue'
import { fiscalYearStartMonth } from '../../company/companyStore'
import { incomeStatement, monthlyIncomeStatement, type MonthlyRow, type StatementSection } from './ledgerMath'
import { amount, csvAmount, money, percent } from './reportFormat'
import { exportReport } from './reportExport'
import { describeRange, fiscalYearMonths, fiscalYearStartYear, monthLabel, parseIso, todayIso } from './reportPeriods'
import PeriodFields from './PeriodFields.vue'
import ReportFrame from './ReportFrame.vue'
import StatementRows from './StatementRows.vue'
import { usePeriodFilter } from './usePeriodFilter'
import { useLedger } from './useLedger'

const props = defineProps<{ variant: 'annual' | 'annual-simple' | 'monthly-simple' }>()
const ledger = useLedger()
const isMonthly = computed(() => props.variant === 'monthly-simple')
const detailed = computed(() => props.variant === 'annual')
const title = computed(() => ({
  annual: 'Income Statement',
  'annual-simple': 'Income Statement (Simplified)',
  'monthly-simple': 'Monthly Income Statement (Simplified)',
})[props.variant])

// Annual variants: any date range, defaulting to the current fiscal year.
const filter = usePeriodFilter('this-year')
const statement = computed(() => incomeStatement(ledger.accounts.value, ledger.lines.value, filter.applied.value))
const margin = computed(() => statement.value.revenue.totalCents
  ? percent(statement.value.netIncomeCents / statement.value.revenue.totalCents * 100)
  : '—')

// Monthly variant: twelve months of one fiscal year.
const currentFiscalYear = fiscalYearStartYear(parseIso(todayIso()), fiscalYearStartMonth.value)
const yearLabel = (year: number) => fiscalYearStartMonth.value === 1 ? String(year) : `FY ${year}–${year + 1}`
const yearOptions = computed(() => Array.from({ length: 5 }, (_, index) => {
  const year = currentFiscalYear - index
  return { value: String(year), label: yearLabel(year) }
}))
const selectedYear = ref(String(currentFiscalYear))
const appliedYear = ref(currentFiscalYear)
const months = computed(() => fiscalYearMonths(appliedYear.value, fiscalYearStartMonth.value))
const monthly = computed(() => monthlyIncomeStatement(ledger.accounts.value, ledger.lines.value, months.value))

const period = computed(() => {
  if (!isMonthly.value) return `For the period ${describeRange(filter.applied.value)}`
  return `${yearLabel(appliedYear.value)} · ${monthLabel(months.value[0], true)} to ${monthLabel(months.value[11], true)}`
})
const hasData = computed(() => isMonthly.value
  ? monthly.value.revenue.length + monthly.value.expenses.length > 0
  : statement.value.revenue.groups.length + statement.value.expenses.groups.length > 0)

function generate() {
  if (isMonthly.value) appliedYear.value = Number(selectedYear.value)
  else filter.apply()
}

function sectionRows(label: string, section: StatementSection): (string | number)[][] {
  const rows: (string | number)[][] = [[label.toLocaleUpperCase(), '', '']]
  for (const group of section.groups) {
    if (detailed.value) {
      rows.push([group.category, '', ''])
      for (const row of group.accounts) rows.push([`  ${row.account.name}`, row.account.code, csvAmount(row.amountCents)])
      rows.push([`Total ${group.category}`, '', csvAmount(group.totalCents)])
    } else {
      rows.push([group.category, '', csvAmount(group.totalCents)])
    }
  }
  rows.push([`Total ${label.toLocaleLowerCase()}`, '', csvAmount(section.totalCents)])
  return rows
}

function monthlyRow(row: MonthlyRow): (string | number)[] {
  return [row.label, ...row.values.map(csvAmount), csvAmount(row.totalCents)]
}

function exportCsv() {
  if (isMonthly.value) {
    const data = monthly.value
    exportReport(title.value, period.value, [
      ['', ...months.value.map((month) => monthLabel(month, true)), 'Total'],
      ['REVENUE'], ...data.revenue.map(monthlyRow), monthlyRow(data.revenueTotals),
      ['EXPENSES'], ...data.expenses.map(monthlyRow), monthlyRow(data.expenseTotals),
      monthlyRow(data.netIncome),
    ])
    return
  }
  exportReport(title.value, period.value, [
    ['Line', 'Code', 'Amount'],
    ...sectionRows('Revenue', statement.value.revenue),
    ...sectionRows('Expenses', statement.value.expenses),
    ['Net income (loss)', '', csvAmount(statement.value.netIncomeCents)],
  ])
}
</script>

<template>
  <ReportFrame
    :title="title"
    :period="period"
    :loading="ledger.loading.value"
    :error="ledger.error.value"
    :issues="ledger.issues.value"
    :source-note="`${ledger.source.value.label} · Revenue and expense accounts grouped by account category. Net income is revenue less expenses; no other subtotals are assumed.`"
    :can-export="hasData"
    @generate="generate"
    @export="exportCsv"
    @retry="ledger.reload"
  >
    <template #filters>
      <div v-if="isMonthly" class="ws-toolbar__field"><AppSelect id="is-year" v-model="selectedYear" :label="fiscalYearStartMonth === 1 ? 'Year' : 'Fiscal year'" :options="yearOptions" /></div>
      <PeriodFields v-else :filter="filter" id-prefix="is" />
    </template>
    <template #filter-error><p v-if="!isMonthly && filter.error.value" class="ws-toolbar__error" role="alert">{{ filter.error.value }}</p></template>
    <template v-if="!isMonthly && hasData" #summary>
      <div class="acct-summary-tiles acct-report__summary">
        <div><span>Revenue</span><strong>{{ money(statement.revenue.totalCents) }}</strong></div>
        <div><span>Expenses</span><strong>{{ money(statement.expenses.totalCents) }}</strong></div>
        <div><span>{{ statement.netIncomeCents < 0 ? 'Net loss' : 'Net income' }}</span><strong>{{ money(statement.netIncomeCents) }}</strong></div>
        <div><span>Net margin</span><strong>{{ margin }}</strong><small>Net income ÷ revenue</small></div>
      </div>
    </template>

    <div v-if="!hasData" class="ws-empty"><strong>No revenue or expenses in this period</strong><span>Choose another period, or check that journal entries have been posted.</span></div>

    <div v-else-if="isMonthly" class="ws-table-wrap">
      <table class="ws-table acct-monthly">
        <thead><tr><th scope="col">Account category</th><th v-for="month in months" :key="month" scope="col" class="ws-num">{{ monthLabel(month) }}</th><th scope="col" class="ws-num">Total</th></tr></thead>
        <tbody>
          <tr class="acct-monthly__heading"><td :colspan="months.length + 2">Revenue</td></tr>
          <tr v-for="row in monthly.revenue" :key="`r-${row.label}`"><td>{{ row.label }}</td><td v-for="(value, index) in row.values" :key="index" class="ws-num">{{ amount(value) }}</td><td class="ws-num"><strong>{{ amount(row.totalCents) }}</strong></td></tr>
          <tr class="acct-monthly__total"><td>{{ monthly.revenueTotals.label }}</td><td v-for="(value, index) in monthly.revenueTotals.values" :key="index" class="ws-num">{{ amount(value) }}</td><td class="ws-num">{{ amount(monthly.revenueTotals.totalCents) }}</td></tr>
          <tr class="acct-monthly__heading"><td :colspan="months.length + 2">Expenses</td></tr>
          <tr v-for="row in monthly.expenses" :key="`e-${row.label}`"><td>{{ row.label }}</td><td v-for="(value, index) in row.values" :key="index" class="ws-num">{{ amount(value) }}</td><td class="ws-num"><strong>{{ amount(row.totalCents) }}</strong></td></tr>
          <tr class="acct-monthly__total"><td>{{ monthly.expenseTotals.label }}</td><td v-for="(value, index) in monthly.expenseTotals.values" :key="index" class="ws-num">{{ amount(value) }}</td><td class="ws-num">{{ amount(monthly.expenseTotals.totalCents) }}</td></tr>
          <tr class="acct-monthly__net"><td>{{ monthly.netIncome.label }}</td><td v-for="(value, index) in monthly.netIncome.values" :key="index" class="ws-num">{{ amount(value) }}</td><td class="ws-num">{{ amount(monthly.netIncome.totalCents) }}</td></tr>
        </tbody>
      </table>
    </div>

    <table v-else class="acct-statement" :class="{ 'acct-statement--simple': !detailed }">
      <thead class="ws-visually-hidden"><tr><th scope="col">Line</th><th scope="col">Amount</th></tr></thead>
      <tbody>
        <StatementRows label="Revenue" :section="statement.revenue" :detailed="detailed" empty-text="No revenue in this period" />
        <tr class="acct-statement__spacer"><td colspan="2" /></tr>
        <StatementRows label="Expenses" :section="statement.expenses" :detailed="detailed" empty-text="No expenses in this period" />
        <tr class="acct-statement__spacer"><td colspan="2" /></tr>
        <tr class="acct-statement__grand"><td>{{ statement.netIncomeCents < 0 ? 'Net loss' : 'Net income' }}</td><td class="ws-num">{{ amount(statement.netIncomeCents) }}</td></tr>
      </tbody>
    </table>
  </ReportFrame>
</template>
