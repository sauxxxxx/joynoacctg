<script setup lang="ts">
import { computed, ref } from 'vue'
import { AlertTriangle, Download, Info, Printer, RotateCw } from '@lucide/vue'
import { companyDisplayName, companyProfile, isAddOnEnabled, reportingSettings } from '../../company/companyStore'
import type { EntryIssue } from './ledgerMath'
import '../../workspace/workspace.css'
import './reports.css'

const props = defineProps<{
  title: string
  period: string
  loading?: boolean
  error?: string
  issues?: EntryIssue[]
  /** Explains where the numbers come from and any assumption the reader should know. */
  sourceNote?: string
  canExport?: boolean
}>()
const emit = defineEmits<{ generate: []; export: []; retry: [] }>()

const address = computed(() => {
  const profile = companyProfile.value
  return [profile.street, profile.city, profile.province, profile.zipCode].map((part) => part.trim()).filter(Boolean).join(', ')
})
const signatories = computed(() => [
  { role: 'Prepared by', name: reportingSettings.value.preparedBy.trim() },
  { role: 'Reviewed by', name: reportingSettings.value.reviewedBy.trim() },
  { role: 'Approved by', name: reportingSettings.value.approvedBy.trim() },
].filter((item) => item.name))
const exportEnabled = computed(() => isAddOnEnabled('report-csv-export'))
const stamp = () => new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
const generatedAt = ref(stamp())

function generate() {
  generatedAt.value = stamp()
  emit('generate')
}

function print() {
  window.print()
}
</script>

<template>
  <section class="ws-page acct-report" :aria-label="title">
    <div class="ws-stack">
      <p v-if="sourceNote" class="ws-note acct-report__screen-only"><Info :size="14" aria-hidden="true" />{{ sourceNote }}</p>

      <div class="ws-panel acct-report__controls">
        <form class="ws-toolbar" @submit.prevent="generate">
          <slot name="filters" />
          <button class="ws-button ws-button--primary" type="submit" :disabled="loading">Generate</button>
          <span class="ws-toolbar__spacer" />
          <button v-if="exportEnabled" class="ws-button" type="button" :disabled="!canExport" @click="emit('export')"><Download :size="15" aria-hidden="true" /> Export CSV</button>
          <button class="ws-button" type="button" :disabled="!canExport" @click="print"><Printer :size="15" aria-hidden="true" /> Print</button>
          <slot name="filter-error" />
        </form>
      </div>

      <div v-if="loading" class="ws-panel"><div class="ws-loading" role="status"><span class="ws-spinner" aria-hidden="true" />Loading ledger…</div></div>
      <div v-else-if="error" class="ws-panel">
        <div class="ws-empty" role="alert">
          <span class="ws-empty__icon"><AlertTriangle :size="22" aria-hidden="true" /></span>
          <strong>The report could not be generated</strong><span>{{ error }}</span>
          <button class="ws-button" type="button" @click="emit('retry')"><RotateCw :size="15" aria-hidden="true" /> Try again</button>
        </div>
      </div>
      <template v-else>
        <div v-if="issues?.length" class="ws-alert ws-alert--danger acct-report__screen-only" role="alert">
          <AlertTriangle :size="16" aria-hidden="true" />
          <div>
            <strong>{{ issues.length }} posted {{ issues.length === 1 ? 'entry needs' : 'entries need' }} attention.</strong> Totals may not balance until the journal is corrected.
            <ul><li v-for="issue in issues.slice(0, 5)" :key="`${issue.entryNumber}-${issue.message}`">{{ issue.entryNumber }} {{ issue.message }}</li></ul>
          </div>
        </div>
        <slot name="summary" />
        <article class="ws-panel acct-doc">
          <header class="acct-doc__header">
            <p v-if="companyDisplayName" class="acct-doc__company">{{ companyDisplayName }}</p>
            <p v-else class="acct-doc__company acct-doc__company--missing acct-report__screen-only">Company name not set · add it in Company › Profile</p>
            <p v-if="companyProfile.tin || address" class="acct-doc__meta">
              <span v-if="companyProfile.tin">TIN {{ companyProfile.tin }}</span><span v-if="address">{{ address }}</span>
            </p>
            <h2 class="acct-doc__title">{{ title }}</h2>
            <p class="acct-doc__period">{{ period }}</p>
          </header>
          <div class="acct-doc__body"><slot /></div>
          <footer class="acct-doc__footer">
            <div v-if="signatories.length" class="acct-doc__signatories">
              <div v-for="item in signatories" :key="item.role"><span class="acct-doc__line" /><strong>{{ item.name }}</strong><small>{{ item.role }}</small></div>
            </div>
            <p v-if="reportingSettings.footerNote.trim()" class="acct-doc__note">{{ reportingSettings.footerNote }}</p>
            <p class="acct-doc__generated">Generated {{ generatedAt }}</p>
          </footer>
        </article>
      </template>
    </div>
  </section>
</template>
