<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Plus, Search, Trash2, Upload, X } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { decimalToCents } from '../../lib/money'
import { salesDocumentRepository } from '../../services/previewRepositories'
import { goods, otherItems, services } from '../company/companyStore'
import { customers } from './customers/customerPreviewStore'
import { downloadInvoiceSheet, readInvoiceSheet } from './invoiceSpreadsheet'
import { salesDocuments, setupRecords, type SalesDocument, type SalesLineItem } from './salesPreviewStore'
import './sales-pages.css'

const emit = defineEmits<{ close: []; saved: [count: number] }>()
type BulkRow = { id: string; number: string; date: string; customerId: string; paymentTermId: string; item: string; quantity: number; unitPrice: number }
const pad = (value: number) => String(value).padStart(2, '0')
const today = () => { const date = new Date(); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
const emptyRow = (): BulkRow => ({ id: crypto.randomUUID(), number: '', date: today(), customerId: '', paymentTermId: '', item: '', quantity: 1, unitPrice: 0 })
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
}
const rows = ref<BulkRow[]>([])
const query = ref('')
const error = ref('')
const busy = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const terms = computed(() => setupRecords.value.filter((item) => item.kind === 'sales-payment-terms' && item.active))
const catalog = computed(() => [...goods.value, ...services.value, ...otherItems.value])
const customerOptions = computed(() => customers.value.filter((customer) => customer.active).map((customer) => ({ value: customer.id, label: customer.name })))
const termOptions = computed(() => [{ value: '', label: 'None' }, ...terms.value.map((term) => ({ value: term.id, label: term.name }))])
const visibleRows = computed(() => rows.value.filter((row) => `${row.number} ${row.item} ${customers.value.find((item) => item.id === row.customerId)?.name ?? ''}`.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())))

function addRow() { rows.value.push(emptyRow()); error.value = '' }
function removeRow(id: string) { rows.value = rows.value.filter((row) => row.id !== id) }
function validateRows() {
  if (rows.value.length > 500) return 'Save at most 500 invoices at a time.'
  const existing = new Set(salesDocuments.value.filter((item) => item.kind === 'sales-invoices').map((item) => item.number.toLocaleLowerCase()))
  const seen = new Set<string>()
  for (const [index, row] of rows.value.entries()) {
    if (!row.number.trim() || !validDate(row.date) || !customers.value.some((customer) => customer.id === row.customerId) || !row.item.trim() || !Number.isFinite(row.quantity) || row.quantity <= 0 || !Number.isFinite(row.unitPrice) || row.unitPrice < 0) return `Row ${index + 1} needs an invoice number, valid date, customer, item, positive quantity, and nonnegative price.`
    const number = row.number.trim().toLocaleLowerCase()
    if (seen.has(number) || existing.has(number)) return `Invoice number ${row.number} is duplicated.`
    seen.add(number)
  }
  return ''
}
async function saveAll() {
  if (!rows.value.length) { error.value = 'Add at least one invoice.'; return }
  error.value = validateRows()
  if (error.value) return
  const documents: SalesDocument[] = rows.value.map((row) => {
    const customer = customers.value.find((item) => item.id === row.customerId)
    const itemId = catalog.value.find((item) => item.name.toLocaleLowerCase() === row.item.trim().toLocaleLowerCase())?.id ?? ''
    const line: SalesLineItem = { id: crypto.randomUUID(), itemId, description: row.item.trim(), quantity: Number(row.quantity), unitPriceCents: decimalToCents(row.unitPrice) ?? 0, withholdingTaxCode: '', withholdingTaxCents: 0, vatCode: '', vatType: '', vatCents: 0, creditableVatCents: 0 }
    return {
      id: crypto.randomUUID(), kind: 'sales-invoices', number: row.number.trim(), date: row.date, customerId: row.customerId,
      status: 'Draft', paymentTermId: row.paymentTermId, paymentMethodId: '', dueDate: '',
      amountCents: Math.round(line.quantity * line.unitPriceCents), remarks: '',
      customerDetails: { customerType: customer?.customerType ?? 'Company', company: customer?.name ?? '', tin: customer?.tin ?? '', street: customer?.unitBuilding ?? '', locality: customer?.locality ?? '', country: customer?.country || 'Philippines', zipCode: customer?.zipCode ?? '' },
      discountTypeId: '', discountRate: 0, discountAmountCents: 0, lines: [line], payments: [], withInvoice: false,
    }
  })
  await Promise.all(documents.map((document) => salesDocumentRepository.save(document)))
  emit('saved', documents.length)
}

async function exportExcel() {
  busy.value = true
  error.value = ''
  try {
    await downloadInvoiceSheet(rows.value.map((row) => ({
      number: row.number, date: row.date, customer: customers.value.find((item) => item.id === row.customerId)?.name ?? '',
      paymentTerm: terms.value.find((item) => item.id === row.paymentTermId)?.name ?? '', item: row.item,
      quantity: row.quantity, unitPrice: row.unitPrice,
    })))
  } catch { error.value = 'Could not create the Excel file.' }
  finally { busy.value = false }
}

async function importExcel(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  busy.value = true
  error.value = ''
  try {
    const imported = await readInvoiceSheet(file)
    if (!imported.length) throw new Error('The Excel file has no invoice rows.')
    const parsed: BulkRow[] = imported.map((row, index) => {
      const customer = customers.value.find((item) => item.name.toLocaleLowerCase() === row.customer.toLocaleLowerCase())
      const term = terms.value.find((item) => item.name.toLocaleLowerCase() === row.paymentTerm.toLocaleLowerCase())
      if (!customer) throw new Error(`Row ${index + 2}: customer ${row.customer || '(blank)'} is not in Sales Setup.`)
      if (row.paymentTerm && !term) throw new Error(`Row ${index + 2}: payment term ${row.paymentTerm} is not in Sales Setup.`)
      return { id: crypto.randomUUID(), number: row.number, date: row.date, customerId: customer.id, paymentTermId: term?.id ?? '', item: row.item, quantity: row.quantity, unitPrice: row.unitPrice }
    })
    rows.value = [...rows.value, ...parsed]
    error.value = validateRows()
    if (error.value) rows.value.splice(rows.value.length - parsed.length, parsed.length)
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not read the Excel file.' }
  finally { busy.value = false }
}
</script>

<template>
  <section class="sales-page" aria-label="Add multiple invoices">
    <div class="sales-panel">
      <div class="sales-panel__toolbar">
        <div><h2>New invoices</h2><p>Add rows here, or fill in the Excel template and upload it.</p></div>
        <div class="sales-panel__actions sales-panel__actions--bulk">
          <label class="sales-search"><Search :size="16" aria-hidden="true" /><input v-model="query" type="search" placeholder="Type to filter" aria-label="Search staged invoices" /></label>
          <button class="sales-button" type="button" @click="addRow"><Plus :size="16" /> Add row</button>
          <button class="sales-button" type="button" :disabled="busy" @click="fileInput?.click()"><Upload :size="16" /> Upload Excel</button>
          <button class="sales-button" type="button" :disabled="busy" @click="exportExcel"><Download :size="16" /> Download Excel</button>
          <button class="sales-button" type="button" @click="emit('close')"><X :size="16" /> Close</button>
          <input ref="fileInput" class="sales-visually-hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="importExcel" />
        </div>
      </div>
      <p v-if="error" class="sales-form__error" role="alert">{{ error }}</p>
      <div class="sales-table-wrap">
        <table class="sales-table sales-bulk-table"><thead><tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>Payment Term</th><th>Item</th><th>Quantity</th><th>Unit Price</th><th>Actions</th></tr></thead>
          <tbody><tr v-for="row in visibleRows" :key="row.id">
            <td><input v-model="row.number" aria-label="Invoice number" maxlength="40" /></td>
            <td><AppDatePicker :id="`bulk-date-${row.id}`" v-model="row.date" label="Invoice date" /></td>
            <td><AppSelect v-model="row.customerId" aria-label="Customer" placeholder="Select customer" :options="customerOptions" compact /></td>
            <td><AppSelect v-model="row.paymentTermId" aria-label="Payment term" :options="termOptions" compact /></td>
            <td><input v-model="row.item" aria-label="Item" maxlength="160" /></td>
            <td><input v-model.number="row.quantity" aria-label="Quantity" type="number" min="0.01" step="0.01" /></td>
            <td><input v-model.number="row.unitPrice" aria-label="Unit price" type="number" min="0" step="0.01" /></td>
            <td class="sales-table__actions"><button type="button" :aria-label="`Remove invoice ${row.number || 'row'}`" @click="removeRow(row.id)"><Trash2 :size="16" /></button></td>
          </tr></tbody>
        </table>
      </div>
      <div v-if="!rows.length" class="sales-empty"><strong>No rows to show</strong><span>Add a row or upload the downloaded Excel template.</span></div>
      <div class="sales-panel__footer"><span>{{ rows.length }} staged invoice{{ rows.length === 1 ? '' : 's' }}</span><button class="sales-button sales-button--primary" type="button" :disabled="busy || !rows.length" @click="saveAll">Save all drafts</button></div>
    </div>
  </section>
</template>
