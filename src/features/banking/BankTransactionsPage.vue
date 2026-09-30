<script setup lang="ts">
import { computed, ref } from 'vue'
import { Filter, LayoutGrid, Plus, Search } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import { formatMoney } from '../../lib/money'
import BankTransactionEditor from './BankTransactionEditor.vue'
import { bankAccountName, bankAccounts, bankTransactions, type BankTransactionRecord } from './bankingData'
import './banking.css'

type TransactionTab = 'search' | 'unjournalized'
const tab = ref<TransactionTab>('search')
const query = ref('')
const compact = ref(false)
const filterOpen = ref(false)
const from = ref('2026-09-01')
const to = ref('2026-09-30')
const accountId = ref('')
const editorOpen = ref(false)
const editing = ref<BankTransactionRecord | null>(null)
const selectedIds = ref<string[]>([])
const notice = ref('')

const visibleRows = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return bankTransactions.value.filter((item) => {
    if (tab.value === 'unjournalized' && item.status === 'Journalized') return false
    if (from.value && item.date < from.value) return false
    if (to.value && item.date > to.value) return false
    if (accountId.value && item.bankAccountId !== accountId.value) return false
    return !term || [item.date, bankAccountName(item.bankAccountId), item.purpose, item.party, item.ledgerAccount, item.reference, item.description, item.status].some((value) => value.toLocaleLowerCase().includes(term))
  })
})
const selectedAll = computed(() => visibleRows.value.length > 0 && visibleRows.value.every((item) => selectedIds.value.includes(item.id)))
const totalCents = computed(() => visibleRows.value.reduce((sum, item) => sum + item.amountCents, 0))

function openEditor(record: BankTransactionRecord | null = null) { editing.value = record; editorOpen.value = true; notice.value = '' }
function saveRecord(record: BankTransactionRecord) {
  const index = bankTransactions.value.findIndex((item) => item.id === record.id)
  if (index >= 0) bankTransactions.value.splice(index, 1, record)
  else bankTransactions.value.push(record)
  notice.value = `Bank transaction ${record.reference || record.purpose} saved.`
}
function deleteRecord(record: BankTransactionRecord) {
  if (!window.confirm(`Delete transaction ${record.reference || record.purpose}?`)) return
  bankTransactions.value = bankTransactions.value.filter((item) => item.id !== record.id)
  selectedIds.value = selectedIds.value.filter((id) => id !== record.id)
  editorOpen.value = false
  notice.value = 'Bank transaction deleted.'
}
function toggleAll() { selectedIds.value = selectedAll.value ? [] : visibleRows.value.map((item) => item.id) }
function journalize() {
  if (!selectedIds.value.length) return
  bankTransactions.value = bankTransactions.value.map((item) => selectedIds.value.includes(item.id) ? { ...item, status: 'Journalized' } : item)
  notice.value = `${selectedIds.value.length} ${selectedIds.value.length === 1 ? 'transaction' : 'transactions'} journalized.`
  selectedIds.value = []
}
function clearFilters() { from.value = ''; to.value = ''; accountId.value = ''; filterOpen.value = false }
</script>

<template>
  <section class="banking-page" aria-label="Bank transactions">
    <header class="banking-toolbar banking-toolbar--tabs">
      <nav class="banking-tabs" aria-label="Bank transaction views"><button type="button" :class="{ 'banking-tabs__active': tab === 'search' }" @click="tab = 'search'">Search</button><button type="button" :class="{ 'banking-tabs__active': tab === 'unjournalized' }" @click="tab = 'unjournalized'">Unjournalized</button></nav>
      <div class="banking-toolbar__actions">
        <label class="banking-search"><Search :size="15" /><input v-model="query" type="search" placeholder="Type to filter" aria-label="Search bank transactions" /></label>
        <div class="banking-filter-control"><button class="banking-icon" type="button" :aria-expanded="filterOpen" aria-label="Filter bank transactions" @click="filterOpen = !filterOpen"><Filter :size="17" /></button><div v-if="filterOpen" class="banking-filter-popover"><strong>Filter transactions</strong><AppDatePicker v-model="from" label="From" /><AppDatePicker v-model="to" label="To" /><label>Bank account<select v-model="accountId"><option value="">All accounts</option><option v-for="account in bankAccounts" :key="account.id" :value="account.id">{{ account.name }}</option></select></label><div><button class="banking-button" type="button" @click="clearFilters">Clear</button><button class="banking-button banking-button--primary" type="button" @click="filterOpen = false">Apply</button></div></div></div>
        <button v-if="tab === 'unjournalized'" class="banking-button" type="button" :disabled="!selectedIds.length" @click="journalize">Create journal</button>
        <button class="banking-button banking-button--primary" type="button" @click="openEditor()"><Plus :size="16" /> New transaction</button>
        <button class="banking-icon" type="button" :aria-pressed="compact" aria-label="Toggle compact rows" @click="compact = !compact"><LayoutGrid :size="18" /></button>
      </div>
    </header>
    <div class="banking-heading-row"><div><h2>{{ tab === 'search' ? 'Bank transactions' : 'Unjournalized bank transactions' }}</h2><span>{{ tab === 'search' ? 'Review recorded bank activity' : 'Select draft transactions to create a journal entry' }}</span></div></div>
    <p v-if="notice" class="banking-notice" role="status">{{ notice }}</p>
    <div class="banking-table-wrap" :class="{ 'banking-table-wrap--compact': compact }">
      <table class="banking-table banking-table--transactions"><thead><tr><th v-if="tab === 'unjournalized'" class="banking-table__check"><input type="checkbox" :checked="selectedAll" aria-label="Select all visible transactions" @change="toggleAll" /></th><th>Date</th><th>Bank account</th><th>Purpose</th><th>Party</th><th class="banking-table__number">Amount</th><th>Status</th><th>Account</th><th>Reference</th><th>Description</th></tr></thead>
        <tbody><tr v-for="item in visibleRows" :key="item.id" @click="openEditor(item)"><td v-if="tab === 'unjournalized'" class="banking-table__check" @click.stop><input v-model="selectedIds" type="checkbox" :value="item.id" :aria-label="`Select ${item.reference || item.purpose}`" /></td><td><button type="button" class="banking-table__link" @click.stop="openEditor(item)">{{ item.date }}</button></td><td>{{ bankAccountName(item.bankAccountId) }}</td><td>{{ item.purpose }}</td><td>{{ item.party || item.partyType }}</td><td class="banking-table__number">{{ formatMoney(item.amountCents) }}</td><td><span class="banking-status" :class="`banking-status--${item.status.toLocaleLowerCase()}`">{{ item.status }}</span></td><td>{{ item.ledgerAccount }}</td><td>{{ item.reference || '—' }}</td><td>{{ item.description || '—' }}</td></tr></tbody>
      </table>
      <div v-if="!visibleRows.length" class="banking-empty"><strong>{{ bankTransactions.length ? 'No matching transactions' : 'No bank transactions yet' }}</strong><p>{{ bankTransactions.length ? 'Adjust the date, account, or search filters.' : 'Add a transaction to begin tracking bank activity.' }}</p><button v-if="!bankTransactions.length" class="banking-button" type="button" @click="openEditor()">Add bank transaction</button></div>
      <footer><span>{{ visibleRows.length }} {{ visibleRows.length === 1 ? 'transaction' : 'transactions' }}</span><span>Total {{ formatMoney(totalCents) }}</span></footer>
    </div>
    <BankTransactionEditor :open="editorOpen" :record="editing" @close="editorOpen = false" @save="saveRecord" @delete="deleteRecord" />
  </section>
</template>
