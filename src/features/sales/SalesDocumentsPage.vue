<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Download, Plus, Search } from '@lucide/vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { useLedger } from '../accounting/reports/useLedger'
import { createPostedJournals, generatedJournals, type CreateJournalInput } from '../accounting/workflows/accountingWorkflow'
import { isAddOnEnabled, recordAudit } from '../company/companyStore'
import DateRangeFilter from '../workspace/DateRangeFilter.vue'
import { customers } from './customers/customerPreviewStore'
import ReceiptForm from './ReceiptForm.vue'
import SalesBulkInvoices from './SalesBulkInvoices.vue'
import SalesInvoiceForm from './SalesInvoiceForm.vue'
import { downloadCsv, toCsv } from './salesCsv'
import { reportDate, tableAmount } from './salesFormat'
import { salesDocuments, setupRecords, type DocumentKind, type SalesDocument } from './salesPreviewStore'
import { invoiceBalanceCents, invoiceStatus, postedReceiptsTotalCents } from './salesRules'
import { paginate } from '../../lib/tableQuery'
import './sales-pages.css'

const props = defineProps<{ pageId: DocumentKind }>()
const titles: Record<DocumentKind, string> = {
  'sales-invoices': 'Invoices',
  'sales-receipts': 'Receipts',
  'acknowledgement-receipts': 'Acknowledgement Receipts',
}
const singulars: Record<DocumentKind, string> = { 'sales-invoices': 'invoice', 'sales-receipts': 'receipt', 'acknowledgement-receipts': 'acknowledgement receipt' }

const pad = (value: number) => String(value).padStart(2, '0')
const dateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const now = new Date()
const defaultRange = { from: dateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to: dateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
const dateRange = ref({ ...defaultRange })
const customerFilter = ref('')
const search = ref('')
const statusFilter = ref('all')
const bulkOpen = ref(false)
// Every document opens in a full-page editor, as in the legacy screens. `null` shows the list.
const editor = ref<{ doc: SalesDocument | null } | null>(null)
const notice = ref('')
const currentPage = ref(1)
const pageSize = 25

const title = computed(() => titles[props.pageId])
const singular = computed(() => singulars[props.pageId])
const isInvoice = computed(() => props.pageId === 'sales-invoices')
const isAcknowledgement = computed(() => props.pageId === 'acknowledgement-receipts')
const statusOptions = computed(() => isInvoice.value ? ['Draft', 'Unpaid', 'Paid', 'Cancelled'] : ['Draft', isAcknowledgement.value ? 'Issued' : 'Posted', 'Cancelled'])
const statusFilterOptions = computed(() => [{ value: 'all', label: 'All statuses' }, ...statusOptions.value.map((status) => ({ value: status, label: status }))])
const customerFilterOptions = computed(() => [{ value: '', label: 'All customers' }, ...customers.value.map((customer) => ({ value: customer.id, label: customer.name }))])

// Views, as in the legacy screens: invoices have Search / Unjournalized / Unpaid; receipts have Search / Unjournalized.
type View = 'search' | 'unjournalized' | 'unpaid'
const view = ref<View>('search')
const views = computed<{ id: View; label: string }[]>(() => [
  { id: 'search', label: 'Search' }, { id: 'unjournalized', label: 'Unjournalized' },
  ...(isInvoice.value ? [{ id: 'unpaid' as View, label: 'Unpaid' }] : []),
])
const selectedIds = ref<string[]>([])
const ledger = useLedger()
watch(() => props.pageId, () => {
  view.value = 'search'; selectedIds.value = []; statusFilter.value = 'all'; search.value = ''; customerFilter.value = ''
  editor.value = null; bulkOpen.value = false; notice.value = ''
})

const records = computed(() => salesDocuments.value.filter((item) => item.kind === props.pageId))
const statusOf = (item: SalesDocument) => item.kind === 'sales-invoices' ? invoiceStatus(item, salesDocuments.value) : item.status

/**
 * A document counts as journalized once a journal entry references its number: Sales Journal for invoices,
 * Cash Receipt Journal for receipts. Assumption pending confirmation: the journal service links entries by reference.
 */
const journalizedNumbers = computed(() => {
  const source = isInvoice.value ? 'sales' : 'cash-receipt'
  return new Set([
    ...ledger.lines.value.filter((line) => line.source === source).map((line) => line.reference.trim().toLocaleLowerCase()),
    ...generatedJournals.value.filter((entry) => entry.kind === `${source}-journal`).map((entry) => entry.referenceNumber.trim().toLocaleLowerCase()),
  ])
})
const unpaidAmount = (item: SalesDocument) => invoiceBalanceCents(salesDocuments.value, item)
const viewTitle = computed(() => {
  if (view.value === 'unjournalized') return `Unjournalized ${isInvoice.value ? 'Sales Invoice' : isAcknowledgement.value ? 'Acknowledgement Receipts' : 'Receipts'}`
  if (view.value === 'unpaid') return 'Unpaid Sales Invoice'
  return title.value
})
const viewNote = computed(() => {
  if (view.value === 'unjournalized') return `${isInvoice.value ? 'Issued invoices' : 'Issued receipts'} with no journal entry yet. Every sale must be journalized before it appears in financial reports and tax forms.`
  if (view.value === 'unpaid') return 'Issued invoices that still have a balance.'
  return `Review and prepare ${title.value.toLocaleLowerCase()}.`
})

const visibleRecords = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return records.value.filter((item) => {
    if (dateRange.value.from && item.date < dateRange.value.from) return false
    if (dateRange.value.to && item.date > dateRange.value.to) return false
    if (customerFilter.value && !isAcknowledgement.value && item.customerId !== customerFilter.value) return false
    const status = statusOf(item)
    if (view.value === 'unpaid' && status !== 'Unpaid') return false
    if (view.value === 'unjournalized' && (!['Unpaid', 'Paid', 'Posted', 'Issued'].includes(status) || journalizedNumbers.value.has(item.number.trim().toLocaleLowerCase()))) return false
    if (view.value === 'search' && statusFilter.value !== 'all' && status !== statusFilter.value) return false
    return !term || `${item.number} ${customerName(item.customerId)} ${status} ${item.remarks}`.toLocaleLowerCase().includes(term)
  })
})
const pagedRecords = computed(() => paginate(visibleRecords.value, currentPage.value, pageSize).items)
watch(visibleRecords, () => { currentPage.value = 1 })

type ColumnKey = 'number' | 'date' | 'customer' | 'paymentTerm' | 'paymentMethod' | 'status' | 'amount' | 'invoiceTotal' | 'totalPaid' | 'totalUnpaid' | 'remarks'
interface Column { key: ColumnKey; label: string; numeric?: boolean }
// Column order follows the legacy screens for each view.
const columns = computed<Column[]>(() => {
  if (isInvoice.value && view.value === 'unjournalized') return [
    { key: 'number', label: 'Sales Invoice #' }, { key: 'date', label: 'Date' }, { key: 'customer', label: 'Customer' },
    { key: 'status', label: 'Status' }, { key: 'paymentTerm', label: 'Payment Term' }, { key: 'amount', label: 'Total Amount', numeric: true },
    { key: 'remarks', label: 'Remarks' },
  ]
  if (isInvoice.value && view.value === 'unpaid') return [
    { key: 'number', label: 'Sales Invoice #' }, { key: 'date', label: 'Date' }, { key: 'customer', label: 'Customer' },
    { key: 'paymentTerm', label: 'Payment Term' }, { key: 'status', label: 'Status' }, { key: 'totalPaid', label: 'Total Paid', numeric: true },
    { key: 'amount', label: 'Total Amount', numeric: true }, { key: 'totalUnpaid', label: 'Total Unpaid', numeric: true },
  ]
  if (isInvoice.value) return [
    { key: 'number', label: 'Invoice #' }, { key: 'date', label: 'Date' }, { key: 'customer', label: 'Customer' },
    { key: 'paymentTerm', label: 'Payment Term' }, { key: 'status', label: 'Status' }, { key: 'amount', label: 'Total Amount', numeric: true },
    { key: 'totalPaid', label: 'Total Paid', numeric: true }, { key: 'remarks', label: 'Remarks' },
  ]
  if (isAcknowledgement.value) return [
    { key: 'number', label: 'AR#' }, { key: 'date', label: 'Date' }, { key: 'customer', label: 'Customer' },
    { key: 'paymentMethod', label: 'Payment Method' }, { key: 'status', label: 'Status' }, { key: 'amount', label: 'Total Amount', numeric: true },
  ]
  return [
    { key: 'number', label: 'Collection Receipt #' }, { key: 'date', label: 'Date' }, { key: 'customer', label: 'Customer' },
    { key: 'status', label: 'Status' }, { key: 'paymentMethod', label: 'Payment Method' }, { key: 'amount', label: 'Amount', numeric: true },
    { key: 'invoiceTotal', label: 'Total Amount', numeric: true },
  ]
})
// Footer totals appear under these columns, as in the legacy screens.
const totalledColumns: ColumnKey[] = ['amount', 'invoiceTotal', 'totalPaid', 'totalUnpaid']
const showSelect = computed(() => view.value === 'unjournalized')
const columnSpan = computed(() => columns.value.length + (showSelect.value ? 1 : 0))
const allSelected = computed(() => visibleRecords.value.length > 0 && visibleRecords.value.every((item) => selectedIds.value.includes(item.id)))

/**
 * A receipt's "Total Amount" is the combined total of the invoices it pays, next to the amount received.
 * Assumption pending confirmation: the legacy column means the invoice total.
 */
function invoiceTotalFor(item: SalesDocument): number {
  return item.payments.reduce((sum, row) => sum + (salesDocuments.value.find((doc) => doc.id === row.invoiceId)?.amountCents ?? 0), 0)
}

function columnTotal(key: ColumnKey): number {
  return visibleRecords.value.reduce((sum, item) => {
    switch (key) {
      case 'amount': return sum + item.amountCents
      case 'totalPaid': return sum + postedReceiptsTotalCents(salesDocuments.value, item.id)
      case 'totalUnpaid': return sum + unpaidAmount(item)
      default: return sum + invoiceTotalFor(item)
    }
  }, 0)
}

function cellText(item: SalesDocument, key: ColumnKey): string {
  switch (key) {
    case 'number': return item.number
    case 'date': return reportDate(item.date)
    case 'customer': return customerName(item.customerId)
    case 'paymentTerm': return setupName(item.paymentTermId)
    case 'paymentMethod': return setupName(item.paymentMethodId)
    case 'status': return statusOf(item)
    case 'amount': return tableAmount(item.amountCents)
    case 'invoiceTotal': return item.payments.some((row) => row.invoiceId) ? tableAmount(invoiceTotalFor(item)) : '—'
    case 'totalPaid': return tableAmount(postedReceiptsTotalCents(salesDocuments.value, item.id))
    case 'totalUnpaid': return tableAmount(unpaidAmount(item))
    case 'remarks': return item.remarks || '—'
  }
}

function customerName(id: string) { return customers.value.find((item) => item.id === id)?.name ?? 'Unknown customer' }
function setupName(id: string) { return setupRecords.value.find((item) => item.id === id)?.name ?? '—' }

/** Raw numbers for money columns so the exported file can be summed; everything else as shown on screen. */
function csvValue(item: SalesDocument, key: ColumnKey): string | number {
  switch (key) {
    case 'amount': return item.amountCents
    case 'invoiceTotal': return invoiceTotalFor(item)
    case 'totalPaid': return postedReceiptsTotalCents(salesDocuments.value, item.id)
    case 'totalUnpaid': return unpaidAmount(item)
    case 'remarks': return item.remarks
    case 'date': return item.date
    default: return cellText(item, key)
  }
}
function exportCsv() {
  if (!visibleRecords.value.length) { notice.value = 'Nothing to export. Change the filters first.'; return }
  const csv = toCsv(columns.value.map((column) => column.label), visibleRecords.value.map((item) => columns.value.map((column) => csvValue(item, column.key))))
  const name = viewTitle.value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  downloadCsv(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  notice.value = `Exported ${visibleRecords.value.length} row${visibleRecords.value.length === 1 ? '' : 's'} to CSV.`
}

// Ctrl+Shift+A opens a new record from the list, as in the legacy screens.
function onShortcut(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLocaleLowerCase() !== 'a') return
  if (editor.value || bulkOpen.value || document.querySelector('dialog[open]')) return
  event.preventDefault()
  open(null)
}
onMounted(() => window.addEventListener('keydown', onShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', onShortcut))

function toggleRow(id: string) {
  selectedIds.value = selectedIds.value.includes(id) ? selectedIds.value.filter((value) => value !== id) : [...selectedIds.value, id]
}
function toggleAll() {
  selectedIds.value = allSelected.value ? [] : visibleRecords.value.map((item) => item.id)
}
function chooseView(next: View) {
  view.value = next
  selectedIds.value = []
}
function open(doc: SalesDocument | null) {
  editor.value = { doc }
  notice.value = ''
}
function done(message: string) {
  editor.value = null
  notice.value = message
}
function onBulkSaved(count: number) {
  bulkOpen.value = false
  notice.value = `${count} draft invoice${count === 1 ? '' : 's'} added.`
  recordAudit('Sales', 'Created', 'Invoices (bulk)', `${count} draft invoice${count === 1 ? '' : 's'}`)
}

function createJournals() {
  const selected = visibleRecords.value.filter((item) => selectedIds.value.includes(item.id))
  try {
    const inputs: CreateJournalInput[] = selected.map((item) => {
      if (item.amountCents <= 0) throw new Error(`Enter a positive amount for ${item.number}.`)
      const invoice = item.kind === 'sales-invoices'
      return {
        kind: invoice ? 'sales-journal' : 'cash-receipt-journal', sourceKey: `sales:${item.id}`,
        referenceNumber: item.number, date: item.date, party: customerName(item.customerId), remarks: item.remarks,
        lines: invoice
          ? [{ accountId: '103', debitCents: item.amountCents, creditCents: 0 }, { accountId: '401', debitCents: 0, creditCents: item.amountCents }]
          : [{ accountId: '101', debitCents: item.amountCents, creditCents: 0 }, { accountId: '103', debitCents: 0, creditCents: item.amountCents }],
      }
    })
    const results = createPostedJournals(inputs)
    const created = results.filter((result) => result.created).length
    notice.value = created ? `${created} journal ${created === 1 ? 'entry' : 'entries'} created and posted.` : 'The selected documents were already journalized.'
    selectedIds.value = []
  } catch (error) {
    notice.value = error instanceof Error ? error.message : 'The selected documents could not be journalized.'
  }
}
</script>

<template>
  <SalesInvoiceForm v-if="isInvoice && editor" :key="editor.doc?.id ?? 'new'" :invoice="editor.doc" @close="editor = null" @saved="done" />
  <ReceiptForm v-else-if="editor && !isInvoice" :key="`${pageId}-${editor.doc?.id ?? 'new'}`" :kind="pageId as 'sales-receipts' | 'acknowledgement-receipts'" :receipt="editor.doc" @close="editor = null" @saved="done" @deleted="done" />
  <SalesBulkInvoices v-else-if="isInvoice && bulkOpen" @close="bulkOpen = false" @saved="onBulkSaved" />
  <section v-else class="sales-page" :aria-label="title">
    <p v-if="notice" class="sales-notice" role="status">{{ notice }}</p>
    <div class="sales-tabs" role="tablist" :aria-label="`${title} views`">
      <button v-for="item in views" :id="`docs-tab-${item.id}`" :key="item.id" type="button" role="tab" class="sales-tabs__tab" :aria-selected="view === item.id" aria-controls="docs-tab-panel" @click="chooseView(item.id)">{{ item.label }}</button>
    </div>
    <div id="docs-tab-panel" class="sales-panel" role="tabpanel" :aria-labelledby="`docs-tab-${view}`">
      <div class="sales-panel__toolbar">
        <div><h2>{{ viewTitle }}</h2><p>{{ viewNote }}</p></div>
        <div class="sales-panel__actions">
          <label class="sales-search"><Search :size="16" aria-hidden="true" /><input v-model="search" type="search" placeholder="Type to filter" :aria-label="`Search ${title}`" /></label>
          <AppSelect v-if="view === 'search'" v-model="statusFilter" aria-label="Filter by status" :options="statusFilterOptions" compact />
          <AppSelect v-if="!isAcknowledgement" v-model="customerFilter" aria-label="Filter by customer" :options="customerFilterOptions" compact />
          <DateRangeFilter v-model="dateRange" :default-value="defaultRange" />
          <button class="sales-button sales-button--primary" type="button" title="Ctrl+Shift+A" @click="open(null)"><Plus :size="16" aria-hidden="true" /> New {{ singular }}</button>
          <button class="sales-button" type="button" :disabled="!visibleRecords.length" @click="exportCsv"><Download :size="16" aria-hidden="true" /> Export CSV</button>
          <button v-if="isInvoice && view !== 'unjournalized' && isAddOnEnabled('bulk-invoice-import')" class="sales-button" type="button" @click="bulkOpen = true">Add multiple</button>
          <button v-if="showSelect" class="sales-button" type="button" :disabled="!selectedIds.length" @click="createJournals">Create journal</button>
        </div>
      </div>
      <div class="sales-table-wrap">
        <table class="sales-table sales-document-table">
          <thead><tr>
            <th v-if="showSelect" scope="col" class="sales-table__select"><input type="checkbox" :checked="allSelected" :disabled="!visibleRecords.length" :aria-label="`Select all ${title.toLocaleLowerCase()}`" @change="toggleAll" /></th>
            <th v-for="column in columns" :key="column.key" scope="col" :class="{ 'sales-table__number': column.numeric }">{{ column.label }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="item in pagedRecords" :key="item.id" class="sales-table__row--open" @click="open(item)">
              <td v-if="showSelect" class="sales-table__select" @click.stop><input type="checkbox" :checked="selectedIds.includes(item.id)" :aria-label="`Select ${singular} ${item.number}`" @change="toggleRow(item.id)" /></td>
              <td v-for="column in columns" :key="column.key" :class="{ 'sales-table__number': column.numeric }">
                <button v-if="column.key === 'number'" class="sales-table__link" type="button" :aria-label="`Open ${singular} ${item.number}`" @click.stop="open(item)">{{ item.number }}</button>
                <span v-else-if="column.key === 'status'" class="sales-badge" :class="['Paid', 'Posted', 'Issued'].includes(statusOf(item)) ? 'sales-badge--success' : 'sales-badge--muted'">{{ statusOf(item) }}</span>
                <template v-else>{{ cellText(item, column.key) }}</template>
              </td>
            </tr>
            <tr v-if="!visibleRecords.length" class="sales-table__empty-row">
              <td :colspan="columnSpan"><strong>No rows to show</strong><span>Try another date range or create a {{ singular }}.</span></td>
            </tr>
          </tbody>
          <tfoot><tr>
            <td v-if="showSelect" />
            <td v-for="(column, index) in columns" :key="column.key" :class="{ 'sales-table__number': column.numeric }">
              <template v-if="index === 0">{{ visibleRecords.length }}</template>
              <template v-else-if="totalledColumns.includes(column.key)">{{ tableAmount(columnTotal(column.key)) }}</template>
            </td>
          </tr></tfoot>
        </table>
      </div>
      <AppPagination v-model:page="currentPage" :page-size="pageSize" :total="visibleRecords.length" :label="title.toLocaleLowerCase()" />
    </div>
  </section>
</template>
