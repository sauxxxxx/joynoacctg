<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import AppDatePicker from '../../../components/ui/AppDatePicker.vue'
import AppSelect from '../../../components/ui/AppSelect.vue'
import { formatMoney, parseMoneyToCents } from '../../../lib/money'
import { yearlyTaxConfigs, type YearlyTaxFormId, type YearlyTaxRecord } from './yearlyTaxData'

const props = defineProps<{ open: boolean; formId: YearlyTaxFormId; record: YearlyTaxRecord | null; usedYears: number[] }>()
const emit = defineEmits<{ close: []; save: [record: YearlyTaxRecord] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const config = computed(() => yearlyTaxConfigs[props.formId])
const year = ref(2026)
const status = ref<'Draft' | 'Filed'>('Draft')
const amount = ref('0.00')
const deadline = ref('')
const entry = ref('')
const error = ref('')
const statusOptions = ['Draft', 'Filed'].map((value) => ({ value, label: value }))

watch(() => [props.open, props.record, props.formId] as const, async ([open]) => {
  year.value = props.record?.year ?? 2026
  status.value = props.record?.status ?? 'Draft'
  amount.value = props.record ? formatMoney(props.record.amountCents).replaceAll(',', '') : '0.00'
  deadline.value = props.record?.deadline ?? ''
  entry.value = props.record?.entry ?? ''
  error.value = ''
  await nextTick()
  if (open && !dialog.value?.open) dialog.value?.showModal()
  if (!open && dialog.value?.open) dialog.value.close()
}, { immediate: true })
watch([year, status, amount, deadline, entry], () => { error.value = '' })

function save() {
  const amountCents = config.value.amountLabel ? parseMoneyToCents(amount.value) : 0
  if (!Number.isInteger(Number(year.value)) || year.value < 2000 || year.value > 2100) { error.value = 'Enter a year from 2000 to 2100.'; return }
  if (props.usedYears.includes(Number(year.value))) { error.value = `${year.value} already has an entry.`; return }
  if (amountCents === null) { error.value = `Enter a valid ${config.value.amountLabel.toLocaleLowerCase()} amount.`; return }
  if (!deadline.value) { error.value = 'Choose a filing deadline.'; return }
  emit('save', {
    id: props.record?.id ?? crypto.randomUUID(), formId: props.formId, year: Number(year.value), status: status.value,
    amountCents, deadline: deadline.value, entry: entry.value.trim(),
  })
  emit('close')
}
</script>

<template>
  <dialog ref="dialog" class="tax-entry-editor" :aria-label="`${record ? 'Edit' : 'New'} ${config.title} entry`" @close="emit('close')">
    <form @submit.prevent="save">
      <header><div><h2>{{ record ? 'Edit' : 'New' }} {{ config.title }} entry</h2><p>Annual tax-return preview. Changes are stored locally.</p></div><button type="button" aria-label="Close form" @click="dialog?.close()"><X :size="18" /></button></header>
      <div class="tax-entry-editor__fields">
        <label>Year <span>*</span><input v-model.number="year" type="number" min="2000" max="2100" /></label>
        <AppSelect v-model="status" label="Status" required :options="statusOptions" />
        <label v-if="config.amountLabel">{{ config.amountLabel }} <span>*</span><input v-model="amount" inputmode="decimal" placeholder="0.00" /></label>
        <AppDatePicker v-model="deadline" label="Deadline" required :invalid="Boolean(error && !deadline)" />
        <label v-if="config.entryLabel" class="tax-entry-editor__wide">{{ config.entryLabel }}<input v-model="entry" maxlength="120" placeholder="Optional journal reference" /></label>
        <p v-if="error" class="tax-entry-editor__error" role="alert">{{ error }}</p>
      </div>
      <footer><button type="button" class="tax-button" @click="dialog?.close()">Cancel</button><button type="submit" class="tax-button tax-button--primary">Save entry</button></footer>
    </form>
  </dialog>
</template>

