<script setup lang="ts">
import { computed, ref } from 'vue'
import { Pencil, Plus, Search, Trash2, X } from '@lucide/vue'
import { recordAudit } from '../company/companyStore'
import { salesDocuments, setupRecords, type SetupKind, type SetupRecord } from './salesPreviewStore'
import './sales-pages.css'

const props = defineProps<{ pageId: SetupKind }>()

const titles: Record<SetupKind, string> = {
  'sales-payment-terms': 'Payment Terms',
  'sales-payment-methods': 'Payment Methods',
  'sales-discount-types': 'Discount Types',
}

const emptyRecord = (kind: SetupKind): SetupRecord => ({
  id: '', kind, name: '', active: true, account: '', payments: 1, frequency: '',
  dueOn: 0, paymentDue: 'Days', computation: 'Amount', rate: 0, allowOverride: false,
})

const query = ref('')
const dialog = ref<HTMLDialogElement | null>(null)
const deleteDialog = ref<HTMLDialogElement | null>(null)
const draft = ref<SetupRecord>(emptyRecord(props.pageId))
const deleting = ref<SetupRecord | null>(null)
const error = ref('')
const notice = ref('')

const rows = computed(() => setupRecords.value.filter((item) => item.kind === props.pageId))
const visibleRows = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return rows.value.filter((item) => !term || [item.name, item.account, item.frequency]
    .some((value) => value.toLocaleLowerCase().includes(term)))
})

function openForm(item?: SetupRecord) {
  draft.value = item ? { ...item } : emptyRecord(props.pageId)
  error.value = ''
  dialog.value?.showModal()
}

function save() {
  const name = draft.value.name.trim()
  if (!name) {
    error.value = 'Name is required.'
    return
  }
  if (rows.value.some((item) => item.id !== draft.value.id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    error.value = 'This name is already in use.'
    return
  }
  if (props.pageId === 'sales-discount-types' && draft.value.computation === 'Percentage' && draft.value.rate > 100) {
    error.value = 'Percentage rate cannot exceed 100.'
    return
  }
  const item = { ...draft.value, id: draft.value.id || crypto.randomUUID(), name, account: draft.value.account.trim() }
  setupRecords.value = draft.value.id
    ? setupRecords.value.map((record) => record.id === item.id ? item : record)
    : [...setupRecords.value, item]
  notice.value = `${title.value.slice(0, -1)} ${draft.value.id ? 'updated' : 'added'}.`
  recordAudit('Sales', draft.value.id ? 'Updated' : 'Created', `${title.value.slice(0, -1)}: ${item.name}`)
  dialog.value?.close()
}

function askDelete(item: SetupRecord) {
  const isReferenced = salesDocuments.value.some((document) =>
    document.paymentTermId === item.id || document.paymentMethodId === item.id || document.discountTypeId === item.id)
  if (isReferenced) {
    notice.value = `${item.name} is used by a sales document. Mark it inactive instead.`
    return
  }
  deleting.value = item
  deleteDialog.value?.showModal()
}

function remove() {
  if (!deleting.value) return
  setupRecords.value = setupRecords.value.filter((item) => item.id !== deleting.value?.id)
  notice.value = `${deleting.value.name} deleted.`
  recordAudit('Sales', 'Deleted', `${title.value.slice(0, -1)}: ${deleting.value.name}`)
  deleteDialog.value?.close()
  deleting.value = null
}

const title = computed(() => titles[props.pageId])
</script>

<template>
  <section class="sales-page" :aria-label="title">
    <p class="sales-preview-note">Frontend preview · Changes reset when this tab reloads.</p>
    <div v-if="notice" class="sales-notice" role="status">{{ notice }}</div>
    <div class="sales-panel">
      <div class="sales-panel__toolbar">
        <div><h2>{{ title }}</h2><p>Manage the options available on sales documents.</p></div>
        <div class="sales-panel__actions">
          <label class="sales-search"><Search :size="16" aria-hidden="true" /><input v-model="query" type="search" placeholder="Type to filter" :aria-label="`Search ${title}`" /></label>
          <button class="sales-button sales-button--primary" type="button" @click="openForm()"><Plus :size="16" aria-hidden="true" /> Add {{ title.slice(0, -1).toLocaleLowerCase() }}</button>
        </div>
      </div>
      <div class="sales-table-wrap">
        <table class="sales-table">
          <thead>
            <tr v-if="pageId === 'sales-payment-terms'"><th>Name</th><th># of Payments</th><th>Payment Frequency</th><th>Due On</th><th>Payment Due</th><th>Account</th><th>Active?</th><th>Actions</th></tr>
            <tr v-else-if="pageId === 'sales-payment-methods'"><th>Name</th><th>Account</th><th>Active?</th><th>Actions</th></tr>
            <tr v-else><th>Name</th><th>Discount Computation Type</th><th>Rate</th><th>Allow Override</th><th>Account</th><th>Active?</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in visibleRows" :key="item.id">
              <td><strong>{{ item.name }}</strong></td>
              <template v-if="pageId === 'sales-payment-terms'"><td>{{ item.payments }}</td><td>{{ item.frequency || '—' }}</td><td>{{ item.dueOn }}</td><td>{{ item.paymentDue }}</td><td>{{ item.account || '—' }}</td></template>
              <template v-else-if="pageId === 'sales-payment-methods'"><td>{{ item.account || '—' }}</td></template>
              <template v-else><td>{{ item.computation }}</td><td>{{ item.rate.toFixed(2) }}</td><td>{{ item.allowOverride ? 'Yes' : 'No' }}</td><td>{{ item.account || '—' }}</td></template>
              <td><span class="sales-badge" :class="item.active ? 'sales-badge--success' : 'sales-badge--muted'">{{ item.active ? 'Active' : 'Inactive' }}</span></td>
              <td class="sales-table__actions"><button type="button" :aria-label="`Edit ${item.name}`" @click="openForm(item)"><Pencil :size="15" /></button><button type="button" :aria-label="`Delete ${item.name}`" @click="askDelete(item)"><Trash2 :size="15" /></button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="!visibleRows.length" class="sales-empty"><strong>{{ rows.length ? 'No matching records' : `No ${title.toLocaleLowerCase()} yet` }}</strong><span>{{ rows.length ? 'Try another search.' : `Add a ${title.slice(0, -1).toLocaleLowerCase()} to get started.` }}</span></div>
      <div class="sales-panel__footer">{{ visibleRows.length }} record{{ visibleRows.length === 1 ? '' : 's' }}</div>
    </div>

    <dialog ref="dialog" class="sales-dialog" :aria-label="`${draft.id ? 'Edit' : 'Add'} ${title.slice(0, -1)}`">
      <form @submit.prevent="save">
        <div class="sales-dialog__header"><h2>{{ draft.id ? 'Edit' : 'Add' }} {{ title.slice(0, -1) }}</h2><button type="button" aria-label="Close form" @click="dialog?.close()"><X :size="18" /></button></div>
        <div class="sales-form">
          <label>Name <span>*</span><input v-model="draft.name" required maxlength="120" /></label>
          <template v-if="pageId === 'sales-payment-terms'">
            <label># of Payments<input v-model.number="draft.payments" type="number" min="1" step="1" required /></label>
            <label>Payment Frequency<input v-model="draft.frequency" maxlength="80" placeholder="e.g. Monthly" /></label>
            <label>Due On<input v-model.number="draft.dueOn" type="number" min="0" step="1" required /></label>
            <label>Payment Due<select v-model="draft.paymentDue"><option>Days</option><option>Months</option></select></label>
          </template>
          <template v-if="pageId === 'sales-discount-types'">
            <label>Discount Computation Type<select v-model="draft.computation"><option>Amount</option><option>Percentage</option></select></label>
            <label>Rate<input v-model.number="draft.rate" type="number" min="0" step="0.01" required /></label>
            <label class="sales-checkbox"><input v-model="draft.allowOverride" type="checkbox" /> Allow override</label>
          </template>
          <label>Account<input v-model="draft.account" maxlength="120" placeholder="Select when accounting accounts are available" /></label>
          <label class="sales-checkbox"><input v-model="draft.active" type="checkbox" /> Active</label>
        </div>
        <p v-if="error" class="sales-form__error" role="alert">{{ error }}</p>
        <div class="sales-dialog__footer"><button class="sales-button" type="button" @click="dialog?.close()">Cancel</button><button class="sales-button sales-button--primary" type="submit">Save</button></div>
      </form>
    </dialog>

    <dialog ref="deleteDialog" class="sales-dialog sales-dialog--small" aria-label="Confirm deletion" @close="deleting = null">
      <div class="sales-dialog__header"><h2>Delete {{ title.slice(0, -1).toLocaleLowerCase() }}?</h2></div>
      <p class="sales-dialog__body">Remove <strong>{{ deleting?.name }}</strong> from this preview?</p>
      <div class="sales-dialog__footer"><button class="sales-button" type="button" @click="deleteDialog?.close()">Cancel</button><button class="sales-button sales-button--danger" type="button" @click="remove">Delete</button></div>
    </dialog>
  </section>
</template>
