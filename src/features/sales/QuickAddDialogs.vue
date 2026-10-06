<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { X } from '@lucide/vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { accounts } from '../accounting/setup/accountSetupData'
import { customerRepository, salesSetupRepository } from '../../services/previewRepositories'
import { recordAudit } from '../company/companyStore'
import { blankCustomer, customers } from './customers/customerPreviewStore'
import { setupRecords, type PeriodUnit, type SetupRecord } from './salesPreviewStore'
import './sales-pages.css'
import { useSubmit } from '../../lib/useSubmit'
import { useAuth } from '../auth/authStore'
import { usePermissions } from '../auth/permissions'

/**
 * The "+" shortcuts next to Customer, Payment Term, and Payment Method on Sales forms.
 * Each adds a minimal record and selects it; full details are edited on the setup pages.
 */
const emit = defineEmits<{ customer: [id: string]; term: [id: string]; method: [id: string] }>()
const mutation = useSubmit()
const { authUser } = useAuth()
const { can } = usePermissions(authUser)

const customerDialog = ref<HTMLDialogElement | null>(null)
const termDialog = ref<HTMLDialogElement | null>(null)
const methodDialog = ref<HTMLDialogElement | null>(null)
const customerInput = ref<HTMLInputElement | null>(null)
const termInput = ref<HTMLInputElement | null>(null)
const methodInput = ref<HTMLInputElement | null>(null)
const newCustomer = ref({ name: '', tin: '', address: '', error: '' })
const newTerm = ref({ name: '', dueOn: 0, unit: 'Days' as PeriodUnit, error: '' })
const newMethod = ref({ name: '', accountId: '', error: '' })
const unitOptions = (['Days', 'Months', 'Years'] as PeriodUnit[]).map((value) => ({ value, label: value }))
const accountOptions = computed(() => accounts.value.filter((account) => account.active)
  .map((account) => ({ value: account.code, label: `${account.code} · ${account.name}` })))

function focusSoon(target: HTMLInputElement | null) { nextTick(() => target?.focus()) }

function openCustomer() {
  if (!can('Sales', 'create') || mutation.pending.value) return
  mutation.reset()
  newCustomer.value = { name: '', tin: '', address: '', error: '' }
  customerDialog.value?.showModal()
  focusSoon(customerInput.value)
}
function openTerm() {
  if (!can('Sales', 'create') || mutation.pending.value) return
  mutation.reset()
  newTerm.value = { name: '', dueOn: 0, unit: 'Days', error: '' }
  termDialog.value?.showModal()
  focusSoon(termInput.value)
}
function openMethod() {
  if (!can('Sales', 'create') || mutation.pending.value) return
  mutation.reset()
  newMethod.value = { name: '', accountId: '', error: '' }
  methodDialog.value?.showModal()
  focusSoon(methodInput.value)
}
defineExpose({ openCustomer, openTerm, openMethod })

async function addCustomer() {
  if (!can('Sales', 'create') || mutation.pending.value) return
  const name = newCustomer.value.name.trim()
  if (!name) { newCustomer.value.error = 'Customer name is required.'; return }
  if (customers.value.some((item) => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) { newCustomer.value.error = 'A customer with this name already exists.'; return }
  if (!/^[\d-]*$/.test(newCustomer.value.tin.trim())) { newCustomer.value.error = 'TIN can contain only digits and dashes.'; return }
  const customer = { id: crypto.randomUUID(), ...blankCustomer(), name, tin: newCustomer.value.tin.trim(), unitBuilding: newCustomer.value.address.trim() }
  let savedId = ''
  if (!await mutation.run(async () => { savedId = (await customerRepository.save(customer)).id })) return
  recordAudit('Sales', 'Created', `Customer: ${name}`, 'Added from a sales form')
  customerDialog.value?.close()
  emit('customer', savedId)
}

async function addTerm() {
  if (!can('Sales', 'create') || mutation.pending.value) return
  const name = newTerm.value.name.trim()
  const dueOn = Number(newTerm.value.dueOn)
  if (!name) { newTerm.value.error = 'Name is required.'; return }
  if (!Number.isInteger(dueOn) || dueOn < 0) { newTerm.value.error = 'Due in must be a whole number, 0 or more.'; return }
  if (setupRecords.value.some((item) => item.kind === 'sales-payment-terms' && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) { newTerm.value.error = 'A payment term with this name already exists.'; return }
  const term: SetupRecord = {
    id: crypto.randomUUID(), kind: 'sales-payment-terms', name, active: true, accountId: '', payments: 1, dueOn, paymentDue: newTerm.value.unit,
    frequencyEvery: 0, frequencyUnit: '', computation: 'Amount', rate: 0, allowOverride: false,
  }
  let savedId = ''
  if (!await mutation.run(async () => { savedId = (await salesSetupRepository.save(term)).id })) return
  recordAudit('Sales', 'Created', `Payment Term: ${name}`, 'Added from a sales form')
  termDialog.value?.close()
  emit('term', savedId)
}

async function addMethod() {
  if (!can('Sales', 'create') || mutation.pending.value) return
  const name = newMethod.value.name.trim()
  if (!name) { newMethod.value.error = 'Name is required.'; return }
  if (setupRecords.value.some((item) => item.kind === 'sales-payment-methods' && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) { newMethod.value.error = 'A payment method with this name already exists.'; return }
  const method: SetupRecord = {
    id: crypto.randomUUID(), kind: 'sales-payment-methods', name, active: true, accountId: newMethod.value.accountId, payments: 1, dueOn: 0,
    paymentDue: 'Days', frequencyEvery: 0, frequencyUnit: '', computation: 'Amount', rate: 0, allowOverride: false,
  }
  let savedId = ''
  if (!await mutation.run(async () => { savedId = (await salesSetupRepository.save(method)).id })) return
  recordAudit('Sales', 'Created', `Payment Method: ${name}`, 'Added from a sales form')
  methodDialog.value?.close()
  emit('method', savedId)
}
</script>

<template>
  <dialog ref="customerDialog" class="sales-dialog" aria-labelledby="quick-customer-title" @cancel.prevent="!mutation.pending.value && customerDialog?.close()">
    <form novalidate @submit.prevent="addCustomer">
      <div class="sales-dialog__header"><h2 id="quick-customer-title">New customer</h2><button type="button" aria-label="Close" :disabled="mutation.pending.value" @click="customerDialog?.close()"><X :size="18" /></button></div>
      <fieldset class="sales-form" :disabled="mutation.pending.value" style="border: 0; margin: 0">
        <label class="sales-form__full">Customer name <span>*</span><input ref="customerInput" v-model="newCustomer.name" maxlength="160" /></label>
        <label>TIN<input v-model="newCustomer.tin" maxlength="20" /></label>
        <label class="sales-form__full">Address<input v-model="newCustomer.address" maxlength="180" placeholder="Unit #, Bldg #, St., Brgy" /></label>
      </fieldset>
      <p v-if="newCustomer.error || mutation.error.value" class="sales-form__error" role="alert">{{ newCustomer.error || mutation.error.value }}</p>
      <div class="sales-dialog__footer"><button class="sales-button" type="button" :disabled="mutation.pending.value" @click="customerDialog?.close()">Cancel</button><button class="sales-button sales-button--primary" type="submit" :disabled="mutation.pending.value">Add customer</button></div>
    </form>
  </dialog>

  <dialog ref="termDialog" class="sales-dialog" aria-labelledby="quick-term-title" @cancel.prevent="!mutation.pending.value && termDialog?.close()">
    <form novalidate @submit.prevent="addTerm">
      <div class="sales-dialog__header"><h2 id="quick-term-title">New payment term</h2><button type="button" aria-label="Close" :disabled="mutation.pending.value" @click="termDialog?.close()"><X :size="18" /></button></div>
      <fieldset class="sales-form" :disabled="mutation.pending.value" style="border: 0; margin: 0">
        <label class="sales-form__full">Name <span>*</span><input ref="termInput" v-model="newTerm.name" maxlength="120" placeholder="e.g. Paid full within 30 days" /></label>
        <label>Payment is due in<input v-model.number="newTerm.dueOn" type="number" min="0" step="1" /></label>
        <div><AppSelect v-model="newTerm.unit" label="Unit" :options="unitOptions" /></div>
      </fieldset>
      <p v-if="newTerm.error || mutation.error.value" class="sales-form__error" role="alert">{{ newTerm.error || mutation.error.value }}</p>
      <div class="sales-dialog__footer"><button class="sales-button" type="button" :disabled="mutation.pending.value" @click="termDialog?.close()">Cancel</button><button class="sales-button sales-button--primary" type="submit" :disabled="mutation.pending.value">Add payment term</button></div>
    </form>
  </dialog>

  <dialog ref="methodDialog" class="sales-dialog" aria-labelledby="quick-method-title" @cancel.prevent="!mutation.pending.value && methodDialog?.close()">
    <form novalidate @submit.prevent="addMethod">
      <div class="sales-dialog__header"><h2 id="quick-method-title">New payment method</h2><button type="button" aria-label="Close" :disabled="mutation.pending.value" @click="methodDialog?.close()"><X :size="18" /></button></div>
      <fieldset class="sales-form" :disabled="mutation.pending.value" style="border: 0; margin: 0">
        <label class="sales-form__full">Name <span>*</span><input ref="methodInput" v-model="newMethod.name" maxlength="120" /></label>
        <div class="sales-form__full"><AppSelect v-model="newMethod.accountId" label="Account" :options="accountOptions" placeholder="Choose account" /></div>
      </fieldset>
      <p v-if="newMethod.error || mutation.error.value" class="sales-form__error" role="alert">{{ newMethod.error || mutation.error.value }}</p>
      <div class="sales-dialog__footer"><button class="sales-button" type="button" :disabled="mutation.pending.value" @click="methodDialog?.close()">Cancel</button><button class="sales-button sales-button--primary" type="submit" :disabled="mutation.pending.value">Add payment method</button></div>
    </form>
  </dialog>
</template>
