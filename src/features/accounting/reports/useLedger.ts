import { computed, shallowRef, watch } from 'vue'
import type { LedgerAccount, LedgerEntry, LedgerSource } from './ledgerContract'
import { findEntryIssues, postedLines, sortAccounts } from './ledgerMath'
import { todayIso } from './reportPeriods'
import { createSampleLedgerSource } from './sampleLedger'
import { liveLedger } from './liveLedger'
import { isPreviewMode } from '../../../services/api/config'
import { getApiCredentials, onSessionReset } from '../../../services/api/session'
import { onDataChanged } from '../../../services/api/dataEvents'

/** Real posted journals in the application; sample data only in isolated tests. */
let source: LedgerSource = isPreviewMode ? createSampleLedgerSource(todayIso()) : liveLedger

export function setLedgerSource(next: LedgerSource) {
  source = next
  state.value = { status: 'idle' }
}

type LedgerState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; accounts: LedgerAccount[]; entries: LedgerEntry[] }
  | { status: 'error'; message: string }

const state = shallowRef<LedgerState>({ status: 'idle' })
let pending: Promise<void> | null = null
let generation = 0
onSessionReset(() => { generation += 1; pending = null; state.value = { status: 'idle' } })
onDataChanged((resource) => { if (/^\/(journal-entries|sales-documents|purchases|bank-transactions|accounts|account-categories|settings|company\/report template)/.test(resource)) { generation += 1; pending = null; state.value = { status: 'idle' } } })

async function load(force = false) {
  if (pending) return pending
  if (!force && state.value.status === 'ready') return
  const current = generation
  state.value = { status: 'loading' }
  pending = (async () => {
    try {
      const [accounts, entries] = await Promise.all([source.loadAccounts(), source.loadEntries()])
      if (current !== generation) return
      state.value = { status: 'ready', accounts: sortAccounts(accounts), entries }
    } catch (error) {
      if (current !== generation) return
      state.value = { status: 'error', message: error instanceof Error ? error.message : 'The ledger could not be loaded.' }
    } finally {
      if (current === generation) pending = null
    }
  })()
  return pending
}

/** Shared, cached ledger data for report and analytics pages. */
export function useLedger() {
  void load()
  watch(() => state.value.status, (status) => {
    if (status === 'idle' && (isPreviewMode || getApiCredentials())) void load()
  }, { flush: 'post' })
  const ready = computed(() => state.value.status === 'ready' ? state.value : null)
  return {
    source: computed(() => source),
    loading: computed(() => state.value.status === 'loading' || state.value.status === 'idle'),
    error: computed(() => state.value.status === 'error' ? state.value.message : ''),
    accounts: computed(() => ready.value?.accounts ?? []),
    lines: computed(() => ready.value ? postedLines(ready.value.entries) : []),
    issues: computed(() => ready.value ? findEntryIssues(ready.value.accounts, ready.value.entries) : []),
    reload: () => load(true),
  }
}
