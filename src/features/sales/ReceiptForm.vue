<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Minus, Plus, Trash2, UserPlus } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { formatSeriesNumber } from '../company/companyRecords'
import { documentSeries, recordAudit } from '../company/companyStore'
import { customers } from './customers/customerPreviewStore'
import QuickAddDialogs from './QuickAddDialogs.vue'
import SalesEditorShell from './SalesEditorShell.vue'
import { tableAmount } from './salesFormat'
import { salesDocuments, setupRecords, type DocumentKind, type PaymentRow, type SalesDocument } from './salesPreviewStore'
import { invoiceBalance } from './salesRules'
import './sales-pages.css'

const props = defineProps<{ kind: Exclude<DocumentKind, 'sales-invoices'>; receipt: SalesDocument | null }>()
const emit = defineEmits<{ close: []; saved: [message: string]; deleted: [message: string] }>()

const isAck = props.kind === 'acknowledgement-receipts'
const label = isAck ? 'Acknowledgement Receipt' : 'Receipt'
const numberLabel = isAck ? 'Acknowledgement Receipt #' : 'Receipt #'
const seriesType = isAck ? 'Acknowledgement receipt' : 'Collection receipt'

const pad = (value: number) => String(value).padStart(2, '0')
const today = () => { const date = new Date(); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

const series = computed(() => documentSeries.value.find((item) => item.active && item.documentType === seriesType))
const suggestedNumber = props.receipt || !series.value ? '' : formatSeriesNumber(series.value, today())
// Collection receipts default to Cash, as in the legacy form; acknowledgement receipts start blank.
const defaultMethod = isAck ? '' : setupRecords.value.find((item) => item.kind === 'sales-payment-methods' && item.active && item.name.trim().toLocaleLowerCase() === 'cash')?.id ?? ''

function blank(): SalesDocument {
  return {
    id: '', kind: props.kind, number: suggestedNumber, date: today(), customerId: '', status: isAck ? 'Issued' : 'Posted',
    paymentTermId: '', paymentMethodId: defaultMethod, dueDate: '', amount: 0, remarks: '',
    customerDetails: { customerType: 'Company', company: '', tin: '', street: '', locality: '', country: 'Philippines', zipCode: '' },
    discountTypeId: '', discountRate: 0, lines: [], payments: [], withInvoice: !isAck,
  }
}

const draft = ref<SalesDocument>(props.receipt ? clone(props.receipt) : blank())
const initial = JSON.stringify(draft.value)
const dirty = computed(() => JSON.stringify(draft.value) !== initial)
const submitted = ref(false)
const saveError = ref('')
const selectedRows = ref<string[]>([])
const quickAdd = ref<InstanceType<typeof QuickAddDialogs> | null>(null)
const deleteDialog = ref<HTMLDialogElement | null>(null)
const showInvoiceColumn = computed(() => !isAck || draft.value.withInvoice)

const customerOptions = computed(() => customers.value
  .filter((customer) => customer.active || customer.id === draft.value.customerId)
  .map((customer) => ({ value: customer.id, label: customer.name })))
const methodOptions = computed(() => setupRecords.value
  .filter((item) => item.kind === 'sales-payment-methods' && (item.active || item.id === draft.value.paymentMethodId))
  .map((item) => ({ value: item.id, label: item.name })))

/** Everything else on file, so the balance an invoice offers does not count this receipt's own earlier payment. */
const otherDocuments = computed(() => salesDocuments.value.filter((doc) => doc.id !== draft.value.id))
const customerInvoices = computed(() => salesDocuments.value.filter((doc) => doc.kind === 'sales-invoices' && doc.customerId === draft.value.customerId && !['Draft', 'Cancelled'].includes(doc.status)))
const availableFor = (invoice: SalesDocument) => invoiceBalance(otherDocuments.value, invoice)
const invoiceOptionsFor = (rowInvoiceId: string) => customerInvoices.value
  .filter((invoice) => invoice.id === rowInvoiceId || (availableFor(invoice) > 0 && !draft.value.payments.some((row) => row.invoiceId === invoice.id)))
  .map((invoice) => ({ id: invoice.id, text: isAck ? `${invoice.number}` : `${invoice.number} · balance ${tableAmount(availableFor(invoice))}` }))

const total = computed(() => Math.round(draft.value.payments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) * 100) / 100)
const allSelected = computed(() => draft.value.payments.length > 0 && draft.value.payments.every((row) => selectedRows.value.includes(row.id)))

const rowErrors = computed(() => {
  const found: Record<string, string> = {}
  draft.value.payments.forEach((row, index) => {
    const amount = Number(row.amount)
    if (showInvoiceColumn.value && !row.invoiceId) found[row.id] = `Row ${index + 1}: choose an invoice`
    else if (!showInvoiceColumn.value && !row.others.trim()) found[row.id] = `Row ${index + 1}: describe what this payment is for`
    else if (!(amount > 0)) found[row.id] = `Row ${index + 1}: enter an amount above zero`
    else if (!isAck && row.invoiceId) {
      const invoice = customerInvoices.value.find((item) => item.id === row.invoiceId)
      if (invoice && amount > availableFor(invoice) + 0.005) found[row.id] = `Row ${index + 1}: ${invoice.number} only has ${tableAmount(availableFor(invoice))} left to collect`
    }
  })
  return found
})

const errors = computed(() => {
  const value = draft.value
  const found: Record<string, string> = {}
  const number = value.number.trim()
  if (!number) found.number = 'Cannot be blank'
  else if (salesDocuments.value.some((doc) => doc.kind === props.kind && doc.id !== value.id && doc.number.trim().toLocaleLowerCase() === number.toLocaleLowerCase())) found.number = `${numberLabel.replace(' #', '')} number ${number} is already in use`
  if (!value.date) found.date = 'Cannot be blank'
  if (!customers.value.some((customer) => customer.id === value.customerId)) found.customerId = 'Choose a customer'
  if (!value.paymentMethodId) found.paymentMethodId = 'Choose a payment method'
  if (!value.payments.length) found.payments = isAck ? 'Add at least one payment detail' : 'Add at least one invoice this receipt pays'
  else if (showInvoiceColumn.value) {
    const ids = value.payments.map((row) => row.invoiceId).filter(Boolean)
    if (new Set(ids).size !== ids.length) found.payments = 'An invoice can be listed only once'
  }
  return found
})
const shown = (key: string) => submitted.value ? errors.value[key] : ''

function addRow() {
  const row: PaymentRow = { id: crypto.randomUUID(), invoiceId: '', others: '', amount: 0 }
  draft.value.payments.push(row)
  nextTick(() => document.getElementById(`payment-row-${row.id}`)?.focus())
}
function removeSelected() {
  draft.value.payments = draft.value.payments.filter((row) => !selectedRows.value.includes(row.id))
  selectedRows.value = []
}
function toggleRow(id: string) {
  selectedRows.value = selectedRows.value.includes(id) ? selectedRows.value.filter((value) => value !== id) : [...selectedRows.value, id]
}
function chooseInvoice(row: PaymentRow) {
  const invoice = customerInvoices.value.find((item) => item.id === row.invoiceId)
  // Offer the remaining balance as the amount, which is what most receipts pay.
  if (invoice && !isAck && !(Number(row.amount) > 0)) row.amount = availableFor(invoice)
}
function chooseCustomer(id: string) {
  if (draft.value.customerId && draft.value.customerId !== id) {
    // Rows point at the previous customer's invoices.
    draft.value.payments.forEach((row) => { row.invoiceId = '' })
  }
  draft.value.customerId = id
}

function save() {
  submitted.value = true
  const first = Object.values(errors.value)[0] ?? Object.values(rowErrors.value)[0]
  saveError.value = first ? `Please fix the highlighted fields.` : ''
  if (first) return
  const isNew = !draft.value.id
  const receipt: SalesDocument = {
    ...clone(draft.value),
    id: draft.value.id || crypto.randomUUID(),
    number: draft.value.number.trim(),
    remarks: draft.value.remarks.trim(),
    amount: total.value,
    payments: draft.value.payments.map((row) => ({
      ...row,
      amount: Math.round(Number(row.amount) * 100) / 100,
      invoiceId: showInvoiceColumn.value ? row.invoiceId : '',
      others: showInvoiceColumn.value ? '' : row.others.trim(),
    })),
  }
  salesDocuments.value = isNew ? [...salesDocuments.value, receipt] : salesDocuments.value.map((doc) => doc.id === receipt.id ? receipt : doc)
  const active = series.value
  if (isNew && active && receipt.number === suggestedNumber) {
    documentSeries.value = documentSeries.value.map((item) => item.id === active.id ? { ...item, nextNumber: item.nextNumber + 1 } : item)
  }
  recordAudit('Sales', isNew ? 'Created' : 'Updated', `${label}: ${receipt.number}`, tableAmount(receipt.amount))
  emit('saved', `${label} ${receipt.number} ${isNew ? 'added' : 'updated'}.`)
}

function remove() {
  const number = draft.value.number
  salesDocuments.value = salesDocuments.value.filter((doc) => doc.id !== draft.value.id)
  recordAudit('Sales', 'Deleted', `${label}: ${number}`)
  deleteDialog.value?.close()
  emit('deleted', `${label} ${number} deleted.`)
}
</script>

<template>
  <SalesEditorShell :title="label" :subtitle="receipt ? receipt.number : `New ${label.toLocaleLowerCase()}`" :dirty="dirty" :error="saveError" :save-label="`Save ${label.toLocaleLowerCase()}`" @save="save" @close="emit('close')">
    <div class="sales-card">
      <h3 class="sales-card__title">Details</h3>
      <div class="sales-form sales-card__form">
        <label>{{ numberLabel }} <span>*</span>
          <input v-model="draft.number" maxlength="40" autocomplete="off" :aria-invalid="Boolean(shown('number'))" />
          <small v-if="shown('number')" class="sales-field-error">{{ shown('number') }}</small>
        </label>
        <div class="sales-field"><AppDatePicker id="receipt-date" v-model="draft.date" label="Date" required :invalid="Boolean(shown('date'))" /></div>
        <div class="sales-field-action">
          <AppSelect id="receipt-customer" :model-value="draft.customerId" label="Customer" required placeholder="Select customer" :options="customerOptions" :invalid="Boolean(shown('customerId'))" @update:model-value="chooseCustomer" />
          <button class="sales-field-action__button" type="button" aria-label="Add a new customer" title="Add a new customer" @click="quickAdd?.openCustomer()"><UserPlus :size="17" aria-hidden="true" /></button>
          <small v-if="shown('customerId')" class="sales-field-error sales-field-action__hint">{{ shown('customerId') }}</small>
        </div>
        <div class="sales-field-action">
          <AppSelect id="receipt-method" v-model="draft.paymentMethodId" label="Payment Method" required placeholder="Select payment method" :options="methodOptions" :invalid="Boolean(shown('paymentMethodId'))" />
          <button class="sales-field-action__button" type="button" aria-label="Add a new payment method" title="Add a new payment method" @click="quickAdd?.openMethod()"><Plus :size="17" aria-hidden="true" /></button>
          <small v-if="shown('paymentMethodId')" class="sales-field-error sales-field-action__hint">{{ shown('paymentMethodId') }}</small>
        </div>
        <label class="sales-form__full">Remarks<textarea v-model="draft.remarks" rows="2" maxlength="500" /></label>
      </div>
    </div>

    <div class="sales-card sales-card--flush">
      <h3 class="sales-card__title sales-card__title--bar">{{ isAck ? 'Payment Details' : 'This receipt is for the following invoices' }}</h3>
      <div class="sales-card__toolbar">
        <button class="sales-round-button" type="button" aria-label="Add row" title="Add row" @click="addRow"><Plus :size="17" aria-hidden="true" /></button>
        <button class="sales-round-button" type="button" aria-label="Remove selected rows" title="Remove selected rows" :disabled="!selectedRows.length" @click="removeSelected"><Minus :size="17" aria-hidden="true" /></button>
        <label v-if="isAck" class="ws-switch sales-card__switch"><input v-model="draft.withInvoice" type="checkbox" /><span class="ws-switch__track" aria-hidden="true" />With Invoice?</label>
        <span v-if="selectedRows.length" class="sales-card__selection">{{ selectedRows.length }} selected</span>
      </div>
      <div class="sales-table-wrap">
        <table class="sales-table sales-lines-grid sales-payment-grid">
          <thead><tr>
            <th scope="col" class="sales-lines-grid__select"><input type="checkbox" :checked="allSelected" :disabled="!draft.payments.length" aria-label="Select all rows" @change="selectedRows = allSelected ? [] : draft.payments.map((row) => row.id)" /></th>
            <th scope="col">{{ showInvoiceColumn ? 'Invoice' : 'Others' }}</th><th scope="col" class="sales-table__number">Amount</th>
          </tr></thead>
          <tbody>
            <tr v-for="(row, index) in draft.payments" :key="row.id" :class="{ 'sales-lines-grid__row--selected': selectedRows.includes(row.id), 'sales-lines-grid__row--error': submitted && rowErrors[row.id] }">
              <td class="sales-lines-grid__select"><input type="checkbox" :checked="selectedRows.includes(row.id)" :aria-label="`Select row ${index + 1}`" @change="toggleRow(row.id)" /></td>
              <td>
                <select v-if="showInvoiceColumn" :id="`payment-row-${row.id}`" v-model="row.invoiceId" :aria-label="`Row ${index + 1} invoice`" @change="chooseInvoice(row)">
                  <option value="">{{ draft.customerId ? (invoiceOptionsFor(row.invoiceId).length ? 'Select invoice' : 'No open invoices for this customer') : 'Choose a customer first' }}</option>
                  <option v-for="option in invoiceOptionsFor(row.invoiceId)" :key="option.id" :value="option.id">{{ option.text }}</option>
                </select>
                <input v-else :id="`payment-row-${row.id}`" v-model="row.others" maxlength="160" :aria-label="`Row ${index + 1} description`" placeholder="What is this payment for?" />
              </td>
              <td><input v-model.number="row.amount" class="sales-lines-grid__number" type="number" min="0" step="0.01" :aria-label="`Row ${index + 1} amount`" /></td>
            </tr>
            <tr v-if="!draft.payments.length" class="sales-table__empty-row sales-lines-grid__empty"><td colspan="3"><strong>No rows to show</strong><span>Use + to add a row.</span></td></tr>
          </tbody>
          <tfoot><tr><td /><td /><td class="sales-table__number">{{ tableAmount(total) }}</td></tr></tfoot>
        </table>
      </div>
      <p v-if="shown('payments')" class="sales-field-error sales-card__error">{{ shown('payments') }}</p>
      <ul v-if="submitted && Object.keys(rowErrors).length" class="sales-card__error sales-field-error sales-card__errors">
        <li v-for="(message, id) in rowErrors" :key="id">{{ message }}</li>
      </ul>
    </div>

    <template #extra-actions>
      <button v-if="receipt" class="sales-button sales-button--ghost-danger" type="button" @click="deleteDialog?.showModal()"><Trash2 :size="15" aria-hidden="true" /> Delete</button>
    </template>
  </SalesEditorShell>

  <QuickAddDialogs ref="quickAdd" @customer="chooseCustomer" @method="draft.paymentMethodId = $event" />

  <dialog ref="deleteDialog" class="sales-dialog sales-dialog--small" aria-label="Confirm deletion">
    <div class="sales-dialog__header"><h2>Delete {{ label.toLocaleLowerCase() }}?</h2></div>
    <p class="sales-dialog__body">Remove <strong>{{ draft.number }}</strong>? {{ isAck ? '' : 'The invoices it paid will show their balances again. ' }}This cannot be undone.</p>
    <div class="sales-dialog__footer"><button class="sales-button" type="button" @click="deleteDialog?.close()">Cancel</button><button class="sales-button sales-button--danger" type="button" @click="remove">Delete</button></div>
  </dialog>
</template>
