<script setup lang="ts">
import { ref } from 'vue'
import { LayoutGrid, ListFilter, Plus, Search } from '@lucide/vue'
import AppLoadState from '../../components/ui/AppLoadState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { useRepositoryList } from '../../lib/useRepositoryList'
import { errorMessage } from '../../services/api/errors'
import { useCollections } from '../../services/collectionStore'
import { confirmAction, showAlert } from '../../services/dialogService'
import { accountName, accountStore } from '../accounting/setup/accountSetupData'
import BankAccountEditor from './BankAccountEditor.vue'
import { bankAccountStore, type BankAccountRecord } from './bankingData'
import './banking.css'

const query = ref('')
const activeOnly = ref(false)
const compact = ref(false)
const editorOpen = ref(false)
const editing = ref<BankAccountRecord | null>(null)
const notice = ref('')
useCollections(accountStore)
const list = useRepositoryList(bankAccountStore.repository, () => ({ search: query.value, filters: { active: activeOnly.value || undefined } }))

function openEditor(record: BankAccountRecord | null = null) { editing.value = record; editorOpen.value = true; notice.value = '' }
async function saveRecord(record: BankAccountRecord) {
  const saved = await bankAccountStore.save(record)
  notice.value = `${saved.name} saved.`
  void list.reload()
}
async function deleteRecord(record: BankAccountRecord) {
  if (!await confirmAction({ title: 'Delete bank account?', message: `${record.name} will be deleted.`, confirmLabel: 'Delete', destructive: true })) return
  try {
    await bankAccountStore.remove(record.id, record.version)
  } catch (error) {
    await showAlert({ title: 'Bank account not deleted', message: errorMessage(error) })
    return
  }
  editorOpen.value = false
  notice.value = `${record.name} deleted.`
  void list.reload()
}
</script>

<template>
  <section class="banking-page" aria-label="Bank accounts">
    <header class="banking-toolbar">
      <div><h2>Bank accounts</h2><span>Accounts available for recording bank transactions</span></div>
      <div class="banking-toolbar__actions">
        <label class="banking-search"><Search :size="15" /><input v-model="query" type="search" placeholder="Type to filter" aria-label="Search bank accounts" /></label>
        <button class="banking-icon" type="button" :aria-pressed="activeOnly" aria-label="Show active accounts only" @click="activeOnly = !activeOnly"><ListFilter :size="17" /></button>
        <button class="banking-button banking-button--primary" type="button" @click="openEditor()"><Plus :size="16" /> New bank account</button>
        <button class="banking-icon" type="button" :aria-pressed="compact" aria-label="Toggle compact rows" @click="compact = !compact"><LayoutGrid :size="18" /></button>
      </div>
    </header>
    <p v-if="notice" class="banking-notice" role="status">{{ notice }}</p>
    <div class="banking-table-wrap" :class="{ 'banking-table-wrap--compact': compact }">
      <table class="banking-table banking-table--accounts">
        <thead><tr><th>Name</th><th>Bank</th><th>Account number</th><th>Account</th><th class="banking-table__center">Active?</th></tr></thead>
        <tbody v-if="list.status.value === 'ready'"><tr v-for="item in list.items.value" :key="item.id" @click="openEditor(item)"><td><button type="button" class="banking-table__link" @click.stop="openEditor(item)">{{ item.name }}</button></td><td>{{ item.bank || '—' }}</td><td>{{ item.accountNumber || '—' }}</td><td>{{ accountName(item.ledgerAccountId) }}</td><td class="banking-table__center"><input type="checkbox" :checked="item.active" disabled /></td></tr></tbody>
      </table>
      <AppLoadState :status="list.status.value" :error="list.error.value" label="bank accounts" @retry="list.reload" />
      <div v-if="list.status.value === 'ready' && !list.items.value.length" class="banking-empty"><strong>{{ query || activeOnly ? 'No matching accounts' : 'No bank accounts yet' }}</strong><p>{{ query || activeOnly ? 'Try another search or clear the active filter.' : 'Add an account to start recording bank activity.' }}</p><button v-if="!query && !activeOnly" class="banking-button" type="button" @click="openEditor()">Add bank account</button></div>
      <AppPagination v-model:page="list.page.value" :page-size="list.pageSize" :total="list.totalItems.value" label="bank accounts" />
    </div>
    <BankAccountEditor :open="editorOpen" :record="editing" :save="saveRecord" @close="editorOpen = false" @delete="deleteRecord" />
  </section>
</template>
