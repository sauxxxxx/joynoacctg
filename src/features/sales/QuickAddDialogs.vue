<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { X } from '@lucide/vue'
import { recordAudit } from '../company/companyStore'
import { blankCustomer, customers } from './customers/customerPreviewStore'
import { setupRecords, type PeriodUnit, type SetupRecord } from './salesPreviewStore'
import './sales-pages.css'

/**
 * The "+" shortcuts next to Customer, Payment Term, and Payment Method on Sales forms.
 * Each adds a minimal record and selects it; full details are edited on the setup pages.
 */
const emit = defineEmits<{ customer: [id: string]; term: [id: string]; method: [id: string] }>()

const customerDialog = ref<HTMLDialogElement | null>(null)
const termDialog = ref<HTMLDialogElement | null>(null)
const methodDialog = ref<HTMLDialogElement | null>(null)
const customerInput = ref<HTMLInputElement | null>(null)
const termInput = ref<HTMLInputElement | null>(null)
const methodInput = ref<HTMLInputElement | null>(null)
const newCustomer = ref({ name: '', tin: '', address: '', error: '' })
const newTerm = ref({ name: '', dueOn: 0, unit: 'Days' as PeriodUnit, error: '' })
const newMethod = ref({ name: '', account: '', error: '' })

function focusSoon(target: HTMLInputElement | null) { nextTick(() => target?.focus()) }

function openCustomer() {
  newCustomer.value = { name: '', tin: '', address: '', error: '' }
  customerDialog.value?.showModal()
  focusSoon(customerInput.value)
}
function openTerm() {
  newTerm.value = { name: '', dueOn: 0, unit: 'Days', error: '' }
  termDialog.value?.showModal()
  focusSoon(termInput.value)
}
function openMethod() {
  newMethod.value = { name: '', account: '', error: '' }
  methodDialog.value?.showModal()
  focusSoon(methodInput.value)
}
defineExpose({ openCustomer, openTerm, openMethod })

function addCustomer() {
  const name = newCustomer.value.name.trim()
  if (!name) { newCustomer.value.error = 'Customer name is required.'; return }
  if (customers.value.some((item) => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) { newCustomer.value.error = 'A customer with this name already exists.'; return }
  if (!/^[\d-]*$/.test(newCustomer.value.tin.trim())) { newCustomer.value.error = 'TIN can contain only digits and dashes.'; return }
  const customer = { id: crypto.randomUUID(), ...blankCustomer(), name, tin: newCustomer.value.tin.trim(), unitBuilding: newCustomer.value.address.trim() }
  customers.value = [...customers.value, customer]
  recordAudit('Sales', 'Created', `Customer: ${name}`, 'Added from a sales form')
  customerDialog.value?.close()
  emit('customer', customer.id)
}

function addTerm() {
  const name = newTerm.value.name.trim()
  const dueOn = Number(newTerm.value.dueOn)
  if (!name) { newTerm.value.error = 'Name is required.'; return }
  if (!Number.isInteger(dueOn) || dueOn < 0) { newTerm.value.error = 'Due in must be a whole number, 0 or more.'; return }
  if (setupRecords.value.some((item) => item.kind === 'sales-payment-terms' && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) { newTerm.value.error = 'A payment term with this name already exists.'; return }
  const term: SetupRecord = {
    id: crypto.randomUUID(), kind: 'sales-payment-terms', name, active: true, account: '', payments: 1, dueOn, paymentDue: newTerm.value.unit,
    frequencyEvery: 0, frequencyUnit: '', computation: 'Amount', rate: 0, allowOverride: false,
  }
  setupRecords.value = [...setupRecords.value, term]
  recordAudit('Sales', 'Created', `Payment Term: ${name}`, 'Added from a sales form')
  termDialog.value?.close()
  emit('term', term.id)
}

function addMethod() {
  const name = newMethod.value.name.trim()
  if (!name) { newMethod.value.error = 'Name is required.'; return }
  if (setupRecords.value.some((item) => item.kind === 'sales-payment-methods' && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) { newMethod.value.error = 'A payment method with this name already exists.'; return }
  const method: SetupRecord = {
    id: crypto.randomUUID(), kind: 'sales-payment-methods', name, active: true, account: newMethod.value.account.trim(), payments: 1, dueOn: 0,
    paymentDue: 'Days', frequencyEvery: 0, frequencyUnit: '', computation: 'Amount', rate: 0, allowOverride: false,
  }
  setupRecords.value = [...setupRecords.value, method]
  recordAudit('Sales', 'Created', `Payment Method: ${name}`, 'Added from a sales form')
  methodDialog.value?.close()
  emit('method', method.id)
}
</script>

<template>
  <dialog ref="customerDialog" class="sales-dialog" aria-labelledby="quick-customer-title">
    <form novalidate @submit.prevent="addCustomer">
      <div class="sales-dialog__header"><h2 id="quick-customer-title">New customer</h2><button type="button" aria-label="Close" @click="customerDialog?.close()"><X :size="18" /></button></div>
      <div class="sales-form">
        <label class="sales-form__full">Customer name <span>*</span><input ref="customerInput" v-model="newCustomer.name" maxlength="160" /></label>
        <label>TIN<input v-model="newCustomer.tin" maxlength="20" /></label>
        <label class="sales-form__full">Address<input v-model="newCustomer.address" maxlength="180" placeholder="Unit #, Bldg #, St., Brgy" /></label>
      </div>
      <p v-if="newCustomer.error" class="sales-form__error" role="alert">{{ newCustomer.error }}</p>
      <div class="sales-dialog__footer"><button class="sales-button" type="button" @click="customerDialog?.close()">Cancel</button><button class="sales-button sales-button--primary" type="submit">Add customer</button></div>
    </form>
  </dialog>

  <dialog ref="termDialog" class="sales-dialog" aria-labelledby="quick-term-title">
    <form novalidate @submit.prevent="addTerm">
      <div class="sales-dialog__header"><h2 id="quick-term-title">New payment term</h2><button type="button" aria-label="Close" @click="termDialog?.close()"><X :size="18" /></button></div>
      <div class="sales-form">
        <label class="sales-form__full">Name <span>*</span><input ref="termInput" v-model="newTerm.name" maxlength="120" placeholder="e.g. Paid full within 30 days" /></label>
        <label>Payment is due in<input v-model.number="newTerm.dueOn" type="number" min="0" step="1" /></label>
        <label>Unit<select v-model="newTerm.unit"><option>Days</option><option>Months</option><option>Years</option></select></label>
      </div>
      <p v-if="newTerm.error" class="sales-form__error" role="alert">{{ newTerm.error }}</p>
      <div class="sales-dialog__footer"><button class="sales-button" type="button" @click="termDialog?.close()">Cancel</button><button class="sales-button sales-button--primary" type="submit">Add payment term</button></div>
    </form>
  </dialog>

  <dialog ref="methodDialog" class="sales-dialog" aria-labelledby="quick-method-title">
    <form novalidate @submit.prevent="addMethod">
      <div class="sales-dialog__header"><h2 id="quick-method-title">New payment method</h2><button type="button" aria-label="Close" @click="methodDialog?.close()"><X :size="18" /></button></div>
      <div class="sales-form">
        <label class="sales-form__full">Name <span>*</span><input ref="methodInput" v-model="newMethod.name" maxlength="120" /></label>
        <label class="sales-form__full">Account<input v-model="newMethod.account" maxlength="120" placeholder="e.g. Cash" /></label>
      </div>
      <p v-if="newMethod.error" class="sales-form__error" role="alert">{{ newMethod.error }}</p>
      <div class="sales-dialog__footer"><button class="sales-button" type="button" @click="methodDialog?.close()">Cancel</button><button class="sales-button sales-button--primary" type="submit">Add payment method</button></div>
    </form>
  </dialog>
</template>
