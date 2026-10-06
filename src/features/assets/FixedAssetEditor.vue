<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Info, Trash2, X } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import AppSelect, { type SelectOption } from '../../components/ui/AppSelect.vue'
import { formatMoney, parseMoneyToCents } from '../../lib/money'
import { emptyFixedAsset, type FixedAssetRecord } from './fixedAssetData'
import { purchaseSetupRecords } from '../purchases/setup/purchaseSetupData'
import { goods } from '../company/companyStore'

const props = defineProps<{ open: boolean; record: FixedAssetRecord | null; busy?: boolean; error?: string; readonly?: boolean; canDelete?: boolean; vendorOptions?: SelectOption[]; itemOptions?: SelectOption[] }>()
const emit = defineEmits<{ close: []; save: [record: FixedAssetRecord]; delete: [record: FixedAssetRecord] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const draft = ref(emptyFixedAsset())
const purchasePrice = ref('0.00')
const vat = ref('0.00')
const salvageValue = ref('0.00')
const localError = ref('')
const combinedError = computed(() => localError.value || props.error)
const resolvedVendors = computed<SelectOption[]>(() => props.vendorOptions ?? purchaseSetupRecords.value
  .filter((record) => record.kind === 'vendors' && record.active)
  .map((record) => ({ value: record.id, label: record.name })))
const resolvedItems = computed<SelectOption[]>(() => props.itemOptions ?? goods.value
  .filter((item) => item.active || item.id === draft.value.itemId)
  .map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` })))

watch(() => [props.open, props.record] as const, async ([open]) => {
  draft.value = props.record ? { ...props.record } : emptyFixedAsset()
  purchasePrice.value = props.record ? formatMoney(props.record.purchasePriceCents).replaceAll(',', '') : '0.00'
  vat.value = props.record ? formatMoney(props.record.vatCents).replaceAll(',', '') : '0.00'
  salvageValue.value = props.record ? formatMoney(props.record.salvageValueCents).replaceAll(',', '') : '0.00'
  localError.value = ''
  await nextTick()
  if (open && !dialog.value?.open) dialog.value?.showModal()
  if (!open && dialog.value?.open) dialog.value.close()
}, { immediate: true })

function save() {
  if (props.busy || props.readonly) return
  const purchasePriceCents = parseMoneyToCents(purchasePrice.value)
  const vatCents = parseMoneyToCents(vat.value)
  const salvageValueCents = parseMoneyToCents(salvageValue.value)
  if (!draft.value.datePurchased) { localError.value = 'Choose the purchase date.'; return }
  if (!draft.value.description.trim()) { localError.value = 'Enter an asset description.'; return }
  if (!draft.value.vendorId) { localError.value = 'Choose the vendor.'; return }
  if (purchasePriceCents === null || purchasePriceCents < 0) { localError.value = 'Enter a valid purchase price.'; return }
  if (vatCents === null || vatCents < 0) { localError.value = 'Enter a valid VAT amount.'; return }
  if (salvageValueCents === null || salvageValueCents < 0) { localError.value = 'Enter a valid salvage value.'; return }
  if (salvageValueCents > purchasePriceCents) { localError.value = 'Salvage value cannot exceed the purchase price.'; return }
  if (!Number.isInteger(draft.value.usefulLifeMonths) || draft.value.usefulLifeMonths < 1) { localError.value = 'Useful life must be at least one month.'; return }
  if (!Number.isInteger(draft.value.lapsedMonths) || draft.value.lapsedMonths < 0) { localError.value = 'Lapsed months must be zero or greater.'; return }
  emit('save', {
    ...draft.value, id: draft.value.id || crypto.randomUUID(), purchasePriceCents, vatCents, salvageValueCents,
    trackingNumber: draft.value.trackingNumber.trim(), description: draft.value.description.trim(),
    itemId: draft.value.itemId, salesInvoice: draft.value.salesInvoice.trim(), remarks: draft.value.remarks.trim(),
  })
}
</script>

<template>
  <dialog ref="dialog" class="asset-editor" :aria-label="`${record ? 'Edit' : 'New'} fixed asset`" @close="emit('close')" @cancel="busy && $event.preventDefault()">
    <form @submit.prevent="save">
      <header><div><h2>{{ record ? 'Fixed asset' : 'New fixed asset' }}</h2><p>Record purchase details and the depreciation already recorded.</p></div><button type="button" aria-label="Close form" :disabled="busy" @click="dialog?.close()"><X :size="18" /></button></header>
      <fieldset class="asset-editor__fields" :disabled="busy || readonly" style="border: 0; margin: 0">
        <section><h3>Source</h3><div class="asset-editor__grid"><label class="asset-editor__wide">Sales invoice<input v-model="draft.salesInvoice" maxlength="80" placeholder="Optional invoice number" /></label></div></section>
        <section><h3>Details</h3><div class="asset-editor__grid">
          <label>Asset tracking #<input v-model="draft.trackingNumber" maxlength="80" /></label><AppDatePicker v-model="draft.datePurchased" label="Date purchased" required :invalid="Boolean(combinedError && !draft.datePurchased)" />
          <label class="asset-editor__wide">Description <span>*</span><input v-model="draft.description" maxlength="180" /></label>
          <AppSelect id="fixed-asset-vendor" v-model="draft.vendorId" label="Vendor" required placeholder="Choose vendor" :options="resolvedVendors" :invalid="Boolean(combinedError && !draft.vendorId)" /><AppSelect id="fixed-asset-item" v-model="draft.itemId" label="Goods" placeholder="Choose goods" :options="resolvedItems" />
          <label>Purchase price <span>*</span><input v-model="purchasePrice" inputmode="decimal" /></label><label>VAT <span>*</span><input v-model="vat" inputmode="decimal" /></label>
          <label>Useful life (months) <span>*</span><input v-model.number="draft.usefulLifeMonths" type="number" min="1" step="1" /></label><label>Salvage value <span>*</span><input v-model="salvageValue" inputmode="decimal" /></label>
          <AppDatePicker v-model="draft.warrantyExpirationDate" label="Warranty expiration date" /><label class="asset-editor__wide">Remarks<textarea v-model="draft.remarks" rows="3" maxlength="300" /></label>
        </div></section>
        <section><h3>Recorded depreciation</h3><div class="asset-editor__migration"><Info :size="17" /><p>Enter the number of months for which depreciation has already been recorded. Saving this register does not post a journal.</p></div><div class="asset-editor__grid"><label>Depreciated / lapsed months <span>*</span><input v-model.number="draft.lapsedMonths" type="number" min="0" step="1" /></label></div></section>
        <p v-if="combinedError" class="asset-editor__error" role="alert">{{ combinedError }}</p>
      </fieldset>
      <footer><button v-if="draft.id && canDelete" class="asset-button asset-button--danger" type="button" :disabled="busy" @click="emit('delete', draft)"><Trash2 :size="15" /> Delete</button><span /><button class="asset-button" type="button" :disabled="busy" @click="dialog?.close()">{{ readonly ? 'Close' : 'Cancel' }}</button><button v-if="!readonly" class="asset-button asset-button--primary" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save asset' }}</button></footer>
    </form>
  </dialog>
</template>
