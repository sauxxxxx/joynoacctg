<script setup lang="ts">
import { computed, ref } from 'vue'
import { Pencil, Plus, Search, X } from '@lucide/vue'
import { isAddOnEnabled, recordAudit } from '../company/companyStore'
import { customers } from './customers/customerPreviewStore'
import DateRangeFilter from '../workspace/DateRangeFilter.vue'
import SalesBulkInvoices from './SalesBulkInvoices.vue'
import { salesDocuments, setupRecords, type DocumentKind, type SalesDocument, type SalesLineItem } from './salesPreviewStore'
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
const error = ref('')
const notice = ref('')
const title = computed(() => titles[props.pageId])
const isInvoice = computed(() => props.pageId === 'sales-invoices')
const isAcknowledgement = computed(() => props.pageId === 'acknowledgement-receipts')
const terms = computed(() => setupRecords.value.filter((item) => item.kind === 'sales-payment-terms' && (item.active || item.id === draft.value.paymentTermId)))
const methods = computed(() => setupRecords.value.filter((item) => item.kind === 'sales-payment-methods' && (item.active || item.id === draft.value.paymentMethodId)))
const discounts = computed(() => setupRecords.value.filter((item) => item.kind === 'sales-discount-types' && (item.active || item.id === draft.value.discountTypeId)))
const invoiceOptions = computed(() => salesDocuments.value.filter((item) => item.kind === 'sales-invoices' && item.customerId === draft.value.customerId))

function emptyLine(): SalesLineItem {
  return { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0, withholdingTaxCode: '', withholdingTaxAmount: 0, vatCode: '', vatType: '', vatAmount: 0 }
}
function emptyDocument(kind: DocumentKind): SalesDocument {
  return {
    id: '', kind, number: '', date: dateInput(new Date()), customerId: '', status: 'Draft',
    paymentTermId: '', paymentMethodId: '', invoiceId: '', dueDate: '', amount: 0,
    remarks: '', customerDetails: { company: '', tin: '', street: '', locality: '', country: 'Philippines', zipCode: '' },
    discountTypeId: '', discountRate: 0, lines: kind === 'sales-invoices' ? [emptyLine()] : [],
  }
}

const draft = ref<SalesDocument>(emptyDocument(props.pageId))
const subtotal = computed(() => draft.value.lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0))
const selectedDiscount = computed(() => discounts.value.find((item) => item.id === draft.value.discountTypeId))
const discountAmount = computed(() => {
  const rate = Number(draft.value.discountRate) || 0
  return Math.min(subtotal.value, Math.max(0, selectedDiscount.value?.computation === 'Percentage' ? subtotal.value * rate / 100 : rate))
})
const invoiceTotal = computed(() => Math.max(0, subtotal.value - (selectedDiscount.value ? discountAmount.value : 0)))
const records = computed(() => salesDocuments.value.filter((item) => item.kind === props.pageId))
const visibleRecords = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return records.value.filter((item) => {
    if (dateRange.value.from && item.date < dateRange.value.from) return false
    if (dateRange.value.to && item.date > dateRange.value.to) return false
    if (customerFilter.value && !isAcknowledgement.value && item.customerId !== customerFilter.value) return false
    if (statusFilter.value !== 'all' && item.status !== statusFilter.value) return false
    return !term || `${item.number} ${customerName(item.customerId)} ${item.status}`.toLocaleLowerCase().includes(term)
  })
})
const visibleTotal = computed(() => visibleRecords.value.reduce((sum, item) => sum + item.amount, 0))

type ColumnKey = 'number' | 'date' | 'customer' | 'paymentTerm' | 'paymentMethod' | 'status' | 'amount' | 'totalPaid' | 'remarks'
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
  ]
})
// Invoices open by clicking the row, as in the legacy screen; other documents keep an Actions column.
const rowOpens = computed(() => isInvoice.value)
const columnCount = computed(() => columns.value.length + (rowOpens.value ? 0 : 1))

function cellText(item: SalesDocument, key: ColumnKey): string {
  switch (key) {
    case 'number': return item.number
    case 'date': return item.date
    case 'customer': return customerName(item.customerId)
    case 'paymentTerm': return termName(item.paymentTermId)
    case 'paymentMethod': return methodName(item.paymentMethodId)
    case 'status': return item.status
    case 'amount': return currency(item.amount)
    case 'totalPaid': return currency(totalPaid(item.id))
    case 'remarks': return item.remarks || '—'
  }
}
const currency =(value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)

function customerName(id: string) { return customers.value.find((item) => item.id === id)?.name ?? 'Unknown customer' }
function termName(id: string) { return setupRecords.value.find((item) => item.id === id)?.name ?? '—' }
function methodName(id: string) { return setupRecords.value.find((item) => item.id === id)?.name ?? '—' }
function totalPaid(invoiceId: string) {
  return salesDocuments.value.filter((item) => item.kind === 'sales-receipts' && item.invoiceId === invoiceId && item.status === 'Posted')
    .reduce((sum, item) => sum + item.amount, 0)
}
function fillCustomerDetails() {
  const customer = customers.value.find((item) => item.id === draft.value.customerId)
  if (!customer) return
  draft.value.customerDetails = {
    ...draft.value.customerDetails,
    company: customer.name,
    tin: customer.tin,
    street: customer.address,
  }
}
function openForm(item?: SalesDocument) {
  draft.value = item ? { ...item, customerDetails: { ...item.customerDetails }, lines: item.lines.map((line) => ({ ...line })) } : emptyDocument(props.pageId)
  error.value = ''
  dialog.value?.showModal()
}
function chooseDiscount() { draft.value.discountRate = selectedDiscount.value?.rate ?? 0 }
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
  if (isInvoice.value && (draft.value.lines.length === 0 || draft.value.lines.some((line) => !line.description.trim() || !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unitPrice) || line.unitPrice < 0 || !Number.isFinite(line.withholdingTaxAmount) || line.withholdingTaxAmount < 0 || !Number.isFinite(line.vatAmount) || line.vatAmount < 0))) {
    error.value = 'Each invoice line needs a description, positive quantity, and nonnegative price.'
    return
  }
  if (isInvoice.value && selectedDiscount.value?.computation === 'Percentage' && draft.value.discountRate > 100) {
    error.value = 'Percentage discount cannot exceed 100.'
    return
  }
  if (!isInvoice.value && (!Number.isFinite(draft.value.amount) || draft.value.amount <= 0)) {
    error.value = 'Amount must be greater than zero.'
    return
  }
  const item: SalesDocument = {
    ...draft.value,
    id: draft.value.id || crypto.randomUUID(),
    number,
    remarks: draft.value.remarks.trim(),
    amount: isInvoice.value ? Math.round(invoiceTotal.value * 100) / 100 : Number(draft.value.amount),
    lines: draft.value.lines.map((line) => ({ ...line, description: line.description.trim() })),
  }
  salesDocuments.value = draft.value.id
    ? salesDocuments.value.map((record) => record.id === item.id ? item : record)
    : [...salesDocuments.value, item]
  notice.value = `${title.value.slice(0, -1)} ${draft.value.id ? 'updated' : 'added'}.`
  recordAudit('Sales', draft.value.id ? 'Updated' : 'Created', `${title.value.slice(0, -1)}: ${item.number}`, `${item.status} · ${currency(item.amount)}`)
  dialog.value?.close()
}
function onBulkSaved(count: number) {
  bulkOpen.value = false
  notice.value = `${count} draft invoice${count === 1 ? '' : 's'} added.`
  recordAudit('Sales', 'Created', 'Invoices (bulk)', `${count} draft invoice${count === 1 ? '' : 's'}`)
}
</script>

<template>
  <SalesBulkInvoices v-if="isInvoice && bulkOpen" @close="bulkOpen = false" @saved="onBulkSaved" />
  <section v-else class="sales-page" :aria-label="title">
    <p v-if="notice" class="sales-notice" role="status">{{ notice }}</p>
    <div class="sales-panel">
      <div class="sales-panel__toolbar">
        <div><h2>{{ title }}</h2><p>Review and prepare {{ title.toLocaleLowerCase() }}.</p></div>
        <div class="sales-panel__actions">
          <label class="sales-search"><Search :size="16" aria-hidden="true" /><input v-model="search" type="search" placeholder="Type to filter" :aria-label="`Search ${title}`" /></label>
          <select v-model="statusFilter" class="sales-status-filter" aria-label="Filter by status"><option value="all">All statuses</option><option>Draft</option><option v-if="isInvoice">Unpaid</option><option v-if="isInvoice">Paid</option><option v-if="!isInvoice">{{ isAcknowledgement ? 'Issued' : 'Posted' }}</option><option>Cancelled</option></select>
          <select v-if="!isAcknowledgement" v-model="customerFilter" class="sales-status-filter" aria-label="Filter by customer"><option value="">All customers</option><option v-for="customer in customers" :key="customer.id" :value="customer.id">{{ customer.name }}</option></select>
          <DateRangeFilter v-model="dateRange" :default-value="defaultRange" />
          <button class="sales-button sales-button--primary" type="button" @click="openForm()"><Plus :size="16" aria-hidden="true" /> New {{ isInvoice ? 'invoice' : isAcknowledgement ? 'acknowledgement receipt' : 'receipt' }}</button>
          <button v-if="isInvoice && isAddOnEnabled('bulk-invoice-import')" class="sales-button" type="button" @click="bulkOpen = true">Add multiple</button>
        </div>
      </div>
      <div class="sales-workspace sales-workspace--single">
        <div class="sales-workspace__results">
          <div class="sales-table-wrap">
            <table class="sales-table sales-document-table">
              <thead><tr>
                <th v-for="column in columns" :key="column.key" scope="col" :class="{ 'sales-table__number': column.numeric }">{{ column.label }}</th>
                <th v-if="!rowOpens" scope="col">Actions</th>
              </tr></thead>
              <tbody>
                <tr v-for="item in visibleRecords" :key="item.id" :class="{ 'sales-table__row--open': rowOpens }" @click="rowOpens && openForm(item)">
                  <td v-for="column in columns" :key="column.key" :class="{ 'sales-table__number': column.numeric }">
                    <template v-if="column.key === 'number'">
                      <button v-if="rowOpens" class="sales-table__link" type="button" :aria-label="`Open ${title.slice(0, -1).toLocaleLowerCase()} ${item.number}`" @click.stop="openForm(item)">{{ item.number }}</button>
                      <strong v-else>{{ item.number }}</strong>
                    </template>
                    <span v-else-if="column.key === 'status'" class="sales-badge" :class="item.status === 'Paid' || item.status === 'Posted' || item.status === 'Issued' ? 'sales-badge--success' : 'sales-badge--muted'">{{ item.status }}</span>
                    <template v-else>{{ cellText(item, column.key) }}</template>
                  </td>
                  <td v-if="!rowOpens" class="sales-table__actions"><button type="button" :aria-label="`Edit ${item.number}`" @click="openForm(item)"><Pencil :size="15" /></button></td>
                </tr>
                <tr v-if="!visibleRecords.length" class="sales-table__empty-row">
                  <td :colspan="columnCount"><strong>No rows to show</strong><span>Try another date range or create a {{ isInvoice ? 'sales invoice' : 'receipt' }}.</span></td>
                </tr>
              </tbody>
              <tfoot><tr>
                <td v-for="(column, index) in columns" :key="column.key" :class="{ 'sales-table__number': column.numeric }">
                  <template v-if="index === 0">{{ visibleRecords.length }}</template>
                  <template v-else-if="column.key === 'amount'">{{ currency(visibleTotal) }}</template>
                </td>
                <td v-if="!rowOpens" />
              </tr></tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>

    <dialog ref="dialog" class="sales-dialog sales-dialog--wide" :aria-label="`${draft.id ? 'Edit' : 'New'} ${title.slice(0, -1)}`">
      <form @submit.prevent="save">
        <div class="sales-dialog__header"><h2>{{ draft.id ? 'Edit' : 'New' }} {{ isInvoice ? 'invoice' : isAcknowledgement ? 'acknowledgement receipt' : 'receipt' }}</h2><button type="button" aria-label="Close form" @click="dialog?.close()"><X :size="18" /></button></div>
        <div class="sales-form">
          <label>{{ isInvoice ? 'Invoice #' : isAcknowledgement ? 'AR#' : 'Collection Receipt #' }} <span>*</span><input v-model="draft.number" required maxlength="40" /></label>
          <label>Date <span>*</span><input v-model="draft.date" type="date" required /></label>
          <label>Customer <span>*</span><select v-model="draft.customerId" required @change="fillCustomerDetails"><option value="" disabled>Select customer</option><option v-for="customer in customers" :key="customer.id" :value="customer.id">{{ customer.name }}</option></select></label>
          <label>Status<select v-model="draft.status"><option>Draft</option><option v-if="isInvoice">Unpaid</option><option v-if="isInvoice">Paid</option><option v-if="!isInvoice">{{ isAcknowledgement ? 'Issued' : 'Posted' }}</option><option>Cancelled</option></select></label>
          <template v-if="isInvoice">
            <label>Payment Term<select v-model="draft.paymentTermId"><option value="">None</option><option v-for="term in terms" :key="term.id" :value="term.id">{{ term.name }}</option></select></label>
            <label>Due Date<input v-model="draft.dueDate" type="date" :min="draft.date" /></label>
            <label>Payment Method<select v-model="draft.paymentMethodId"><option value="">None</option><option v-for="method in methods" :key="method.id" :value="method.id">{{ method.name }}</option></select></label>
          </template>
          <template v-else>
            <label>Payment Method<select v-model="draft.paymentMethodId"><option value="">None</option><option v-for="method in methods" :key="method.id" :value="method.id">{{ method.name }}</option></select></label>
            <label v-if="!isAcknowledgement">Invoice reference<select v-model="draft.invoiceId"><option value="">None</option><option v-for="invoice in invoiceOptions" :key="invoice.id" :value="invoice.id">{{ invoice.number }}</option></select></label>
            <label>Amount <span>*</span><input v-model.number="draft.amount" type="number" min="0.01" step="0.01" required /></label>
          </template>
          <label v-if="isInvoice" class="sales-form__full">Remarks<textarea v-model="draft.remarks" rows="2" maxlength="500" /></label>
        </div>
        <div v-if="isInvoice" class="sales-lines">
          <div class="sales-lines__heading"><h3>Line items</h3><button class="sales-button" type="button" @click="draft.lines.push(emptyLine())"><Plus :size="15" /> Add line</button></div>
          <div v-for="(line, index) in draft.lines" :key="line.id" class="sales-lines__row">
            <label>Item<input v-model="line.description" required maxlength="160" /></label>
            <label>Quantity<input v-model.number="line.quantity" type="number" min="0.01" step="0.01" required /></label>
            <label>Unit price<input v-model.number="line.unitPrice" type="number" min="0" step="0.01" required /></label>
            <button type="button" :aria-label="`Remove line ${index + 1}`" :disabled="draft.lines.length === 1" @click="draft.lines.splice(index, 1)"><X :size="17" /></button>
            <div class="sales-lines__taxes">
              <label>WTAX Code<input v-model="line.withholdingTaxCode" maxlength="40" /></label>
              <label>WTAX<input v-model.number="line.withholdingTaxAmount" type="number" min="0" step="0.01" /></label>
              <label>VAT Code<input v-model="line.vatCode" maxlength="40" /></label>
              <label>VAT Type<input v-model="line.vatType" maxlength="40" /></label>
              <label>VAT<input v-model.number="line.vatAmount" type="number" min="0" step="0.01" /></label>
            </div>
          </div>
          <div class="sales-lines__totals">
            <span>Subtotal <strong>{{ currency(subtotal) }}</strong></span>
            <label>Discount type<select v-model="draft.discountTypeId" @change="chooseDiscount"><option value="">None</option><option v-for="discount in discounts" :key="discount.id" :value="discount.id">{{ discount.name }}</option></select></label>
            <label v-if="selectedDiscount">{{ selectedDiscount.computation === 'Percentage' ? 'Rate (%)' : 'Amount' }}<input v-model.number="draft.discountRate" type="number" min="0" step="0.01" :disabled="!selectedDiscount.allowOverride" /></label>
            <span v-if="selectedDiscount">Discount <strong>−{{ currency(discountAmount) }}</strong></span>
            <span class="sales-lines__total">Total before tax <strong>{{ currency(invoiceTotal) }}</strong></span>
          </div>
        </div>
        <div v-if="isInvoice" class="sales-customer-details">
          <h3>Customer Details</h3>
          <div class="sales-form">
            <label>Company<input v-model="draft.customerDetails.company" maxlength="120" /></label>
            <label>Tax Identification Number<input v-model="draft.customerDetails.tin" maxlength="30" /></label>
            <label class="sales-form__full">Unit#, Bldg., St., Barangay<input v-model="draft.customerDetails.street" maxlength="180" /></label>
            <label class="sales-form__full">District/Town, City, Province<input v-model="draft.customerDetails.locality" maxlength="180" /></label>
            <label>Country<input v-model="draft.customerDetails.country" maxlength="80" /></label>
            <label>Zip code<input v-model="draft.customerDetails.zipCode" maxlength="12" /></label>
          </div>
        </div>
        <p v-if="error" class="sales-form__error" role="alert">{{ error }}</p>
        <div class="sales-dialog__footer"><button class="sales-button" type="button" @click="dialog?.close()">Cancel</button><button class="sales-button sales-button--primary" type="submit">Save</button></div>
      </form>
    </dialog>
  </section>
</template>
