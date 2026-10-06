<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Trash2, X } from '@lucide/vue'
import AppSelect from '../../../components/ui/AppSelect.vue'
import { accounts } from '../../accounting/setup/accountSetupData'
import { emptyPurchaseSetupRecord, type PurchaseSetupKind, type PurchaseSetupRecord } from './purchaseSetupData'

const props = defineProps<{ open: boolean; kind: PurchaseSetupKind; record: PurchaseSetupRecord | null; busy?: boolean; error?: string; readonly?: boolean; canDelete?: boolean }>()
const emit = defineEmits<{ close: []; save: [record: PurchaseSetupRecord]; delete: [record: PurchaseSetupRecord] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const draft = ref(emptyPurchaseSetupRecord(props.kind))
const localError = ref('')
const isTerms = () => props.kind === 'purchases-payment-terms'
const isDiscount = () => props.kind === 'purchases-discount-types'
const singular = () => ({
  vendors: 'vendor',
  'revolving-fund-customers': 'custodian',
  'purchases-discount-types': 'discount type',
  'purchases-payment-terms': 'payment term',
  'purchases-payment-methods': 'payment method',
})[props.kind]
const accountOptions = computed(() => accounts.value.filter((account) => account.active || account.code === draft.value.accountId)
  .map((account) => ({ value: account.code, label: `${account.code} · ${account.name}` })))
const dueUnitOptions = ['Days', 'Months'].map((value) => ({ value, label: value }))
const computationOptions = ['Amount', 'Percentage'].map((value) => ({ value, label: value }))

watch(() => [props.open, props.record, props.kind] as const, async ([open]) => {
  draft.value = props.record ? { ...props.record } : emptyPurchaseSetupRecord(props.kind)
  localError.value = ''
  await nextTick()
  if (open && !dialog.value?.open) dialog.value?.showModal()
  if (!open && dialog.value?.open) dialog.value.close()
}, { immediate: true })

function save() {
  if (props.busy || props.readonly) return
  const name = draft.value.name.trim()
  if (!name) { localError.value = 'Name is required.'; return }
  if (isDiscount() && draft.value.computation === 'Percentage' && draft.value.rate > 100) {
    localError.value = 'Percentage rate cannot exceed 100.'
    return
  }
  emit('save', { ...draft.value, id: draft.value.id || crypto.randomUUID(), name })
}
</script>

<template>
  <dialog ref="dialog" class="purchase-setup-editor" :aria-label="`${draft.id ? 'Edit' : 'New'} ${singular()}`" @close="emit('close')" @cancel="busy && $event.preventDefault()">
    <form @submit.prevent="save">
      <header><div><h2>{{ draft.id ? 'Edit' : 'New' }} {{ singular() }}</h2><p>Maintain the details used in purchase records.</p></div><button type="button" aria-label="Close form" :disabled="busy" @click="dialog?.close()"><X :size="18" /></button></header>
      <fieldset class="purchase-setup-editor__fields" :disabled="busy || readonly" style="border: 0; margin: 0">
        <label>Name <span>*</span><input v-model="draft.name" required maxlength="140" /></label>
        <template v-if="kind === 'vendors'">
          <label>TIN<input v-model="draft.tin" maxlength="40" /></label>
          <label class="purchase-setup-editor__wide">Address<textarea v-model="draft.address" rows="3" maxlength="240" /></label>
        </template>
        <template v-if="isTerms()">
          <label># of Payments<input v-model.number="draft.payments" type="number" min="1" step="1" /></label>
          <label>Payment Frequency<input v-model="draft.frequency" maxlength="60" placeholder="e.g. Months" /></label>
          <label>Due On<input v-model.number="draft.dueOn" type="number" min="0" step="1" /></label>
          <AppSelect v-model="draft.paymentDue" label="Payment Due" :options="dueUnitOptions" />
        </template>
        <template v-if="isDiscount()">
          <AppSelect v-model="draft.computation" label="Computation" :options="computationOptions" />
          <label>Rate<input v-model.number="draft.rate" type="number" min="0" step="0.01" /></label>
          <label class="purchase-setup-editor__check"><input v-model="draft.allowOverride" type="checkbox" /> Allow override</label>
        </template>
        <AppSelect v-if="kind !== 'vendors'" v-model="draft.accountId" label="Account" :options="accountOptions" placeholder="Choose account" />
        <label v-if="kind === 'revolving-fund-customers' || isTerms()" class="purchase-setup-editor__check"><input v-model="draft.active" type="checkbox" /> Active</label>
      </fieldset>
      <p v-if="localError || error" class="purchase-setup-editor__error" role="alert">{{ localError || error }}</p>
      <footer><button v-if="draft.id && canDelete" class="purchase-setup-button purchase-setup-button--danger" type="button" :disabled="busy" @click="emit('delete', draft)"><Trash2 :size="15" /> Delete</button><span /><button class="purchase-setup-button" type="button" :disabled="busy" @click="dialog?.close()">{{ readonly ? 'Close' : 'Cancel' }}</button><button v-if="!readonly" class="purchase-setup-button purchase-setup-button--primary" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save' }}</button></footer>
    </form>
  </dialog>
</template>
