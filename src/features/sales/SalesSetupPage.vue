<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Search } from '@lucide/vue'
import CheckMark from './CheckMark.vue'
import SalesSetupForm from './SalesSetupForm.vue'
import { tableAmount } from './salesFormat'
import { setupRecords, type SetupKind, type SetupRecord } from './salesPreviewStore'
import { frequencyLabel } from './salesRules'
import './sales-pages.css'

const props = defineProps<{ pageId: SetupKind }>()

const titles: Record<SetupKind, string> = {
  'sales-payment-terms': 'Payment Terms',
  'sales-payment-methods': 'Payment Methods',
  'sales-discount-types': 'Discount Types',
}

const query = ref('')
const notice = ref('')
// The form replaces the list, like the legacy full-page editors. `null` shows the list.
const editor = ref<{ record: SetupRecord | null } | null>(null)
watch(() => props.pageId, () => { editor.value = null; query.value = ''; notice.value = '' })

const title = computed(() => titles[props.pageId])
const singular = computed(() => title.value.slice(0, -1).toLocaleLowerCase())
const rows = computed(() => setupRecords.value.filter((item) => item.kind === props.pageId))
const visibleRows = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return rows.value.filter((item) => !term || [item.name, item.account, frequencyLabel(item)].some((value) => value.toLocaleLowerCase().includes(term)))
})
const columnCount = computed(() => ({ 'sales-payment-terms': 7, 'sales-payment-methods': 2, 'sales-discount-types': 5 })[props.pageId])

function done(message: string) {
  editor.value = null
  notice.value = message
}
</script>

<template>
  <SalesSetupForm v-if="editor" :key="editor.record?.id ?? 'new'" :kind="pageId" :record="editor.record" @close="editor = null" @saved="done" @deleted="done" />
  <section v-else class="sales-page" :aria-label="title">
    <div v-if="notice" class="sales-notice" role="status">{{ notice }}</div>
    <div class="sales-panel">
      <div class="sales-panel__toolbar">
        <div><h2>{{ title }}</h2><p>Manage the options available on sales documents.</p></div>
        <div class="sales-panel__actions">
          <label class="sales-search"><Search :size="16" aria-hidden="true" /><input v-model="query" type="search" placeholder="Type to filter" :aria-label="`Search ${title}`" /></label>
          <button class="sales-button sales-button--primary" type="button" @click="editor = { record: null }; notice = ''"><Plus :size="16" aria-hidden="true" /> Add {{ singular }}</button>
        </div>
      </div>
      <div class="sales-table-wrap">
        <table class="sales-table sales-list-table">
          <thead>
            <tr v-if="pageId === 'sales-payment-terms'"><th scope="col">Name</th><th scope="col" class="sales-table__number"># of Payments</th><th scope="col">Payment Frequency</th><th scope="col" class="sales-table__number">Due On</th><th scope="col">Payment Due</th><th scope="col">Account</th><th scope="col" class="sales-table__center">Active?</th></tr>
            <tr v-else-if="pageId === 'sales-payment-methods'"><th scope="col">Name</th><th scope="col">Account</th></tr>
            <tr v-else><th scope="col">Name</th><th scope="col">Discount Computation Type</th><th scope="col" class="sales-table__number">Rate</th><th scope="col" class="sales-table__center">Allow Override</th><th scope="col">Account</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in visibleRows" :key="item.id" class="sales-table__row--open" @click="editor = { record: item }; notice = ''">
              <td>
                <button class="sales-table__link" type="button" :aria-label="`Open ${item.name}`" @click.stop="editor = { record: item }; notice = ''">{{ item.name }}</button>
                <small v-if="!item.active && pageId !== 'sales-payment-terms'" class="sales-table__tag">Inactive</small>
              </td>
              <template v-if="pageId === 'sales-payment-terms'">
                <td class="sales-table__number">{{ item.payments }}</td><td>{{ frequencyLabel(item) }}</td><td class="sales-table__number">{{ item.dueOn }}</td><td>{{ item.paymentDue }}</td><td>{{ item.account }}</td>
                <td class="sales-table__center"><CheckMark :value="item.active" label="Active" /></td>
              </template>
              <td v-else-if="pageId === 'sales-payment-methods'">{{ item.account }}</td>
              <template v-else>
                <td>{{ item.computation }}</td><td class="sales-table__number">{{ tableAmount(item.rate) }}</td>
                <td class="sales-table__center"><CheckMark :value="item.allowOverride" label="Allow override" /></td><td>{{ item.account }}</td>
              </template>
            </tr>
            <tr v-if="!visibleRows.length" class="sales-table__empty-row">
              <td :colspan="columnCount"><strong>{{ rows.length ? 'No matching records' : 'No rows to show' }}</strong><span>{{ rows.length ? 'Try another search.' : `Add a ${singular} to get started.` }}</span></td>
            </tr>
          </tbody>
          <tfoot><tr><td :colspan="columnCount">{{ visibleRows.length }}</td></tr></tfoot>
        </table>
      </div>
    </div>
  </section>
</template>
