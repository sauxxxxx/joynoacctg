<script setup lang="ts">
import { computed, ref } from 'vue'
import { Trash2 } from '@lucide/vue'
import AppSelect from '../../../components/ui/AppSelect.vue'
import { recordAudit } from '../../company/companyStore'
import { customerRepository } from '../../../services/previewRepositories'
import SalesEditorShell from '../SalesEditorShell.vue'
import { salesDocuments } from '../salesPreviewStore'
import { blankCustomer, customers, type Customer, type CustomerType } from './customerPreviewStore'
import '../sales-pages.css'

const props = defineProps<{ customer: Customer | null }>()
const emit = defineEmits<{ close: []; saved: [message: string]; deleted: [message: string] }>()

type Draft = Omit<Customer, 'id'> & { id: string }
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const draft = ref<Draft>(props.customer ? clone(props.customer) : { id: '', ...blankCustomer() })
const initial = JSON.stringify(draft.value)
const dirty = computed(() => JSON.stringify(draft.value) !== initial)
const submitted = ref(false)
const saveError = ref('')
const deleteDialog = ref<HTMLDialogElement | null>(null)

// Assumption pending confirmation: the legacy Customer Type list has Company and Individual.
const typeOptions: { value: CustomerType; label: string }[] = [{ value: 'Company', label: 'Company' }, { value: 'Individual', label: 'Individual' }]
const isCompany = computed(() => draft.value.customerType === 'Company')

const errors = computed(() => {
  const value = draft.value
  const found: Record<string, string> = {}
  const name = value.name.trim()
  if (!name) found.name = 'Cannot be blank'
  else if (customers.value.some((item) => item.id !== value.id && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) found.name = 'A customer with this name already exists'
  if (!/^[\d-]*$/.test(value.tin.trim())) found.tin = 'TIN can contain only digits and dashes'
  if (value.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) found.email = 'Enter a valid e-mail address'
  if (!/^\d*$/.test(value.zipCode.trim())) found.zipCode = 'Zip code can contain only digits'
  return found
})
const shown = (key: string) => submitted.value ? errors.value[key] : ''

async function save() {
  submitted.value = true
  const first = Object.values(errors.value)[0]
  saveError.value = first ? `Please fix the highlighted fields.` : ''
  if (first) return
  const value = draft.value
  const isNew = !value.id
  const trimmed = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === 'string' ? item.trim() : item])) as Draft
  const saved: Customer = { ...trimmed, id: value.id || crypto.randomUUID(), tradeName: isCompany.value ? trimmed.tradeName : '' }
  // Only one customer can be the default.
  const others = customers.value.filter((item) => item.id !== saved.id).map((item) => saved.isDefault ? { ...item, isDefault: false } : item)
  if (saved.isDefault) await Promise.all(others.filter((item) => item.isDefault).map((item) => customerRepository.save({ ...item, isDefault: false })))
  await customerRepository.save(saved)
  recordAudit('Sales', isNew ? 'Created' : 'Updated', `Customer: ${saved.name}`)
  emit('saved', `${saved.name} ${isNew ? 'added' : 'updated'}.`)
}

function askDelete() {
  if (salesDocuments.value.some((doc) => doc.customerId === draft.value.id)) {
    saveError.value = 'This customer is used by a sales document. Clear "active" instead of deleting it.'
    return
  }
  deleteDialog.value?.showModal()
}

async function remove() {
  const name = draft.value.name
  await customerRepository.remove(draft.value.id)
  recordAudit('Sales', 'Deleted', `Customer: ${name}`)
  deleteDialog.value?.close()
  emit('deleted', `${name} deleted.`)
}
</script>

<template>
  <SalesEditorShell :title="customer ? 'Customer' : 'New Customer'" :subtitle="customer?.name" :dirty="dirty" :error="saveError" @save="save" @close="emit('close')">
    <div class="sales-card">
      <h3 class="sales-card__title">Name</h3>
      <div class="sales-form sales-card__form">
        <div class="sales-field"><AppSelect id="customer-type" v-model="draft.customerType" label="Customer Type" :options="typeOptions" /></div>
        <label class="ws-check sales-card__inline-check"><input v-model="draft.active" type="checkbox" /> This customer account is active</label>
        <label class="sales-form__full">{{ isCompany ? 'Company Name' : 'Full Name' }} <span>*</span>
          <input v-model="draft.name" maxlength="160" autocomplete="off" :aria-invalid="Boolean(shown('name'))" />
          <small v-if="shown('name')" class="sales-field-error">{{ shown('name') }}</small>
        </label>
        <label v-if="isCompany" class="sales-form__full">Trade name<input v-model="draft.tradeName" maxlength="160" /></label>
        <label class="ws-check sales-form__full"><input v-model="draft.isDefault" type="checkbox" /> This is the default customer</label>
      </div>
    </div>

    <div class="sales-card">
      <h3 class="sales-card__title">Address</h3>
      <div class="sales-form sales-card__form">
        <label class="sales-form__full">Unit #, Bldg #, St., Brgy<input v-model="draft.unitBuilding" maxlength="180" /></label>
        <label class="sales-form__full">District\Town, City<input v-model="draft.locality" maxlength="180" /></label>
        <label>Country<input v-model="draft.country" maxlength="80" /></label>
        <label>Zip Code
          <input v-model="draft.zipCode" maxlength="10" inputmode="numeric" :aria-invalid="Boolean(shown('zipCode'))" />
          <small v-if="shown('zipCode')" class="sales-field-error">{{ shown('zipCode') }}</small>
        </label>
      </div>
    </div>

    <div class="sales-card">
      <h3 class="sales-card__title">Tax Information</h3>
      <div class="sales-form sales-card__form">
        <label>TIN
          <input v-model="draft.tin" maxlength="20" placeholder="000-000-000-00000" :aria-invalid="Boolean(shown('tin'))" />
          <small v-if="shown('tin')" class="sales-field-error">{{ shown('tin') }}</small>
        </label>
        <label>Line of Business<input v-model="draft.lineOfBusiness" maxlength="160" /></label>
        <label class="ws-check"><input v-model="draft.withholding" type="checkbox" /> This customer is withholding</label>
        <label class="ws-check"><input v-model="draft.topWithholdingAgent" type="checkbox" /> This customer is a top withholding agent</label>
      </div>
    </div>

    <div class="sales-card">
      <h3 class="sales-card__title">Contact Information</h3>
      <div class="sales-form sales-card__form">
        <label>Contact Person<input v-model="draft.contactPerson" maxlength="120" autocomplete="off" /></label>
        <label>E-mail
          <input v-model="draft.email" type="email" maxlength="254" autocomplete="off" :aria-invalid="Boolean(shown('email'))" />
          <small v-if="shown('email')" class="sales-field-error">{{ shown('email') }}</small>
        </label>
        <label>Tel No.<input v-model="draft.phone" type="tel" maxlength="40" autocomplete="off" /></label>
        <label>Fax No.<input v-model="draft.fax" type="tel" maxlength="40" autocomplete="off" /></label>
      </div>
    </div>

    <template #extra-actions>
      <button v-if="customer" class="sales-button sales-button--ghost-danger" type="button" @click="askDelete"><Trash2 :size="15" aria-hidden="true" /> Delete</button>
    </template>
  </SalesEditorShell>

  <dialog ref="deleteDialog" class="sales-dialog sales-dialog--small" aria-label="Confirm deletion">
    <div class="sales-dialog__header"><h2>Delete customer?</h2></div>
    <p class="sales-dialog__body">Remove <strong>{{ draft.name }}</strong>? This cannot be undone.</p>
    <div class="sales-dialog__footer"><button class="sales-button" type="button" @click="deleteDialog?.close()">Cancel</button><button class="sales-button sales-button--danger" type="button" @click="remove">Delete</button></div>
  </dialog>
</template>
