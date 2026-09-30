<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { CalendarDays, LayoutGrid, ListFilter, Search } from '@lucide/vue'
import AppDatePicker from '../../../components/ui/AppDatePicker.vue'
import { formatMoney } from '../../../lib/money'
import TaxCertificateEditor from './TaxCertificateEditor.vue'
import { taxCertificateRecords, type TaxCertificateId, type TaxCertificateRecord } from './taxCertificateData'
import './taxForms.css'

const props = defineProps<{ formId: TaxCertificateId }>()
const tabs = ['Draft', 'Search', 'Required Entries'] as const
type Tab = typeof tabs[number]
const activeTab = ref<Tab>('Draft')
const query = ref('')
const compact = ref(false)
const filtersOpen = ref(false)
const filterControl = ref<HTMLElement | null>(null)
const filterButton = ref<HTMLButtonElement | null>(null)
const source = ref('')
const fromDate = ref('2026-09-01')
const toDate = ref('2026-09-30')
const month = ref('September')
const year = ref(2026)
const selectedId = ref('')
const editorOpen = ref(false)
const notice = ref('')
const title = computed(() => props.formId.replace('form-', ''))
const records = computed(() => taxCertificateRecords.value.filter((record) => record.formId === props.formId))
const visibleRows = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return records.value.filter((record) => {
    const matchesQuery = !term || [record.source, record.party, record.status, record.tin].some((value) => value.toLocaleLowerCase().includes(term))
    const matchesSource = !source.value || record.source === source.value
    if (activeTab.value === 'Draft') return record.status === 'Draft' && matchesQuery && matchesSource
    if (activeTab.value === 'Search') return matchesQuery && matchesSource && (!fromDate.value || record.date >= fromDate.value) && (!toDate.value || record.date <= toDate.value)
    const targetMonth = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(`${record.date}T00:00:00`))
    return matchesQuery && matchesSource && targetMonth === month.value && record.date.startsWith(String(year.value))
  })
})
const sourceOptions = ['Purchase receipts', 'Purchase invoices', 'Sales receipts', 'Other']
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function selectTab(tab: Tab) { activeTab.value = tab; selectedId.value = ''; filtersOpen.value = false; notice.value = '' }
function saveRecord(record: TaxCertificateRecord) { taxCertificateRecords.value.push(record); selectedId.value = record.id; notice.value = `${title.value} draft created.` }
function displayDate(value: string) { const [y, m, d] = value.split('-'); return y && m && d ? `${m}/${d}/${y}` : '—' }
function closeFilters() { filtersOpen.value = false; nextTick(() => filterButton.value?.focus()) }
function resetFilters() { source.value = ''; fromDate.value = '2026-09-01'; toDate.value = '2026-09-30'; month.value = 'September'; year.value = 2026; closeFilters() }
function onOutside(event: PointerEvent) { if (filtersOpen.value && event.target instanceof Node && !filterControl.value?.contains(event.target) && !(event.target instanceof Element && event.target.closest('.ui-date-picker__panel'))) filtersOpen.value = false }
function onKeydown(event: KeyboardEvent) { if (event.key === 'Escape' && filtersOpen.value) closeFilters() }
onMounted(() => { document.addEventListener('pointerdown', onOutside); document.addEventListener('keydown', onKeydown) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', onOutside); document.removeEventListener('keydown', onKeydown) })
</script>

<template>
  <section class="tax-form-page" :aria-label="title">
    <header class="tax-certificate-toolbar">
      <div class="tax-certificate-heading"><h2>{{ title }}</h2><nav class="tax-certificate-tabs" aria-label="Certificate views"><button v-for="tab in tabs" :key="tab" type="button" :class="{ 'tax-certificate-tabs__active': activeTab === tab }" @click="selectTab(tab)">{{ tab }}</button></nav></div>
      <div class="tax-form-toolbar__actions">
        <label class="tax-search"><Search :size="15" aria-hidden="true" /><input v-model="query" type="search" placeholder="Type to filter" :aria-label="`Search ${title} certificates`" /></label>
        <div ref="filterControl" class="tax-filter-control"><button ref="filterButton" type="button" class="tax-icon-button" :aria-expanded="filtersOpen" aria-label="Open certificate filters" @click="filtersOpen = !filtersOpen"><ListFilter :size="17" /></button>
          <aside v-if="filtersOpen" class="tax-filter-popover" aria-label="Certificate filters"><strong>{{ activeTab }} filters</strong><label>Source<select v-model="source"><option value="">All sources</option><option v-for="option in sourceOptions" :key="option">{{ option }}</option></select></label><template v-if="activeTab === 'Search'"><AppDatePicker v-model="fromDate" label="From" /><AppDatePicker v-model="toDate" label="To" /></template><template v-else-if="activeTab === 'Required Entries'"><label>Month<select v-model="month"><option v-for="option in months" :key="option">{{ option }}</option></select></label><label>Year<input v-model.number="year" type="number" min="2000" max="2100" /></label></template><div><button type="button" class="tax-button" @click="resetFilters">Reset</button><button type="button" class="tax-button tax-button--primary" @click="closeFilters">Apply</button></div></aside>
        </div>
        <button type="button" class="tax-button" @click="editorOpen = true">Create tax certificate manually</button>
        <button type="button" class="tax-button" :disabled="!selectedId">Receive / send</button>
        <button type="button" class="tax-icon-button" :aria-pressed="compact" aria-label="Toggle compact rows" @click="compact = !compact"><LayoutGrid :size="18" /></button>
      </div>
    </header>
    <p v-if="notice" class="tax-notice" role="status">{{ notice }}</p>
    <div class="tax-table-wrap" :class="{ 'tax-table-wrap--compact': compact }">
      <table class="tax-table tax-certificate-table">
        <thead><tr><th>Source</th><th>Vendor/Customer</th><th v-if="activeTab !== 'Required Entries'">Status</th><th v-if="activeTab === 'Required Entries'">Date</th><th class="tax-table__number">Amount</th><th v-if="activeTab === 'Search'">Date</th><th v-if="activeTab !== 'Required Entries'">From</th><th v-if="activeTab !== 'Required Entries'">To</th><th v-if="activeTab === 'Required Entries'">TIN</th><th v-else>Signed file</th></tr></thead>
        <tbody><tr v-for="record in visibleRows" :key="record.id" :class="{ 'tax-table__selected': selectedId === record.id }" :aria-selected="selectedId === record.id" @click="selectedId = record.id"><td>{{ record.source }}</td><td>{{ record.party }}</td><td v-if="activeTab !== 'Required Entries'"><span class="tax-status" :class="`tax-status--${record.status.toLocaleLowerCase()}`">{{ record.status }}</span></td><td v-if="activeTab === 'Required Entries'">{{ displayDate(record.date) }}</td><td class="tax-table__number">{{ formatMoney(record.amountCents) }}</td><td v-if="activeTab === 'Search'">{{ displayDate(record.date) }}</td><td v-if="activeTab !== 'Required Entries'">{{ displayDate(record.fromDate) }}</td><td v-if="activeTab !== 'Required Entries'">{{ displayDate(record.toDate) }}</td><td v-if="activeTab === 'Required Entries'">{{ record.tin || '—' }}</td><td v-else>{{ record.signedFile || '—' }}</td></tr></tbody>
      </table>
      <div v-if="!visibleRows.length" class="tax-empty" role="status"><strong>No rows to show</strong><p>{{ activeTab === 'Draft' ? 'Create a certificate manually to begin.' : 'No certificates match the selected filters.' }}</p><button v-if="activeTab === 'Draft'" type="button" class="tax-button" @click="editorOpen = true">Create draft</button></div>
      <footer><span>{{ visibleRows.length }} {{ visibleRows.length === 1 ? 'certificate' : 'certificates' }}</span><span>{{ activeTab }} · {{ formatMoney(visibleRows.reduce((sum, row) => sum + row.amountCents, 0)) }}</span></footer>
    </div>
    <TaxCertificateEditor :open="editorOpen" :form-id="formId" @close="editorOpen = false" @save="saveRecord" />
  </section>
</template>
