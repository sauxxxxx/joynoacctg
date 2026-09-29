<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Plus, Search, Trash2, X } from '@lucide/vue'
import { recordAudit } from '../../company/companyStore'
import { customers, type Customer } from './customerPreviewStore'
import { salesDocuments } from '../salesPreviewStore'
import './customers.css'

type StatusFilter = 'all' | 'active' | 'inactive'
type CustomerDraft = Omit<Customer, 'id'>
type PendingAction = { kind: 'status' | 'delete'; customer: Customer }

const emptyDraft = (): CustomerDraft => ({
  name: '',
  tin: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  active: true,
})

const search = ref('')
const statusFilter = ref<StatusFilter>('all')
const formDialog = ref<HTMLDialogElement | null>(null)
const confirmDialog = ref<HTMLDialogElement | null>(null)
const firstField = ref<HTMLInputElement | null>(null)
const editingId = ref<string | null>(null)
const draft = ref<CustomerDraft>(emptyDraft())
const formError = ref('')
const pendingAction = ref<PendingAction | null>(null)
const feedback = ref('')

const filteredCustomers = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return customers.value.filter((customer) => {
    if (statusFilter.value !== 'all' && customer.active !== (statusFilter.value === 'active')) return false
    return !term || [customer.name, customer.tin, customer.address, customer.contactPerson, customer.email, customer.phone]
      .some((value) => value.toLocaleLowerCase().includes(term))
  })
})

function openForm(customer?: Customer) {
  editingId.value = customer?.id ?? null
  draft.value = customer ? { ...customer } : emptyDraft()
  formError.value = ''
  formDialog.value?.showModal()
  nextTick(() => firstField.value?.focus())
}

function saveCustomer() {
  const name = draft.value.name.trim()
  if (!name) {
    formError.value = 'Customer name is required.'
    return
  }

  const customer: Customer = {
    id: editingId.value ?? crypto.randomUUID(),
    name,
    tin: draft.value.tin.trim(),
    contactPerson: draft.value.contactPerson.trim(),
    email: draft.value.email.trim(),
    phone: draft.value.phone.trim(),
    address: draft.value.address.trim(),
    active: draft.value.active,
  }
  if (editingId.value) {
    customers.value = customers.value.map((item) => item.id === editingId.value ? customer : item)
    feedback.value = `${customer.name} updated.`
  } else {
    customers.value = [...customers.value, customer]
    feedback.value = `${customer.name} added.`
  }
  recordAudit('Sales', editingId.value ? 'Updated' : 'Created', `Customer: ${customer.name}`)
  formDialog.value?.close()
}

function askToChange(customer: Customer, kind: PendingAction['kind']) {
  if (kind === 'delete' && salesDocuments.value.some((document) => document.customerId === customer.id)) {
    feedback.value = 'This customer is used by a sales document. Deactivate the customer instead.'
    return
  }
  pendingAction.value = { customer, kind }
  confirmDialog.value?.showModal()
}

// Customers open by clicking their row; deleting happens from the edit form.
function deleteFromForm() {
  const customer = customers.value.find((item) => item.id === editingId.value)
  if (!customer) return
  if (salesDocuments.value.some((document) => document.customerId === customer.id)) {
    formError.value = 'This customer is used by a sales document. Set the status to Inactive instead.'
    return
  }
  formDialog.value?.close()
  askToChange(customer, 'delete')
}

function confirmChange() {
  const action = pendingAction.value
  if (!action) return
  if (action.kind === 'delete') {
    customers.value = customers.value.filter((customer) => customer.id !== action.customer.id)
    feedback.value = `${action.customer.name} deleted.`
    recordAudit('Sales', 'Deleted', `Customer: ${action.customer.name}`)
  } else {
    customers.value = customers.value.map((customer) => customer.id === action.customer.id
      ? { ...customer, active: !customer.active }
      : customer)
    feedback.value = `${action.customer.name} ${action.customer.active ? 'deactivated' : 'activated'}.`
    recordAudit('Sales', action.customer.active ? 'Deactivated' : 'Activated', `Customer: ${action.customer.name}`)
  }
  confirmDialog.value?.close()
  pendingAction.value = null
}

function clearFilters() {
  search.value = ''
  statusFilter.value = 'all'
}
</script>

<template>
  <section class="customers-page" aria-label="Customer management">
    <div class="customers-page__intro">
      <div>
        <span class="customers-page__eyebrow">Sales setup</span>
        <h2>Customers</h2>
        <p>Keep customer names, tax identifiers, and contact details ready for sales documents.</p>
      </div>
      <button class="customer-button customer-button--primary" type="button" @click="openForm()">
        <Plus :size="17" aria-hidden="true" /> Add customer
      </button>
    </div>

    <p v-if="feedback" class="customers-page__feedback" role="status">{{ feedback }}</p>

    <div class="customer-panel">
      <div class="customer-panel__toolbar">
        <label class="customer-search">
          <Search :size="17" aria-hidden="true" />
          <input v-model="search" type="search" placeholder="Search customers" aria-label="Search customers" />
        </label>
        <label class="customer-filter">
          <span>Status</span>
          <select v-model="statusFilter" aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>

      <div class="customer-table-wrap">
        <table class="customer-table">
          <thead><tr><th scope="col">Name</th><th scope="col">TIN</th><th scope="col">Address</th><th scope="col">Tel No</th></tr></thead>
          <tbody>
            <tr v-for="customer in filteredCustomers" :key="customer.id" class="customer-table__row" @click="openForm(customer)">
              <td data-label="Name"><button class="customer-table__link" type="button" :aria-label="`Open ${customer.name}`" @click.stop="openForm(customer)">{{ customer.name }}</button><small v-if="!customer.active">Inactive</small></td>
              <td data-label="TIN">{{ customer.tin }}</td>
              <td data-label="Address">{{ customer.address }}</td>
              <td data-label="Tel No">{{ customer.phone }}</td>
            </tr>
            <tr v-if="!filteredCustomers.length" class="customer-table__empty">
              <td colspan="4">
                <strong>{{ customers.length ? 'No customers found' : 'No rows to show' }}</strong>
                <span>{{ customers.length ? 'Try another search or status filter.' : 'Add your first customer to start building your sales records.' }}</span>
                <button v-if="customers.length" class="customer-button customer-button--secondary" type="button" @click="clearFilters">Clear filters</button>
                <button v-else class="customer-button customer-button--secondary" type="button" @click="openForm()">Add customer</button>
              </td>
            </tr>
          </tbody>
          <tfoot><tr><td colspan="4">{{ filteredCustomers.length }}</td></tr></tfoot>
        </table>
      </div>
    </div>

    <dialog ref="formDialog" class="customer-dialog" aria-labelledby="customer-dialog-title" @close="formError = ''">
      <form class="customer-form" @submit.prevent="saveCustomer">
        <div class="customer-dialog__header">
          <div><span class="customers-page__eyebrow">Customer record</span><h2 id="customer-dialog-title">{{ editingId ? 'Edit customer' : 'Add customer' }}</h2></div>
          <button class="customer-dialog__close" type="button" aria-label="Close form" @click="formDialog?.close()"><X :size="19" aria-hidden="true" /></button>
        </div>
        <div class="customer-form__fields">
          <label>Customer name <span aria-hidden="true">*</span><input ref="firstField" v-model="draft.name" required maxlength="120" autocomplete="organization" /></label>
          <label>TIN<input v-model="draft.tin" maxlength="30" inputmode="numeric" autocomplete="off" /></label>
          <label>Contact person<input v-model="draft.contactPerson" maxlength="120" autocomplete="name" /></label>
          <label>Email address<input v-model="draft.email" type="email" maxlength="254" autocomplete="email" /></label>
          <label>Phone number<input v-model="draft.phone" type="tel" maxlength="40" autocomplete="tel" /></label>
          <label>Status<select v-model="draft.active"><option :value="true">Active</option><option :value="false">Inactive</option></select></label>
          <label class="customer-form__full">Address<textarea v-model="draft.address" rows="3" maxlength="500" autocomplete="street-address" /></label>
        </div>
        <p v-if="formError" class="customer-form__error" role="alert">{{ formError }}</p>
        <div class="customer-dialog__footer">
          <button v-if="editingId" class="customer-button customer-button--ghost-danger" type="button" @click="deleteFromForm"><Trash2 :size="15" aria-hidden="true" /> Delete</button>
          <button class="customer-button customer-button--secondary" type="button" @click="formDialog?.close()">Cancel</button>
          <button class="customer-button customer-button--primary" type="submit">{{ editingId ? 'Save changes' : 'Add customer' }}</button>
        </div>
      </form>
    </dialog>

    <dialog ref="confirmDialog" class="customer-dialog customer-dialog--confirm" aria-labelledby="customer-confirm-title" @close="pendingAction = null">
      <div v-if="pendingAction" class="customer-confirm">
        <h2 id="customer-confirm-title">{{ pendingAction.kind === 'delete' ? 'Delete customer?' : `${pendingAction.customer.active ? 'Deactivate' : 'Activate'} customer?` }}</h2>
        <p v-if="pendingAction.kind === 'delete'">Remove <strong>{{ pendingAction.customer.name }}</strong> from this preview? This action cannot be undone.</p>
        <p v-if="pendingAction.kind === 'status'">{{ pendingAction.customer.name }} will be marked {{ pendingAction.customer.active ? 'inactive' : 'active' }}.</p>
        <div class="customer-dialog__footer">
          <button class="customer-button customer-button--secondary" type="button" @click="confirmDialog?.close()">Cancel</button>
          <button class="customer-button" :class="pendingAction.kind === 'delete' ? 'customer-button--danger' : 'customer-button--primary'" type="button" @click="confirmChange">{{ pendingAction.kind === 'delete' ? 'Delete customer' : pendingAction.customer.active ? 'Deactivate' : 'Activate' }}</button>
        </div>
      </div>
    </dialog>
  </section>
</template>
