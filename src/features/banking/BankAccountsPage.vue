<script setup lang="ts">
import { computed, ref } from 'vue'
import { LayoutGrid, ListFilter, Plus, Search } from '@lucide/vue'
import BankAccountEditor from './BankAccountEditor.vue'
import { bankAccounts, type BankAccountRecord } from './bankingData'
import './banking.css'

const query = ref('')
const activeOnly = ref(false)
const compact = ref(false)
const editorOpen = ref(false)
const editing = ref<BankAccountRecord | null>(null)
const notice = ref('')
const visibleRows = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return bankAccounts.value.filter((item) => (!activeOnly.value || item.active) && (!term || [item.name, item.bank, item.accountNumber, item.ledgerAccount].some((value) => value.toLocaleLowerCase().includes(term))))
})

function openEditor(record: BankAccountRecord | null = null) { editing.value = record; editorOpen.value = true; notice.value = '' }
function saveRecord(record: BankAccountRecord) {
  const duplicate = bankAccounts.value.some((item) => item.id !== record.id && item.accountNumber && item.accountNumber === record.accountNumber)
  if (duplicate) { window.alert('That account number is already in use.'); return }
  const index = bankAccounts.value.findIndex((item) => item.id === record.id)
  if (index >= 0) bankAccounts.value.splice(index, 1, record)
  else bankAccounts.value.push(record)
  notice.value = `${record.name} saved.`
}
function deleteRecord(record: BankAccountRecord) {
  if (!window.confirm(`Delete ${record.name}?`)) return
  bankAccounts.value = bankAccounts.value.filter((item) => item.id !== record.id)
  editorOpen.value = false
  notice.value = `${record.name} deleted.`
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
        <tbody><tr v-for="item in visibleRows" :key="item.id" @click="openEditor(item)"><td><button type="button" class="banking-table__link" @click.stop="openEditor(item)">{{ item.name }}</button></td><td>{{ item.bank || '—' }}</td><td>{{ item.accountNumber || '—' }}</td><td>{{ item.ledgerAccount }}</td><td class="banking-table__center"><input type="checkbox" :checked="item.active" disabled /></td></tr></tbody>
      </table>
      <div v-if="!visibleRows.length" class="banking-empty"><strong>{{ bankAccounts.length ? 'No matching accounts' : 'No bank accounts yet' }}</strong><p>{{ bankAccounts.length ? 'Try another search or clear the active filter.' : 'Add an account to start recording bank activity.' }}</p><button v-if="!bankAccounts.length" class="banking-button" type="button" @click="openEditor()">Add bank account</button></div>
      <footer><span>{{ visibleRows.length }} {{ visibleRows.length === 1 ? 'account' : 'accounts' }}</span></footer>
    </div>
    <BankAccountEditor :open="editorOpen" :record="editing" @close="editorOpen = false" @save="saveRecord" @delete="deleteRecord" />
  </section>
</template>
