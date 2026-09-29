<script setup lang="ts">
import { computed, ref } from 'vue'
import AppDatePicker from '../../../components/ui/AppDatePicker.vue'
import { reportingSettings } from '../../company/companyStore'
import { accountTypeLabels } from './ledgerContract'
import { trialBalance } from './ledgerMath'
import { amount, amountOrBlank, csvAmount } from './reportFormat'
import { exportReport } from './reportExport'
import { formatLongDate, todayIso } from './reportPeriods'
import BalanceCheck from './BalanceCheck.vue'
import ReportFrame from './ReportFrame.vue'
import { useLedger } from './useLedger'

const ledger = useLedger()
const asOf = ref(todayIso())
const includeZero = ref(reportingSettings.value.includeZeroBalances)
const applied = ref({ asOf: asOf.value, includeZero: includeZero.value })
const filterError = ref('')

const report = computed(() => trialBalance(ledger.accounts.value, ledger.lines.value, applied.value.asOf, applied.value.includeZero))
const period = computed(() => `As of ${formatLongDate(applied.value.asOf)}`)

function generate() {
  if (!asOf.value) { filterError.value = 'Choose an as-of date.'; return }
  filterError.value = ''
  applied.value = { asOf: asOf.value, includeZero: includeZero.value }
}

function exportCsv() {
  exportReport('Trial Balance', period.value, [
    ['Code', 'Account', 'Type', 'Debit', 'Credit'],
    ...report.value.rows.map((row) => [row.account.code, row.account.name, accountTypeLabels[row.account.type], csvAmount(row.debitCents), csvAmount(row.creditCents)]),
    ['', 'Total', '', csvAmount(report.value.totalDebitCents), csvAmount(report.value.totalCreditCents)],
  ])
}
</script>

<template>
  <ReportFrame
    title="Trial Balance"
    :period="period"
    :loading="ledger.loading.value"
    :error="ledger.error.value"
    :issues="ledger.issues.value"
    :source-note="`${ledger.source.value.label} · Net balance of each account from posted entries up to the as-of date.`"
    :can-export="report.rows.length > 0"
    @generate="generate"
    @export="exportCsv"
    @retry="ledger.reload"
  >
    <template #filters>
      <div class="ws-toolbar__field"><AppDatePicker id="tb-as-of" v-model="asOf" label="As of" required :invalid="Boolean(filterError)" /></div>
      <label class="ws-check"><input v-model="includeZero" type="checkbox" /> Include zero balances</label>
    </template>
    <template #filter-error><p v-if="filterError" class="ws-toolbar__error" role="alert">{{ filterError }}</p></template>
    <template #summary>
      <BalanceCheck
        :balanced="report.differenceCents === 0"
        ok-text="Debits equal credits."
        fail-text="Debits and credits do not match."
        :figures="[
          { label: 'Debits', cents: report.totalDebitCents },
          { label: 'Credits', cents: report.totalCreditCents },
          { label: 'Difference', cents: report.differenceCents, hideWhenBalanced: true },
        ]"
      />
    </template>

    <div v-if="!report.rows.length" class="ws-empty"><strong>No balances to show</strong><span>No posted entries exist up to {{ formatLongDate(applied.asOf) }}. Try a later date.</span></div>
    <div v-else class="ws-table-wrap">
      <table class="ws-table">
        <thead><tr><th scope="col">Code</th><th scope="col">Account</th><th scope="col">Type</th><th scope="col" class="ws-num">Debit</th><th scope="col" class="ws-num">Credit</th></tr></thead>
        <tbody>
          <tr v-for="row in report.rows" :key="row.account.id">
            <td class="ws-nowrap ws-muted">{{ row.account.code }}</td>
            <td>{{ row.account.name }}</td>
            <td class="ws-nowrap ws-muted">{{ accountTypeLabels[row.account.type] }}</td>
            <td class="ws-num">{{ amountOrBlank(row.debitCents) }}</td>
            <td class="ws-num">{{ amountOrBlank(row.creditCents) }}</td>
          </tr>
        </tbody>
        <tfoot><tr><th scope="row" colspan="3">Total</th><td class="ws-num">{{ amount(report.totalDebitCents) }}</td><td class="ws-num">{{ amount(report.totalCreditCents) }}</td></tr></tfoot>
      </table>
    </div>
  </ReportFrame>
</template>
