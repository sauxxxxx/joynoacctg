<script setup lang="ts">
import AppDataState from '../../components/ui/AppDataState.vue'
import { computed, ref, watch } from 'vue'
import { Download, Search } from '@lucide/vue'
import { auditRepository } from './auditLog'
import { errorMessage } from '../../services/api/errors'
import { getApiCredentials } from '../../services/api/session'
import AppSelect from '../../components/ui/AppSelect.vue'
import { downloadCsv } from '../accounting/reports/reportFormat'
import DateRangeFilter from '../workspace/DateRangeFilter.vue'
import { auditEvents, isAddOnEnabled, recordAudit } from './companyStore'
import '../workspace/workspace.css'
import './company.css'

const pageSize = 50
const search = ref('')
const module = ref('')
const action = ref('')
const allDates = { from: '', to: '' }
const range = ref({ ...allDates })
const shown = ref(pageSize)
const loading = ref(false)
const loadError = ref('')
async function load() {
  const token = getApiCredentials()?.accessToken
  loading.value = true
  loadError.value = ''
  try { const records = await auditRepository.listAll(); if (token === getApiCredentials()?.accessToken) auditEvents.value = records }
  catch (cause) { loadError.value = errorMessage(cause, 'The audit trail could not be loaded.') }
  finally { loading.value = false }
}
void load()

const localDay = (iso: string) => {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const timestamp = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'medium' })
const distinct = (key: 'module' | 'action') => [...new Set(auditEvents.value.map((event) => event[key]))].sort()
const moduleOptions = computed(() => [{ value: '', label: 'All modules' }, ...distinct('module').map((value) => ({ value, label: value }))])
const actionOptions = computed(() => [{ value: '', label: 'All actions' }, ...distinct('action').map((value) => ({ value, label: value }))])

const filtered = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return auditEvents.value.filter((event) => {
    const day = localDay(event.at)
    if (module.value && event.module !== module.value) return false
    if (action.value && event.action !== action.value) return false
    if (range.value.from && day < range.value.from) return false
    if (range.value.to && day > range.value.to) return false
    return !term || `${event.user} ${event.reference} ${event.details}`.toLocaleLowerCase().includes(term)
  })
})
const visible = computed(() => filtered.value.slice(0, shown.value))
const filtersActive = computed(() => Boolean(search.value || module.value || action.value || range.value.from || range.value.to))
watch([search, module, action, range], () => { shown.value = pageSize })

function clear() {
  search.value = ''
  module.value = ''
  action.value = ''
  range.value = { ...allDates }
}

function exportCsv() {
  downloadCsv(`audit-trail-${localDay(new Date().toISOString())}.csv`, [
    ['Timestamp', 'User', 'Module', 'Action', 'Reference', 'Details'],
    ...filtered.value.map((event) => [event.at, event.user, event.module, event.action, event.reference, event.details]),
  ])
  recordAudit('Company', 'Exported', 'Audit trail', `${filtered.value.length} events`)
}
</script>

<template>
  <section class="ws-page co-page" aria-label="Audit trail">
    <div class="ws-stack">
      <p class="co-intro">A history of changes to your company records, newest first.</p>

      <div class="ws-panel ws-panel--clip">
        <div class="ws-toolbar">
          <label class="ws-search"><Search :size="16" aria-hidden="true" /><input v-model="search" type="search" placeholder="Search reference or details" aria-label="Search audit trail" /></label>
          <div class="ws-toolbar__field"><AppSelect id="audit-module" v-model="module" aria-label="Module" :options="moduleOptions" /></div>
          <div class="ws-toolbar__field"><AppSelect id="audit-action" v-model="action" aria-label="Action" :options="actionOptions" /></div>
          <span class="ws-toolbar__spacer" />
          <DateRangeFilter v-model="range" :default-value="allDates" optional />
          <button v-if="isAddOnEnabled('report-csv-export')" class="ws-button" type="button" :disabled="loading || Boolean(loadError) || !filtered.length" @click="exportCsv"><Download :size="15" aria-hidden="true" /> Export CSV</button>
        </div>

        <AppDataState :loading="loading" :error="loadError" :empty="!visible.length" label="Activity" :empty-title="auditEvents.length ? 'No matching activity' : 'No activity yet'" empty-message="Changes to records you can access will appear here. Try another search or filter." :action-label="filtersActive ? 'Clear filters' : undefined" @action="clear" @retry="load">
        <div v-if="visible.length" class="ws-table-wrap">
          <table class="ws-table">
            <thead><tr><th scope="col">When</th><th scope="col">User</th><th scope="col">Module</th><th scope="col">Action</th><th scope="col">Reference</th><th scope="col">Details</th></tr></thead>
            <tbody>
              <tr v-for="event in visible" :key="event.id">
                <td class="ws-nowrap"><time :datetime="event.at">{{ timestamp.format(new Date(event.at)) }}</time></td>
                <td class="ws-nowrap">{{ event.user }}</td>
                <td class="ws-nowrap">{{ event.module }}</td>
                <td><span class="ws-badge" :class="{ 'ws-badge--success': event.action === 'Created', 'ws-badge--info': event.action === 'Updated' || event.action === 'Exported', 'ws-badge--danger': event.action === 'Deleted' }">{{ event.action }}</span></td>
                <td><strong>{{ event.reference }}</strong></td>
                <td class="ws-muted">{{ event.details || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="ws-panel__footer">
          <span>Showing {{ visible.length }} of {{ filtered.length }} event{{ filtered.length === 1 ? '' : 's' }}</span>
          <button v-if="visible.length < filtered.length" class="ws-button ws-button--small" type="button" @click="shown += pageSize">Show more</button>
        </div>
        </AppDataState>
      </div>
    </div>
  </section>
</template>
