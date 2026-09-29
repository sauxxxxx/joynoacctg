import { computed, shallowRef } from 'vue'
import type { LedgerAccount, LedgerEntry, LedgerSource } from './ledgerContract'
import { findEntryIssues, postedLines, sortAccounts } from './ledgerMath'
import { todayIso } from './reportPeriods'
import { createSampleLedgerSource } from './sampleLedger'

/**
 * The one place that decides where report data comes from. Replace the sample source
 * with Owner B's journal service adapter once it implements `LedgerSource`.
 */
let source: LedgerSource = createSampleLedgerSource(todayIso())

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

async function load(force = false) {
  if (pending) return pending
  if (!force && state.value.status === 'ready') return
  state.value = { status: 'loading' }
  pending = (async () => {
    try {
      const [accounts, entries] = await Promise.all([source.loadAccounts(), source.loadEntries()])
      state.value = { status: 'ready', accounts: sortAccounts(accounts), entries }
    } catch (error) {
      state.value = { status: 'error', message: error instanceof Error ? error.message : 'The ledger could not be loaded.' }
    } finally {
      pending = null
    }
  })()
  return pending
}

/** Shared, cached ledger data for report and analytics pages. */
export function useLedger() {
  void load()
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
