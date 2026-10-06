<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import AppDatePicker from '../../../components/ui/AppDatePicker.vue'
import AppSelect from '../../../components/ui/AppSelect.vue'
import { formatMoney, parseMoneyToCents } from '../../../lib/money'
import type { TaxCertificateId, TaxCertificateRecord } from './taxCertificateData'

const props = defineProps<{ open: boolean; busy?: boolean; serverError?: string; record?: TaxCertificateRecord | null; formId: TaxCertificateId }>()
const emit = defineEmits<{ close: []; save: [record: TaxCertificateRecord] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const source = ref('Purchase receipts')
const party = ref('')
const amount = ref('0.00')
const date = ref('')
const fromDate = ref('')
const toDate = ref('')
const tin = ref('')
const signedFile = ref('')
const error = ref('')
const sourceOptions = ['Purchase receipts', 'Purchase invoices', 'Sales receipts', 'Other'].map((value) => ({ value, label: value }))

watch(() => props.open, async (open) => {
  if (open) {
    source.value = props.record?.source ?? 'Purchase receipts'; party.value = props.record?.party ?? ''
    amount.value = props.record ? formatMoney(props.record.amountCents).replaceAll(',', '') : '0.00'
    date.value = props.record?.date ?? ''; fromDate.value = props.record?.fromDate ?? ''; toDate.value = props.record?.toDate ?? ''
    tin.value = props.record?.tin ?? ''; signedFile.value = props.record?.signedFile ?? ''; error.value = ''
  }
  await nextTick()
  if (open && !dialog.value?.open) dialog.value?.showModal()
  if (!open && dialog.value?.open) dialog.value.close()
}, { immediate: true })
watch([source, party, amount, date, fromDate, toDate, tin, signedFile], () => { error.value = '' })

function save() {
  if (props.busy) return
  const amountCents = parseMoneyToCents(amount.value)
  if (!party.value.trim()) { error.value = 'Enter a vendor or customer.'; return }
  if (amountCents === null) { error.value = 'Enter a valid amount with up to two decimal places.'; return }
  if (!date.value) { error.value = 'Choose the certificate date.'; return }
  if (fromDate.value && toDate.value && fromDate.value > toDate.value) { error.value = 'The end date must be on or after the start date.'; return }
  emit('save', {
    id: props.record?.id ?? crypto.randomUUID(), version: props.record?.version, formId: props.formId, source: source.value, party: party.value.trim(), status: props.record?.status ?? 'Draft',
    amountCents, date: date.value, fromDate: fromDate.value, toDate: toDate.value, signedFile: signedFile.value.trim(), tin: tin.value.trim(),
  })
}
</script>

<template>
  <dialog ref="dialog" class="tax-entry-editor" :aria-label="`${record ? 'Edit' : 'Create'} ${formId.replace('form-', '')} tax certificate manually`" @cancel="busy && $event.preventDefault()" @close="emit('close')">
    <form @submit.prevent="save">
      <header><div><h2>{{ record ? 'Edit' : 'Create' }} {{ formId.replace('form-', '') }} manually</h2><p>Track the certificate details and its receipt or delivery status.</p></div><button type="button" :disabled="busy" aria-label="Close form" @click="dialog?.close()"><X :size="18" /></button></header>
      <fieldset class="tax-entry-editor__fields" :disabled="busy">
        <AppSelect v-model="source" label="Source" required :options="sourceOptions" />
        <label>Vendor/Customer <span>*</span><input v-model="party" maxlength="140" /></label>
        <label>Amount <span>*</span><input v-model="amount" inputmode="decimal" placeholder="0.00" /></label>
        <AppDatePicker v-model="date" label="Date" required :invalid="Boolean(error && !date)" />
        <AppDatePicker v-model="fromDate" label="From" /><AppDatePicker v-model="toDate" label="To" />
        <label>TIN<input v-model="tin" maxlength="40" /></label><label>Signed file reference<input v-model="signedFile" maxlength="120" placeholder="Optional filename or document reference" /></label>
        <p v-if="error || serverError" class="tax-entry-editor__error" role="alert">{{ error || serverError }}</p>
      </fieldset>
      <footer><button type="button" class="tax-button" :disabled="busy" @click="dialog?.close()">Cancel</button><button type="submit" class="tax-button tax-button--primary" :disabled="busy">{{ busy ? 'Saving…' : 'Save certificate' }}</button></footer>
    </form>
  </dialog>
</template>

