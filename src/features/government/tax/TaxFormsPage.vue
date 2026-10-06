<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LayoutGrid, ListFilter, Minus, Plus, Search } from '@lucide/vue'
import { formatMoney } from '../../../lib/money'
import { confirmAction } from '../../../services/dialogService'
import { taxFormRepository } from '../../../services/previewRepositories'
import { useRecordWorkspace } from '../../../services/useRecordWorkspace'
import { useAuth } from '../../auth/authStore'
import { usePermissions } from '../../auth/permissions'
import { exportTaxForms } from './taxExports'
import TaxEntryEditor from './TaxEntryEditor.vue'
import { taxFormConfigs, taxFormRecords, type TaxFormId, type TaxFormRecord } from './taxFormData'
import './taxForms.css'

const props = defineProps<{ formId: TaxFormId }>()
const config = computed(() => taxFormConfigs[props.formId])
const persistence = useRecordWorkspace(taxFormRepository, taxFormRecords)
const { loading, busy, error } = persistence
const permissions = usePermissions(useAuth().authUser)
const canCreate = computed(() => permissions.can('Government', 'create') && !loading.value && !busy.value)
const canEdit = computed(() => permissions.can('Government', 'edit') && !loading.value && !busy.value)
const canDelete = computed(() => permissions.can('Government', 'delete') && !loading.value && !busy.value)
const yearInput = ref(new Date().getFullYear())
const loadedYear = ref(new Date().getFullYear())
const query = ref('')
const draftOnly = ref(false)
const compact = ref(false)
const selectedId = ref('')
const editorOpen = ref(false)
const editing = ref<TaxFormRecord | null>(null)
const notice = ref('')
const rows = computed(() => taxFormRecords.value.filter((record) => record.formId === props.formId && record.year === loadedYear.value))
const usedPeriods = computed(() => rows.value.filter((record) => record.id !== editing.value?.id).map((record) => record.period))
const visibleRows = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return rows.value.filter((record) => (!draftOnly.value || record.status === 'Draft') && (!term || [record.status, record.period, record.entry, config.value.rowCode].some((value) => value.toLocaleLowerCase().includes(term))))
})
watch(() => props.formId, () => { selectedId.value = ''; notice.value = ''; query.value = '' })

function loadYear() {
  const year = Number(yearInput.value)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) { notice.value = 'Enter a year from 2000 to 2100.'; return }
  loadedYear.value = year
  selectedId.value = ''
  notice.value = `Loaded ${year}.`
}
function openEditor(record: TaxFormRecord | null = null) { if (record ? !canEdit.value : !canCreate.value) return; editing.value = record; editorOpen.value = true; notice.value = ''; error.value = '' }
async function saveRecord(record: TaxFormRecord) {
  const saved = await persistence.save(record)
  if (!saved) return
  selectedId.value = saved.id
  editorOpen.value = false
  notice.value = `${config.value.title} ${record.period} saved.`
}
async function removeSelected() {
  const record = taxFormRecords.value.find((item) => item.id === selectedId.value)
  if (!record || !canDelete.value || !await confirmAction({ title: 'Delete tax entry?', message: `The ${record.period} ${config.value.title} entry will be removed.`, confirmLabel: 'Delete', destructive: true })) return
  if (!await persistence.remove(record)) return
  selectedId.value = ''
  notice.value = `${record.period} entry deleted.`
}
function displayDate(value: string) {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${month}/${day}/${year}` : '—'
}
</script>

<template>
  <section class="tax-form-page" :aria-label="config.title">
    <header class="tax-form-toolbar">
      <div class="tax-form-toolbar__title"><h2>{{ config.title }}</h2><span>{{ config.cadence }} tax returns</span></div>
      <div class="tax-form-toolbar__actions">
        <label class="tax-year"><span>Year</span><input v-model.number="yearInput" type="number" min="2000" max="2100" @keydown.enter="loadYear" /></label>
        <button type="button" class="tax-button" @click="loadYear">Load</button>
        <label class="tax-search"><Search :size="15" aria-hidden="true" /><input v-model="query" type="search" placeholder="Type to filter" :aria-label="`Search ${config.title} entries`" /></label>
        <button type="button" class="tax-icon-button" :aria-pressed="draftOnly" aria-label="Show draft entries only" @click="draftOnly = !draftOnly"><ListFilter :size="17" /></button>
        <button type="button" class="tax-button" :disabled="loading || busy || Boolean(error)" @click="exportTaxForms(formId, visibleRows)">Export CSV</button>
        <button type="button" class="tax-icon-button" :disabled="!selectedId || !canDelete" aria-label="Delete selected entry" @click="removeSelected"><Minus :size="18" /></button>
        <button type="button" class="tax-icon-button tax-icon-button--primary" :disabled="!canCreate" aria-label="Add tax entry" @click="openEditor()"><Plus :size="18" /></button>
        <button type="button" class="tax-icon-button" :aria-pressed="compact" aria-label="Toggle compact rows" @click="compact = !compact"><LayoutGrid :size="18" /></button>
      </div>
    </header>
    <p v-if="notice" class="tax-notice" role="status">{{ notice }}</p>
    <p v-if="loading" class="tax-notice" role="status">Loading records…</p>
    <p v-if="error" class="tax-entry-editor__error" role="alert">{{ error }} <button type="button" class="tax-button" :disabled="busy" @click="persistence.load">Reload</button></p>
    <div class="tax-table-wrap" :class="{ 'tax-table-wrap--compact': compact }">
      <table class="tax-table">
        <thead><tr><th>Form</th><th>Status</th><th>{{ config.cadence === 'Monthly' ? 'Month' : 'Quarter' }}</th><th v-if="config.hasTaxDue" class="tax-table__number">Tax due</th><th v-if="config.hasAmendment" class="tax-table__center">Amendment?</th><th>Due date</th><th v-if="config.entryLabel">{{ config.entryLabel }}</th></tr></thead>
        <tbody><tr v-for="record in visibleRows" :key="record.id" :class="{ 'tax-table__selected': selectedId === record.id }" :aria-selected="selectedId === record.id" @click="selectedId = record.id" @dblclick="openEditor(record)">
          <td><button type="button" class="tax-table__link" @click.stop="openEditor(record)">{{ config.rowCode }}</button></td>
          <td><span class="tax-status" :class="`tax-status--${record.status.toLocaleLowerCase()}`">{{ record.status }}</span></td>
          <td>{{ record.period }}</td>
          <td v-if="config.hasTaxDue" class="tax-table__number">{{ formatMoney(record.taxDueCents) }}</td>
          <td v-if="config.hasAmendment" class="tax-table__center"><input type="checkbox" :checked="record.amendment" disabled /></td>
          <td>{{ displayDate(record.dueDate) }}</td><td v-if="config.entryLabel">{{ record.entry || '—' }}</td>
        </tr></tbody>
      </table>
      <div v-if="!loading && !error && !visibleRows.length" class="tax-empty" role="status"><strong>{{ rows.length ? 'No matching entries' : 'No rows to show' }}</strong><p>{{ rows.length ? 'Clear the search or draft filter to see more entries.' : `No ${config.title} entries are available for ${loadedYear}.` }}</p><button v-if="canCreate" type="button" class="tax-button" @click="openEditor()">Add entry</button></div>
      <footer><span>{{ visibleRows.length }} {{ visibleRows.length === 1 ? 'entry' : 'entries' }}</span><span>{{ config.cadence }} · {{ loadedYear }}</span></footer>
    </div>
    <TaxEntryEditor :open="editorOpen" :busy="busy" :server-error="error" :form-id="formId" :year="loadedYear" :record="editing" :used-periods="usedPeriods" @close="editorOpen = false" @save="saveRecord" />
  </section>
</template>
