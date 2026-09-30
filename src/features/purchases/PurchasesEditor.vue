<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Plus, Trash2, X } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import { formatMoney, parseMoneyToCents } from '../../lib/money'
import { draftFromRecord, emptyPurchaseDraft, validatePurchaseDraft } from './purchaseForm'
import { purchaseConfigs, type PurchaseKind, type PurchaseRecord } from './purchasePreviewData'

const props = defineProps<{ open: boolean; kind: PurchaseKind; record: PurchaseRecord | null }>()
const emit = defineEmits<{ close: []; save: [record: PurchaseRecord]; delete: [record: PurchaseRecord] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const error = ref('')
const draft = ref(emptyPurchaseDraft())
const posted = computed(() => props.record?.status === 'Posted')
const invoice = computed(() => props.kind === 'purchase-invoices')
const payroll = computed(() => props.kind === 'payrolls')
const receipt = computed(() => props.kind === 'purchase-receipts')
const singularNames: Record<PurchaseKind, string> = { 'purchase-invoices': 'invoice', payrolls: 'payroll', 'cash-voucher': 'cash voucher', 'check-voucher': 'check voucher', 'petty-cash-voucher': 'petty cash voucher', 'purchase-receipts': 'receipt' }
const title = computed(() => `${posted.value ? 'View' : props.record ? 'Edit' : 'New'} ${singularNames[props.kind]}`)
const invoiceSubtotal = computed(() => draft.value.lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (parseMoneyToCents(line.unitPrice) ?? 0), 0))
const invoiceTotal = computed(() => invoiceSubtotal.value + (parseMoneyToCents(draft.value.tax) ?? 0))

watch(() => [props.open, props.record, props.kind] as const, async () => {
  if (!props.open) { if (dialog.value?.open) dialog.value.close(); return }
  draft.value = props.record ? draftFromRecord(props.record) : emptyPurchaseDraft()
  error.value = ''
  await nextTick()
  if (!dialog.value?.open) dialog.value?.showModal()
}, { immediate: true })

function save() {
  if (posted.value) return
  const result = validatePurchaseDraft(props.kind, draft.value, props.record ?? undefined)
  if (!result.record) { error.value = result.error ?? 'Check this record.'; return }
  emit('save', result.record)
  emit('close')
}
function addLine() { draft.value.lines.push({ id: crypto.randomUUID(), description: '', quantity: '1', unitPrice: '' }) }
</script>

<template>
  <dialog ref="dialog" class="purchases-editor" :aria-label="title" @cancel.prevent="emit('close')" @click="($event) => { if ($event.target === dialog) emit('close') }">
    <form @submit.prevent="save">
      <header class="purchases-editor__header"><div><h2>{{ title }}</h2><p>{{ posted ? 'Reference sample · Read only' : 'Temporary draft · Nothing is posted or saved to a server' }}</p></div><button type="button" class="icon-button" aria-label="Close editor" @click="emit('close')"><X :size="18" /></button></header>
      <div class="purchases-editor__body">
        <div class="purchases-editor__fields">
          <label>{{ purchaseConfigs[kind].numberLabel }} <span aria-hidden="true">*</span><input v-model="draft.number" type="text" maxlength="80" :disabled="posted" required /></label>
          <AppDatePicker v-if="!payroll" v-model="draft.date" label="Date" required :disabled="posted" :invalid="Boolean(error)" />
          <label v-if="!payroll">{{ receipt ? 'Vendor' : 'Vendor / Payee' }} <span aria-hidden="true">*</span><input v-model="draft.vendor" type="text" maxlength="120" :disabled="posted" required /></label>
          <template v-if="payroll">
            <label>Month <span aria-hidden="true">*</span><input v-model="draft.month" type="number" min="1" max="12" :disabled="posted" required /></label>
            <label>Year <span aria-hidden="true">*</span><input v-model="draft.year" type="number" min="2000" max="2100" :disabled="posted" required /></label>
            <label>Period<input v-model="draft.period" type="text" maxlength="80" :disabled="posted" /></label>
            <label>Payroll frequency<input v-model="draft.payrollFrequency" type="text" maxlength="80" :disabled="posted" /></label>
            <label>Pay group<input v-model="draft.payGroup" type="text" maxlength="80" :disabled="posted" /></label>
            <label>Accrual JE<input v-model="draft.accrualJE" type="text" maxlength="80" :disabled="posted" /></label>
          </template>
          <label v-if="kind === 'check-voucher'">Check number <span aria-hidden="true">*</span><input v-model="draft.checkNumber" type="text" maxlength="80" :disabled="posted" required /></label>
          <label v-if="receipt || invoice">Payment method <span v-if="receipt" aria-hidden="true">*</span><input v-model="draft.paymentMethod" type="text" maxlength="80" :disabled="posted" :required="receipt" /></label>
          <label v-if="invoice">Payment terms<input v-model="draft.paymentTerms" type="text" maxlength="80" :disabled="posted" /></label>
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
          <div class="purchases-editor__summary"><span>Subtotal <strong>{{ formatMoney(invoiceSubtotal) }}</strong></span><label>Tax / adjustment<input v-model="draft.tax" type="text" inputmode="decimal" /></label><span>Total <strong>{{ formatMoney(invoiceTotal) }}</strong></span><label>Paid amount<input v-model="draft.paid" type="text" inputmode="decimal" /></label></div>
        </template>
        <p v-if="error" class="purchases-editor__error" role="alert">{{ error }}</p>
      </div>
      <footer class="purchases-editor__footer"><button v-if="record?.status === 'Draft'" type="button" class="purchases-button purchases-button--danger" @click="emit('delete', record)">Delete draft</button><span class="purchases-editor__spacer" /><button type="button" class="purchases-button" @click="emit('close')">{{ posted ? 'Close' : 'Cancel' }}</button><button v-if="!posted" type="submit" class="purchases-button purchases-button--primary">Save draft</button></footer>
    </form>
  </dialog>
</template>
