<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LayoutGrid, ListFilter, Minus, Plus, Search } from '@lucide/vue'
import { formatMoney } from '../../../lib/money'
import YearlyTaxEntryEditor from './YearlyTaxEntryEditor.vue'
import { yearlyTaxConfigs, yearlyTaxRecords, type YearlyTaxFormId, type YearlyTaxRecord } from './yearlyTaxData'
import './taxForms.css'

const props = defineProps<{ formId: YearlyTaxFormId }>()
const config = computed(() => yearlyTaxConfigs[props.formId])
const query = ref('')
const draftOnly = ref(false)
const compact = ref(false)
const selectedId = ref('')
const editorOpen = ref(false)
const editing = ref<YearlyTaxRecord | null>(null)
const notice = ref('')
const rows = computed(() => yearlyTaxRecords.value.filter((record) => record.formId === props.formId))
const usedYears = computed(() => rows.value.filter((record) => record.id !== editing.value?.id).map((record) => record.year))
const visibleRows = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return rows.value.filter((record) => (!draftOnly.value || record.status === 'Draft') && (!term || [record.year, record.status, record.entry].some((value) => String(value).toLocaleLowerCase().includes(term))))
})
watch(() => props.formId, () => { selectedId.value = ''; notice.value = ''; query.value = '' })

function openEditor(record: YearlyTaxRecord | null = null) { editing.value = record; editorOpen.value = true; notice.value = '' }
function saveRecord(record: YearlyTaxRecord) {
  const index = yearlyTaxRecords.value.findIndex((item) => item.id === record.id)
  if (index >= 0) yearlyTaxRecords.value.splice(index, 1, record)
  else yearlyTaxRecords.value.push(record)
  selectedId.value = record.id
  notice.value = `${config.value.title} ${record.year} saved.`
}
function removeSelected() {
  const record = yearlyTaxRecords.value.find((item) => item.id === selectedId.value)
  if (!record || !window.confirm(`Delete the ${record.year} ${config.value.title} entry?`)) return
  yearlyTaxRecords.value = yearlyTaxRecords.value.filter((item) => item.id !== record.id)
  selectedId.value = ''
  notice.value = `${record.year} entry deleted.`
}
function displayDate(value: string) {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${month}/${day}/${year}` : '—'
}
</script>

<template>
  <section class="tax-form-page" :aria-label="config.title">
    <header class="tax-form-toolbar">
      <div class="tax-form-toolbar__title"><h2>{{ config.title }}</h2><span>Yearly tax returns</span></div>
      <div class="tax-form-toolbar__actions">
        <label class="tax-search"><Search :size="15" aria-hidden="true" /><input v-model="query" type="search" placeholder="Type to filter" :aria-label="`Search ${config.title} entries`" /></label>
        <button type="button" class="tax-icon-button" :aria-pressed="draftOnly" aria-label="Show draft entries only" @click="draftOnly = !draftOnly"><ListFilter :size="17" /></button>
        <button type="button" class="tax-icon-button" :disabled="!selectedId" aria-label="Delete selected entry" @click="removeSelected"><Minus :size="18" /></button>
        <button type="button" class="tax-icon-button tax-icon-button--primary" aria-label="Add yearly tax entry" @click="openEditor()"><Plus :size="18" /></button>
        <button type="button" class="tax-icon-button" :aria-pressed="compact" aria-label="Toggle compact rows" @click="compact = !compact"><LayoutGrid :size="18" /></button>
      </div>
    </header>
    <p v-if="notice" class="tax-notice" role="status">{{ notice }}</p>
    <div class="tax-table-wrap" :class="{ 'tax-table-wrap--compact': compact }">
      <table class="tax-table">
        <thead><tr><th>Year</th><th>Status</th><th v-if="config.amountLabel" class="tax-table__number">{{ config.amountLabel }}</th><th>Deadline</th><th v-if="config.entryLabel">{{ config.entryLabel }}</th></tr></thead>
        <tbody><tr v-for="record in visibleRows" :key="record.id" :class="{ 'tax-table__selected': selectedId === record.id }" :aria-selected="selectedId === record.id" @click="selectedId = record.id" @dblclick="openEditor(record)">
          <td><button type="button" class="tax-table__link" @click.stop="openEditor(record)">{{ record.year }}</button></td><td><span class="tax-status" :class="`tax-status--${record.status.toLocaleLowerCase()}`">{{ record.status }}</span></td><td v-if="config.amountLabel" class="tax-table__number">{{ formatMoney(record.amountCents) }}</td><td>{{ displayDate(record.deadline) }}</td><td v-if="config.entryLabel">{{ record.entry || '—' }}</td>
        </tr></tbody>
      </table>
      <div v-if="!visibleRows.length" class="tax-empty" role="status"><strong>{{ rows.length ? 'No matching entries' : 'No rows to show' }}</strong><p>{{ rows.length ? 'Clear the search or draft filter to see more entries.' : `No ${config.title} yearly entries are available.` }}</p><button type="button" class="tax-button" @click="openEditor()">Add entry</button></div>
      <footer><span>{{ visibleRows.length }} {{ visibleRows.length === 1 ? 'entry' : 'entries' }}</span><span>Yearly</span></footer>
    </div>
    <YearlyTaxEntryEditor :open="editorOpen" :form-id="formId" :record="editing" :used-years="usedYears" @close="editorOpen = false" @save="saveRecord" />
  </section>
</template>

