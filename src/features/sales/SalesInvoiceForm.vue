<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Minus, Plus, Settings2, UserPlus } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { formatSeriesNumber } from '../company/companyRecords'
import { documentSeries, goods, otherItems, recordAudit, services } from '../company/companyStore'
import { customers } from './customers/customerPreviewStore'
import QuickAddDialogs from './QuickAddDialogs.vue'
import SalesEditorShell from './SalesEditorShell.vue'
import { reportDate, tableAmount } from './salesFormat'
import { salesDocuments, setupRecords, type SalesDocument, type SalesLineItem } from './salesPreviewStore'
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
// Like the legacy form, a new invoice starts on the first active payment term.
const defaultTermId = props.invoice ? '' : setupRecords.value.find((item) => item.kind === 'sales-payment-terms' && item.active)?.id ?? ''

function blankInvoice(): SalesDocument {
  return {
    id: '', kind: 'sales-invoices', number: suggestedNumber, date: today(), customerId: '', status: 'Unpaid',
    paymentTermId: defaultTermId, paymentMethodId: '', dueDate: '', amount: 0, remarks: '',
    customerDetails: { customerType: 'Company', company: '', tin: '', street: '', locality: '', country: 'Philippines', zipCode: '' },
    discountTypeId: '', discountRate: 0, lines: [], payments: [], withInvoice: false,
  }
}

const draft = ref<SalesDocument>(props.invoice ? clone(props.invoice) : blankInvoice())
const initial = JSON.stringify(draft.value)
const dirty = computed(() => JSON.stringify(draft.value) !== initial)
const submitted = ref(false)
const saveError = ref('')
const selectedLines = ref<string[]>([])
const numberInput = ref<HTMLInputElement | null>(null)
const quickAdd = ref<InstanceType<typeof QuickAddDialogs> | null>(null)
const isDraft = computed(() => props.invoice?.status === 'Draft')

// Options menu (legacy): choose which parts of the form are shown.
const options = ref({ discount: Boolean(draft.value.discountTypeId), wtax: true, vat: true })
const optionsOpen = ref(false)
const optionsRoot = ref<HTMLElement | null>(null)
const optionRows: { key: 'discount' | 'wtax' | 'vat'; label: string }[] = [
  { key: 'discount', label: 'Discount' }, { key: 'wtax', label: 'WTAX' }, { key: 'vat', label: 'VAT' },
]
function setOption(key: 'discount' | 'wtax' | 'vat', on: boolean) {
  options.value[key] = on
  // A hidden discount must not keep applying silently.
  if (key === 'discount' && !on) { draft.value.discountTypeId = ''; draft.value.discountRate = 0 }
}
function onPointerDown(event: PointerEvent) {
  if (optionsOpen.value && optionsRoot.value && !optionsRoot.value.contains(event.target as Node)) optionsOpen.value = false
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && optionsOpen.value) { optionsOpen.value = false; event.stopPropagation() }
}
onMounted(() => {
  nextTick(() => numberInput.value?.focus())
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown, true)
})

const activeOrCurrent = (kind: 'sales-payment-terms' | 'sales-discount-types', currentId: string) => setupRecords.value
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

/**
 * Assumption pending confirmation: a line's Total Amount is quantity × unit price, before discount and tax.
 * WTAX, VAT, and CVAT are entered as shown on the source invoice and do not change the invoice total.
 */
const totals = computed(() => draft.value.lines.reduce((sum, line) => ({
  quantity: sum.quantity + (Number(line.quantity) || 0),
  withholding: sum.withholding + (Number(line.withholdingTaxAmount) || 0),
  vat: sum.vat + (Number(line.vatAmount) || 0),
  cvat: sum.cvat + (Number(line.creditableVatAmount) || 0),
  amount: sum.amount + lineAmount(line),
}), { quantity: 0, withholding: 0, vat: 0, cvat: 0, amount: 0 }))
const discountAmount = computed(() => {
  if (!selectedDiscount.value) return 0
  const rate = Number(draft.value.discountRate) || 0
  const value = selectedDiscount.value.computation === 'Percentage' ? totals.value.amount * rate / 100 : rate
  return Math.min(totals.value.amount, Math.max(0, value))
})
const invoiceTotal = computed(() => Math.round(Math.max(0, totals.value.amount - discountAmount.value) * 100) / 100)
const allSelected = computed(() => draft.value.lines.length > 0 && draft.value.lines.every((line) => selectedLines.value.includes(line.id)))
const customerTypeOptions = [{ value: 'Company', label: 'Company' }, { value: 'Individual', label: 'Individual' }]
const columnCount = computed(() => 5 + (options.value.wtax ? 2 : 0) + (options.value.vat ? 4 : 0))

const errors = computed(() => {
  const invoice = draft.value
  const found: Record<string, string> = {}
  const number = invoice.number.trim()
  if (!number) found.number = 'Cannot be blank'
  else if (salesDocuments.value.some((item) => item.kind === 'sales-invoices' && item.id !== invoice.id && item.number.trim().toLocaleLowerCase() === number.toLocaleLowerCase())) found.number = `Invoice # ${number} is already in use`
  if (!invoice.date) found.date = 'Cannot be blank'
  if (!customers.value.some((customer) => customer.id === invoice.customerId)) found.customerId = 'Choose a customer'
  if (!selectedTerm.value) found.paymentTermId = 'Choose a payment term'
  if (!invoice.lines.length) found.lines = 'Add at least one line item'
  if (selectedDiscount.value?.computation === 'Percentage' && Number(invoice.discountRate) > 100) found.discount = 'A percentage discount cannot exceed 100'
  return found
})
const lineErrors = computed(() => {
  const found: Record<string, string> = {}
  draft.value.lines.forEach((line, index) => {
    if (!line.description.trim()) found[line.id] = `Line ${index + 1}: enter the item`
    else if (!(Number(line.quantity) > 0)) found[line.id] = `Line ${index + 1}: quantity must be above zero`
    else if (!(Number(line.unitPrice) >= 0) || !(Number(line.withholdingTaxAmount) >= 0) || !(Number(line.vatAmount) >= 0) || !(Number(line.creditableVatAmount) >= 0)) found[line.id] = `Line ${index + 1}: amounts cannot be negative`
  })
  return found
})
const shown = (key: string) => submitted.value ? errors.value[key] : ''

function addLine() {
  const line: SalesLineItem = {
    id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0, withholdingTaxCode: '', withholdingTaxAmount: 0,
    vatCode: '', vatType: '', vatAmount: 0, creditableVatAmount: 0,
  }
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
function useCatalogPrice(line: SalesLineItem) {
  const match = catalog.value.find((item) => item.name.toLocaleLowerCase() === line.description.trim().toLocaleLowerCase())
  if (match && !line.unitPrice) line.unitPrice = match.sellingPrice
}
function chooseCustomer(id: string) {
  draft.value.customerId = id
  const customer = customers.value.find((item) => item.id === id)
  if (!customer) return
  draft.value.customerDetails = {
    ...draft.value.customerDetails, customerType: customer.customerType, company: customer.name, tin: customer.tin, street: customer.unitBuilding,
    locality: customer.locality, country: customer.country || draft.value.customerDetails.country, zipCode: customer.zipCode,
  }
}
function chooseDiscount(id: string) {
  draft.value.discountTypeId = id
  draft.value.discountRate = discounts.value.find((item) => item.id === id)?.rate ?? 0
}

function save() {
  submitted.value = true
  const first = Object.values(errors.value)[0] ?? Object.values(lineErrors.value)[0]
  saveError.value = first ? `Please fix the highlighted fields.` : ''
  if (first) return
  const isNew = !draft.value.id
  const invoice: SalesDocument = {
    ...clone(draft.value),
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
</script>

<template>
  <SalesEditorShell title="Invoice" :subtitle="invoice ? invoice.number : 'New invoice'" :dirty="dirty" :error="saveError" save-label="Save invoice" @save="save" @close="emit('close')">
    <template #before>
      <p v-if="isDraft" class="sales-notice sales-notice--info">This draft came from bulk entry. Saving it issues the invoice as Unpaid.</p>
    </template>

    <div class="sales-card">
      <h3 class="sales-card__title">Details</h3>
      <div class="sales-form sales-card__form">
        <label>Invoice # <span>*</span>
          <input ref="numberInput" v-model="draft.number" maxlength="40" autocomplete="off" :aria-invalid="Boolean(shown('number'))" />
          <small v-if="shown('number')" class="sales-field-error">{{ shown('number') }}</small>
        </label>
        <div class="sales-field"><AppDatePicker id="invoice-date" v-model="draft.date" label="Date" required :invalid="Boolean(shown('date'))" /></div>
        <div class="sales-field-action">
          <AppSelect id="invoice-customer" :model-value="draft.customerId" label="Customer" required placeholder="Select customer" :options="customerOptions" :invalid="Boolean(shown('customerId'))" @update:model-value="chooseCustomer" />
          <button class="sales-field-action__button" type="button" aria-label="Add a new customer" title="Add a new customer" @click="quickAdd?.openCustomer()"><UserPlus :size="17" aria-hidden="true" /></button>
          <small v-if="shown('customerId')" class="sales-field-error sales-field-action__hint">{{ shown('customerId') }}</small>
        </div>
        <div class="sales-field-action">
          <AppSelect id="invoice-term" v-model="draft.paymentTermId" label="Payment Term" required placeholder="Select payment term" :options="termOptions" :invalid="Boolean(shown('paymentTermId'))" />
          <button class="sales-field-action__button" type="button" aria-label="Add a new payment term" title="Add a new payment term" @click="quickAdd?.openTerm()"><Plus :size="17" aria-hidden="true" /></button>
          <small v-if="shown('paymentTermId')" class="sales-field-error sales-field-action__hint">{{ shown('paymentTermId') }}</small>
          <small v-else-if="dueDate" class="sales-field-action__hint">Due {{ reportDate(dueDate) }}</small>
        </div>
        <label class="sales-form__full">Remarks<textarea v-model="draft.remarks" rows="3" maxlength="500" /></label>
      </div>
    </div>

    <div class="sales-card sales-card--flush">
      <div class="sales-card__toolbar">
        <button class="sales-round-button" type="button" aria-label="Add row" title="Add row" @click="addLine"><Plus :size="17" aria-hidden="true" /></button>
        <button class="sales-round-button" type="button" aria-label="Remove selected rows" title="Remove selected rows" :disabled="!selectedLines.length" @click="removeSelected"><Minus :size="17" aria-hidden="true" /></button>
        <span v-if="selectedLines.length" class="sales-card__selection">{{ selectedLines.length }} selected</span>
        <div ref="optionsRoot" class="sales-options">
          <button class="sales-options__toggle" type="button" :aria-expanded="optionsOpen" aria-haspopup="true" @click="optionsOpen = !optionsOpen"><Settings2 :size="16" aria-hidden="true" /> Options</button>
          <div v-if="optionsOpen" class="sales-options__menu" role="group" aria-label="Invoice options">
            <label v-for="row in optionRows" :key="row.key" class="ws-switch"><input type="checkbox" :checked="options[row.key]" @change="setOption(row.key, ($event.target as HTMLInputElement).checked)" /><span class="ws-switch__track" aria-hidden="true" />{{ row.label }}</label>
          </div>
        </div>
      </div>
      <div class="sales-table-wrap">
        <table class="sales-table sales-lines-grid">
          <thead><tr>
            <th scope="col" class="sales-lines-grid__select"><input type="checkbox" :checked="allSelected" :disabled="!draft.lines.length" aria-label="Select all lines" @change="selectedLines = allSelected ? [] : draft.lines.map((line) => line.id)" /></th>
            <th scope="col">Item</th><th scope="col" class="sales-table__number">Quantity</th><th scope="col" class="sales-table__number">Unit Price</th>
            <template v-if="options.wtax"><th scope="col">WTAX Code</th><th scope="col" class="sales-table__number">WTAX</th></template>
            <template v-if="options.vat"><th scope="col">VAT Code</th><th scope="col">VAT Type</th><th scope="col" class="sales-table__number">VAT</th><th scope="col" class="sales-table__number">CVAT</th></template>
            <th scope="col" class="sales-table__number">Total Amount</th>
          </tr></thead>
          <tbody>
            <tr v-for="(line, index) in draft.lines" :key="line.id" :class="{ 'sales-lines-grid__row--selected': selectedLines.includes(line.id), 'sales-lines-grid__row--error': submitted && lineErrors[line.id] }">
              <td class="sales-lines-grid__select"><input type="checkbox" :checked="selectedLines.includes(line.id)" :aria-label="`Select line ${index + 1}`" @change="toggleLine(line.id)" /></td>
              <td><input :id="`invoice-line-${line.id}`" v-model="line.description" list="invoice-items" maxlength="160" :aria-label="`Line ${index + 1} item`" @change="useCatalogPrice(line)" /></td>
              <td><input v-model.number="line.quantity" class="sales-lines-grid__number" type="number" min="0.01" step="0.01" :aria-label="`Line ${index + 1} quantity`" /></td>
              <td><input v-model.number="line.unitPrice" class="sales-lines-grid__number" type="number" min="0" step="0.01" :aria-label="`Line ${index + 1} unit price`" /></td>
              <template v-if="options.wtax">
                <td><input v-model="line.withholdingTaxCode" maxlength="40" :aria-label="`Line ${index + 1} WTAX code`" /></td>
                <td><input v-model.number="line.withholdingTaxAmount" class="sales-lines-grid__number" type="number" min="0" step="0.01" :aria-label="`Line ${index + 1} WTAX`" /></td>
              </template>
              <template v-if="options.vat">
                <td><input v-model="line.vatCode" maxlength="40" :aria-label="`Line ${index + 1} VAT code`" /></td>
                <td><input v-model="line.vatType" maxlength="40" :aria-label="`Line ${index + 1} VAT type`" /></td>
                <td><input v-model.number="line.vatAmount" class="sales-lines-grid__number" type="number" min="0" step="0.01" :aria-label="`Line ${index + 1} VAT`" /></td>
                <td><input v-model.number="line.creditableVatAmount" class="sales-lines-grid__number" type="number" min="0" step="0.01" :aria-label="`Line ${index + 1} CVAT`" /></td>
              </template>
              <td class="sales-table__number sales-lines-grid__amount">{{ tableAmount(lineAmount(line)) }}</td>
            </tr>
            <tr v-if="!draft.lines.length" class="sales-table__empty-row sales-lines-grid__empty">
              <td :colspan="columnCount"><strong>No rows to show</strong><span>Use + to add a row.</span></td>
            </tr>
          </tbody>
          <tfoot><tr>
            <td /><td /><td class="sales-table__number">{{ totals.quantity }}</td><td />
            <template v-if="options.wtax"><td /><td class="sales-table__number">{{ tableAmount(totals.withholding) }}</td></template>
            <template v-if="options.vat"><td /><td /><td class="sales-table__number">{{ tableAmount(totals.vat) }}</td><td class="sales-table__number">{{ tableAmount(totals.cvat) }}</td></template>
            <td class="sales-table__number">{{ tableAmount(totals.amount) }}</td>
          </tr></tfoot>
        </table>
        <datalist id="invoice-items"><option v-for="item in catalog" :key="item.id" :value="item.name" /></datalist>
      </div>
      <p v-if="shown('lines')" class="sales-field-error sales-card__error">{{ shown('lines') }}</p>
      <ul v-if="submitted && Object.keys(lineErrors).length" class="sales-card__error sales-field-error sales-card__errors">
        <li v-for="(message, id) in lineErrors" :key="id">{{ message }}</li>
      </ul>
      <div class="sales-invoice__totals">
        <div v-if="options.discount" class="sales-invoice__discount">
          <AppSelect id="invoice-discount" :model-value="draft.discountTypeId" label="Discount" :options="discountOptions" @update:model-value="chooseDiscount" />
          <label v-if="selectedDiscount">{{ selectedDiscount.computation === 'Percentage' ? 'Rate (%)' : 'Amount' }}<input v-model.number="draft.discountRate" type="number" min="0" step="0.01" :disabled="!selectedDiscount.allowOverride" /></label>
          <small v-if="shown('discount')" class="sales-field-error">{{ shown('discount') }}</small>
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
        <div class="sales-field"><AppSelect id="invoice-customer-type" v-model="draft.customerDetails.customerType" label="Customer Type" :options="customerTypeOptions" /></div>
        <label>Tax Identification Number<input v-model="draft.customerDetails.tin" maxlength="20" /></label>
        <label class="sales-form__full">Unit#, Bldg., St., Barangay<input v-model="draft.customerDetails.street" maxlength="180" /></label>
        <label class="sales-form__full">District/Town, City, Province<input v-model="draft.customerDetails.locality" maxlength="180" /></label>
        <label>Country<input v-model="draft.customerDetails.country" maxlength="80" /></label>
        <label>Zip code<input v-model="draft.customerDetails.zipCode" maxlength="12" inputmode="numeric" /></label>
      </div>
    </div>
  </SalesEditorShell>

  <QuickAddDialogs ref="quickAdd" @customer="chooseCustomer" @term="draft.paymentTermId = $event" />
</template>
