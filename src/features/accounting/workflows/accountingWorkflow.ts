import { ref } from 'vue'
import type { JournalPreviewEntry, JournalPreviewKind } from '../journals/journalPreviewData'
import { journalLineTotals, type PurchaseJournalLine } from '../journals/purchaseJournalData'

export type WorkflowAction = 'created' | 'posted' | 'voided' | 'transferred'

export interface WorkflowAuditEvent {
  id: string
  at: string
  action: WorkflowAction
  entityId: string
  sourceKey: string
  message: string
}

export interface CreateJournalInput {
  kind: JournalPreviewKind
  sourceKey: string
  referenceNumber: string
  date: string
  party: string
  remarks: string
  lines: PurchaseJournalLine[]
}

export interface GeneratedJournal extends JournalPreviewEntry {
  kind: JournalPreviewKind
  sourceKey: string
}

export const generatedJournals = ref<GeneratedJournal[]>([])
export const workflowAuditEvents = ref<WorkflowAuditEvent[]>([])

function audit(action: WorkflowAction, entry: { id: string; sourceKey?: string }, message: string) {
  workflowAuditEvents.value.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), action, entityId: entry.id, sourceKey: entry.sourceKey ?? `journal:${entry.id}`, message })
}

export function recordWorkflowAction(entry: { id: string; sourceKey?: string }, action: WorkflowAction, message: string) { audit(action, entry, message) }

function assertBalanced(lines: PurchaseJournalLine[]) {
  if (lines.length < 2) throw new Error('A journal entry requires at least two accounting lines.')
  const totals = journalLineTotals(lines)
  if (totals.debitCents <= 0 || totals.debitCents !== totals.creditCents) throw new Error('Debits and credits must be positive and balanced.')
}

export function createPostedJournal(input: CreateJournalInput): { entry: GeneratedJournal; created: boolean } {
  const existing = generatedJournals.value.find((entry) => entry.sourceKey === input.sourceKey)
  if (existing) return { entry: existing, created: false }
  assertBalanced(input.lines)
  const total = journalLineTotals(input.lines).debitCents
  const sequence = generatedJournals.value.filter((entry) => entry.kind === input.kind).length + 1
  const entry: GeneratedJournal = {
    id: crypto.randomUUID(), kind: input.kind, sourceKey: input.sourceKey,
    journalNumber: String(sequence), referenceNumber: input.referenceNumber, date: input.date,
    party: input.party, amountCents: total, status: 'Posted', remarks: input.remarks,
    createdBy: 'Current session', lines: input.lines,
  }
  generatedJournals.value.push(entry)
  audit('created', entry, `Created ${input.kind} entry for ${input.referenceNumber || input.sourceKey}.`)
  audit('posted', entry, 'Posted after balance and duplicate checks passed.')
  return { entry, created: true }
}

export function createPostedJournals(inputs: CreateJournalInput[]) {
  const sourceKeys = new Set<string>()
  for (const input of inputs) {
    if (sourceKeys.has(input.sourceKey)) throw new Error('The selection contains a duplicate source record.')
    sourceKeys.add(input.sourceKey)
    assertBalanced(input.lines)
  }
  return inputs.map(createPostedJournal)
}

export function transitionJournalEntry(entry: JournalPreviewEntry, action: 'post' | 'void'): JournalPreviewEntry {
  if (action === 'post') {
    if (entry.status !== 'Draft') throw new Error('Only draft journal entries can be posted.')
    assertBalanced(entry.lines)
    const posted = { ...entry, status: 'Posted' } as JournalPreviewEntry
    audit('posted', entry, 'Journal draft posted.')
    return posted
  }
  if (entry.status !== 'Posted') throw new Error('Only posted journal entries can be voided.')
  const voided = { ...entry, status: 'Voided' } as JournalPreviewEntry
  audit('voided', entry, 'Posted journal entry voided; original lines preserved.')
  return voided
}

export function transferJournalEntry(sourceKey: string, message: string) {
  const entry = generatedJournals.value.find((item) => item.sourceKey === sourceKey)
  if (entry) audit('transferred', entry, message)
}
