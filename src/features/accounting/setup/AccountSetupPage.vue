<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, ChevronRight, LayoutGrid, ListFilter, Plus, Search } from '@lucide/vue'
import { confirmAction, showAlert } from '../../../services/dialogService'
import { errorMessage } from '../../../services/api/errors'
import { useCollections } from '../../../services/collectionStore'
import { isPreviewMode } from '../../../services/api/config'
import { useAuth } from '../../auth/authStore'
import { usePermissions } from '../../auth/permissions'
import AccountSetupEditor from './AccountSetupEditor.vue'
import { accountStore, categoryStore, accounts, categories, categoryName, type Account, type AccountCategory } from './accountSetupData'
import './accountSetup.css'

const props = defineProps<{ pageId: 'chart-of-accounts' | 'account-categories' }>()
const { loading, error: loadError, retry } = useCollections(accountStore, categoryStore)
const { authUser } = useAuth()
const { can } = usePermissions(authUser)
const busy = ref(false)
const saveError = ref('')
const canSave = computed(() => can('Accounting', editing.value ? 'edit' : 'create'))
const canDelete = computed(() => can('Accounting', 'delete'))
type Tab = 'accounts' | 'tree' | 'mapping'
type TreeRow = { key: string; code: string; name: string; depth: number; group: boolean; expandable: boolean }
const tab = ref<Tab>('accounts')
const search = ref('')
const activeOnly = ref(false)
const compact = ref(false)
const expanded = ref<string[]>([])
const editorOpen = ref(false)
const editing = ref<Account | AccountCategory | null>(null)
const isCategories = computed(() => props.pageId === 'account-categories')
const title = computed(() => isCategories.value ? 'Account Categories' : tab.value === 'mapping' ? 'Account Mapping' : 'Chart of Accounts')
const filterText = computed(() => search.value.trim().toLocaleLowerCase())
const visibleAccounts = computed(() => accounts.value.filter((item) => (!activeOnly.value || item.active) && (!filterText.value || [item.code, item.name, item.type, categoryName(item.parentCode), item.remarks, item.itr, item.legalBasis].some((field) => field.toLocaleLowerCase().includes(filterText.value)))).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })))
const referenceCategoryOrder = ['CAP', 'CCE', 'COS', 'CUA', 'CUL', 'CR', 'FE', 'IT', 'IA', 'I', 'LTI']
const visibleCategories = computed(() => categories.value.filter((item) => (!activeOnly.value || item.active) && (!filterText.value || [item.code, item.name, categoryName(item.parentCode), item.remarks, item.accountType ?? ''].some((field) => field.toLocaleLowerCase().includes(filterText.value)))).sort((a, b) => {
  const aRank = referenceCategoryOrder.indexOf(a.code)
  const bRank = referenceCategoryOrder.indexOf(b.code)
  if (aRank >= 0 || bRank >= 0) return (aRank >= 0 ? aRank : Infinity) - (bRank >= 0 ? bRank : Infinity)
  return a.code.localeCompare(b.code)
}))
const treeRows = computed<TreeRow[]>(() => {
  const rows: TreeRow[] = []
  function append(parentCode: string, depth: number) {
    for (const category of categories.value.filter((item) => item.parentCode === parentCode)) {
      const hasChildren = categories.value.some((item) => item.parentCode === category.code) || accounts.value.some((item) => item.parentCode === category.code)
      rows.push({ key: `c-${category.code}`, code: category.code, name: category.name, depth, group: true, expandable: hasChildren })
      if (!expanded.value.includes(category.code)) continue
      append(category.code, depth + 1)
      for (const account of accounts.value.filter((item) => item.parentCode === category.code).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))) {
        rows.push({ key: `a-${account.code}`, code: account.code, name: account.name, depth: depth + 1, group: false, expandable: false })
      }
    }
  }
  append('', 0)
  return rows
})

function openEditor(record: Account | AccountCategory | null = null) { if (loading.value || loadError.value) return; editing.value = record; saveError.value = ''; editorOpen.value = true }
async function persist(operation: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  saveError.value = ''
  try { await operation(); editorOpen.value = false }
  catch (cause) { saveError.value = errorMessage(cause, 'The record could not be saved. Your draft is still here.') }
  finally { busy.value = false }
}
async function saveAccount(record: Account) {
  if (canSave.value) await persist(() => accountStore.save(record))
}
async function saveCategory(record: AccountCategory) {
  if (canSave.value) await persist(() => categoryStore.save(record))
}
async function removeRecord() {
  const record = editing.value
  if (!record || busy.value || !canDelete.value) return
  if (isCategories.value && (categories.value.some((item) => item.parentCode === record.code) || accounts.value.some((item) => item.parentCode === record.code))) {
    await showAlert({ title: 'Category is in use', message: 'Move or remove child categories and accounts before deleting this category.' })
    return
  }
  if (!await confirmAction({ title: 'Delete account record?', message: `${record.code} · ${record.name} will be removed from your company records.`, confirmLabel: 'Delete', destructive: true })) return
  await persist(() => isCategories.value ? categoryStore.remove(record.id, record.version) : accountStore.remove(record.id, record.version))
}
function refresh() { void Promise.all([accountStore.reload(), categoryStore.reload()]) }
function toggleExpanded(code: string) { expanded.value = expanded.value.includes(code) ? expanded.value.filter((item) => item !== code) : [...expanded.value, code] }
</script>

<template>
  <section class="setup-page" :aria-label="isCategories ? 'Account Categories' : 'Chart of Accounts'">
    <header class="setup-toolbar">
      <nav v-if="!isCategories" class="setup-tabs" aria-label="Chart of Accounts views">
        <button v-for="item in ([['accounts', 'Accounts'], ['tree', 'Account Tree View'], ['mapping', 'Mapping']] as const)" :key="item[0]" type="button" :class="{ 'setup-tabs__active': tab === item[0] }" :aria-current="tab === item[0] ? 'page' : undefined" @click="tab = item[0]">{{ item[1] }}</button>
      </nav>
      <div v-if="isCategories || tab !== 'tree'" class="setup-toolbar__actions">
        <label class="setup-search"><Search :size="15" aria-hidden="true" /><input v-model="search" type="search" :aria-label="`Search ${title}`" placeholder="Type to filter" /></label>
        <button type="button" class="setup-icon-button" :aria-pressed="activeOnly" :title="activeOnly ? 'Show all records' : 'Show active only'" aria-label="Toggle active filter" @click="activeOnly = !activeOnly"><ListFilter :size="17" /></button>
        <button type="button" class="setup-button" :disabled="loading || busy || editorOpen" @click="refresh">Reload</button>
        <button v-if="can('Accounting', 'create')" type="button" class="setup-button setup-button--primary" :disabled="loading || Boolean(loadError) || busy" @click="openEditor()"><Plus :size="16" aria-hidden="true" /> New {{ isCategories ? 'category' : 'account' }}</button>
        <button type="button" class="setup-icon-button" :aria-pressed="compact" title="Toggle compact rows" aria-label="Toggle compact rows" @click="compact = !compact"><LayoutGrid :size="18" /></button>
      </div>
    </header>
    <p v-if="loading" class="setup-empty" role="status">Loading company records…</p>
    <div v-else-if="loadError" class="setup-empty" role="alert"><p>{{ loadError }}</p><button type="button" class="setup-button" @click="retry">Retry</button></div>
    <div v-else-if="!isCategories && tab === 'tree'" class="setup-tree" role="tree" aria-label="Account tree">
      <div v-for="row in treeRows" :key="row.key" class="setup-tree__row" :class="{ 'setup-tree__row--account': !row.group }" :style="{ paddingLeft: `${20 + row.depth * 28}px` }" role="treeitem" :aria-level="row.depth + 1" :aria-expanded="row.group && row.expandable ? expanded.includes(row.code) : undefined">
        <button v-if="row.group && row.expandable" type="button" class="setup-tree__expand" :aria-label="`${expanded.includes(row.code) ? 'Collapse' : 'Expand'} ${row.name}`" @click="toggleExpanded(row.code)"><ChevronDown v-if="expanded.includes(row.code)" :size="15" /><ChevronRight v-else :size="15" /></button>
        <span v-else class="setup-tree__spacer" />
        <span class="setup-tree__code">{{ row.code }}</span><span>{{ row.name }}</span>
      </div>
      <p v-if="!treeRows.length" class="setup-empty">No categories to show.</p>
    </div>
    <div v-else class="setup-table-area" :class="{ 'setup-table-area--compact': compact }">
      <div class="setup-table-area__scroll"><table class="setup-table"><thead><tr>
        <th scope="col">Code</th><th scope="col">Name</th>
        <template v-if="isCategories"><th scope="col">Parent</th><th scope="col">Remarks</th></template>
        <template v-else-if="tab === 'mapping'"><th scope="col">Account Type</th><th scope="col">ITR</th><th scope="col">Legal Basis</th></template>
        <template v-else><th scope="col">Parent</th><th scope="col">Account Type</th><th scope="col">Remarks</th></template>
        <th scope="col">Active</th>
      </tr></thead><tbody>
        <tr v-for="item in (isCategories ? visibleCategories : visibleAccounts)" :key="item.code">
          <td><button type="button" class="setup-table__link" :aria-label="`Edit ${item.name}`" @click="openEditor(item)">{{ item.code }}</button></td><td>{{ item.name }}</td>
          <template v-if="isCategories"><td>{{ categoryName(item.parentCode) }}</td><td>{{ item.remarks }}</td></template>
          <template v-else-if="tab === 'mapping'"><td>{{ 'type' in item ? item.type : '' }}</td><td>{{ 'itr' in item ? item.itr : '' }}</td><td>{{ 'legalBasis' in item ? item.legalBasis : '' }}</td></template>
          <template v-else><td>{{ categoryName(item.parentCode) }}</td><td>{{ 'type' in item ? item.type : '' }}</td><td>{{ item.remarks }}</td></template>
          <td><input type="checkbox" :checked="item.active" disabled :aria-label="`${item.name} ${item.active ? 'active' : 'inactive'}`" /></td>
        </tr>
      </tbody></table><p v-if="!(isCategories ? visibleCategories : visibleAccounts).length" class="setup-empty">{{ !isPreviewMode && !categories.length ? 'Your company has no account categories yet. Create a category first, then add accounts.' : 'No matching records.' }}</p></div>
      <footer class="setup-table-area__footer"><span>{{ (isCategories ? visibleCategories : visibleAccounts).length }} {{ isCategories ? 'categories' : 'accounts' }}</span></footer>
    </div>
    <AccountSetupEditor :open="editorOpen" :kind="isCategories ? 'category' : 'account'" :record="editing" :busy="busy" :server-error="saveError" :can-save="canSave" :can-delete="canDelete" @close="editorOpen = false" @save-account="saveAccount" @save-category="saveCategory" @delete="removeRecord" />
  </section>
</template>
