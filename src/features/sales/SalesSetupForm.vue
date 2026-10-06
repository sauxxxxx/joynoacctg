<script setup lang="ts">
import { computed, ref } from 'vue'
import { Trash2 } from '@lucide/vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { accountName, accounts } from '../accounting/setup/accountSetupData'
import { recordAudit } from '../company/companyStore'
import { salesSetupRepository } from '../../services/previewRepositories'
import { useSubmit } from '../../lib/useSubmit'
import { useAuth } from '../auth/authStore'
import { usePermissions } from '../auth/permissions'
import SalesEditorShell from './SalesEditorShell.vue'
import { reportDate } from './salesFormat'
import { salesDocuments, setupRecords, type PeriodUnit, type SetupKind, type SetupRecord } from './salesPreviewStore'
import { paymentSchedule } from './salesRules'
import './sales-pages.css'

const props = defineProps<{ kind: SetupKind; record: SetupRecord | null }>()
const emit = defineEmits<{ close: []; saved: [message: string]; deleted: [message: string] }>()

const names: Record<SetupKind, string> = { 'sales-payment-terms': 'Payment Term', 'sales-payment-methods': 'Payment Method', 'sales-discount-types': 'Discount Type' }
const label = names[props.kind]
type Draft = Omit<SetupRecord, 'paymentDue'> & { paymentDue: PeriodUnit | '' }

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
function blank(): Draft {
  return {
    id: '', kind: props.kind, name: '', active: true, accountId: '', payments: 1, dueOn: 1, paymentDue: '',
    frequencyEvery: 0, frequencyUnit: '', computation: 'Amount', rate: 0, allowOverride: false,
  }
}
const draft = ref<Draft>(props.record ? clone(props.record) : blank())
const initial = JSON.stringify(draft.value)
const dirty = computed(() => JSON.stringify(draft.value) !== initial)
const submitted = ref(false)
const deleteDialog = ref<HTMLDialogElement | null>(null)
const saveError = ref('')
const submit = useSubmit()
const { authUser } = useAuth()
const { can } = usePermissions(authUser)
const editable = computed(() => can('Sales', props.record ? 'edit' : 'create'))

const unitOptions = (['Days', 'Months', 'Years'] as PeriodUnit[]).map((value) => ({ value, label: value }))
const computationOptions = [{ value: 'Amount', label: 'Amount' }, { value: 'Percentage', label: 'Percentage' }]
const accountOptions = computed(() => accounts.value.filter((account) => account.active || account.code === draft.value.accountId)
  .map((account) => ({ value: account.code, label: `${account.code} · ${account.name}` })))
const isTerm = props.kind === 'sales-payment-terms'
const isDiscount = props.kind === 'sales-discount-types'
const multiple = computed(() => Number(draft.value.payments) > 1)

const errors = computed(() => {
  const value = draft.value
  const found: Record<string, string> = {}
  const name = value.name.trim()
  if (!name) found.name = 'Cannot be blank'
  else if (setupRecords.value.some((item) => item.kind === props.kind && item.id !== value.id && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) found.name = `This ${label.toLocaleLowerCase()} name is already in use`
  if (isTerm) {
    if (!Number.isInteger(Number(value.payments)) || value.payments < 1 || value.payments > 120) found.payments = 'Enter a whole number from 1 to 120'
    if (!Number.isInteger(Number(value.dueOn)) || value.dueOn < 0) found.dueOn = 'Enter a whole number, 0 or more'
    if (!value.paymentDue) found.paymentDue = 'Choose a unit'
    if (multiple.value) {
      if (!Number.isInteger(Number(value.frequencyEvery)) || value.frequencyEvery < 1) found.frequencyEvery = 'Enter a whole number, 1 or more'
      if (!value.frequencyUnit) found.frequencyUnit = 'Choose a unit'
    }
  }
  if (isDiscount) {
    if (!Number.isFinite(Number(value.rate)) || value.rate < 0) found.rate = 'Rate cannot be negative'
    else if (value.computation === 'Percentage' && value.rate > 100) found.rate = 'A percentage cannot exceed 100'
  }
  return found
})
const shown = (key: string) => submitted.value ? errors.value[key] : ''

// Illustration only: what the term would look like for an invoice dated today.
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
const schedule = computed(() => {
  const value = draft.value
  if (!isTerm || !value.paymentDue || errors.value.payments || errors.value.dueOn || (multiple.value && (errors.value.frequencyEvery || errors.value.frequencyUnit))) return []
  return paymentSchedule({ ...value, paymentDue: value.paymentDue }, today)
})

async function save() {
  if (!editable.value || submit.pending.value) return
  submitted.value = true
  const first = Object.values(errors.value)[0]
  saveError.value = first ? `Please fix the highlighted fields.` : ''
  if (first) return
  const value = draft.value
  const isNew = !value.id
  const record: SetupRecord = {
    ...clone(value),
    id: value.id || crypto.randomUUID(),
    name: value.name.trim(),
    accountId: value.accountId,
    paymentDue: (value.paymentDue || 'Days') as PeriodUnit,
    payments: isTerm ? Math.trunc(Number(value.payments)) : 1,
    // A single payment has no succeeding payments.
    frequencyEvery: isTerm && multiple.value ? Math.trunc(Number(value.frequencyEvery)) : 0,
    frequencyUnit: isTerm && multiple.value ? value.frequencyUnit : '',
  }
  if (!await submit.run(() => salesSetupRepository.save(record))) return
  recordAudit('Sales', isNew ? 'Created' : 'Updated', `${label}: ${record.name}`)
  emit('saved', `${record.name} ${isNew ? 'added' : 'updated'}.`)
}

function askDelete() {
  if (!can('Sales', 'delete') || submit.pending.value) return
  const id = draft.value.id
  const used = salesDocuments.value.some((doc) => doc.paymentTermId === id || doc.paymentMethodId === id || doc.discountTypeId === id)
  if (used) {
    saveError.value = `${draft.value.name} is used by a sales document. Clear "active" instead of deleting it.`
    return
  }
  deleteDialog.value?.showModal()
}

async function remove() {
  if (!can('Sales', 'delete') || submit.pending.value) return
  const name = draft.value.name
  if (!await submit.run(() => salesSetupRepository.remove(draft.value.id, draft.value.version))) {
    deleteDialog.value?.close()
    return
  }
  recordAudit('Sales', 'Deleted', `${label}: ${name}`)
  deleteDialog.value?.close()
  emit('deleted', `${name} deleted.`)
}
</script>

<template>
  <SalesEditorShell :title="record ? label : `New ${label}`" :subtitle="record?.name" :dirty="dirty" :error="saveError || submit.error.value" :busy="submit.pending.value" :readonly="!editable" @save="save" @close="emit('close')">
    <div class="sales-card">
      <h3 class="sales-card__title">Details</h3>
      <div class="sales-form sales-card__form">
        <label :class="{ 'sales-form__full': !isTerm && !isDiscount }">Name <span>*</span>
          <input v-model="draft.name" maxlength="120" :aria-invalid="Boolean(shown('name'))" />
          <small v-if="shown('name')" class="sales-field-error">{{ shown('name') }}</small>
        </label>
        <label v-if="isTerm">Number of Payment(s) <span>*</span>
          <input v-model.number="draft.payments" type="number" min="1" step="1" :aria-invalid="Boolean(shown('payments'))" />
          <small v-if="shown('payments')" class="sales-field-error">{{ shown('payments') }}</small>
        </label>
        <template v-if="isDiscount">
          <div class="sales-field"><AppSelect id="discount-computation" v-model="draft.computation" label="Discount Computation Type" required :options="computationOptions" /></div>
          <label>{{ draft.computation === 'Percentage' ? 'Rate (%)' : 'Rate' }}
            <input v-model.number="draft.rate" type="number" min="0" step="0.01" :aria-invalid="Boolean(shown('rate'))" />
            <small v-if="shown('rate')" class="sales-field-error">{{ shown('rate') }}</small>
          </label>
          <label class="sales-checkbox"><input v-model="draft.allowOverride" type="checkbox" /> Allow override <small class="sales-field-hint">Lets whoever prepares an invoice change the rate.</small></label>
        </template>
      </div>
    </div>

    <div v-if="isTerm" class="sales-card">
      <h3 class="sales-card__title">Schedule</h3>
      <div class="sales-card__row">
        <span>{{ multiple ? 'First payment is due in' : 'Payment is due in' }}</span>
        <label class="sales-field-inline"><span class="sales-visually-hidden">Number of units until the first payment</span><input v-model.number="draft.dueOn" type="number" min="0" step="1" :aria-invalid="Boolean(shown('dueOn'))" /><small v-if="shown('dueOn')" class="sales-field-error">{{ shown('dueOn') }}</small></label>
        <div class="sales-field-inline"><AppSelect id="term-due-unit" v-model="draft.paymentDue" label="Unit" required :options="unitOptions" :invalid="Boolean(shown('paymentDue'))" /><small v-if="shown('paymentDue')" class="sales-field-error">{{ shown('paymentDue') }}</small></div>
      </div>
      <div v-if="multiple" class="sales-card__row">
        <span>Succeeding payments every</span>
        <label class="sales-field-inline"><span class="sales-visually-hidden">Number of units between payments</span><input v-model.number="draft.frequencyEvery" type="number" min="0" step="1" :aria-invalid="Boolean(shown('frequencyEvery'))" /><small v-if="shown('frequencyEvery')" class="sales-field-error">{{ shown('frequencyEvery') }}</small></label>
        <div class="sales-field-inline"><AppSelect id="term-frequency-unit" v-model="draft.frequencyUnit" label="Unit" required :options="unitOptions" :invalid="Boolean(shown('frequencyUnit'))" /><small v-if="shown('frequencyUnit')" class="sales-field-error">{{ shown('frequencyUnit') }}</small></div>
      </div>
    </div>

    <div class="sales-card">
      <h3 class="sales-card__title">Accounting</h3>
      <p class="sales-card__note">Choose the account to associate with this {{ label.toLocaleLowerCase() }}.</p>
      <div class="sales-form sales-card__form">
        <div class="sales-card__narrow"><AppSelect v-model="draft.accountId" label="Account" :options="accountOptions" placeholder="Choose account" /><small class="sales-field-hint">{{ draft.accountId ? accountName(draft.accountId) : 'Choose from the Chart of Accounts.' }}</small></div>
      </div>
      <label class="ws-check sales-card__check"><input v-model="draft.active" type="checkbox" /> This {{ label.toLocaleLowerCase() }} is active</label>
    </div>

    <div v-if="isTerm" class="sales-card">
      <h3 class="sales-card__title">Example Payment/Collection Schedule</h3>
      <p v-if="!schedule.length" class="sales-card__note">Select the due period and unit to see an example schedule.</p>
      <template v-else>
        <p class="sales-card__note">For an invoice dated {{ reportDate(today) }}:</p>
        <table class="sales-table sales-schedule">
          <thead><tr><th scope="col">Payment</th><th scope="col">Due date</th></tr></thead>
          <tbody><tr v-for="item in schedule" :key="item.number"><td>{{ item.number }}</td><td>{{ reportDate(item.dueDate) }}</td></tr></tbody>
        </table>
      </template>
    </div>

    <template #extra-actions>
      <button v-if="record && can('Sales', 'delete')" class="sales-button sales-button--ghost-danger" type="button" :disabled="submit.pending.value" @click="askDelete"><Trash2 :size="15" aria-hidden="true" /> Delete</button>
    </template>
  </SalesEditorShell>

  <dialog ref="deleteDialog" class="sales-dialog sales-dialog--small" aria-label="Confirm deletion" @cancel="submit.pending.value && $event.preventDefault()">
    <div class="sales-dialog__header"><h2>Delete {{ label.toLocaleLowerCase() }}?</h2></div>
    <p class="sales-dialog__body">Remove <strong>{{ draft.name }}</strong>? This cannot be undone.</p>
    <div class="sales-dialog__footer"><button class="sales-button" type="button" :disabled="submit.pending.value" @click="deleteDialog?.close()">Cancel</button><button class="sales-button sales-button--danger" type="button" :disabled="submit.pending.value" @click="remove">{{ submit.pending.value ? 'Deleting…' : 'Delete' }}</button></div>
  </dialog>
</template>
