<script setup lang="ts">
import { computed, ref } from 'vue'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Info, RotateCw } from '@lucide/vue'
import AppDatePicker from '../../../components/ui/AppDatePicker.vue'
import AppSelect from '../../../components/ui/AppSelect.vue'
import { fiscalYearStartMonth } from '../../company/companyStore'
import type { AccountType } from '../reports/ledgerContract'
import { balanceSheet, monthEndBalances, monthEndEarnings, monthlyActivity, monthRange, statementSection, totalsByAccount, type StatementAccountRow } from '../reports/ledgerMath'
import { amount, money, percent } from '../reports/reportFormat'
import { fiscalYearMonths, fiscalYearStartYear, formatLongDate, monthLabel, monthsEnding, parseIso, todayIso } from '../reports/reportPeriods'
import type { AnalyticsPageId } from '../reports/reportPages'
import { useLedger } from '../reports/useLedger'
import TrendChart from './TrendChart.vue'
import '../../workspace/workspace.css'
import './analytics.css'

const props = defineProps<{ pageId: AnalyticsPageId }>()

const pages: Record<AnalyticsPageId, { type: AccountType; label: string; kind: 'balance' | 'flow' }> = {
  'analytics-assets': { type: 'asset', label: 'Assets', kind: 'balance' },
  'analytics-liabilities': { type: 'liability', label: 'Liabilities', kind: 'balance' },
  'analytics-equities': { type: 'equity', label: 'Equity', kind: 'balance' },
  'analytics-revenues': { type: 'revenue', label: 'Revenue', kind: 'flow' },
  'analytics-expenses': { type: 'expense', label: 'Expenses', kind: 'flow' },
}
const page = computed(() => pages[props.pageId])
const isBalance = computed(() => page.value.kind === 'balance')
const ledger = useLedger()
const today = todayIso()

// Balance views: position as of a date, with twelve month-end points ending there.
const asOf = ref(today)
// Flow views: activity for one fiscal year, up to today.
const currentFiscalYear = fiscalYearStartYear(parseIso(today), fiscalYearStartMonth.value)
const yearLabel = (year: number) => fiscalYearStartMonth.value === 1 ? String(year) : `FY ${year}–${year + 1}`
const yearOptions = computed(() => Array.from({ length: 5 }, (_, index) => ({ value: String(currentFiscalYear - index), label: yearLabel(currentFiscalYear - index) })))
const year = ref(String(currentFiscalYear))

const cap = computed(() => isBalance.value ? asOf.value || today : today)
const months = computed(() => isBalance.value
  ? monthsEnding(cap.value, 12)
  : fiscalYearMonths(Number(year.value), fiscalYearStartMonth.value).filter((month) => month <= today.slice(0, 7)))
const range = computed(() => {
  if (isBalance.value || !months.value.length) return { to: cap.value }
  const lastMonthEnd = monthRange(months.value[months.value.length - 1]).to
  return { from: monthRange(months.value[0]).from, to: lastMonthEnd < today ? lastMonthEnd : today }
})

const series = computed(() => {
  const accounts = ledger.accounts.value
  const lines = ledger.lines.value
  if (!months.value.length) return []
  if (!isBalance.value) return monthlyActivity(accounts, lines, page.value.type, months.value, cap.value)
  const balances = monthEndBalances(accounts, lines, page.value.type, months.value, cap.value)
  if (page.value.type !== 'equity') return balances
  const earnings = monthEndEarnings(accounts, lines, months.value, cap.value)
  return balances.map((value, index) => value + earnings[index])
})

const section = computed(() => statementSection(page.value.type, ledger.accounts.value, totalsByAccount(ledger.lines.value, range.value)))
const currentEarnings = computed(() => page.value.type === 'equity' ? balanceSheet(ledger.accounts.value, ledger.lines.value, cap.value).currentEarningsCents : 0)
const total = computed(() => section.value.totalCents + currentEarnings.value)

const breakdown = computed(() => {
  const rows = section.value.groups.map((group) => ({ label: group.category, cents: group.totalCents }))
  if (currentEarnings.value) rows.push({ label: 'Current earnings (unclosed)', cents: currentEarnings.value })
  return rows.sort((a, b) => b.cents - a.cents)
})
const accountRows = computed<StatementAccountRow[]>(() => section.value.groups.flatMap((group) => group.accounts).sort((a, b) => b.amountCents - a.amountCents))
const largestBar = computed(() => Math.max(1, ...breakdown.value.map((row) => Math.abs(row.cents))))
const share = (cents: number) => total.value > 0 ? percent(cents / total.value * 100) : '—'

function delta(current: number, previous: number) {
  const change = current - previous
  return { change, pct: previous !== 0 ? `${change >= 0 ? '+' : '-'}${percent(Math.abs(change / previous) * 100)}` : '' }
}
const lastIndex = computed(() => series.value.length - 1)
const monthDelta = computed(() => lastIndex.value > 0 ? delta(series.value[lastIndex.value], series.value[lastIndex.value - 1]) : null)
const yearDelta = computed(() => lastIndex.value > 0 ? delta(series.value[lastIndex.value], series.value[0]) : null)
const monthlyAverage = computed(() => series.value.length ? Math.round(series.value.reduce((sum, value) => sum + value, 0) / series.value.length) : 0)

const totalAssets = computed(() => statementSection('asset', ledger.accounts.value, totalsByAccount(ledger.lines.value, { to: cap.value })).totalCents)
const periodRevenue = computed(() => statementSection('revenue', ledger.accounts.value, totalsByAccount(ledger.lines.value, range.value)).totalCents)
const fourthTile = computed(() => {
  switch (page.value.type) {
    case 'asset': return { label: 'Accounts with balances', value: String(accountRows.value.length), note: `Across ${breakdown.value.length} categories` }
    case 'liability':
    case 'equity': return { label: 'Share of total assets', value: totalAssets.value > 0 ? percent(total.value / totalAssets.value * 100) : '—', note: `${page.value.label} ÷ total assets` }
    case 'revenue': return { label: 'Largest category', value: breakdown.value[0]?.label ?? '—', note: breakdown.value[0] ? `${share(breakdown.value[0].cents)} of revenue` : '' }
    case 'expense': return { label: 'Share of revenue', value: periodRevenue.value > 0 ? percent(total.value / periodRevenue.value * 100) : '—', note: 'Expenses ÷ revenue, same period' }
  }
})
const periodText = computed(() => isBalance.value
  ? `As of ${formatLongDate(cap.value)}`
  : months.value.length ? `${yearLabel(Number(year.value))} · ${monthLabel(months.value[0], true)} to ${monthLabel(months.value[lastIndex.value], true)}` : '')
const hasData = computed(() => section.value.groups.length > 0 || currentEarnings.value !== 0)
</script>

<template>
  <section class="ws-page an-page" :aria-label="`${page.label} analytics`">
    <div class="ws-stack">
      <p class="ws-note"><Info :size="14" aria-hidden="true" />{{ ledger.source.value.label }} · {{ isBalance ? 'Balances from posted entries.' : 'Posted activity per month.' }}<template v-if="page.type === 'equity'"> Includes revenue less expenses not yet closed to equity (assumption pending confirmation).</template></p>

      <div class="ws-panel">
        <div class="ws-toolbar">
          <div v-if="isBalance" class="ws-toolbar__field"><AppDatePicker :id="`${pageId}-as-of`" v-model="asOf" label="As of" :max="today" /></div>
          <div v-else class="ws-toolbar__field"><AppSelect :id="`${pageId}-year`" v-model="year" :label="fiscalYearStartMonth === 1 ? 'Year' : 'Fiscal year'" :options="yearOptions" /></div>
          <span class="ws-toolbar__spacer" />
          <span class="ws-muted">{{ periodText }}</span>
        </div>
      </div>

      <div v-if="ledger.loading.value" class="ws-panel"><div class="ws-loading" role="status"><span class="ws-spinner" aria-hidden="true" />Loading ledger…</div></div>
      <div v-else-if="ledger.error.value" class="ws-panel">
        <div class="ws-empty" role="alert">
          <span class="ws-empty__icon"><AlertTriangle :size="22" aria-hidden="true" /></span>
          <strong>Analytics could not be loaded</strong><span>{{ ledger.error.value }}</span>
          <button class="ws-button" type="button" @click="ledger.reload"><RotateCw :size="15" aria-hidden="true" /> Try again</button>
        </div>
      </div>
      <div v-else-if="!hasData" class="ws-panel">
        <div class="ws-empty">
          <span class="ws-empty__icon"><BarChart3 :size="22" aria-hidden="true" /></span>
          <strong>No {{ page.label.toLocaleLowerCase() }} to analyze</strong>
          <span>{{ isBalance ? 'No balances exist up to this date.' : 'No activity was posted in this year.' }} Try another {{ isBalance ? 'date' : 'year' }}.</span>
        </div>
      </div>
      <template v-else>
        <div class="an-kpis">
          <div class="an-kpi an-kpi--hero">
            <span>{{ isBalance ? `Total ${page.label.toLocaleLowerCase()}` : `${page.label}, year to date` }}</span>
            <strong>{{ money(total) }}</strong>
            <small>{{ periodText }}</small>
          </div>
          <div class="an-kpi">
            <span>{{ isBalance ? 'Change vs. last month end' : `Latest month · ${monthLabel(months[lastIndex], true)}` }}</span>
            <strong>{{ isBalance ? (monthDelta ? money(monthDelta.change) : '—') : money(series[lastIndex] ?? 0) }}</strong>
            <small v-if="monthDelta" class="an-delta">
              <ArrowUpRight v-if="monthDelta.change >= 0" :size="14" aria-hidden="true" /><ArrowDownRight v-else :size="14" aria-hidden="true" />
              {{ isBalance ? monthDelta.pct || 'No prior balance' : `${money(monthDelta.change)} vs. prior month` }}
            </small>
          </div>
          <div class="an-kpi">
            <span>{{ isBalance ? `Change since end of ${monthLabel(months[0], true)}` : 'Monthly average' }}</span>
            <strong>{{ isBalance ? (yearDelta ? money(yearDelta.change) : '—') : money(monthlyAverage) }}</strong>
            <small v-if="isBalance && yearDelta" class="an-delta">
              <ArrowUpRight v-if="yearDelta.change >= 0" :size="14" aria-hidden="true" /><ArrowDownRight v-else :size="14" aria-hidden="true" />
              {{ yearDelta.pct || 'No balance at the start' }}
            </small>
            <small v-else-if="!isBalance">Over {{ months.length }} month{{ months.length === 1 ? '' : 's' }}</small>
          </div>
          <div class="an-kpi"><span>{{ fourthTile.label }}</span><strong>{{ fourthTile.value }}</strong><small>{{ fourthTile.note }}</small></div>
        </div>

        <div class="an-grid">
          <div class="ws-panel">
            <div class="ws-panel__header"><div><h2>{{ isBalance ? `${page.label} at each month end` : `${page.label} by month` }}</h2><p>{{ isBalance ? 'The last point is the as-of date.' : 'Posted activity on the normal side of each account.' }}</p></div></div>
            <TrendChart :labels="months.map((month) => monthLabel(month))" :values="series" :kind="isBalance ? 'line' : 'column'" :series-name="page.label" />
            <details class="an-data-table">
              <summary>Show data table</summary>
              <table class="ws-table"><thead><tr><th scope="col">Month</th><th scope="col" class="ws-num">{{ page.label }}</th></tr></thead>
                <tbody><tr v-for="(month, index) in months" :key="month"><td>{{ monthLabel(month, true) }}</td><td class="ws-num">{{ amount(series[index]) }}</td></tr></tbody>
              </table>
            </details>
          </div>

          <div class="ws-panel">
            <div class="ws-panel__header"><div><h2>By category</h2><p>Share of total {{ page.label.toLocaleLowerCase() }}</p></div></div>
            <ul class="an-bars">
              <li v-for="row in breakdown" :key="row.label">
                <span class="an-bars__label" :title="row.label">{{ row.label }}</span>
                <span class="an-bars__value">{{ money(row.cents) }}<small>{{ share(row.cents) }}</small></span>
                <span class="an-bars__track" aria-hidden="true"><span class="an-bars__fill" :class="{ 'an-bars__fill--negative': row.cents < 0 }" :style="{ width: `${Math.abs(row.cents) / largestBar * 100}%` }" /></span>
              </li>
            </ul>
          </div>
        </div>

        <div class="ws-panel ws-panel--clip">
          <div class="ws-panel__header"><div><h2>Accounts</h2><p>Largest first. Negative amounts are contra balances, such as accumulated depreciation.</p></div></div>
          <div class="ws-table-wrap">
            <table class="ws-table">
              <thead><tr><th scope="col">Code</th><th scope="col">Account</th><th scope="col">Category</th><th scope="col" class="ws-num">Amount</th><th scope="col" class="ws-num">Share</th></tr></thead>
              <tbody>
                <tr v-for="row in accountRows" :key="row.account.id">
                  <td class="ws-muted ws-nowrap">{{ row.account.code }}</td><td>{{ row.account.name }}</td><td class="ws-muted">{{ row.account.category }}</td>
                  <td class="ws-num">{{ amount(row.amountCents) }}</td><td class="ws-num">{{ share(row.amountCents) }}</td>
                </tr>
                <tr v-if="currentEarnings"><td class="ws-muted">—</td><td>Current earnings (unclosed)</td><td class="ws-muted">Revenue less expenses</td><td class="ws-num">{{ amount(currentEarnings) }}</td><td class="ws-num">{{ share(currentEarnings) }}</td></tr>
              </tbody>
              <tfoot><tr><th scope="row" colspan="3">Total</th><td class="ws-num">{{ amount(total) }}</td><td class="ws-num">{{ total > 0 ? '100.0%' : '—' }}</td></tr></tfoot>
            </table>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
