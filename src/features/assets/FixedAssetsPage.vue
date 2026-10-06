<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, LayoutGrid, Plus, Search } from '@lucide/vue'
import { formatMoney } from '../../lib/money'
import { confirmAction, showAlert } from '../../services/dialogService'
import { useRecordWorkspace } from '../../services/useRecordWorkspace'
import { useAuth } from '../auth/authStore'
import { usePermissions } from '../auth/permissions'
import { isPreviewMode } from '../../services/api/config'
import { useAssetReferences } from './assetReferences'
import { exportFixedAssets } from './assetExports'
import { fixedAssetRepository } from '../../services/previewRepositories'
import FixedAssetEditor from './FixedAssetEditor.vue'
import {
  accumulatedDepreciationCents, bookValueCents, fixedAssets, isDepreciated, monthlyDepreciationCents,
  type FixedAssetRecord, unclaimedAssets,
} from './fixedAssetData'
import './fixedAssets.css'

type AssetTab = 'active' | 'unclaimed' | 'depreciated'
const tab = ref<AssetTab>('active')
const query = ref('')
const compact = ref(false)
const editorOpen = ref(false)
const editing = ref<FixedAssetRecord | null>(null)
const notice = ref('')
const workspace = useRecordWorkspace(fixedAssetRepository, fixedAssets)
const references = useAssetReferences()
const { authUser } = useAuth()
const { can } = usePermissions(authUser)
const editable = computed(() => can('Asset Management', editing.value ? 'edit' : 'create'))
const vendorOptions = computed(() => references.vendors.value.filter((item) => item.active || item.id === editing.value?.vendorId).map((item) => ({ value: item.id, label: item.name })))
const itemOptions = computed(() => references.items.value.filter((item) => item.active || item.id === editing.value?.itemId).map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` })))

const activeAssets = computed(() => fixedAssets.value.filter((asset) => !isDepreciated(asset)))
const depreciatedAssets = computed(() => fixedAssets.value.filter(isDepreciated))
const visibleAssets = computed(() => {
  const source = tab.value === 'active' ? activeAssets.value : depreciatedAssets.value
  const term = query.value.trim().toLocaleLowerCase()
  return source.filter((asset) => !term || [asset.trackingNumber, asset.description, vendorName(asset.vendorId), itemName(asset.itemId), asset.remarks, asset.salesInvoice].some((value) => value.toLocaleLowerCase().includes(term)))
})
const visibleUnclaimed = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return unclaimedAssets.value.filter((item) => !term || [item.invoiceNumber, item.invoiceDate, item.itemName].some((value) => value.toLocaleLowerCase().includes(term)))
})
const activeBookValue = computed(() => visibleAssets.value.reduce((sum, asset) => sum + bookValueCents(asset), 0))
const unclaimedTotal = computed(() => visibleUnclaimed.value.reduce((sum, item) => sum + item.amountCents + item.vatCents, 0))
const vendorName = (id: string) => references.vendors.value.find((record) => record.id === id)?.name ?? 'Unknown vendor'
const itemName = (id: string) => references.items.value.find((item) => item.id === id)?.name ?? ''

function openEditor(record: FixedAssetRecord | null = null) {
  if (workspace.loading.value || workspace.busy.value || (!record && (!can('Asset Management', 'create') || references.loading.value || references.error.value))) return
  editing.value = record; editorOpen.value = true; notice.value = ''
}
async function saveRecord(record: FixedAssetRecord) {
  if (!editable.value || workspace.busy.value) return
  const duplicate = fixedAssets.value.some((item) => item.id !== record.id && record.trackingNumber && item.trackingNumber === record.trackingNumber)
  if (duplicate) { await showAlert({ title: 'Duplicate asset number', message: 'That asset tracking number is already in use.' }); return }
  if (!await workspace.save(record)) return
  editorOpen.value = false
  tab.value = isDepreciated(record) ? 'depreciated' : 'active'
  notice.value = `${record.description} saved.`
}
async function deleteRecord(record: FixedAssetRecord) {
  if (!can('Asset Management', 'delete') || workspace.busy.value) return
  if (!await confirmAction({ title: 'Delete fixed asset?', message: `${record.description} will be deleted.`, confirmLabel: 'Delete', destructive: true })) return
  if (!await workspace.remove(record)) return
  editorOpen.value = false
  notice.value = `${record.description} deleted.`
}
</script>

<template>
  <section class="asset-page" aria-label="Fixed assets">
    <p v-if="workspace.loading.value || references.loading.value" role="status">Loading fixed assets…</p>
    <p v-if="workspace.error.value || references.error.value" role="alert">{{ workspace.error.value || references.error.value }} <button type="button" @click="workspace.load(); references.retry()">Retry</button></p>
    <header class="asset-toolbar">
      <nav class="asset-tabs" aria-label="Fixed asset views"><button type="button" :class="{ 'asset-tabs__active': tab === 'active' }" @click="tab = 'active'">Active <span>{{ activeAssets.length }}</span></button><button v-if="isPreviewMode" type="button" :class="{ 'asset-tabs__active': tab === 'unclaimed' }" @click="tab = 'unclaimed'">Unclaimed <span>{{ unclaimedAssets.length }}</span></button><button type="button" :class="{ 'asset-tabs__active': tab === 'depreciated' }" @click="tab = 'depreciated'">Depreciated <span>{{ depreciatedAssets.length }}</span></button></nav>
      <div class="asset-toolbar__actions"><label class="asset-search"><Search :size="15" /><input v-model="query" type="search" placeholder="Type to filter" aria-label="Search fixed assets" /></label><button class="asset-button" type="button" :disabled="workspace.loading.value || Boolean(workspace.error.value) || !visibleAssets.length" @click="exportFixedAssets(visibleAssets)"><Download :size="16" /> Export CSV</button><button v-if="tab !== 'unclaimed' && can('Asset Management', 'create')" class="asset-button asset-button--primary" type="button" :disabled="workspace.loading.value || references.loading.value || Boolean(references.error.value)" @click="openEditor()"><Plus :size="16" /> New fixed asset</button><button class="asset-icon" type="button" :aria-pressed="compact" aria-label="Toggle compact rows" @click="compact = !compact"><LayoutGrid :size="18" /></button></div>
    </header>
    <div class="asset-heading"><div><h2>{{ tab === 'unclaimed' ? 'Unclaimed purchases' : tab === 'depreciated' ? 'Depreciated assets' : 'Fixed assets' }}</h2><span>{{ tab === 'unclaimed' ? 'Purchases that can be claimed as fixed assets' : tab === 'depreciated' ? 'Assets that reached the end of their useful life' : 'Active depreciation schedules and current book values' }}</span></div></div>
    <p v-if="notice" class="asset-notice" role="status">{{ notice }}</p>
    <div class="asset-table-wrap" :class="{ 'asset-table-wrap--compact': compact }">
      <table v-if="tab === 'active'" class="asset-table asset-table--active"><thead><tr><th>Fixed asset #</th><th>Description</th><th>Date purchased</th><th class="asset-table__number">Purchase price</th><th class="asset-table__number">Useful life (months)</th><th class="asset-table__number">Monthly depreciation</th><th class="asset-table__number">Lapsed (months)</th><th class="asset-table__number">Accumulated depreciation</th><th class="asset-table__number">Book value</th><th>Remarks</th></tr></thead><tbody><tr v-for="asset in visibleAssets" :key="asset.id" @click="openEditor(asset)"><td><button type="button" class="asset-table__link" @click.stop="openEditor(asset)">{{ asset.trackingNumber || 'Unassigned' }}</button></td><td>{{ asset.description }}</td><td>{{ asset.datePurchased }}</td><td class="asset-table__number">{{ formatMoney(asset.purchasePriceCents) }}</td><td class="asset-table__number">{{ asset.usefulLifeMonths }}</td><td class="asset-table__number">{{ formatMoney(monthlyDepreciationCents(asset)) }}</td><td class="asset-table__number">{{ asset.lapsedMonths }}</td><td class="asset-table__number">{{ formatMoney(accumulatedDepreciationCents(asset)) }}</td><td class="asset-table__number">{{ formatMoney(bookValueCents(asset)) }}</td><td>{{ asset.remarks || '—' }}</td></tr></tbody></table>
      <table v-else-if="tab === 'unclaimed'" class="asset-table asset-table--unclaimed"><thead><tr><th>Invoice #</th><th>Invoice date</th><th>Item name</th><th class="asset-table__number">Amount</th><th class="asset-table__number">VAT</th><th class="asset-table__number">Total amount</th><th class="asset-table__center">Deferred VAT?</th></tr></thead><tbody><tr v-for="item in visibleUnclaimed" :key="item.id"><td>{{ item.invoiceNumber }}</td><td>{{ item.invoiceDate }}</td><td>{{ item.itemName }}</td><td class="asset-table__number">{{ formatMoney(item.amountCents) }}</td><td class="asset-table__number">{{ formatMoney(item.vatCents) }}</td><td class="asset-table__number">{{ formatMoney(item.amountCents + item.vatCents) }}</td><td class="asset-table__center"><input type="checkbox" :checked="item.deferredVat" disabled /></td></tr></tbody></table>
      <table v-else class="asset-table asset-table--depreciated"><thead><tr><th>Fixed asset #</th><th>Description</th><th>Remarks</th><th>Date purchased</th><th class="asset-table__number">Amount</th><th class="asset-table__number">Useful life</th><th>Warranty expiration date</th></tr></thead><tbody><tr v-for="asset in visibleAssets" :key="asset.id" @click="openEditor(asset)"><td><button type="button" class="asset-table__link" @click.stop="openEditor(asset)">{{ asset.trackingNumber || 'Unassigned' }}</button></td><td>{{ asset.description }}</td><td>{{ asset.remarks || '—' }}</td><td>{{ asset.datePurchased }}</td><td class="asset-table__number">{{ formatMoney(asset.purchasePriceCents) }}</td><td class="asset-table__number">{{ asset.usefulLifeMonths }} months</td><td>{{ asset.warrantyExpirationDate || '—' }}</td></tr></tbody></table>
      <div v-if="!workspace.loading.value && !workspace.error.value && (tab === 'unclaimed' ? !visibleUnclaimed.length : !visibleAssets.length)" class="asset-empty"><strong>{{ query ? 'No matching records' : tab === 'unclaimed' ? 'No unclaimed purchases' : tab === 'depreciated' ? 'No depreciated assets' : 'No fixed assets yet' }}</strong><p>{{ query ? 'Try another search term.' : tab === 'unclaimed' ? 'Eligible purchase invoices will appear here.' : tab === 'depreciated' ? 'Assets appear here when their recorded depreciation reaches their useful life.' : 'Add an asset to start its depreciation schedule.' }}</p><button v-if="tab === 'active' && !query && can('Asset Management', 'create')" class="asset-button" type="button" :disabled="references.loading.value || Boolean(references.error.value)" @click="openEditor()">Add fixed asset</button></div>
      <footer><span>{{ tab === 'unclaimed' ? visibleUnclaimed.length : visibleAssets.length }} records</span><span>{{ tab === 'unclaimed' ? `Total ${formatMoney(unclaimedTotal)}` : `Book value ${formatMoney(activeBookValue)}` }}</span></footer>
    </div>
    <FixedAssetEditor :open="editorOpen" :record="editing" :busy="workspace.busy.value" :error="workspace.error.value" :readonly="!editable" :can-delete="can('Asset Management', 'delete')" :vendor-options="vendorOptions" :item-options="itemOptions" @close="editorOpen = false" @save="saveRecord" @delete="deleteRecord" />
  </section>
</template>
