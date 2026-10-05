<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import AppDatePicker from '../../../components/ui/AppDatePicker.vue'
import AppSelect from '../../../components/ui/AppSelect.vue'
import { formatMoney, parseMoneyToCents } from '../../../lib/money'
import { taxFormConfigs, type TaxFormId, type TaxFormRecord, type TaxStatus } from './taxFormData'

const props = defineProps<{ open: boolean; formId: TaxFormId; year: number; record: TaxFormRecord | null; usedPeriods: string[] }>()
const emit = defineEmits<{ close: []; save: [record: TaxFormRecord] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const config = computed(() => taxFormConfigs[props.formId])
const monthOptions = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const quarterOptions = ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter']
const periodOptions = computed(() => config.value.cadence === 'Monthly' ? monthOptions : quarterOptions)
const periodSelectOptions = computed(() => periodOptions.value.map((value) => ({ value, label: value })))
const statusOptions = ['Draft', 'Filed'].map((value) => ({ value, label: value }))
const period = ref('')
const status = ref<TaxStatus>('Draft')
const taxDue = ref('0.00')
const dueDate = ref('')
const entry = ref('')
const amendment = ref(false)
const error = ref('')

watch(() => [props.open, props.record, props.formId, props.year] as const, async ([open]) => {
  period.value = props.record?.period ?? periodOptions.value[0]
  status.value = props.record?.status ?? 'Draft'
  taxDue.value = props.record ? formatMoney(props.record.taxDueCents).replaceAll(',', '') : '0.00'
  dueDate.value = props.record?.dueDate ?? ''
  entry.value = props.record?.entry ?? ''
  amendment.value = props.record?.amendment ?? false
  error.value = ''
  await nextTick()
  if (open && !dialog.value?.open) dialog.value?.showModal()
  if (!open && dialog.value?.open) dialog.value.close()
}, { immediate: true })
watch([period, status, taxDue, dueDate, entry, amendment], () => { error.value = '' })

function save() {
  const taxDueCents = config.value.hasTaxDue ? parseMoneyToCents(taxDue.value) : 0
  if (!period.value) { error.value = `Choose a ${config.value.cadence.toLocaleLowerCase()} period.`; return }
  if (props.usedPeriods.includes(period.value)) { error.value = `${period.value} already has an entry.`; return }
  if (taxDueCents === null) { error.value = 'Enter a valid tax due amount with up to two decimal places.'; return }
  if (!dueDate.value) { error.value = 'Choose a due date.'; return }
  emit('save', {
    id: props.record?.id ?? crypto.randomUUID(), formId: props.formId, year: props.year, status: status.value,
    period: period.value, taxDueCents, dueDate: dueDate.value, entry: entry.value.trim(), amendment: amendment.value,
  })
  emit('close')
}
</script>

<template>
  <dialog ref="dialog" class="tax-entry-editor" :aria-label="`${record ? 'Edit' : 'New'} ${config.title} entry`" @close="emit('close')">
    <form @submit.prevent="save">
      <header><div><h2>{{ record ? 'Edit' : 'New' }} {{ config.title }} entry</h2><p>{{ config.cadence }} return for {{ year }}. Preview data is stored locally.</p></div><button type="button" aria-label="Close form" @click="dialog?.close()"><X :size="18" /></button></header>
      <div class="tax-entry-editor__fields">
        <AppSelect v-model="period" :label="config.cadence === 'Monthly' ? 'Month' : 'Quarter'" required :options="periodSelectOptions" />
        <AppSelect v-model="status" label="Status" required :options="statusOptions" />
        <label v-if="config.hasTaxDue">Tax due <span>*</span><input v-model="taxDue" inputmode="decimal" placeholder="0.00" /></label>
        <AppDatePicker v-model="dueDate" label="Due date" required :invalid="Boolean(error && !dueDate)" />
        <label v-if="config.entryLabel" class="tax-entry-editor__wide">{{ config.entryLabel }}<input v-model="entry" maxlength="120" placeholder="Optional journal reference" /></label>
        <label v-if="config.hasAmendment" class="tax-entry-editor__check"><input v-model="amendment" type="checkbox" /> Amendment</label>
        <p v-if="error" class="tax-entry-editor__error" role="alert">{{ error }}</p>
      </div>
      <footer><button type="button" class="tax-button" @click="dialog?.close()">Cancel</button><button type="submit" class="tax-button tax-button--primary">Save entry</button></footer>
    </form>
  </dialog>
</template>
