<script setup lang="ts">
import BalanceSheetReport from './BalanceSheetReport.vue'
import GeneralLedgerReport from './GeneralLedgerReport.vue'
import IncomeStatementReport from './IncomeStatementReport.vue'
import type { AccountingReportPageId } from './reportPages'
import SummaryOfSalesReport from './SummaryOfSalesReport.vue'
import TrialBalanceReport from './TrialBalanceReport.vue'

defineProps<{ pageId: AccountingReportPageId }>()
const emit = defineEmits<{ navigate: [pageId: string] }>()
</script>

<template>
  <GeneralLedgerReport v-if="pageId === 'general-ledger'" />
  <TrialBalanceReport v-else-if="pageId === 'trial-balance'" />
  <IncomeStatementReport v-else-if="pageId === 'income-statement-annual'" key="annual" variant="annual" />
  <IncomeStatementReport v-else-if="pageId === 'income-statement-annual-simple'" key="annual-simple" variant="annual-simple" />
  <IncomeStatementReport v-else-if="pageId === 'income-statement-monthly-simple'" key="monthly-simple" variant="monthly-simple" />
  <SummaryOfSalesReport v-else-if="pageId === 'summary-of-sales'" @navigate="emit('navigate', $event)" />
  <BalanceSheetReport v-else-if="pageId === 'balance-sheet'" />
</template>
