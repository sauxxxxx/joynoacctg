<script setup lang="ts">
import AppDataState from '../../../components/ui/AppDataState.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { LayoutGrid, ListFilter, Search } from '@lucide/vue'
import AppDatePicker from '../../../components/ui/AppDatePicker.vue'
import AppSelect from '../../../components/ui/AppSelect.vue'
import { formatMoney } from '../../../lib/money'
import TaxCertificateEditor from './TaxCertificateEditor.vue'
import { taxCertificateRecords, type TaxCertificateId, type TaxCertificateRecord } from './taxCertificateData'
import { taxCertificateRepository } from '../../../services/previewRepositories'
import { recordAudit } from '../../company/companyStore'
import { useRecordWorkspace } from '../../../services/useRecordWorkspace'
import { useAuth } from '../../auth/authStore'
import { usePermissions } from '../../auth/permissions'
import { confirmAction } from '../../../services/dialogService'
import { exportTaxCertificates } from './taxExports'
import './taxForms.css'

const props = defineProps<{ formId: TaxCertificateId }>()
const persistence = useRecordWorkspace(taxCertificateRepository, taxCertificateRecords)
const { loading, busy, error } = persistence
const permissions = usePermissions(useAuth().authUser)
const canCreate = computed(() => permissions.can('Government', 'create') && !loading.value && !busy.value)
const canEdit = computed(() => permissions.can('Government', 'edit') && !loading.value && !busy.value)
const canDelete = computed(() => permissions.can('Government', 'delete') && !loading.value && !busy.value)
const tabs = ['Draft', 'Search', 'By Month'] as const
type Tab = typeof tabs[number]
const activeTab = ref<Tab>('Draft')
const query = ref('')
const compact = ref(false)
const filtersOpen = ref(false)
const filterControl = ref<HTMLElement | null>(null)
const filterButton = ref<HTMLButtonElement | null>(null)
const source = ref('')
const today = new Date()
const currentMonth = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(today)
const currentRange = { from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, to: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()).padStart(2, '0')}` }
const fromDate = ref(currentRange.from)
const toDate = ref(currentRange.to)
const month = ref(currentMonth)
const year = ref(today.getFullYear())
const selectedId = ref('')
const editorOpen = ref(false)
const editing = ref<TaxCertificateRecord | null>(null)
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
const sourceSelectOptions = [{ value: '', label: 'All sources' }, ...sourceOptions.map((value) => ({ value, label: value }))]
const monthOptions = months.map((value) => ({ value, label: value }))

function selectTab(tab: Tab) { activeTab.value = tab; selectedId.value = ''; filtersOpen.value = false; notice.value = '' }
function openEditor(record: TaxCertificateRecord | null = null) {
  if (record ? !canEdit.value : !canCreate.value) return
  editing.value = record; error.value = ''; editorOpen.value = true
}
async function saveRecord(record: TaxCertificateRecord) {
  const saved = await persistence.save(record)
  if (!saved) return
  selectedId.value = saved.id; editorOpen.value = false; notice.value = `${title.value} certificate saved.`
}
function displayDate(value: string) { const [y, m, d] = value.split('-'); return y && m && d ? `${m}/${d}/${y}` : '—' }
function closeFilters() { filtersOpen.value = false; nextTick(() => filterButton.value?.focus()) }
function resetFilters() { source.value = ''; fromDate.value = currentRange.from; toDate.value = currentRange.to; month.value = currentMonth; year.value = today.getFullYear(); closeFilters() }
async function receiveOrSend() {
  const index = taxCertificateRecords.value.findIndex((record) => record.id === selectedId.value)
  if (index < 0 || !canEdit.value) return
  const record = taxCertificateRecords.value[index]
  if (record.status === 'Sent') return
  const status = record.status === 'Draft' ? 'Received' : 'Sent'
  if (!await persistence.save({ ...record, status })) return
  recordAudit('Government', status, title.value, `${record.party} · ${record.date}`)
  notice.value = `${title.value} marked as ${status.toLocaleLowerCase()}.`
}
async function removeSelected() {
  const record = records.value.find((item) => item.id === selectedId.value)
  if (!record || !canDelete.value || record.status !== 'Draft') return
  if (!await confirmAction({ title: 'Delete certificate draft?', message: `${record.party}'s draft will be removed.`, confirmLabel: 'Delete', destructive: true })) return
  if (await persistence.remove(record)) { selectedId.value = ''; notice.value = 'Draft deleted.' }
}
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
          <aside v-if="filtersOpen" class="tax-filter-popover" aria-label="Certificate filters"><strong>{{ activeTab }} filters</strong><AppSelect v-model="source" label="Source" :options="sourceSelectOptions" /><template v-if="activeTab === 'Search'"><AppDatePicker v-model="fromDate" label="From" /><AppDatePicker v-model="toDate" label="To" /></template><template v-else-if="activeTab === 'By Month'"><AppSelect v-model="month" label="Month" :options="monthOptions" /><label>Year<input v-model.number="year" type="number" min="2000" max="2100" /></label></template><div><button type="button" class="tax-button" @click="resetFilters">Reset</button><button type="button" class="tax-button tax-button--primary" @click="closeFilters">Apply</button></div></aside>
        </div>
        <button type="button" class="tax-button" :disabled="loading || busy || Boolean(error)" @click="exportTaxCertificates(formId, visibleRows)">Export CSV</button>
        <button type="button" class="tax-button" :disabled="!canCreate" @click="openEditor()">Record certificate</button>
        <button type="button" class="tax-button" :disabled="!selectedId || !canEdit || records.find(row => row.id === selectedId)?.status === 'Sent'" @click="receiveOrSend">Mark received / sent</button>
        <button type="button" class="tax-button" :disabled="!selectedId || !canDelete || records.find(row => row.id === selectedId)?.status !== 'Draft'" @click="removeSelected">Delete draft</button>
        <button type="button" class="tax-icon-button" :aria-pressed="compact" aria-label="Toggle compact rows" @click="compact = !compact"><LayoutGrid :size="18" /></button>
      </div>
    </header>
    <p v-if="notice" class="tax-notice" role="status">{{ notice }}</p>
    <AppDataState :loading="loading" :error="error" :empty="!visibleRows.length" label="Tax certificates" empty-title="No records in this view" empty-message="Try another period or filter, or add your first record." :action-label="canCreate ? 'Add record' : undefined" @action="openEditor()" @retry="persistence.load">
    <div class="tax-table-wrap" :class="{ 'tax-table-wrap--compact': compact }">
      <table class="tax-table tax-certificate-table">
        <thead><tr><th>Source</th><th>Vendor/Customer</th><th>Status</th><th class="tax-table__number">Amount</th><th>Date</th><th>From</th><th>To</th><th>TIN</th><th>Signed file reference</th></tr></thead>
        <tbody><tr v-for="record in visibleRows" :key="record.id" :class="{ 'tax-table__selected': selectedId === record.id }" :aria-selected="selectedId === record.id" @click="selectedId = record.id"><td>{{ record.source }}</td><td><button type="button" class="tax-table__link" :disabled="!canEdit" @click.stop="openEditor(record)">{{ record.party }}</button></td><td><span class="tax-status" :class="`tax-status--${record.status.toLocaleLowerCase()}`">{{ record.status }}</span></td><td class="tax-table__number">{{ formatMoney(record.amountCents) }}</td><td>{{ displayDate(record.date) }}</td><td>{{ displayDate(record.fromDate) }}</td><td>{{ displayDate(record.toDate) }}</td><td>{{ record.tin || '—' }}</td><td>{{ record.signedFile || '—' }}</td></tr></tbody>
      </table>
      <footer><span>{{ visibleRows.length }} {{ visibleRows.length === 1 ? 'certificate' : 'certificates' }}</span><span>{{ activeTab }} · {{ formatMoney(visibleRows.reduce((sum, row) => sum + row.amountCents, 0)) }}</span></footer>
    </div>
    </AppDataState>
    <TaxCertificateEditor :open="editorOpen" :record="editing" :busy="busy" :server-error="error" :form-id="formId" @close="editorOpen = false" @save="saveRecord" />
  </section>
</template>
