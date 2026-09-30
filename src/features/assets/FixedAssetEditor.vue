<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Info, Trash2, X } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import { formatMoney, parseMoneyToCents } from '../../lib/money'
import { emptyFixedAsset, type FixedAssetRecord } from './fixedAssetData'

const props = defineProps<{ open: boolean; record: FixedAssetRecord | null }>()
const emit = defineEmits<{ close: []; save: [record: FixedAssetRecord]; delete: [record: FixedAssetRecord] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const draft = ref(emptyFixedAsset())
const purchasePrice = ref('0.00')
const vat = ref('0.00')
const salvageValue = ref('0.00')
const error = ref('')

watch(() => [props.open, props.record] as const, async ([open]) => {
  draft.value = props.record ? { ...props.record } : emptyFixedAsset()
  purchasePrice.value = props.record ? formatMoney(props.record.purchasePriceCents).replaceAll(',', '') : '0.00'
  vat.value = props.record ? formatMoney(props.record.vatCents).replaceAll(',', '') : '0.00'
  salvageValue.value = props.record ? formatMoney(props.record.salvageValueCents).replaceAll(',', '') : '0.00'
  error.value = ''
  await nextTick()
  if (open && !dialog.value?.open) dialog.value?.showModal()
  if (!open && dialog.value?.open) dialog.value.close()
}, { immediate: true })

function save() {
  const purchasePriceCents = parseMoneyToCents(purchasePrice.value)
  const vatCents = parseMoneyToCents(vat.value)
  const salvageValueCents = parseMoneyToCents(salvageValue.value)
  if (!draft.value.datePurchased) { error.value = 'Choose the purchase date.'; return }
  if (!draft.value.description.trim()) { error.value = 'Enter an asset description.'; return }
  if (!draft.value.vendor.trim()) { error.value = 'Enter the vendor.'; return }
  if (purchasePriceCents === null || purchasePriceCents < 0) { error.value = 'Enter a valid purchase price.'; return }
  if (vatCents === null || vatCents < 0) { error.value = 'Enter a valid VAT amount.'; return }
  if (salvageValueCents === null || salvageValueCents < 0) { error.value = 'Enter a valid salvage value.'; return }
  if (salvageValueCents > purchasePriceCents) { error.value = 'Salvage value cannot exceed the purchase price.'; return }
  if (!Number.isInteger(draft.value.usefulLifeMonths) || draft.value.usefulLifeMonths < 1) { error.value = 'Useful life must be at least one month.'; return }
  if (!Number.isInteger(draft.value.lapsedMonths) || draft.value.lapsedMonths < 0) { error.value = 'Lapsed months must be zero or greater.'; return }
  emit('save', {
    ...draft.value, id: draft.value.id || crypto.randomUUID(), purchasePriceCents, vatCents, salvageValueCents,
    trackingNumber: draft.value.trackingNumber.trim(), description: draft.value.description.trim(), vendor: draft.value.vendor.trim(),
    goods: draft.value.goods.trim(), salesInvoice: draft.value.salesInvoice.trim(), remarks: draft.value.remarks.trim(),
  })
  emit('close')
}
</script>

<template>
  <dialog ref="dialog" class="asset-editor" :aria-label="`${record ? 'Edit' : 'New'} fixed asset`" @close="emit('close')">
    <form @submit.prevent="save">
      <header><div><h2>{{ record ? 'Edit fixed asset' : 'New fixed asset' }}</h2><p>Record purchase details and establish the depreciation schedule.</p></div><button type="button" aria-label="Close form" @click="dialog?.close()"><X :size="18" /></button></header>
      <div class="asset-editor__fields">
        <section><h3>Source</h3><div class="asset-editor__grid"><label class="asset-editor__wide">Sales invoice<input v-model="draft.salesInvoice" maxlength="80" placeholder="Optional invoice number" /></label></div></section>
        <section><h3>Details</h3><div class="asset-editor__grid">
          <label>Asset tracking #<input v-model="draft.trackingNumber" maxlength="80" /></label><AppDatePicker v-model="draft.datePurchased" label="Date purchased" required :invalid="Boolean(error && !draft.datePurchased)" />
          <label class="asset-editor__wide">Description <span>*</span><input v-model="draft.description" maxlength="180" /></label>
          <label>Vendor <span>*</span><input v-model="draft.vendor" maxlength="140" /></label><label>Goods<input v-model="draft.goods" maxlength="140" /></label>
          <label>Purchase price <span>*</span><input v-model="purchasePrice" inputmode="decimal" /></label><label>VAT <span>*</span><input v-model="vat" inputmode="decimal" /></label>
          <label>Useful life (months) <span>*</span><input v-model.number="draft.usefulLifeMonths" type="number" min="1" step="1" /></label><label>Salvage value <span>*</span><input v-model="salvageValue" inputmode="decimal" /></label>
          <AppDatePicker v-model="draft.warrantyExpirationDate" label="Warranty expiration date" /><label class="asset-editor__wide">Remarks<textarea v-model="draft.remarks" rows="3" maxlength="300" /></label>
        </div></section>
        <section><h3>Migration</h3><div class="asset-editor__migration"><Info :size="17" /><p>Use lapsed months only when depreciation was already recorded in a previous accounting system.</p></div><div class="asset-editor__grid"><label>Depreciated / lapsed months <span>*</span><input v-model.number="draft.lapsedMonths" type="number" min="0" step="1" /></label></div></section>
        <p v-if="error" class="asset-editor__error" role="alert">{{ error }}</p>
      </div>
      <footer><button v-if="draft.id" class="asset-button asset-button--danger" type="button" @click="emit('delete', draft)"><Trash2 :size="15" /> Delete</button><span /><button class="asset-button" type="button" @click="dialog?.close()">Cancel</button><button class="asset-button asset-button--primary" type="submit">Save asset</button></footer>
    </form>
  </dialog>
</template>
