<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { LayoutGrid, ListFilter, Plus, Search } from '@lucide/vue'
import { accountName } from '../../accounting/setup/accountSetupData'
import { confirmAction, showAlert } from '../../../services/dialogService'
import { purchaseSetupRepository } from '../../../services/previewRepositories'
import PurchaseSetupEditor from './PurchaseSetupEditor.vue'
import { purchaseSetupRecords, purchaseSetupTitles, type PurchaseSetupKind, type PurchaseSetupRecord } from './purchaseSetupData'
import './purchaseSetup.css'

const props = defineProps<{ pageId: PurchaseSetupKind }>()
const query = ref('')
const activeOnly = ref(false)
const compact = ref(false)
const vendorTab = ref<'vendors' | 'search'>('vendors')
const searchInput = ref<HTMLInputElement | null>(null)
const editorOpen = ref(false)
const editing = ref<PurchaseSetupRecord | null>(null)
const notice = ref('')
const title = computed(() => purchaseSetupTitles[props.pageId])
const rows = computed(() => purchaseSetupRecords.value.filter((item) => item.kind === props.pageId))
const visibleRows = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return rows.value.filter((item) => (!activeOnly.value || item.active) && (!term || [item.name, item.tin, item.address, accountName(item.accountId), item.computation, item.frequency].some((value) => String(value).toLocaleLowerCase().includes(term))))
})
function selectVendorTab(tab: 'vendors' | 'search') {
  vendorTab.value = tab
  if (tab === 'search') nextTick(() => searchInput.value?.focus())
}
function openEditor(record: PurchaseSetupRecord | null = null) { editing.value = record; editorOpen.value = true; notice.value = '' }
async function saveRecord(record: PurchaseSetupRecord) {
  if (rows.value.some((item) => item.id !== record.id && item.name.toLocaleLowerCase() === record.name.toLocaleLowerCase())) {
    await showAlert({ title: 'Duplicate name', message: 'This name is already in use.' })
    return
  }
  await purchaseSetupRepository.save(record)
  notice.value = `${record.name} saved.`
}
async function deleteRecord(record: PurchaseSetupRecord) {
  if (!await confirmAction({ title: 'Delete setup record?', message: `${record.name} will be removed from this preview.`, confirmLabel: 'Delete', destructive: true })) return
  await purchaseSetupRepository.remove(record.id)
  editorOpen.value = false
  notice.value = `${record.name} deleted.`
}
</script>

<template>
  <section class="purchase-setup-page" :aria-label="title">
    <header class="purchase-setup-toolbar">
      <nav v-if="pageId === 'vendors'" class="purchase-setup-tabs" aria-label="Vendor views"><button type="button" :class="{ 'purchase-setup-tabs__active': vendorTab === 'vendors' }" @click="selectVendorTab('vendors')">Vendors</button><button type="button" :class="{ 'purchase-setup-tabs__active': vendorTab === 'search' }" @click="selectVendorTab('search')">Search</button></nav>
      <h2 v-else>{{ title }}</h2>
      <div class="purchase-setup-toolbar__actions">
        <label class="purchase-setup-search"><Search :size="15" aria-hidden="true" /><input ref="searchInput" v-model="query" type="search" placeholder="Type to filter" :aria-label="`Search ${title}`" /></label>
        <button class="purchase-setup-icon" type="button" :aria-pressed="activeOnly" aria-label="Show active records only" @click="activeOnly = !activeOnly"><ListFilter :size="17" /></button>
        <button class="purchase-setup-button purchase-setup-button--primary" type="button" @click="openEditor()"><Plus :size="16" /> New {{ pageId === 'vendors' ? 'vendor' : title.replace(/s$/, '').toLocaleLowerCase() }}</button>
        <button class="purchase-setup-icon" type="button" :aria-pressed="compact" aria-label="Toggle compact rows" @click="compact = !compact"><LayoutGrid :size="18" /></button>
      </div>
    </header>
    <p v-if="notice" class="purchase-setup-notice" role="status">{{ notice }}</p>
    <div class="purchase-setup-table-wrap" :class="{ 'purchase-setup-table-wrap--compact': compact }">
      <table class="purchase-setup-table">
        <thead>
          <tr v-if="pageId === 'vendors'"><th>Name</th><th>TIN</th><th>Address</th></tr>
          <tr v-else-if="pageId === 'revolving-fund-customers'"><th>Name</th><th>Account</th><th class="purchase-setup-table__center">Active?</th></tr>
          <tr v-else-if="pageId === 'purchases-discount-types'"><th>Name</th><th>Discount Computation Type</th><th class="purchase-setup-table__number">Rate</th><th class="purchase-setup-table__center">Allow Override</th><th>Account</th></tr>
          <tr v-else-if="pageId === 'purchases-payment-terms'"><th>Name</th><th class="purchase-setup-table__number"># of Payments</th><th>Payment Frequency</th><th class="purchase-setup-table__number">Due On</th><th>Payment Due</th><th>Account</th><th class="purchase-setup-table__center">Active?</th></tr>
          <tr v-else><th>Name</th><th>Account</th></tr>
        </thead>
        <tbody>
          <tr v-for="item in visibleRows" :key="item.id" @click="openEditor(item)">
            <td><button type="button" class="purchase-setup-table__link" @click.stop="openEditor(item)">{{ item.name }}</button></td>
            <template v-if="pageId === 'vendors'"><td>{{ item.tin || '—' }}</td><td :title="item.address">{{ item.address || '—' }}</td></template>
            <template v-else-if="pageId === 'revolving-fund-customers'"><td>{{ accountName(item.accountId) }}</td><td class="purchase-setup-table__center"><input type="checkbox" :checked="item.active" disabled /></td></template>
            <template v-else-if="pageId === 'purchases-discount-types'"><td>{{ item.computation }}</td><td class="purchase-setup-table__number">{{ item.rate.toFixed(2) }}</td><td class="purchase-setup-table__center"><input type="checkbox" :checked="item.allowOverride" disabled /></td><td>{{ accountName(item.accountId) }}</td></template>
            <template v-else-if="pageId === 'purchases-payment-terms'"><td class="purchase-setup-table__number">{{ item.payments }}</td><td>{{ item.frequency || '—' }}</td><td class="purchase-setup-table__number">{{ item.dueOn }}</td><td>{{ item.paymentDue }}</td><td>{{ accountName(item.accountId) }}</td><td class="purchase-setup-table__center"><input type="checkbox" :checked="item.active" disabled /></td></template>
            <td v-else>{{ accountName(item.accountId) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!visibleRows.length" class="purchase-setup-empty" role="status"><strong>{{ rows.length ? 'No matching records' : 'No rows to show' }}</strong><p>{{ rows.length ? 'Try another search or clear the active filter.' : `Add a ${title.replace(/s$/, '').toLocaleLowerCase()} to get started.` }}</p><button v-if="!rows.length" class="purchase-setup-button" type="button" @click="openEditor()">Add record</button></div>
      <footer>{{ visibleRows.length }}</footer>
    </div>
    <PurchaseSetupEditor :open="editorOpen" :kind="pageId" :record="editing" @close="editorOpen = false" @save="saveRecord" @delete="deleteRecord" />
  </section>
</template>
