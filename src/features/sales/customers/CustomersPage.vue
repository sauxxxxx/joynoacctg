<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Search } from '@lucide/vue'
import CustomerForm from './CustomerForm.vue'
import { customerAddress, customers, type Customer } from './customerPreviewStore'
import '../sales-pages.css'
import './customers.css'

type StatusFilter = 'all' | 'active' | 'inactive'

const search = ref('')
const statusFilter = ref<StatusFilter>('all')
const notice = ref('')
// The form replaces the list, like the legacy full-page editors. `null` shows the list.
const editor = ref<{ customer: Customer | null } | null>(null)

const filteredCustomers = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return customers.value.filter((customer) => {
    if (statusFilter.value !== 'all' && customer.active !== (statusFilter.value === 'active')) return false
    return !term || [customer.name, customer.tradeName, customer.tin, customerAddress(customer), customer.contactPerson, customer.email, customer.phone]
      .some((value) => value.toLocaleLowerCase().includes(term))
  })
})

function open(customer: Customer | null) {
  editor.value = { customer }
  notice.value = ''
}

function done(message: string) {
  editor.value = null
  notice.value = message
}

function clearFilters() {
  search.value = ''
  statusFilter.value = 'all'
}
</script>

<template>
  <CustomerForm v-if="editor" :key="editor.customer?.id ?? 'new'" :customer="editor.customer" @close="editor = null" @saved="done" @deleted="done" />
  <section v-else class="sales-page" aria-label="Customers">
    <p v-if="notice" class="sales-notice" role="status">{{ notice }}</p>

    <div class="sales-panel">
      <div class="sales-panel__toolbar">
        <div><h2>Customers</h2><p>Keep customer names, tax identifiers, and contact details ready for sales documents.</p></div>
        <div class="sales-panel__actions">
          <label class="sales-search"><Search :size="16" aria-hidden="true" /><input v-model="search" type="search" placeholder="Type to filter" aria-label="Search customers" /></label>
          <select v-model="statusFilter" class="sales-status-filter" aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button class="sales-button sales-button--primary" type="button" @click="open(null)"><Plus :size="16" aria-hidden="true" /> Add customer</button>
        </div>
      </div>

      <div class="customer-table-wrap">
        <table class="customer-table">
          <thead><tr><th scope="col">Name</th><th scope="col">TIN</th><th scope="col">Address</th><th scope="col">Tel No</th></tr></thead>
          <tbody>
            <tr v-for="customer in filteredCustomers" :key="customer.id" class="customer-table__row" @click="open(customer)">
              <td data-label="Name"><span><button class="customer-table__link" type="button" :aria-label="`Open ${customer.name}`" @click.stop="open(customer)">{{ customer.name }}</button><small v-if="!customer.active">Inactive</small></span></td>
              <td data-label="TIN">{{ customer.tin }}</td>
              <td data-label="Address">{{ customerAddress(customer) }}</td>
              <td data-label="Tel No">{{ customer.phone }}</td>
            </tr>
            <tr v-if="!filteredCustomers.length" class="customer-table__empty">
              <td colspan="4">
                <strong>{{ customers.length ? 'No customers found' : 'No rows to show' }}</strong>
                <span>{{ customers.length ? 'Try another search or status filter.' : 'Add your first customer to start building your sales records.' }}</span>
                <button v-if="customers.length" class="customer-button customer-button--secondary" type="button" @click="clearFilters">Clear filters</button>
                <button v-else class="customer-button customer-button--secondary" type="button" @click="open(null)">Add customer</button>
              </td>
            </tr>
          </tbody>
          <tfoot><tr><td colspan="4">{{ filteredCustomers.length }}</td></tr></tfoot>
        </table>
      </div>
    </div>
  </section>
</template>
