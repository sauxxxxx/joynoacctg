<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Trash2, X } from '@lucide/vue'
import { emptyPurchaseSetupRecord, type PurchaseSetupKind, type PurchaseSetupRecord } from './purchaseSetupData'

const props = defineProps<{ open: boolean; kind: PurchaseSetupKind; record: PurchaseSetupRecord | null }>()
const emit = defineEmits<{ close: []; save: [record: PurchaseSetupRecord]; delete: [record: PurchaseSetupRecord] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const draft = ref(emptyPurchaseSetupRecord(props.kind))
const error = ref('')
const isTerms = () => props.kind === 'purchases-payment-terms'
const isDiscount = () => props.kind === 'purchases-discount-types'
const singular = () => ({
  vendors: 'vendor',
  'revolving-fund-customers': 'custodian',
  'purchases-discount-types': 'discount type',
  'purchases-payment-terms': 'payment term',
  'purchases-payment-methods': 'payment method',
})[props.kind]

watch(() => [props.open, props.record, props.kind] as const, async ([open]) => {
  draft.value = props.record ? { ...props.record } : emptyPurchaseSetupRecord(props.kind)
  error.value = ''
  await nextTick()
  if (open && !dialog.value?.open) dialog.value?.showModal()
  if (!open && dialog.value?.open) dialog.value.close()
}, { immediate: true })

function save() {
  const name = draft.value.name.trim()
  if (!name) { error.value = 'Name is required.'; return }
  if (isDiscount() && draft.value.computation === 'Percentage' && draft.value.rate > 100) {
    error.value = 'Percentage rate cannot exceed 100.'
    return
  }
  emit('save', { ...draft.value, id: draft.value.id || crypto.randomUUID(), name })
  emit('close')
}
</script>

<template>
  <dialog ref="dialog" class="purchase-setup-editor" :aria-label="`${draft.id ? 'Edit' : 'New'} ${singular()}`" @close="emit('close')">
    <form @submit.prevent="save">
      <header><div><h2>{{ draft.id ? 'Edit' : 'New' }} {{ singular() }}</h2><p>Changes are kept in this preview only.</p></div><button type="button" aria-label="Close form" @click="dialog?.close()"><X :size="18" /></button></header>
      <div class="purchase-setup-editor__fields">
        <label>Name <span>*</span><input v-model="draft.name" required maxlength="140" /></label>
        <template v-if="kind === 'vendors'">
          <label>TIN<input v-model="draft.tin" maxlength="40" /></label>
          <label class="purchase-setup-editor__wide">Address<textarea v-model="draft.address" rows="3" maxlength="240" /></label>
        </template>
        <template v-if="isTerms()">
          <label># of Payments<input v-model.number="draft.payments" type="number" min="1" step="1" /></label>
          <label>Payment Frequency<input v-model="draft.frequency" maxlength="60" placeholder="e.g. Months" /></label>
          <label>Due On<input v-model.number="draft.dueOn" type="number" min="0" step="1" /></label>
          <label>Payment Due<select v-model="draft.paymentDue"><option>Days</option><option>Months</option></select></label>
        </template>
        <template v-if="isDiscount()">
          <label>Computation<select v-model="draft.computation"><option>Amount</option><option>Percentage</option></select></label>
          <label>Rate<input v-model.number="draft.rate" type="number" min="0" step="0.01" /></label>
          <label class="purchase-setup-editor__check"><input v-model="draft.allowOverride" type="checkbox" /> Allow override</label>
        </template>
        <label v-if="kind !== 'vendors'">Account<input v-model="draft.account" maxlength="120" /></label>
        <label v-if="kind === 'revolving-fund-customers' || isTerms()" class="purchase-setup-editor__check"><input v-model="draft.active" type="checkbox" /> Active</label>
        <p v-if="error" class="purchase-setup-editor__error" role="alert">{{ error }}</p>
      </div>
      <footer><button v-if="draft.id" class="purchase-setup-button purchase-setup-button--danger" type="button" @click="emit('delete', draft)"><Trash2 :size="15" /> Delete</button><span /><button class="purchase-setup-button" type="button" @click="dialog?.close()">Cancel</button><button class="purchase-setup-button purchase-setup-button--primary" type="submit">Save</button></footer>
    </form>
  </dialog>
</template>
