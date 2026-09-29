<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Download, FileClock, Info, Search } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { downloadCsv } from '../accounting/reports/reportFormat'
import { auditEvents, isAddOnEnabled, recordAudit } from './companyStore'
import '../workspace/workspace.css'
import './company.css'

const pageSize = 50
const search = ref('')
const module = ref('')
const action = ref('')
const from = ref('')
const to = ref('')
const shown = ref(pageSize)

const localDay = (iso: string) => {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const timestamp = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'medium' })
const distinct = (key: 'module' | 'action') => [...new Set(auditEvents.value.map((event) => event[key]))].sort()
const moduleOptions = computed(() => [{ value: '', label: 'All modules' }, ...distinct('module').map((value) => ({ value, label: value }))])
const actionOptions = computed(() => [{ value: '', label: 'All actions' }, ...distinct('action').map((value) => ({ value, label: value }))])
const rangeError = computed(() => from.value && to.value && from.value > to.value ? 'The end date must be on or after the start date.' : '')

const filtered = computed(() => {
  if (rangeError.value) return []
  const term = search.value.trim().toLocaleLowerCase()
  return auditEvents.value.filter((event) => {
    const day = localDay(event.at)
    if (module.value && event.module !== module.value) return false
    if (action.value && event.action !== action.value) return false
    if (from.value && day < from.value) return false
    if (to.value && day > to.value) return false
    return !term || `${event.user} ${event.reference} ${event.details}`.toLocaleLowerCase().includes(term)
  })
})
const visible = computed(() => filtered.value.slice(0, shown.value))
const filtersActive = computed(() => Boolean(search.value || module.value || action.value || from.value || to.value))
watch([search, module, action, from, to], () => { shown.value = pageSize })

function clear() {
  search.value = ''
  module.value = ''
  action.value = ''
  from.value = ''
  to.value = ''
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
      <p class="co-intro">A record of changes made in Sales, Company, and report exports during this session, newest first.</p>
      <p class="ws-note"><Info :size="14" aria-hidden="true" />Events are kept in this tab until the backend is connected. There is no sign-in yet, so the user is shown as “Preview session”.</p>

      <div class="ws-panel ws-panel--clip">
        <div class="ws-toolbar">
          <label class="ws-search"><Search :size="16" aria-hidden="true" /><input v-model="search" type="search" placeholder="Search reference or details" aria-label="Search audit trail" /></label>
          <div class="ws-toolbar__field"><AppSelect id="audit-module" v-model="module" aria-label="Module" :options="moduleOptions" /></div>
          <div class="ws-toolbar__field"><AppSelect id="audit-action" v-model="action" aria-label="Action" :options="actionOptions" /></div>
          <div class="ws-toolbar__field"><AppDatePicker id="audit-from" v-model="from" label="From" :invalid="Boolean(rangeError)" /></div>
          <div class="ws-toolbar__field"><AppDatePicker id="audit-to" v-model="to" label="To" :invalid="Boolean(rangeError)" /></div>
          <span class="ws-toolbar__spacer" />
          <button v-if="isAddOnEnabled('report-csv-export')" class="ws-button" type="button" :disabled="!filtered.length" @click="exportCsv"><Download :size="15" aria-hidden="true" /> Export CSV</button>
          <p v-if="rangeError" class="ws-toolbar__error" role="alert">{{ rangeError }}</p>
        </div>

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
        <div v-else class="ws-empty">
          <span class="ws-empty__icon"><FileClock :size="22" aria-hidden="true" /></span>
          <strong>{{ auditEvents.length ? 'No events match' : 'No activity yet' }}</strong>
          <span>{{ auditEvents.length ? 'Try other filters.' : 'Changes to Sales and Company records, settings, and report exports will appear here.' }}</span>
          <button v-if="filtersActive" class="ws-button" type="button" @click="clear">Clear filters</button>
        </div>
        <div class="ws-panel__footer">
          <span>Showing {{ visible.length }} of {{ filtered.length }} event{{ filtered.length === 1 ? '' : 's' }}</span>
          <button v-if="visible.length < filtered.length" class="ws-button ws-button--small" type="button" @click="shown += pageSize">Show more</button>
        </div>
      </div>
    </div>
  </section>
</template>
