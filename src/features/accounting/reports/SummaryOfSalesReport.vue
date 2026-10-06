<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ReceiptText } from '@lucide/vue'
import { customers } from '../../sales/customers/customerPreviewStore'
import { salesDocuments } from '../../sales/salesPreviewStore'
import DateRangeFilter from '../../workspace/DateRangeFilter.vue'
import { amount, csvAmount, money } from './reportFormat'
import { exportReport } from './reportExport'
import { describeRange, monthLabel } from './reportPeriods'
import ReportFrame from './ReportFrame.vue'
import { includedInvoices, summarizeSales, type SalesGrouping, type SalesSummaryRow } from './salesSummary'
import { useReportPeriod } from './useReportPeriod'
import { http } from '../../../services/api/httpClient'
import type { EntityResponseDto } from '../../../contracts/dto'
import { useAsyncResource } from '../../../lib/asyncState'
import { getApiCredentials } from '../../../services/api/session'
import { isPreviewMode } from '../../../services/api/config'
import { companyProfile, reportingSettings, reportTemplates, type CompanyProfile, type ReportingSettings, type ReportTemplate } from '../../company/companyStore'
import type { SalesDocument } from '../../sales/salesPreviewStore'

const emit = defineEmits<{ navigate: [pageId: string] }>()
const { range, defaultRange, presets } = useReportPeriod('year-to-date')
const grouping = ref<SalesGrouping>('customer')
const includeDrafts = ref(false)
const resource = useAsyncResource({ load: async () => {
  if (isPreviewMode) return { documents: salesDocuments.value, customers: customers.value }
  const token = getApiCredentials()?.accessToken
  const response = await http.get<EntityResponseDto<{ documents: SalesDocument[]; customers: { id: string; name: string }[]; profile: CompanyProfile; reporting: ReportingSettings; templates: ReportTemplate[] }>>('/sales-report-context')
  if (token !== getApiCredentials()?.accessToken) throw new Error('Your session changed. Sign in again.')
  companyProfile.value = response.data.profile; reportingSettings.value = response.data.reporting; reportTemplates.value = response.data.templates
  return response.data
} })
onMounted(resource.run)

const documents = computed(() => resource.data.value?.documents ?? [])
const customerName = (id: string) => resource.data.value?.customers.find((customer) => customer.id === id)?.name ?? 'Unknown customer'
const invoices = computed(() => includedInvoices(documents.value.filter((item) => isPreviewMode || includeDrafts.value || Boolean(item.journalEntryId)), range.value, includeDrafts.value))
const summary = computed(() => summarizeSales(invoices.value, grouping.value, (invoice) =>
  grouping.value === 'month' ? monthLabel(invoice.date.slice(0, 7), true) : customerName(invoice.customerId)))
const hasInvoices = computed(() => documents.value.some((item) => item.kind === 'sales-invoices'))
const period = computed(() => `For the period ${describeRange(range.value)}`)
const groupLabel = computed(() => grouping.value === 'month' ? 'Month' : 'Customer')

const csvRow = (row: SalesSummaryRow) => [row.label, row.invoiceCount, csvAmount(row.grossCents), csvAmount(row.discountCents), csvAmount(row.netCents), csvAmount(row.vatCents), csvAmount(row.withholdingCents)]

function exportCsv() {
  exportReport('Summary of Sales', period.value, [
    [groupLabel.value, 'Invoices', 'Gross sales', 'Discounts', 'Net sales (before tax)', 'VAT (as entered)', 'Withholding (as entered)'],
    ...summary.value.rows.map(csvRow),
    csvRow(summary.value.total),
  ])
}
</script>

<template>
  <ReportFrame
    title="Summary of Sales"
    :period="period"
    source-note="Posted sales invoices in the selected period. Unposted invoices are optional; cancelled invoices are excluded. Net sales exclude recorded VAT."
    :loading="resource.loading.value"
    :error="resource.error.value"
    :can-export="summary.rows.length > 0"
    @export="exportCsv"
    @retry="resource.run"
  >
    <template #filters>
      <div class="ws-field">
        <span>Group by</span>
        <div class="ws-tabs" role="group" aria-label="Group by">
          <button type="button" :aria-pressed="grouping === 'customer'" @click="grouping = 'customer'">Customer</button>
          <button type="button" :aria-pressed="grouping === 'month'" @click="grouping = 'month'">Month</button>
        </div>
      </div>
      <label class="ws-check"><input v-model="includeDrafts" type="checkbox" /> Include unposted invoices</label>
    </template>
    <template #date><DateRangeFilter v-model="range" :default-value="defaultRange" :presets="presets" /></template>
    <template v-if="summary.rows.length" #summary>
      <div class="acct-summary-tiles acct-report__summary">
        <div><span>Net sales</span><strong>{{ money(summary.total.netCents) }}</strong><small>Before tax</small></div>
        <div><span>Invoices</span><strong>{{ summary.total.invoiceCount }}</strong></div>
        <div><span>Average invoice</span><strong>{{ money(Math.round(summary.total.netCents / summary.total.invoiceCount)) }}</strong></div>
        <div><span>Discounts given</span><strong>{{ money(summary.total.discountCents) }}</strong></div>
      </div>
    </template>

    <div v-if="!hasInvoices" class="ws-empty">
      <span class="ws-empty__icon"><ReceiptText :size="22" aria-hidden="true" /></span>
      <strong>No sales invoices yet</strong>
      <span>Create an invoice in Sales › Invoices, then review and post it.</span>
      <button class="ws-button" type="button" @click="emit('navigate', 'sales-invoices')">Go to Invoices</button>
    </div>
    <div v-else-if="!summary.rows.length" class="ws-empty"><strong>No invoices in this period</strong><span>Try a wider date range, or include drafts.</span></div>
    <div v-else class="ws-table-wrap">
      <table class="ws-table">
        <thead><tr>
          <th scope="col">{{ groupLabel }}</th><th scope="col" class="ws-num">Invoices</th><th scope="col" class="ws-num">Gross sales</th><th scope="col" class="ws-num">Discounts</th>
          <th scope="col" class="ws-num">Net sales</th><th scope="col" class="ws-num">VAT (entered)</th><th scope="col" class="ws-num">Withholding (entered)</th>
        </tr></thead>
        <tbody>
          <tr v-for="row in summary.rows" :key="row.key">
            <td>{{ row.label }}</td><td class="ws-num">{{ row.invoiceCount }}</td><td class="ws-num">{{ amount(row.grossCents) }}</td><td class="ws-num">{{ amount(row.discountCents) }}</td>
            <td class="ws-num"><strong>{{ amount(row.netCents) }}</strong></td><td class="ws-num">{{ amount(row.vatCents) }}</td><td class="ws-num">{{ amount(row.withholdingCents) }}</td>
          </tr>
        </tbody>
        <tfoot><tr>
          <th scope="row">Total</th><td class="ws-num">{{ summary.total.invoiceCount }}</td><td class="ws-num">{{ amount(summary.total.grossCents) }}</td><td class="ws-num">{{ amount(summary.total.discountCents) }}</td>
          <td class="ws-num">{{ amount(summary.total.netCents) }}</td><td class="ws-num">{{ amount(summary.total.vatCents) }}</td><td class="ws-num">{{ amount(summary.total.withholdingCents) }}</td>
        </tr></tfoot>
      </table>
    </div>
  </ReportFrame>
</template>
