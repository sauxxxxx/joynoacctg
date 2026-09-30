<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Info, List, Search, X } from '@lucide/vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { accountMappings, recordAudit, recordingSettings, type AccountMapping, type RecordingSettings } from './companyStore'
import { toOptions } from './recordConfig'
import SaveBar from './SaveBar.vue'
import SubNavLayout from './SubNavLayout.vue'
import { useSettingsDraft } from './useSettingsDraft'
import '../workspace/workspace.css'
import './company.css'

type Section = 'general' | 'mapping'
const sections: { id: Section; label: string; icon: typeof Info }[] = [
  { id: 'general', label: 'General', icon: Info },
  { id: 'mapping', label: 'Account Mapping', icon: List },
]
const section = ref<Section>('general')

// Only the option shown in the legacy screen is offered until the other choices are confirmed.
const journalUsageOptions = toOptions(['All invoices'])
const journalUsageMeaning: Record<string, string> = {
  'All invoices': 'Sales Journal and Purchase Journal are used for all recorded invoices, while the Cash Receipt Journal is used for recorded receipts and collections, and the Cash Disbursement Journal for recorded payments.',
}
const monthOptions = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: new Intl.DateTimeFormat('en-PH', { month: 'long' }).format(new Date(2024, index, 1)) }))
const thisYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 8 }, (_, index) => String(thisYear - index)).map((year) => ({ value: year, label: year }))

function validate(draft: RecordingSettings): string {
  if (!draft.journalUsage) return 'Choose when to use the Sales Journal and Purchase Journal.'
  if (Boolean(draft.closeMonth) !== Boolean(draft.closeYear)) return 'Choose both the month and the year to close the books.'
  return ''
}
const { draft, error, notice, dirty, save, discard } = useSettingsDraft(recordingSettings, 'Recording settings', validate)
const closedThrough = computed(() => draft.value.closeMonth && draft.value.closeYear
  ? new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(Number(draft.value.closeYear), Number(draft.value.closeMonth), 0))
  : '')

// Account mapping edits apply immediately, one row at a time.
const mappingSearch = ref('')
const mappingDialog = ref<HTMLDialogElement | null>(null)
const mappingInput = ref<HTMLInputElement | null>(null)
const editing = ref<AccountMapping | null>(null)
const accountDraft = ref('')
const mappingError = ref('')
const mappingNotice = ref('')
const visibleMappings = computed(() => {
  const term = mappingSearch.value.trim().toLocaleLowerCase()
  return accountMappings.value.filter((row) => !term || `${row.label} ${row.account} ${row.description}`.toLocaleLowerCase().includes(term))
})

function editMapping(row: AccountMapping) {
  editing.value = row
  accountDraft.value = row.account
  mappingError.value = ''
  mappingDialog.value?.showModal()
  nextTick(() => mappingInput.value?.focus())
}

function saveMapping() {
  const row = editing.value
  const account = accountDraft.value.trim()
  if (!row) return
  if (!account) { mappingError.value = 'Enter the account to use.'; return }
  accountMappings.value = accountMappings.value.map((item) => item.id === row.id ? { ...item, account } : item)
  recordAudit('Company', 'Updated', `Account mapping: ${row.label}`, `${row.account} → ${account}`)
  mappingNotice.value = `${row.label} now uses ${account}.`
  mappingDialog.value?.close()
}
</script>

<template>
  <section class="ws-page co-page" aria-label="Recording">
    <div class="ws-stack">
      <SubNavLayout v-model="section" :items="sections" label="Recording sections">
        <div v-if="section === 'general'" class="ws-stack">
          <p v-if="notice && !dirty" class="ws-notice" role="status">{{ notice }}</p>
          <div class="ws-panel co-card">
            <h2 class="co-card__title">When to use Sales Journal and Purchase Journal?</h2>
            <div class="co-card__narrow"><AppSelect id="recording-journal-usage" v-model="draft.journalUsage" label="When to use SJ and PJ" required :options="journalUsageOptions" /></div>
            <p v-if="journalUsageMeaning[draft.journalUsage]" class="co-callout"><span><strong>This setting means:</strong> {{ journalUsageMeaning[draft.journalUsage] }}</span></p>
          </div>
          <div class="ws-panel co-card">
            <h2 class="co-card__title">Close Accounting Book as of</h2>
            <div class="ws-form">
              <div class="ws-field"><AppSelect id="recording-close-month" v-model="draft.closeMonth" label="Month" placeholder="Select month" :options="monthOptions" /></div>
              <div class="ws-field"><AppSelect id="recording-close-year" v-model="draft.closeYear" label="Year" placeholder="Select year" :options="yearOptions" /></div>
            </div>
            <p class="co-card__hint">{{ closedThrough ? `Entries dated on or before ${closedThrough} are locked for the journal module.` : 'Leave blank to keep all periods open.' }}</p>
          </div>
          <div class="ws-panel ws-panel--clip">
            <div class="ws-panel__header"><h2>Year end Closing Entries</h2></div>
            <table class="ws-table co-list">
              <thead><tr><th scope="col">Year</th><th scope="col">Entry</th><th scope="col">Notes</th></tr></thead>
              <tbody>
                <tr v-for="entry in draft.closingEntries" :key="entry.id"><td>{{ entry.year }}</td><td>{{ entry.entry }}</td><td>{{ entry.notes }}</td></tr>
                <tr v-if="!draft.closingEntries.length" class="co-list__empty"><td colspan="3"><strong>No rows to show</strong><span>Closing entries appear here after a year is closed in Accounting.</span></td></tr>
              </tbody>
            </table>
          </div>
          <SaveBar :dirty="dirty" :error="error" @save="save" @discard="discard" />
        </div>

        <div v-else class="ws-stack">
          <p class="ws-note"><Info :size="14" aria-hidden="true" />Accounts are names for now. They will be picked from Accounting › Chart of Accounts once it is available.</p>
          <p v-if="mappingNotice" class="ws-notice" role="status">{{ mappingNotice }}</p>
          <div class="ws-panel ws-panel--clip">
            <div class="ws-panel__header">
              <h2>Account Mapping</h2>
              <div class="ws-panel__actions"><label class="ws-search"><Search :size="16" aria-hidden="true" /><input v-model="mappingSearch" type="search" placeholder="Type to filter" aria-label="Search account mapping" /></label></div>
            </div>
            <div class="ws-table-wrap">
              <table class="ws-table co-list">
                <thead><tr><th scope="col">Label</th><th scope="col">Account</th><th scope="col">Description</th></tr></thead>
                <tbody>
                  <tr v-for="row in visibleMappings" :key="row.id" class="co-list__row" @click="editMapping(row)">
                    <td><button class="co-list__link" type="button" :aria-label="`Change account for ${row.label}`" @click.stop="editMapping(row)">{{ row.label }}</button></td>
                    <td>{{ row.account }}</td>
                    <td class="ws-muted">{{ row.description }}</td>
                  </tr>
                  <tr v-if="!visibleMappings.length" class="co-list__empty"><td colspan="3"><strong>No rows to show</strong><span>Try another search.</span></td></tr>
                </tbody>
                <tfoot><tr><td colspan="3">{{ visibleMappings.length }}</td></tr></tfoot>
              </table>
            </div>
          </div>
        </div>
      </SubNavLayout>
    </div>

    <dialog ref="mappingDialog" class="ws-dialog" aria-labelledby="mapping-dialog-title" @close="editing = null">
      <form novalidate @submit.prevent="saveMapping">
        <div class="ws-dialog__header"><h2 id="mapping-dialog-title">{{ editing?.label }}</h2><button class="ws-icon-button" type="button" aria-label="Close" @click="mappingDialog?.close()"><X :size="18" aria-hidden="true" /></button></div>
        <div class="ws-dialog__body">
          <p>{{ editing?.description }}</p>
          <label class="ws-field"><span>Account<em> *</em></span><input ref="mappingInput" v-model="accountDraft" maxlength="160" /></label>
          <p v-if="mappingError" class="ws-form-error" role="alert">{{ mappingError }}</p>
        </div>
        <div class="ws-dialog__footer"><button class="ws-button" type="button" @click="mappingDialog?.close()">Cancel</button><button class="ws-button ws-button--primary" type="submit">Save</button></div>
      </form>
    </dialog>
  </section>
</template>
