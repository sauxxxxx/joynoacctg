<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Plus, Trash2, X } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import AppSelect, { type SelectOption } from '../../components/ui/AppSelect.vue'
import { formatMoney, parseMoneyToCents } from '../../lib/money'
import { draftFromRecord, emptyPurchaseDraft, validatePurchaseDraft } from './purchaseForm'
import { purchaseConfigs, purchaseRecords, type PurchaseKind, type PurchaseRecord } from './purchasePreviewData'
import { purchaseSetupRecords } from './setup/purchaseSetupData'
import SourceDocumentActions from '../transactions/SourceDocumentActions.vue'

const props = defineProps<{ open: boolean; kind: PurchaseKind; record: PurchaseRecord | null; busy?: boolean; readonly?: boolean; canDelete?: boolean; serverError?: string }>()
const emit = defineEmits<{ close: []; save: [record: PurchaseRecord]; delete: [record: PurchaseRecord]; changed: [message: string] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const error = ref('')
const draft = ref(emptyPurchaseDraft())
const posted = computed(() => Boolean(props.readonly || props.record?.journalEntryId || props.record?.status === 'Posted' || props.record?.status === 'Voided'))
const invoice = computed(() => props.kind === 'purchase-invoices')
const payroll = computed(() => props.kind === 'payrolls')
const receipt = computed(() => props.kind === 'purchase-receipts')
const voucher = computed(() => ['cash-voucher', 'check-voucher', 'petty-cash-voucher'].includes(props.kind))
const custodianOptions = computed(() => [{ value: '', label: 'No revolving fund' }, ...purchaseSetupRecords.value.filter((record) => record.kind === 'revolving-fund-customers' && (record.active || record.id === draft.value.custodianId)).map((record) => ({ value: record.id, label: record.name }))])
const singularNames: Record<PurchaseKind, string> = { 'purchase-invoices': 'invoice', payrolls: 'payroll', 'cash-voucher': 'cash voucher', 'check-voucher': 'check voucher', 'petty-cash-voucher': 'petty cash voucher', 'purchase-receipts': 'receipt' }
const title = computed(() => `${posted.value ? 'View' : props.record ? 'Edit' : 'New'} ${singularNames[props.kind]}`)
const invoiceSubtotal = computed(() => draft.value.lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (parseMoneyToCents(line.unitPrice) ?? 0), 0))
const invoiceTotal = computed(() => invoiceSubtotal.value + (parseMoneyToCents(draft.value.tax) ?? 0))
const vendorOptions = computed<SelectOption[]>(() => purchaseSetupRecords.value
  .filter((record) => record.kind === 'vendors' && (record.active || record.id === draft.value.vendorId))
  .map((record) => ({ value: record.id, label: record.name })))

watch(() => [props.open, props.record, props.kind] as const, async () => {
  if (!props.open) { if (dialog.value?.open) dialog.value.close(); return }
  draft.value = props.record ? draftFromRecord(props.record) : emptyPurchaseDraft()
  draft.value.dueDate = props.record?.dueDate || draft.value.date
  draft.value.custodianId = props.record?.custodianId || ''; draft.value.fundMovement = props.record?.fundMovement || ''
  draft.value.allocations = (props.record?.allocations || []).map((row) => ({ ...row, amount: (row.amountCents / 100).toFixed(2) }))
  error.value = ''
  await nextTick()
  if (!dialog.value?.open) dialog.value?.showModal()
}, { immediate: true })

function save() {
  if (posted.value || props.busy) return
  const result = validatePurchaseDraft(props.kind, draft.value, props.record ?? undefined)
  if (!result.record) { error.value = result.error ?? 'Check this record.'; return }
  emit('save', result.record)
}
function addLine() { draft.value.lines.push({ id: crypto.randomUUID(), description: '', quantity: '1', unitPrice: '' }) }
function addAllocation() { draft.value.allocations?.push({ id: crypto.randomUUID(), invoiceId: '', others: '', amount: '' }) }
const payableOptions = computed(() => [{ value: '', label: 'Other payment' }, ...purchaseRecords.value.filter((record) => record.kind === 'purchase-invoices' && record.status === 'Posted' && record.vendorId === draft.value.vendorId).map((record) => ({ value: record.id, label: `${record.number} · balance ${formatMoney(record.totalCents - record.paidCents)}` }))])
</script>

<template>
  <dialog ref="dialog" class="purchases-editor" :aria-label="title" @cancel.prevent="!busy && emit('close')" @click="($event) => { if (!busy && $event.target === dialog) emit('close') }">
    <form @submit.prevent="save">
      <header class="purchases-editor__header"><div><h2>{{ title }}</h2><p>{{ posted ? 'Read only · History preserved' : payroll ? 'Track recorded payroll totals; no salary or statutory deductions are calculated.' : 'Save a draft, then review its accounts before posting.' }}</p></div><button type="button" class="icon-button" aria-label="Close editor" :disabled="busy" @click="emit('close')"><X :size="18" /></button></header>
      <fieldset class="purchases-editor__body" :disabled="busy || posted" style="border: 0; margin: 0; min-width: 0">
        <div class="purchases-editor__fields">
          <label>{{ purchaseConfigs[kind].numberLabel }} <span aria-hidden="true">*</span><input v-model="draft.number" type="text" maxlength="80" :disabled="posted" required /></label>
          <AppDatePicker v-if="!payroll" v-model="draft.date" label="Date" required :disabled="posted" :invalid="Boolean(error)" />
          <AppSelect v-if="!payroll" id="purchase-vendor" v-model="draft.vendorId" :label="receipt ? 'Vendor' : 'Vendor / Payee'" required placeholder="Choose vendor" :options="vendorOptions" :disabled="posted" :invalid="Boolean(error && !draft.vendorId)" />
          <template v-if="payroll">
            <label>Month <span aria-hidden="true">*</span><input v-model="draft.month" type="number" min="1" max="12" :disabled="posted" required /></label>
            <label>Year <span aria-hidden="true">*</span><input v-model="draft.year" type="number" min="2000" max="2100" :disabled="posted" required /></label>
            <label>Period<input v-model="draft.period" type="text" maxlength="80" :disabled="posted" /></label>
            <label>Payroll frequency<input v-model="draft.payrollFrequency" type="text" maxlength="80" :disabled="posted" /></label>
            <label>Pay group<input v-model="draft.payGroup" type="text" maxlength="80" :disabled="posted" /></label>
            <label>Accrual JE<input v-model="draft.accrualJE" type="text" maxlength="80" :disabled="posted" /></label>
          </template>
          <label v-if="kind === 'check-voucher'">Check number <span aria-hidden="true">*</span><input v-model="draft.checkNumber" type="text" maxlength="80" :disabled="posted" required /></label>
          <AppSelect v-if="voucher" :model-value="draft.custodianId || ''" label="Fund custodian" :options="custodianOptions" :disabled="posted" @update:model-value="draft.custodianId = $event" />
          <AppSelect v-if="voucher && draft.custodianId" :model-value="draft.fundMovement || ''" label="Fund movement" :options="[{ value: '', label: 'Select movement' }, { value: 'Replenishment', label: 'Replenishment' }, { value: 'Disbursement', label: 'Disbursement' }]" required :disabled="posted" @update:model-value="draft.fundMovement = $event as '' | 'Replenishment' | 'Disbursement'" />
          <label v-if="receipt || invoice">Payment method <span v-if="receipt" aria-hidden="true">*</span><input v-model="draft.paymentMethod" type="text" maxlength="80" :disabled="posted" :required="receipt" /></label>
          <label v-if="invoice">Payment terms<input v-model="draft.paymentTerms" type="text" maxlength="80" :disabled="posted" /></label>
          <AppDatePicker v-if="invoice" :model-value="draft.dueDate || ''" label="Due date" required :disabled="posted" @update:model-value="draft.dueDate = $event" />
          <label v-if="!invoice && !posted">Amount <span aria-hidden="true">*</span><input v-model="draft.amount" type="text" inputmode="decimal" placeholder="0.00" required /></label>
          <template v-if="posted"><div class="purchases-editor__readout"><span>Amount</span><strong>{{ formatMoney(record?.amountCents ?? 0) }}</strong></div><div class="purchases-editor__readout"><span>Total</span><strong>{{ formatMoney(record?.totalCents ?? 0) }}</strong></div></template>
          <label class="purchases-editor__wide">Remarks<input v-model="draft.remarks" type="text" maxlength="240" :disabled="posted" /></label>
        </div>
        <template v-if="invoice && !posted">
          <div class="purchases-editor__section-heading"><h3>Invoice lines</h3><span>Quantity × unit price</span></div>
          <div v-for="(line, index) in draft.lines" :key="line.id" class="purchases-editor__line">
            <label>Description<input v-model="line.description" type="text" maxlength="140" placeholder="Item or service" required /></label>
            <label>Qty<input v-model="line.quantity" type="number" min="1" step="1" required /></label>
            <label>Unit price<input v-model="line.unitPrice" type="text" inputmode="decimal" placeholder="0.00" required /></label>
            <button type="button" class="icon-button" :disabled="draft.lines.length === 1" :aria-label="`Remove line ${index + 1}`" @click="draft.lines.splice(index, 1)"><Trash2 :size="16" /></button>
          </div>
          <button type="button" class="purchases-button" @click="addLine"><Plus :size="15" /> Add line</button>
          <div class="purchases-editor__summary"><span>Subtotal <strong>{{ formatMoney(invoiceSubtotal) }}</strong></span><label>Recorded tax<input v-model="draft.tax" type="text" inputmode="decimal" /></label><span>Total <strong>{{ formatMoney(invoiceTotal) }}</strong></span><span>Paid amounts come from posted payment records.</span></div>
        </template>
        <template v-if="!invoice && !payroll">
          <h3>Payment allocations</h3><p>Allocate this payment to a posted invoice, or describe another payment.</p>
          <div v-for="(row, index) in draft.allocations" :key="row.id" class="purchases-editor__line"><AppSelect v-model="row.invoiceId" :label="`Allocation ${index + 1} invoice`" :options="payableOptions" /><label v-if="!row.invoiceId">Description<input v-model="row.others" maxlength="300" /></label><label>Amount<input v-model="row.amount" inputmode="decimal" /></label><button type="button" @click="draft.allocations?.splice(index, 1)">Remove</button></div>
          <button v-if="!posted" type="button" class="purchases-button" @click="addAllocation">Add allocation</button>
        </template>
        <p v-if="error" class="purchases-editor__error" role="alert">{{ error }}</p>
      </fieldset>
      <p v-if="serverError" class="purchases-editor__error" role="alert">{{ serverError }}</p>
      <footer class="purchases-editor__footer"><button v-if="record?.status === 'Draft' && canDelete" type="button" class="purchases-button purchases-button--danger" :disabled="busy" @click="emit('delete', record)">Delete draft</button><SourceDocumentActions v-if="record" :record="record" domain="purchases" @changed="emit('changed', $event)" /><span class="purchases-editor__spacer" /><button type="button" class="purchases-button" :disabled="busy" @click="emit('close')">{{ posted ? 'Close' : 'Cancel' }}</button><button v-if="!posted" type="submit" class="purchases-button purchases-button--primary" :disabled="busy">{{ busy ? 'Saving…' : 'Save draft' }}</button></footer>
    </form>
  </dialog>
</template>
