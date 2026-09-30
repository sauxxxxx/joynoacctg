<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Minus, Plus, UserPlus, X } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { formatSeriesNumber } from '../company/companyRecords'
import { documentSeries, goods, otherItems, recordAudit, services } from '../company/companyStore'
import { customers, type Customer } from './customers/customerPreviewStore'
import { reportDate, tableAmount } from './salesFormat'
import { salesDocuments, setupRecords, type SalesDocument, type SalesLineItem, type SetupRecord } from './salesPreviewStore'
import { computeDueDate, lineAmount } from './salesRules'
import './sales-pages.css'

const props = defineProps<{ invoice: SalesDocument | null }>()
const emit = defineEmits<{ close: []; saved: [message: string] }>()

const pad = (value: number) => String(value).padStart(2, '0')
const today = () => { const date = new Date(); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

// A new invoice takes its number from the active Sales invoice series, when one is set up in Company › Series.
const invoiceSeries = computed(() => documentSeries.value.find((series) => series.active && series.documentType === 'Sales invoice'))
const suggestedNumber = props.invoice ? '' : invoiceSeries.value ? formatSeriesNumber(invoiceSeries.value, today()) : ''

function blankInvoice(): SalesDocument {
  return {
    id: '', kind: 'sales-invoices', number: suggestedNumber, date: today(), customerId: '', status: 'Unpaid',
    paymentTermId: '', paymentMethodId: '', invoiceId: '', dueDate: '', amount: 0, remarks: '',
    customerDetails: { company: '', tin: '', street: '', locality: '', country: 'Philippines', zipCode: '' },
    discountTypeId: '', discountRate: 0, lines: [],
  }
}

const draft = ref<SalesDocument>(props.invoice ? clone(props.invoice) : blankInvoice())
const initial = JSON.stringify(draft.value)
const selectedLines = ref<string[]>([])
const error = ref('')
const numberInput = ref<HTMLInputElement | null>(null)
const discardDialog = ref<HTMLDialogElement | null>(null)
const customerDialog = ref<HTMLDialogElement | null>(null)
const termDialog = ref<HTMLDialogElement | null>(null)
const newCustomer = ref({ name: '', tin: '', address: '', error: '' })
const newTerm = ref({ name: '', dueOn: 0, paymentDue: 'Days' as SetupRecord['paymentDue'], error: '' })
const isDraft = computed(() => props.invoice?.status === 'Draft')

const activeOrCurrent = (kind: SetupRecord['kind'], currentId: string) => setupRecords.value
  .filter((item) => item.kind === kind && (item.active || item.id === currentId))
const customerOptions = computed(() => customers.value
  .filter((customer) => customer.active || customer.id === draft.value.customerId)
  .map((customer) => ({ value: customer.id, label: customer.name })))
const termOptions = computed(() => activeOrCurrent('sales-payment-terms', draft.value.paymentTermId).map((term) => ({ value: term.id, label: term.name })))
const discounts = computed(() => activeOrCurrent('sales-discount-types', draft.value.discountTypeId))
const discountOptions = computed(() => [{ value: '', label: 'None' }, ...discounts.value.map((item) => ({ value: item.id, label: item.name }))])
const selectedTerm = computed(() => setupRecords.value.find((item) => item.id === draft.value.paymentTermId))
const selectedDiscount = computed(() => discounts.value.find((item) => item.id === draft.value.discountTypeId))
const dueDate = computed(() => selectedTerm.value ? computeDueDate(draft.value.date, selectedTerm.value) : '')

// Items from Company › Items are offered as suggestions; typing any other description still works.
const catalog = computed(() => [...goods.value, ...services.value, ...otherItems.value].filter((item) => item.active))

const totals = computed(() => draft.value.lines.reduce((sum, line) => ({
  quantity: sum.quantity + (Number(line.quantity) || 0),
  withholding: sum.withholding + (Number(line.withholdingTaxAmount) || 0),
  vat: sum.vat + (Number(line.vatAmount) || 0),
  amount: sum.amount + lineAmount(line),
}), { quantity: 0, withholding: 0, vat: 0, amount: 0 }))
const discountAmount = computed(() => {
  if (!selectedDiscount.value) return 0
  const rate = Number(draft.value.discountRate) || 0
  const value = selectedDiscount.value.computation === 'Percentage' ? totals.value.amount * rate / 100 : rate
  return Math.min(totals.value.amount, Math.max(0, value))
})
const invoiceTotal = computed(() => Math.round(Math.max(0, totals.value.amount - discountAmount.value) * 100) / 100)
const allSelected = computed(() => draft.value.lines.length > 0 && draft.value.lines.every((line) => selectedLines.value.includes(line.id)))

onMounted(() => nextTick(() => numberInput.value?.focus()))
// An error message describes the last save attempt; clear it once the user edits the invoice.
watch(draft, () => { error.value = '' }, { deep: true })

function addLine() {
  const line: SalesLineItem = { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0, withholdingTaxCode: '', withholdingTaxAmount: 0, vatCode: '', vatType: '', vatAmount: 0 }
  draft.value.lines.push(line)
  nextTick(() => document.getElementById(`invoice-line-${line.id}`)?.focus())
}

function removeSelected() {
  draft.value.lines = draft.value.lines.filter((line) => !selectedLines.value.includes(line.id))
  selectedLines.value = []
}

function toggleLine(id: string) {
  selectedLines.value = selectedLines.value.includes(id) ? selectedLines.value.filter((item) => item !== id) : [...selectedLines.value, id]
}

function toggleAllLines() {
  selectedLines.value = allSelected.value ? [] : draft.value.lines.map((line) => line.id)
}

function useCatalogPrice(line: SalesLineItem) {
  const match = catalog.value.find((item) => item.name.toLocaleLowerCase() === line.description.trim().toLocaleLowerCase())
  if (match && !line.unitPrice) line.unitPrice = match.sellingPrice
}

function chooseCustomer(id: string) {
  draft.value.customerId = id
  const customer = customers.value.find((item) => item.id === id)
  if (!customer) return
  draft.value.customerDetails = { ...draft.value.customerDetails, company: customer.name, tin: customer.tin, street: customer.address }
}

function chooseDiscount(id: string) {
  draft.value.discountTypeId = id
  draft.value.discountRate = discounts.value.find((item) => item.id === id)?.rate ?? 0
}

function validate(): string {
  const invoice = draft.value
  const number = invoice.number.trim()
  if (!number) return 'Enter an invoice number.'
  if (salesDocuments.value.some((item) => item.kind === 'sales-invoices' && item.id !== invoice.id && item.number.trim().toLocaleLowerCase() === number.toLocaleLowerCase())) return `Invoice # ${number} is already in use.`
  if (!invoice.date) return 'Choose the invoice date.'
  if (!customers.value.some((customer) => customer.id === invoice.customerId)) return 'Choose a customer.'
  if (!selectedTerm.value) return 'Choose a payment term.'
  if (!invoice.lines.length) return 'Add at least one line item.'
  const badLine = invoice.lines.findIndex((line) => !line.description.trim() || !(Number(line.quantity) > 0) || !(Number(line.unitPrice) >= 0)
    || !(Number(line.withholdingTaxAmount) >= 0) || !(Number(line.vatAmount) >= 0))
  if (badLine >= 0) return `Line ${badLine + 1} needs an item, a quantity above zero, and amounts that are not negative.`
  if (selectedDiscount.value?.computation === 'Percentage' && Number(invoice.discountRate) > 100) return 'A percentage discount cannot exceed 100.'
  return ''
}

function save() {
  error.value = validate()
  if (error.value) return
  const isNew = !draft.value.id
  const invoice: SalesDocument = {
    ...draft.value,
    id: draft.value.id || crypto.randomUUID(),
    number: draft.value.number.trim(),
    remarks: draft.value.remarks.trim(),
    // Saving issues the invoice; Paid is shown once collections cover it.
    status: draft.value.status === 'Cancelled' ? 'Cancelled' : 'Unpaid',
    dueDate: dueDate.value,
    paymentMethodId: '',
    amount: invoiceTotal.value,
    lines: draft.value.lines.map((line) => ({ ...line, description: line.description.trim() })),
  }
  salesDocuments.value = isNew ? [...salesDocuments.value, invoice] : salesDocuments.value.map((item) => item.id === invoice.id ? invoice : item)
  const series = invoiceSeries.value
  if (isNew && series && invoice.number === suggestedNumber) {
    documentSeries.value = documentSeries.value.map((item) => item.id === series.id ? { ...item, nextNumber: item.nextNumber + 1 } : item)
  }
  recordAudit('Sales', isNew ? 'Created' : 'Updated', `Invoice: ${invoice.number}`, tableAmount(invoice.amount))
  emit('saved', `Invoice ${invoice.number} ${isNew ? 'added' : 'updated'}.`)
}

function requestClose() {
  if (JSON.stringify(draft.value) === initial) emit('close')
  else discardDialog.value?.showModal()
}

function openCustomerDialog() {
  newCustomer.value = { name: '', tin: '', address: '', error: '' }
  customerDialog.value?.showModal()
}

function addCustomer() {
  const name = newCustomer.value.name.trim()
  if (!name) { newCustomer.value.error = 'Customer name is required.'; return }
  if (customers.value.some((item) => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) { newCustomer.value.error = 'A customer with this name already exists.'; return }
  const customer: Customer = { id: crypto.randomUUID(), name, tin: newCustomer.value.tin.trim(), contactPerson: '', email: '', phone: '', address: newCustomer.value.address.trim(), active: true }
  customers.value = [...customers.value, customer]
  recordAudit('Sales', 'Created', `Customer: ${name}`, 'Added from an invoice')
  chooseCustomer(customer.id)
  customerDialog.value?.close()
}

function openTermDialog() {
  newTerm.value = { name: '', dueOn: 0, paymentDue: 'Days', error: '' }
  termDialog.value?.showModal()
}

function addTerm() {
  const name = newTerm.value.name.trim()
  const dueOn = Number(newTerm.value.dueOn)
  if (!name) { newTerm.value.error = 'Name is required.'; return }
  if (!Number.isInteger(dueOn) || dueOn < 0) { newTerm.value.error = 'Due On must be a whole number, 0 or more.'; return }
  if (setupRecords.value.some((item) => item.kind === 'sales-payment-terms' && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) { newTerm.value.error = 'A payment term with this name already exists.'; return }
  const term: SetupRecord = {
    id: crypto.randomUUID(), kind: 'sales-payment-terms', name, active: true, account: '', payments: 1, frequency: '',
    dueOn, paymentDue: newTerm.value.paymentDue, computation: 'Amount', rate: 0, allowOverride: false,
  }
  setupRecords.value = [...setupRecords.value, term]
  recordAudit('Sales', 'Created', `Payment Term: ${name}`, 'Added from an invoice')
  draft.value.paymentTermId = term.id
  termDialog.value?.close()
}
</script>

<template>
  <section class="sales-page sales-invoice" aria-labelledby="invoice-editor-title">
    <header class="sales-invoice__header">
      <div>
        <h2 id="invoice-editor-title">Invoice</h2>
        <p>{{ invoice ? invoice.number : 'New invoice' }}</p>
      </div>
      <button class="sales-invoice__close" type="button" aria-label="Close invoice" @click="requestClose"><X :size="20" aria-hidden="true" /></button>
    </header>
    <p v-if="isDraft" class="sales-notice sales-notice--info">This draft came from bulk entry. Saving it issues the invoice as Unpaid.</p>

    <form class="sales-invoice__form" novalidate @submit.prevent="save">
      <div class="sales-card">
        <h3 class="sales-card__title">Details</h3>
        <div class="sales-form sales-card__form">
          <label>Invoice # <span>*</span><input ref="numberInput" v-model="draft.number" maxlength="40" autocomplete="off" /></label>
          <AppDatePicker id="invoice-date" v-model="draft.date" label="Date" required />
          <div class="sales-field-action">
            <AppSelect id="invoice-customer" :model-value="draft.customerId" label="Customer" required placeholder="Select customer" :options="customerOptions" @update:model-value="chooseCustomer" />
            <button class="sales-field-action__button" type="button" aria-label="Add a new customer" title="Add a new customer" @click="openCustomerDialog"><UserPlus :size="17" aria-hidden="true" /></button>
          </div>
          <div class="sales-field-action">
            <AppSelect id="invoice-term" v-model="draft.paymentTermId" label="Payment Term" required placeholder="Select payment term" :options="termOptions" />
            <button class="sales-field-action__button" type="button" aria-label="Add a new payment term" title="Add a new payment term" @click="openTermDialog"><Plus :size="17" aria-hidden="true" /></button>
            <small v-if="dueDate" class="sales-field-action__hint">Due {{ reportDate(dueDate) }}</small>
          </div>
          <label class="sales-form__full">Remarks<textarea v-model="draft.remarks" rows="3" maxlength="500" /></label>
        </div>
      </div>

      <div class="sales-card sales-card--flush">
        <div class="sales-card__toolbar">
          <button class="sales-round-button" type="button" aria-label="Add line" title="Add line" @click="addLine"><Plus :size="17" aria-hidden="true" /></button>
          <button class="sales-round-button" type="button" aria-label="Remove selected lines" title="Remove selected lines" :disabled="!selectedLines.length" @click="removeSelected"><Minus :size="17" aria-hidden="true" /></button>
          <span v-if="selectedLines.length" class="sales-card__selection">{{ selectedLines.length }} selected</span>
        </div>
        <div class="sales-table-wrap">
          <table class="sales-table sales-lines-grid">
            <thead><tr>
              <th scope="col" class="sales-lines-grid__select"><input type="checkbox" :checked="allSelected" :disabled="!draft.lines.length" aria-label="Select all lines" @change="toggleAllLines" /></th>
              <th scope="col">Item</th><th scope="col" class="sales-table__number">Quantity</th><th scope="col" class="sales-table__number">Unit Price</th>
              <th scope="col">WTAX Code</th><th scope="col" class="sales-table__number">WTAX</th><th scope="col">VAT Code</th><th scope="col">VAT Type</th>
              <th scope="col" class="sales-table__number">VAT</th><th scope="col" class="sales-table__number">Amount</th>
            </tr></thead>
            <tbody>
              <tr v-for="(line, index) in draft.lines" :key="line.id" :class="{ 'sales-lines-grid__row--selected': selectedLines.includes(line.id) }">
                <td class="sales-lines-grid__select"><input type="checkbox" :checked="selectedLines.includes(line.id)" :aria-label="`Select line ${index + 1}`" @change="toggleLine(line.id)" /></td>
                <td><input :id="`invoice-line-${line.id}`" v-model="line.description" list="invoice-items" maxlength="160" :aria-label="`Line ${index + 1} item`" @change="useCatalogPrice(line)" /></td>
                <td><input v-model.number="line.quantity" class="sales-lines-grid__number" type="number" min="0.01" step="0.01" :aria-label="`Line ${index + 1} quantity`" /></td>
                <td><input v-model.number="line.unitPrice" class="sales-lines-grid__number" type="number" min="0" step="0.01" :aria-label="`Line ${index + 1} unit price`" /></td>
                <td><input v-model="line.withholdingTaxCode" maxlength="40" :aria-label="`Line ${index + 1} WTAX code`" /></td>
                <td><input v-model.number="line.withholdingTaxAmount" class="sales-lines-grid__number" type="number" min="0" step="0.01" :aria-label="`Line ${index + 1} WTAX`" /></td>
                <td><input v-model="line.vatCode" maxlength="40" :aria-label="`Line ${index + 1} VAT code`" /></td>
                <td><input v-model="line.vatType" maxlength="40" :aria-label="`Line ${index + 1} VAT type`" /></td>
                <td><input v-model.number="line.vatAmount" class="sales-lines-grid__number" type="number" min="0" step="0.01" :aria-label="`Line ${index + 1} VAT`" /></td>
                <td class="sales-table__number sales-lines-grid__amount">{{ tableAmount(lineAmount(line)) }}</td>
              </tr>
              <tr v-if="!draft.lines.length" class="sales-table__empty-row sales-lines-grid__empty">
                <td colspan="10"><strong>No rows to show</strong><span>Use + to add a line item.</span></td>
              </tr>
            </tbody>
            <tfoot><tr>
              <td /><td /><td class="sales-table__number">{{ totals.quantity }}</td><td /><td />
              <td class="sales-table__number">{{ tableAmount(totals.withholding) }}</td><td /><td />
              <td class="sales-table__number">{{ tableAmount(totals.vat) }}</td><td class="sales-table__number">{{ tableAmount(totals.amount) }}</td>
            </tr></tfoot>
          </table>
          <datalist id="invoice-items"><option v-for="item in catalog" :key="item.id" :value="item.name" /></datalist>
        </div>
        <div class="sales-invoice__totals">
          <div v-if="discounts.length" class="sales-invoice__discount">
            <AppSelect id="invoice-discount" :model-value="draft.discountTypeId" label="Discount" :options="discountOptions" @update:model-value="chooseDiscount" />
            <label v-if="selectedDiscount">{{ selectedDiscount.computation === 'Percentage' ? 'Rate (%)' : 'Amount' }}<input v-model.number="draft.discountRate" type="number" min="0" step="0.01" :disabled="!selectedDiscount.allowOverride" /></label>
          </div>
          <dl>
            <div><dt>Subtotal</dt><dd>{{ tableAmount(totals.amount) }}</dd></div>
            <div v-if="selectedDiscount"><dt>Discount</dt><dd>-{{ tableAmount(discountAmount) }}</dd></div>
            <div class="sales-invoice__grand"><dt>Total before tax</dt><dd>{{ tableAmount(invoiceTotal) }}</dd></div>
          </dl>
        </div>
      </div>

      <div class="sales-card">
        <h3 class="sales-card__title">Customer Details</h3>
        <div class="sales-form sales-card__form">
          <label>Company<input v-model="draft.customerDetails.company" maxlength="120" /></label>
          <label>Tax Identification Number<input v-model="draft.customerDetails.tin" maxlength="30" /></label>
          <label class="sales-form__full">Unit#, Bldg., St., Barangay<input v-model="draft.customerDetails.street" maxlength="180" /></label>
          <label class="sales-form__full">District/Town, City, Province<input v-model="draft.customerDetails.locality" maxlength="180" /></label>
          <label>Country<input v-model="draft.customerDetails.country" maxlength="80" /></label>
          <label>Zip code<input v-model="draft.customerDetails.zipCode" maxlength="12" inputmode="numeric" /></label>
        </div>
      </div>

      <div class="sales-invoice__actions">
        <p v-if="error" class="sales-invoice__error" role="alert">{{ error }}</p>
        <button class="sales-button" type="button" @click="requestClose">Cancel</button>
        <button class="sales-button sales-button--primary" type="submit">Save invoice</button>
      </div>
    </form>

    <dialog ref="discardDialog" class="sales-dialog sales-dialog--small" aria-labelledby="invoice-discard-title">
      <div class="sales-dialog__header"><h2 id="invoice-discard-title">Discard changes?</h2></div>
      <p class="sales-dialog__body">Your changes to this invoice have not been saved.</p>
      <div class="sales-dialog__footer"><button class="sales-button" type="button" @click="discardDialog?.close()">Keep editing</button><button class="sales-button sales-button--danger" type="button" @click="emit('close')">Discard</button></div>
    </dialog>

    <dialog ref="customerDialog" class="sales-dialog" aria-labelledby="invoice-customer-title">
      <form @submit.prevent="addCustomer">
        <div class="sales-dialog__header"><h2 id="invoice-customer-title">New customer</h2><button type="button" aria-label="Close" @click="customerDialog?.close()"><X :size="18" /></button></div>
        <div class="sales-form">
          <label class="sales-form__full">Customer name <span>*</span><input v-model="newCustomer.name" maxlength="120" /></label>
          <label>TIN<input v-model="newCustomer.tin" maxlength="30" /></label>
          <label class="sales-form__full">Address<textarea v-model="newCustomer.address" rows="2" maxlength="500" /></label>
        </div>
        <p v-if="newCustomer.error" class="sales-form__error" role="alert">{{ newCustomer.error }}</p>
        <div class="sales-dialog__footer"><button class="sales-button" type="button" @click="customerDialog?.close()">Cancel</button><button class="sales-button sales-button--primary" type="submit">Add customer</button></div>
      </form>
    </dialog>

    <dialog ref="termDialog" class="sales-dialog" aria-labelledby="invoice-term-title">
      <form @submit.prevent="addTerm">
        <div class="sales-dialog__header"><h2 id="invoice-term-title">New payment term</h2><button type="button" aria-label="Close" @click="termDialog?.close()"><X :size="18" /></button></div>
        <div class="sales-form">
          <label class="sales-form__full">Name <span>*</span><input v-model="newTerm.name" maxlength="120" placeholder="e.g. Paid full within 30 days" /></label>
          <label>Due On<input v-model.number="newTerm.dueOn" type="number" min="0" step="1" /></label>
          <label>Payment Due<select v-model="newTerm.paymentDue"><option>Days</option><option>Months</option></select></label>
        </div>
        <p v-if="newTerm.error" class="sales-form__error" role="alert">{{ newTerm.error }}</p>
        <div class="sales-dialog__footer"><button class="sales-button" type="button" @click="termDialog?.close()">Cancel</button><button class="sales-button sales-button--primary" type="submit">Add payment term</button></div>
      </form>
    </dialog>
  </section>
</template>
