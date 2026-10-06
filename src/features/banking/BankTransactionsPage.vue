<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Filter, LayoutGrid, Plus, Search } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import AppDataState from '../../components/ui/AppDataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { formatMoney } from '../../lib/money'
import { useRepositoryList } from '../../lib/useRepositoryList'
import { useSubmit } from '../../lib/useSubmit'
import { http } from '../../services/api/httpClient'
import { useAuth } from '../auth/authStore'
import { usePermissions } from '../auth/permissions'
import { useCollections } from '../../services/collectionStore'
import { confirmAction, showAlert } from '../../services/dialogService'
import { accountName, accountStore } from '../accounting/setup/accountSetupData'
import { describeJournalResult, journalOperations } from '../accounting/journals/journalOperations'
import BankTransactionEditor from './BankTransactionEditor.vue'
import { bankAccountName, bankAccounts, bankAccountStore, bankTransactionRepository, type BankTransactionRecord } from './bankingData'
import './banking.css'

type TransactionTab = 'search' | 'unjournalized'
const tab = ref<TransactionTab>('search')
const query = ref('')
const compact = ref(false)
const filterOpen = ref(false)
const from = ref('')
const to = ref('')
const accountId = ref('')
const editorOpen = ref(false)
const editing = ref<BankTransactionRecord | null>(null)
const selectedIds = ref<string[]>([])
const notice = ref('')
const journalize = useSubmit()
const mutation = useSubmit()
const { authUser } = useAuth()
const { can } = usePermissions(authUser)
const canJournalize = computed(() => can('Banking', 'edit') && can('Accounting', 'create') && can('Accounting', 'edit'))
const canVoid = computed(() => can('Banking', 'edit') && can('Accounting', 'edit'))
const bankAccountOptions = computed(() => [{ value: '', label: 'All accounts' }, ...bankAccounts.value.map((account) => ({ value: account.id, label: account.name }))])
const filtered = computed(() => Boolean(query.value || from.value || to.value || accountId.value))

const references = useCollections(accountStore, bankAccountStore)
const list = useRepositoryList(bankTransactionRepository, () => ({
  search: query.value,
  filters: { status: tab.value === 'unjournalized' ? 'Draft' as const : undefined, from: from.value || undefined, to: to.value || undefined, bankAccountId: accountId.value || undefined },
}))
const rows = computed(() => list.items.value)
watch(rows, (visible) => { selectedIds.value = selectedIds.value.filter((id) => visible.some((item) => item.id === id)) })
const selectedAll = computed(() => rows.value.length > 0 && rows.value.every((item) => selectedIds.value.includes(item.id)))

function openEditor(record: BankTransactionRecord | null = null) {
  if (mutation.pending.value || journalize.pending.value || (!record && (!can('Banking', 'create') || references.loading.value || references.error.value))) return
  editing.value = record; editorOpen.value = true; notice.value = ''
}
async function saveRecord(record: BankTransactionRecord) {
  const saved = await bankTransactionRepository.save(record)
  notice.value = `Bank transaction ${saved.reference || saved.purpose} saved.`
  void list.reload()
}
async function deleteRecord(record: BankTransactionRecord) {
  if (!can('Banking', 'delete') || mutation.pending.value || record.status !== 'Draft') return
  if (!await confirmAction({ title: 'Delete bank transaction?', message: `${record.reference || record.purpose} will be deleted.`, confirmLabel: 'Delete', destructive: true })) return
  if (!await mutation.run(() => bankTransactionRepository.remove(record.id, record.version))) {
    await showAlert({ title: 'Bank transaction not deleted', message: mutation.error.value })
    return
  }
  selectedIds.value = selectedIds.value.filter((id) => id !== record.id)
  editorOpen.value = false
  notice.value = 'Bank transaction deleted.'
  void list.reload()
}
async function voidRecord(record: BankTransactionRecord) {
  if (!canVoid.value || mutation.pending.value || record.status !== 'Journalized') return
  if (!await confirmAction({ title: 'Void bank transaction?', message: 'This transaction and its journal will be marked voided and excluded from financial totals. The original records will be preserved.', confirmLabel: 'Void transaction', destructive: true })) return
  if (!await mutation.run(() => http.post(`/bank-transactions/${encodeURIComponent(record.id)}/void`, { expectedVersion: record.version }))) {
    await showAlert({ title: 'Transaction not voided', message: mutation.error.value })
    return
  }
  editorOpen.value = false
  notice.value = 'Bank transaction and related journal voided.'
  void list.reload()
}
function toggleAll() { selectedIds.value = selectedAll.value ? [] : rows.value.map((item) => item.id) }
async function createJournals() {
  if (!canJournalize.value || !selectedIds.value.length || mutation.pending.value || journalize.pending.value) return
  if (!await confirmAction({ title: 'Create and post journals?', message: 'Each selected bank transaction will create a posted journal and become read-only. Check the dates, accounts and amounts before continuing.', confirmLabel: 'Create journals' })) return
  notice.value = ''
  let message = ''
  const done = await journalize.run(async () => {
    message = describeJournalResult(await journalOperations.createFromBankTransactions(selectedIds.value))
  }, 'The selected transactions could not be journalized.')
  notice.value = done ? message : journalize.error.value
  if (done) selectedIds.value = []
  void list.reload()
}
function clearFilters() { from.value = ''; to.value = ''; accountId.value = ''; filterOpen.value = false }
</script>

<template>
  <section class="banking-page" aria-label="Bank transactions">
    <header class="banking-toolbar banking-toolbar--tabs">
      <nav class="banking-tabs" aria-label="Bank transaction views"><button type="button" :class="{ 'banking-tabs__active': tab === 'search' }" @click="tab = 'search'">Search</button><button type="button" :class="{ 'banking-tabs__active': tab === 'unjournalized' }" @click="tab = 'unjournalized'">Unjournalized</button></nav>
      <div class="banking-toolbar__actions">
        <label class="banking-search"><Search :size="15" /><input v-model="query" type="search" placeholder="Type to filter" aria-label="Search bank transactions" /></label>
        <div class="banking-filter-control"><button class="banking-icon" type="button" :aria-expanded="filterOpen" aria-label="Filter bank transactions" @click="filterOpen = !filterOpen"><Filter :size="17" /></button><div v-if="filterOpen" class="banking-filter-popover"><strong>Filter transactions</strong><AppDatePicker v-model="from" label="From" /><AppDatePicker v-model="to" label="To" /><AppSelect v-model="accountId" label="Bank account" :options="bankAccountOptions" /><div><button class="banking-button" type="button" @click="clearFilters">Clear</button><button class="banking-button banking-button--primary" type="button" @click="filterOpen = false">Apply</button></div></div></div>
        <button v-if="tab === 'unjournalized' && canJournalize" class="banking-button" type="button" :disabled="!selectedIds.length || journalize.pending.value || mutation.pending.value" @click="createJournals">{{ journalize.pending.value ? 'Creating…' : 'Create journal' }}</button>
        <button v-if="can('Banking', 'create')" class="banking-button banking-button--primary" type="button" :disabled="references.loading.value || Boolean(references.error.value) || journalize.pending.value" @click="openEditor()"><Plus :size="16" /> New transaction</button>
        <button class="banking-icon" type="button" :aria-pressed="compact" aria-label="Toggle compact rows" @click="compact = !compact"><LayoutGrid :size="18" /></button>
      </div>
    </header>
    <div class="banking-heading-row"><div><h2>{{ tab === 'search' ? 'Bank transactions' : 'Unjournalized bank transactions' }}</h2><span>{{ tab === 'search' ? 'Review recorded bank activity' : 'Select draft transactions to create a journal entry' }}</span></div></div>
    <p v-if="notice" class="banking-notice" role="status">{{ notice }}</p>
    <AppDataState :loading="list.status.value === 'loading' || references.loading.value" :error="list.error.value || references.error.value" :empty="!rows.length" label="Bank transactions" :empty-title="filtered ? 'No matching transactions' : tab === 'unjournalized' ? 'No draft transactions' : 'No bank transactions yet'" empty-message="Try another search or filter, or add a record when ready." :action-label="!filtered && tab === 'search' && can('Banking', 'create') ? 'Add bank transaction' : undefined" @action="openEditor()" @retry="list.reload(); references.retry()">
    <div class="banking-table-wrap" :class="{ 'banking-table-wrap--compact': compact }">
      <table class="banking-table banking-table--transactions"><thead><tr><th v-if="tab === 'unjournalized'" class="banking-table__check"><input type="checkbox" :checked="selectedAll" aria-label="Select all transactions on this page" @change="toggleAll" /></th><th>Date</th><th>Bank account</th><th>Direction</th><th>Purpose</th><th>Party</th><th class="banking-table__number">Amount</th><th>Status</th><th>Account</th><th>Reference</th><th>Description</th></tr></thead>
        <tbody v-if="list.status.value === 'ready'"><tr v-for="item in rows" :key="item.id" @click="openEditor(item)"><td v-if="tab === 'unjournalized'" class="banking-table__check" @click.stop><input v-model="selectedIds" type="checkbox" :value="item.id" :aria-label="`Select ${item.reference || item.purpose}`" /></td><td><button type="button" class="banking-table__link" @click.stop="openEditor(item)">{{ item.date }}</button></td><td>{{ bankAccountName(item.bankAccountId) }}</td><td>{{ item.direction === 'Receipt' ? 'Money in' : 'Money out' }}</td><td>{{ item.purpose }}</td><td>{{ item.party || item.partyType }}</td><td class="banking-table__number">{{ formatMoney(item.amountCents) }}</td><td><span class="banking-status" :class="`banking-status--${item.status.toLocaleLowerCase()}`">{{ item.status }}</span></td><td>{{ accountName(item.ledgerAccountId) }}</td><td>{{ item.reference || '—' }}</td><td>{{ item.description || '—' }}</td></tr></tbody>
      </table>
      <footer><span>{{ list.totalItems.value }} {{ list.totalItems.value === 1 ? 'transaction' : 'transactions' }}</span><span>Total {{ formatMoney(list.summary.value.amountCents ?? 0) }}</span></footer>
      <AppPagination v-model:page="list.page.value" :page-size="list.pageSize" :total="list.totalItems.value" label="bank transactions" />
    </div>
    </AppDataState>
    <BankTransactionEditor :open="editorOpen" :record="editing" :save="saveRecord" :readonly="!can('Banking', editing ? 'edit' : 'create')" :can-delete="can('Banking', 'delete')" :can-void="canVoid" :busy="mutation.pending.value" @close="editorOpen = false" @delete="deleteRecord" @void="voidRecord" />
  </section>
</template>
