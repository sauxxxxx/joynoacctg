<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Search, X } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import { isAddOnEnabled, recordAudit } from '../company/companyStore'
import DateRangeFilter from '../workspace/DateRangeFilter.vue'
import { customers } from './customers/customerPreviewStore'
import SalesBulkInvoices from './SalesBulkInvoices.vue'
import SalesInvoiceForm from './SalesInvoiceForm.vue'
import { reportDate, tableAmount } from './salesFormat'
import { salesDocuments, setupRecords, type DocumentKind, type SalesDocument } from './salesPreviewStore'
import { invoiceStatus, postedReceiptsTotal } from './salesRules'
import './sales-pages.css'

const props = defineProps<{ pageId: DocumentKind }>()
const titles: Record<DocumentKind, string> = {
  'sales-invoices': 'Invoices',
  'sales-receipts': 'Receipts',
  'acknowledgement-receipts': 'Acknowledgement Receipts',
}

const pad = (value: number) => String(value).padStart(2, '0')
const dateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const now = new Date()
const defaultRange = { from: dateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to: dateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
const dateRange = ref({ ...defaultRange })
const customerFilter = ref('')
const search = ref('')
const statusFilter = ref('all')
const dialog = ref<HTMLDialogElement | null>(null)
const bulkOpen = ref(false)
// Invoices open in a full-page editor, as in the legacy screen; receipts use a dialog.
const invoiceEditor = ref<{ invoice: SalesDocument | null } | null>(null)
const error = ref('')
const notice = ref('')
const title = computed(() => titles[props.pageId])
const singular = computed(() => ({ 'sales-invoices': 'invoice', 'sales-receipts': 'receipt', 'acknowledgement-receipts': 'acknowledgement receipt' })[props.pageId])
const isInvoice = computed(() => props.pageId === 'sales-invoices')
const isAcknowledgement = computed(() => props.pageId === 'acknowledgement-receipts')
const methods = computed(() => setupRecords.value.filter((item) => item.kind === 'sales-payment-methods' && (item.active || item.id === draft.value.paymentMethodId)))
const invoiceOptions = computed(() => salesDocuments.value.filter((item) => item.kind === 'sales-invoices' && item.customerId === draft.value.customerId && item.status !== 'Draft'))
const statusOptions = computed(() => isInvoice.value ? ['Draft', 'Unpaid', 'Paid', 'Cancelled'] : ['Draft', isAcknowledgement.value ? 'Issued' : 'Posted', 'Cancelled'])

function emptyReceipt(kind: DocumentKind): SalesDocument {
  return {
    id: '', kind, number: '', date: dateInput(new Date()), customerId: '', status: 'Draft',
    paymentTermId: '', paymentMethodId: '', invoiceId: '', dueDate: '', amount: 0,
    remarks: '', customerDetails: { company: '', tin: '', street: '', locality: '', country: 'Philippines', zipCode: '' },
    discountTypeId: '', discountRate: 0, lines: [],
  }
}

const draft = ref<SalesDocument>(emptyReceipt(props.pageId))
const records = computed(() => salesDocuments.value.filter((item) => item.kind === props.pageId))
const statusOf = (item: SalesDocument) => item.kind === 'sales-invoices' ? invoiceStatus(item, salesDocuments.value) : item.status
const visibleRecords = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return records.value.filter((item) => {
    if (dateRange.value.from && item.date < dateRange.value.from) return false
    if (dateRange.value.to && item.date > dateRange.value.to) return false
    if (customerFilter.value && !isAcknowledgement.value && item.customerId !== customerFilter.value) return false
    if (statusFilter.value !== 'all' && statusOf(item) !== statusFilter.value) return false
    return !term || `${item.number} ${customerName(item.customerId)} ${statusOf(item)} ${item.remarks}`.toLocaleLowerCase().includes(term)
  })
})

type ColumnKey = 'number' | 'date' | 'customer' | 'paymentTerm' | 'paymentMethod' | 'status' | 'amount' | 'invoiceTotal' | 'totalPaid' | 'remarks'
interface Column { key: ColumnKey; label: string; numeric?: boolean }
// Column order follows the legacy screens for each document type.
const columns = computed<Column[]>(() => {
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
const totalledColumns: ColumnKey[] = ['amount', 'invoiceTotal']

/**
 * Receipts show the referenced invoice's total next to the amount received.
 * Assumption pending confirmation: legacy 'Total Amount' on receipts means the invoice total.
 */
function invoiceTotalFor(item: SalesDocument): number | null {
  return salesDocuments.value.find((document) => document.kind === 'sales-invoices' && document.id === item.invoiceId)?.amount ?? null
}

function columnTotal(key: ColumnKey): number {
  return visibleRecords.value.reduce((sum, item) => sum + (key === 'amount' ? item.amount : invoiceTotalFor(item) ?? 0), 0)
}

function cellText(item: SalesDocument, key: ColumnKey): string {
  switch (key) {
    case 'number': return item.number
    case 'date': return reportDate(item.date)
    case 'customer': return customerName(item.customerId)
    case 'paymentTerm': return setupName(item.paymentTermId)
    case 'paymentMethod': return setupName(item.paymentMethodId)
    case 'status': return statusOf(item)
    case 'amount': return tableAmount(item.amount)
    case 'invoiceTotal': { const total = invoiceTotalFor(item); return total === null ? '—' : tableAmount(total) }
    case 'totalPaid': return tableAmount(postedReceiptsTotal(salesDocuments.value, item.id))
    case 'remarks': return item.remarks || '—'
  }
}

function customerName(id: string) { return customers.value.find((item) => item.id === id)?.name ?? 'Unknown customer' }
function setupName(id: string) { return setupRecords.value.find((item) => item.id === id)?.name ?? '—' }

function openForm(item?: SalesDocument) {
  if (isInvoice.value) {
    invoiceEditor.value = { invoice: item ?? null }
    notice.value = ''
    return
  }
  draft.value = item ? { ...item, customerDetails: { ...item.customerDetails }, lines: [] } : emptyReceipt(props.pageId)
  error.value = ''
  dialog.value?.showModal()
}

function onInvoiceSaved(message: string) {
  invoiceEditor.value = null
  notice.value = message
}

function save() {
  const number = draft.value.number.trim()
  if (!number || !customers.value.some((customer) => customer.id === draft.value.customerId) || !draft.value.date) {
    error.value = 'Document number, date, and customer are required.'
    return
  }
  if (records.value.some((item) => item.id !== draft.value.id && item.number.toLocaleLowerCase() === number.toLocaleLowerCase())) {
    error.value = 'This document number is already in use.'
    return
  }
  if (!Number.isFinite(draft.value.amount) || draft.value.amount <= 0) {
    error.value = 'Amount must be greater than zero.'
    return
  }
  const item: SalesDocument = { ...draft.value, id: draft.value.id || crypto.randomUUID(), number, remarks: draft.value.remarks.trim(), amount: Number(draft.value.amount) }
  salesDocuments.value = draft.value.id
    ? salesDocuments.value.map((record) => record.id === item.id ? item : record)
    : [...salesDocuments.value, item]
  const label = singular.value.charAt(0).toLocaleUpperCase() + singular.value.slice(1)
  notice.value = `${label} ${draft.value.id ? 'updated' : 'added'}.`
  recordAudit('Sales', draft.value.id ? 'Updated' : 'Created', `${label}: ${item.number}`, `${item.status} · ${tableAmount(item.amount)}`)
  dialog.value?.close()
}

function onBulkSaved(count: number) {
  bulkOpen.value = false
  notice.value = `${count} draft invoice${count === 1 ? '' : 's'} added.`
  recordAudit('Sales', 'Created', 'Invoices (bulk)', `${count} draft invoice${count === 1 ? '' : 's'}`)
}
</script>

<template>
  <SalesInvoiceForm v-if="isInvoice && invoiceEditor" :invoice="invoiceEditor.invoice" @close="invoiceEditor = null" @saved="onInvoiceSaved" />
  <SalesBulkInvoices v-else-if="isInvoice && bulkOpen" @close="bulkOpen = false" @saved="onBulkSaved" />
  <section v-else class="sales-page" :aria-label="title">
    <p v-if="notice" class="sales-notice" role="status">{{ notice }}</p>
    <div class="sales-panel">
      <div class="sales-panel__toolbar">
        <div><h2>{{ title }}</h2><p>Review and prepare {{ title.toLocaleLowerCase() }}.</p></div>
        <div class="sales-panel__actions">
          <label class="sales-search"><Search :size="16" aria-hidden="true" /><input v-model="search" type="search" placeholder="Type to filter" :aria-label="`Search ${title}`" /></label>
          <select v-model="statusFilter" class="sales-status-filter" aria-label="Filter by status"><option value="all">All statuses</option><option v-for="status in statusOptions" :key="status">{{ status }}</option></select>
          <select v-if="!isAcknowledgement" v-model="customerFilter" class="sales-status-filter" aria-label="Filter by customer"><option value="">All customers</option><option v-for="customer in customers" :key="customer.id" :value="customer.id">{{ customer.name }}</option></select>
          <DateRangeFilter v-model="dateRange" :default-value="defaultRange" />
          <button class="sales-button sales-button--primary" type="button" @click="openForm()"><Plus :size="16" aria-hidden="true" /> New {{ singular }}</button>
          <button v-if="isInvoice && isAddOnEnabled('bulk-invoice-import')" class="sales-button" type="button" @click="bulkOpen = true">Add multiple</button>
        </div>
      </div>
      <div class="sales-table-wrap">
        <table class="sales-table sales-document-table">
          <thead><tr>
            <th v-for="column in columns" :key="column.key" scope="col" :class="{ 'sales-table__number': column.numeric }">{{ column.label }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="item in visibleRecords" :key="item.id" class="sales-table__row--open" @click="openForm(item)">
              <td v-for="column in columns" :key="column.key" :class="{ 'sales-table__number': column.numeric }">
                <button v-if="column.key === 'number'" class="sales-table__link" type="button" :aria-label="`Open ${singular} ${item.number}`" @click.stop="openForm(item)">{{ item.number }}</button>
                <span v-else-if="column.key === 'status'" class="sales-badge" :class="['Paid', 'Posted', 'Issued'].includes(statusOf(item)) ? 'sales-badge--success' : 'sales-badge--muted'">{{ statusOf(item) }}</span>
                <template v-else>{{ cellText(item, column.key) }}</template>
              </td>
            </tr>
            <tr v-if="!visibleRecords.length" class="sales-table__empty-row">
              <td :colspan="columns.length"><strong>No rows to show</strong><span>Try another date range or create a {{ singular }}.</span></td>
            </tr>
          </tbody>
          <tfoot><tr>
            <td v-for="(column, index) in columns" :key="column.key" :class="{ 'sales-table__number': column.numeric }">
              <template v-if="index === 0">{{ visibleRecords.length }}</template>
              <template v-else-if="totalledColumns.includes(column.key)">{{ tableAmount(columnTotal(column.key)) }}</template>
            </td>
          </tr></tfoot>
        </table>
      </div>
    </div>

    <dialog ref="dialog" class="sales-dialog sales-dialog--wide" :aria-label="`${draft.id ? 'Edit' : 'New'} ${singular}`">
      <form novalidate @submit.prevent="save">
        <div class="sales-dialog__header"><h2>{{ draft.id ? 'Edit' : 'New' }} {{ singular }}</h2><button type="button" aria-label="Close form" @click="dialog?.close()"><X :size="18" /></button></div>
        <div class="sales-form">
          <label>{{ isAcknowledgement ? 'AR#' : 'Collection Receipt #' }} <span>*</span><input v-model="draft.number" maxlength="40" /></label>
          <AppDatePicker id="sales-document-date" v-model="draft.date" label="Date" required />
          <label>Customer <span>*</span><select v-model="draft.customerId"><option value="" disabled>Select customer</option><option v-for="customer in customers" :key="customer.id" :value="customer.id">{{ customer.name }}</option></select></label>
          <label>Status<select v-model="draft.status"><option>Draft</option><option>{{ isAcknowledgement ? 'Issued' : 'Posted' }}</option><option>Cancelled</option></select></label>
          <label>Payment Method<select v-model="draft.paymentMethodId"><option value="">None</option><option v-for="method in methods" :key="method.id" :value="method.id">{{ method.name }}</option></select></label>
          <label v-if="!isAcknowledgement">Invoice reference<select v-model="draft.invoiceId"><option value="">None</option><option v-for="invoice in invoiceOptions" :key="invoice.id" :value="invoice.id">{{ invoice.number }}</option></select></label>
          <label>Amount <span>*</span><input v-model.number="draft.amount" type="number" min="0.01" step="0.01" /></label>
        </div>
        <p v-if="error" class="sales-form__error" role="alert">{{ error }}</p>
        <div class="sales-dialog__footer"><button class="sales-button" type="button" @click="dialog?.close()">Cancel</button><button class="sales-button sales-button--primary" type="submit">Save</button></div>
      </form>
    </dialog>
  </section>
</template>
