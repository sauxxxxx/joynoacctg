<script setup lang="ts">
import { computed, ref } from 'vue'
import DateRangeFilter from '../../workspace/DateRangeFilter.vue'
import { balanceSheet, type StatementSection } from './ledgerMath'
import { amount, csvAmount } from './reportFormat'
import { exportReport } from './reportExport'
import { formatLongDate } from './reportPeriods'
import BalanceCheck from './BalanceCheck.vue'
import ReportFrame from './ReportFrame.vue'
import StatementRows from './StatementRows.vue'
import { useAsOfDate } from './useReportPeriod'
import { useLedger } from './useLedger'

const ledger = useLedger()
const { range, defaultRange, asOf } = useAsOfDate()
const detailed = ref(true)

const sheet = computed(() => balanceSheet(ledger.accounts.value, ledger.lines.value, asOf.value))
const period = computed(() => `As of ${formatLongDate(asOf.value)}`)
const totalEquity = computed(() => sheet.value.equity.totalCents + sheet.value.currentEarningsCents)
const hasData = computed(() => sheet.value.assets.groups.length + sheet.value.liabilities.groups.length + sheet.value.equity.groups.length > 0 || sheet.value.currentEarningsCents !== 0)

function sectionRows(label: string, section: StatementSection): (string | number)[][] {
  const rows: (string | number)[][] = [[label.toLocaleUpperCase(), '', '']]
  for (const group of section.groups) {
    if (detailed.value) {
      rows.push([group.category, '', ''])
      for (const row of group.accounts) rows.push([`  ${row.account.name}`, row.account.code, csvAmount(row.amountCents)])
    }
    rows.push([detailed.value ? `Total ${group.category}` : group.category, '', csvAmount(group.totalCents)])
  }
  return rows
}

function exportCsv() {
  const data = sheet.value
  exportReport('Balance Sheet', period.value, [
    ['Line', 'Code', 'Amount'],
    ...sectionRows('Assets', data.assets),
    ['Total assets', '', csvAmount(data.totalAssetsCents)],
    ...sectionRows('Liabilities', data.liabilities),
    ['Total liabilities', '', csvAmount(data.liabilities.totalCents)],
    ...sectionRows('Equity', data.equity),
    ['Current earnings (revenue less expenses, not yet closed)', '', csvAmount(data.currentEarningsCents)],
    ['Total equity', '', csvAmount(totalEquity.value)],
    ['Total liabilities and equity', '', csvAmount(data.totalLiabilitiesAndEquityCents)],
  ])
}
</script>

<template>
  <ReportFrame
    title="Balance Sheet"
    :period="period"
    :loading="ledger.loading.value"
    :error="ledger.error.value"
    :issues="ledger.issues.value"
    :source-note="`${ledger.source.value.label} · Assumption pending confirmation: the ledger has no closing entries, so revenue less expenses to date is shown in equity as current earnings.`"
    :can-export="hasData"
    @export="exportCsv"
    @retry="ledger.reload"
  >
    <template #filters>
      <label class="ws-check"><input v-model="detailed" type="checkbox" /> Show accounts</label>
    </template>
    <template #date><DateRangeFilter v-model="range" :default-value="defaultRange" mode="as-of" /></template>
    <template v-if="hasData" #summary>
      <BalanceCheck
        :balanced="sheet.differenceCents === 0"
        ok-text="Assets equal liabilities plus equity."
        fail-text="Assets do not equal liabilities plus equity."
        :figures="[
          { label: 'Assets', cents: sheet.totalAssetsCents },
          { label: 'Liabilities + equity', cents: sheet.totalLiabilitiesAndEquityCents },
          { label: 'Difference', cents: sheet.differenceCents, hideWhenBalanced: true },
        ]"
      />
    </template>

    <div v-if="!hasData" class="ws-empty"><strong>No balances to show</strong><span>No posted entries exist up to {{ formatLongDate(asOf) }}. Try a later date.</span></div>
    <table v-else class="acct-statement" :class="{ 'acct-statement--simple': !detailed }">
      <thead class="ws-visually-hidden"><tr><th scope="col">Line</th><th scope="col">Amount</th></tr></thead>
      <tbody>
        <StatementRows label="Assets" :section="sheet.assets" :detailed="detailed" empty-text="No asset balances" />
        <tr class="acct-statement__spacer"><td colspan="2" /></tr>
        <StatementRows label="Liabilities" :section="sheet.liabilities" :detailed="detailed" empty-text="No liability balances" />
        <tr class="acct-statement__spacer"><td colspan="2" /></tr>
        <tr class="acct-statement__section"><th scope="rowgroup" colspan="2">Equity</th></tr>
        <template v-for="group in sheet.equity.groups" :key="group.category">
          <template v-if="detailed">
            <tr class="acct-statement__group"><td colspan="2">{{ group.category }}</td></tr>
            <tr v-for="row in group.accounts" :key="row.account.id" class="acct-statement__account"><td>{{ row.account.name }}<small>{{ row.account.code }}</small></td><td class="ws-num">{{ amount(row.amountCents) }}</td></tr>
            <tr class="acct-statement__subtotal"><td>Total {{ group.category }}</td><td class="ws-num">{{ amount(group.totalCents) }}</td></tr>
          </template>
          <tr v-else class="acct-statement__group"><td>{{ group.category }}</td><td class="ws-num">{{ amount(group.totalCents) }}</td></tr>
        </template>
        <tr class="acct-statement__group"><td>Current earnings <span class="ws-muted">(revenue less expenses, not yet closed)</span></td><td class="ws-num">{{ amount(sheet.currentEarningsCents) }}</td></tr>
        <tr class="acct-statement__total"><td>Total equity</td><td class="ws-num">{{ amount(totalEquity) }}</td></tr>
        <tr class="acct-statement__spacer"><td colspan="2" /></tr>
        <tr class="acct-statement__grand"><td>Total liabilities and equity</td><td class="ws-num">{{ amount(sheet.totalLiabilitiesAndEquityCents) }}</td></tr>
      </tbody>
    </table>
  </ReportFrame>
</template>
