<script setup lang="ts">
import { computed, ref } from 'vue'
import AppSelect from '../../../components/ui/AppSelect.vue'
import { journalSourceLabels } from './ledgerContract'
import { generalLedger } from './ledgerMath'
import { amountOrBlank, csvAmount, drCr } from './reportFormat'
import { exportReport } from './reportExport'
import { describeRange, formatShortDate } from './reportPeriods'
import PeriodFields from './PeriodFields.vue'
import ReportFrame from './ReportFrame.vue'
import { usePeriodFilter } from './usePeriodFilter'
import { useLedger } from './useLedger'

const ledger = useLedger()
const filter = usePeriodFilter('this-month')
const accountId = ref('')
const appliedAccountId = ref('')

const accountOptions = computed(() => [
  { value: '', label: 'All accounts with activity' },
  ...ledger.accounts.value.map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` })),
])
const sections = computed(() => generalLedger(ledger.accounts.value, ledger.lines.value, {
  ...filter.applied.value,
  accountId: appliedAccountId.value || undefined,
}))
const period = computed(() => {
  const account = ledger.accounts.value.find((item) => item.id === appliedAccountId.value)
  return `${account ? `${account.code} ${account.name} · ` : ''}${describeRange(filter.applied.value)}`
})
const lineCount = computed(() => sections.value.reduce((sum, section) => sum + section.rows.length, 0))

function generate() {
  if (filter.apply()) appliedAccountId.value = accountId.value
}

function exportCsv() {
  const rows: (string | number)[][] = [['Account code', 'Account', 'Date', 'Entry #', 'Journal', 'Reference', 'Description', 'Debit', 'Credit', 'Balance (Dr + / Cr −)']]
  for (const section of sections.value) {
    const { code, name } = section.account
    rows.push([code, name, filter.applied.value.from, '', '', '', 'Opening balance', '', '', csvAmount(section.openingCents)])
    for (const { line, runningCents } of section.rows) {
      rows.push([code, name, line.date, line.entryNumber, journalSourceLabels[line.source], line.reference, line.description, csvAmount(line.debitCents), csvAmount(line.creditCents), csvAmount(runningCents)])
    }
    rows.push([code, name, filter.applied.value.to, '', '', '', 'Closing balance', csvAmount(section.periodDebitCents), csvAmount(section.periodCreditCents), csvAmount(section.closingCents)])
  }
  exportReport('General Ledger (Detailed)', period.value, rows)
}
</script>

<template>
  <ReportFrame
    title="General Ledger (Detailed)"
    :period="period"
    :loading="ledger.loading.value"
    :error="ledger.error.value"
    :issues="ledger.issues.value"
    :source-note="`${ledger.source.value.label} · Posted lines per account. Balances show the side they fall on (Dr or Cr); the opening balance includes everything before the start date.`"
    :can-export="sections.length > 0"
    @generate="generate"
    @export="exportCsv"
    @retry="ledger.reload"
  >
    <template #filters>
      <div class="ws-toolbar__field ws-toolbar__field--wide"><AppSelect id="gl-account" v-model="accountId" label="Account" :options="accountOptions" /></div>
      <PeriodFields :filter="filter" id-prefix="gl" />
    </template>
    <template #filter-error><p v-if="filter.error.value" class="ws-toolbar__error" role="alert">{{ filter.error.value }}</p></template>

    <div v-if="!sections.length" class="ws-empty"><strong>No ledger activity</strong><span>No account has a balance or posted lines in this period. Try a wider date range.</span></div>
    <div v-else class="ws-table-wrap">
      <table class="ws-table acct-ledger">
        <caption class="ws-visually-hidden">{{ sections.length }} accounts, {{ lineCount }} posted lines</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Entry #</th><th scope="col">Journal</th><th scope="col">Reference</th><th scope="col">Description</th><th scope="col" class="ws-num">Debit</th><th scope="col" class="ws-num">Credit</th><th scope="col" class="ws-num">Balance</th></tr></thead>
        <tbody v-for="section in sections" :key="section.account.id">
          <tr class="acct-ledger__account"><td colspan="8">{{ section.account.code }} · {{ section.account.name }}<small>{{ section.account.category }}</small></td></tr>
          <tr class="acct-ledger__opening"><td class="ws-nowrap">{{ formatShortDate(filter.applied.value.from) }}</td><td colspan="4">Opening balance</td><td /><td /><td class="ws-num">{{ drCr(section.openingCents) }}</td></tr>
          <tr v-for="({ line, runningCents }, index) in section.rows" :key="`${line.entryId}-${index}`">
            <td class="ws-nowrap">{{ formatShortDate(line.date) }}</td>
            <td class="ws-nowrap">{{ line.entryNumber }}</td>
            <td class="ws-nowrap ws-muted">{{ journalSourceLabels[line.source] }}</td>
            <td class="ws-nowrap">{{ line.reference }}</td>
            <td>{{ line.description }}</td>
            <td class="ws-num">{{ amountOrBlank(line.debitCents) }}</td>
            <td class="ws-num">{{ amountOrBlank(line.creditCents) }}</td>
            <td class="ws-num">{{ drCr(runningCents) }}</td>
          </tr>
          <tr v-if="!section.rows.length"><td colspan="8" class="ws-muted">No posted lines in this period</td></tr>
          <tr class="acct-ledger__closing"><td class="ws-nowrap">{{ formatShortDate(filter.applied.value.to) }}</td><td colspan="4">Totals and closing balance</td><td class="ws-num">{{ amountOrBlank(section.periodDebitCents) }}</td><td class="ws-num">{{ amountOrBlank(section.periodCreditCents) }}</td><td class="ws-num">{{ drCr(section.closingCents) }}</td></tr>
        </tbody>
      </table>
    </div>
  </ReportFrame>
</template>
